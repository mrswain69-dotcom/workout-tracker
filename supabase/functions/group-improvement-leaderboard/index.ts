import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import {
  IMPROVEMENT_SCORE_VERSION,
  buildImprovementBaseline,
  getCurrentImprovementWeekWindow,
  getPreviousCompletedImprovementWeekWindows,
  rankImprovementRows,
  scoreImprovementWindow,
  shiftImprovementYmd,
} from "./improvementEngine.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function validYmd(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function londonYmd(value: Date | string | null | undefined = new Date()) {
  const date = value instanceof Date ? value : new Date(value || "");
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function maxYmd(...values: string[]) {
  return values.filter(validYmd).sort().at(-1) || "";
}

function minYmd(...values: string[]) {
  return values.filter(validYmd).sort()[0] || "";
}

function platformKey(jsonName: string, singleName: string, legacyName: string) {
  const single = Deno.env.get(singleName);
  if (single) return single;
  const encoded = Deno.env.get(jsonName);
  if (encoded) {
    try {
      const parsed = JSON.parse(encoded);
      if (parsed?.default) return String(parsed.default);
    } catch {
      // Fall through to the legacy key while projects complete key migration.
    }
  }
  return Deno.env.get(legacyName) || "";
}

function membershipOverlapsWindow(member: any, startDate: string, endDate: string) {
  const joinedDate = londonYmd(member?.joined_at);
  const leftDate = londonYmd(member?.left_at);
  return !!joinedDate && joinedDate <= endDate && (!leftDate || leftDate >= startDate);
}

function memberEligibility(member: any, groupStart: string, window: any) {
  const joinedDate = londonYmd(member?.joined_at);
  const leftDate = londonYmd(member?.left_at);
  return {
    eligibleFrom: maxYmd(window.startDate, groupStart, joinedDate),
    eligibleThrough: minYmd(window.endDate, leftDate) || window.endDate,
  };
}

function safeLiveRow(member: any, score: any) {
  return {
    membership_id: member.id,
    nickname: member.nickname,
    role: member.role,
    avatar_id: member.avatar_id || "",
    avatar_frame: member.avatar_frame || "",
    avatar_frames_enabled: member.avatar_frames_enabled !== false,
    improvementPct:
      score?.improvementPct === null || score?.improvementPct === undefined
        ? null
        : Number(score.improvementPct),
    metricCount: Number(score?.metricCount || 0),
    improvedMetricCount: Number(score?.improvedMetricCount || 0),
    declinedMetricCount: Number(score?.declinedMetricCount || 0),
    unchangedMetricCount: Number(score?.unchangedMetricCount || 0),
    scoreState: score?.reason || "unavailable",
  };
}

function safeFrozenRow(row: any) {
  return {
    membership_id: row.membership_id,
    nickname: row.nickname,
    avatar_id: row.avatar_id || "",
    avatar_frame: row.avatar_frame || "",
    avatar_frames_enabled: row.avatar_frames_enabled !== false,
    improvementPct:
      row.improvement_pct === null || row.improvement_pct === undefined
        ? null
        : Number(row.improvement_pct),
    metricCount: Number(row.metric_count || 0),
    improvedMetricCount: Number(row.improved_metric_count || 0),
    declinedMetricCount: Number(row.declined_metric_count || 0),
    unchangedMetricCount: Number(row.unchanged_metric_count || 0),
    scoreState: row.score_state || "unavailable",
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) return json({ error: "Authentication required" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const publishableKey = platformKey("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY");
    const secretKey = platformKey("SUPABASE_SECRET_KEYS", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !publishableKey || !secretKey) {
      console.error("Group Improvement function is missing required Supabase environment keys.");
      return json({ error: "Improvement service unavailable" }, 503);
    }

    const userClient = createClient(supabaseUrl, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const adminClient = createClient(supabaseUrl, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: authError } = await userClient.auth.getUser(jwt);
    if (authError || !authData?.user) return json({ error: "Authentication required" }, 401);

    const body = await req.json().catch(() => ({}));
    const groupId = typeof body?.groupId === "string" ? body.groupId : "";
    const membershipId = typeof body?.membershipId === "string" ? body.membershipId : "";
    const referenceDate = validYmd(body?.referenceDate) ? body.referenceDate : londonYmd();
    if (!groupId || !membershipId) return json({ error: "Group membership is required" }, 400);

    // Prove the caller belongs to this active Group under their RLS-scoped user context
    // before any privileged cross-family performance reads occur.
    const { data: callerMembership, error: callerMembershipError } = await userClient
      .from("group_memberships")
      .select("id,group_id")
      .eq("id", membershipId)
      .eq("group_id", groupId)
      .eq("status", "active")
      .maybeSingle();
    if (callerMembershipError || !callerMembership) {
      return json({ error: "Active Group membership required" }, 403);
    }

    const { data: group, error: groupError } = await adminClient
      .from("groups")
      .select("id,status,competition_start_date")
      .eq("id", groupId)
      .eq("status", "active")
      .maybeSingle();
    if (groupError || !group) return json({ error: "Group is not active" }, 404);

    const { data: memberships, error: membershipError } = await adminClient
      .from("group_memberships")
      .select("id,profile_id,nickname,role,avatar_id,avatar_frame,avatar_frames_enabled,status,joined_at,left_at")
      .eq("group_id", groupId)
      .order("joined_at", { ascending: true });
    if (membershipError) throw membershipError;

    const allMemberships = memberships || [];
    const activeMembers = allMemberships.filter((member: any) => member.status === "active");
    const profileIds = [...new Set(allMemberships.map((member: any) => member.profile_id).filter(Boolean))];
    const currentWindow = getCurrentImprovementWeekWindow(referenceDate);
    const historyWindows = getPreviousCompletedImprovementWeekWindows(referenceDate, 4);
    const oldestWindow = historyWindows.at(-1) || currentWindow;
    const earliestDate = oldestWindow ? shiftImprovementYmd(oldestWindow.startDate, -28) : referenceDate;
    const latestDate = currentWindow?.endDate || referenceDate;

    let logs: any[] = [];
    let assessmentRuns: any[] = [];
    let assessmentResults: any[] = [];
    let baselineRows: any[] = [];

    if (profileIds.length) {
      const [logsResult, runsResult, baselinesResult] = await Promise.all([
        adminClient
          .from("logs")
          .select("profile_id,date_ymd,log_json")
          .in("profile_id", profileIds)
          .gte("date_ymd", earliestDate)
          .lte("date_ymd", latestDate)
          .order("date_ymd", { ascending: true }),
        adminClient
          .from("assessment_runs")
          .select("id,profile_id,date_ymd,status")
          .in("profile_id", profileIds)
          .eq("status", "completed")
          .gte("date_ymd", earliestDate)
          .lte("date_ymd", latestDate)
          .order("date_ymd", { ascending: true }),
        adminClient
          .from("profile_weekly_improvement_baselines")
          .select("profile_id,week_start,baseline_json")
          .in("profile_id", profileIds)
          .eq("score_version", IMPROVEMENT_SCORE_VERSION),
      ]);
      if (logsResult.error) throw logsResult.error;
      if (runsResult.error) throw runsResult.error;
      if (baselinesResult.error) throw baselinesResult.error;
      logs = logsResult.data || [];
      assessmentRuns = runsResult.data || [];
      baselineRows = baselinesResult.data || [];

      const runIds = assessmentRuns.map((run: any) => run.id).filter(Boolean);
      if (runIds.length) {
        const { data, error } = await adminClient
          .from("assessment_test_results")
          .select("assessment_run_id,test_id,assessment_template_test_id,metric_snapshot,comparable_value,comparable_dimensions,is_valid")
          .in("assessment_run_id", runIds)
          .eq("is_valid", true);
        if (error) throw error;
        assessmentResults = data || [];
      }
    }

    const logsByProfile = new Map<string, any[]>();
    for (const row of logs) {
      const list = logsByProfile.get(row.profile_id) || [];
      list.push({ date_ymd: row.date_ymd, log_json: row.log_json });
      logsByProfile.set(row.profile_id, list);
    }
    const runsByProfile = new Map<string, any[]>();
    const runProfile = new Map<string, string>();
    for (const run of assessmentRuns) {
      runProfile.set(run.id, run.profile_id);
      const list = runsByProfile.get(run.profile_id) || [];
      list.push(run);
      runsByProfile.set(run.profile_id, list);
    }
    const resultsByProfile = new Map<string, any[]>();
    for (const result of assessmentResults) {
      const profileId = runProfile.get(result.assessment_run_id);
      if (!profileId) continue;
      const list = resultsByProfile.get(profileId) || [];
      list.push(result);
      resultsByProfile.set(profileId, list);
    }

    const baselinesByKey = new Map<string, any>();
    for (const row of baselineRows) {
      baselinesByKey.set(`${row.profile_id}:${row.week_start}`, row.baseline_json || {});
    }

    async function baselineFor(profileId: string, window: any) {
      const key = `${profileId}:${window.startDate}`;
      if (baselinesByKey.has(key)) return baselinesByKey.get(key);
      const baseline = buildImprovementBaseline({
        window,
        workoutLogs: logsByProfile.get(profileId) || [],
        assessmentRuns: runsByProfile.get(profileId) || [],
        assessmentResults: resultsByProfile.get(profileId) || [],
      });
      const { error } = await adminClient
        .from("profile_weekly_improvement_baselines")
        .upsert({
          profile_id: profileId,
          week_start: window.startDate,
          baseline_json: baseline,
          score_version: IMPROVEMENT_SCORE_VERSION,
        }, {
          onConflict: "profile_id,week_start,score_version",
          ignoreDuplicates: true,
        });
      if (error) throw error;
      baselinesByKey.set(key, baseline);
      return baseline;
    }

    const groupStart = String(group.competition_start_date || referenceDate);
    let current: any = null;
    if (currentWindow) {
      const rows = [];
      for (const member of activeMembers) {
        const eligibility = memberEligibility(member, groupStart, currentWindow);
        const baselineMetrics = await baselineFor(member.profile_id, currentWindow);
        const score = scoreImprovementWindow({
          window: currentWindow,
          referenceDate,
          eligibleFrom: eligibility.eligibleFrom,
          eligibleThrough: eligibility.eligibleThrough,
          workoutLogs: logsByProfile.get(member.profile_id) || [],
          assessmentRuns: runsByProfile.get(member.profile_id) || [],
          assessmentResults: resultsByProfile.get(member.profile_id) || [],
          baselineMetrics,
        });
        rows.push(safeLiveRow(member, score));
      }
      current = {
        startDate: currentWindow.startDate,
        endDate: currentWindow.endDate,
        baselineStart: shiftImprovementYmd(currentWindow.startDate, -28),
        baselineEnd: shiftImprovementYmd(currentWindow.startDate, -1),
        state: "live",
        available: groupStart <= currentWindow.endDate,
        rows: rankImprovementRows(rows),
      };
    }

    const history: any[] = [];
    for (const window of historyWindows) {
      if (groupStart > window.endDate) {
        history.push({ startDate: window.startDate, endDate: window.endDate, state: "not_started", available: false, rows: [] });
        continue;
      }

      const historyMembers = allMemberships.filter((member: any) => membershipOverlapsWindow(member, window.startDate, window.endDate));
      const { data: existing, error: existingError } = await adminClient
        .from("group_weekly_improvement_results")
        .select("membership_id,nickname,avatar_id,avatar_frame,avatar_frames_enabled,improvement_pct,metric_count,improved_metric_count,declined_metric_count,unchanged_metric_count,score_state")
        .eq("group_id", groupId)
        .eq("week_start", window.startDate)
        .eq("score_version", IMPROVEMENT_SCORE_VERSION);
      if (existingError) throw existingError;

      const existingIds = new Set((existing || []).map((row: any) => row.membership_id));
      const inserts: any[] = [];
      for (const member of historyMembers) {
        if (existingIds.has(member.id)) continue;
        const eligibility = memberEligibility(member, groupStart, window);
        if (!eligibility.eligibleFrom || eligibility.eligibleFrom > eligibility.eligibleThrough) continue;
        const baselineMetrics = await baselineFor(member.profile_id, window);
        const score = scoreImprovementWindow({
          window,
          referenceDate: window.endDate,
          eligibleFrom: eligibility.eligibleFrom,
          eligibleThrough: eligibility.eligibleThrough,
          workoutLogs: logsByProfile.get(member.profile_id) || [],
          assessmentRuns: runsByProfile.get(member.profile_id) || [],
          assessmentResults: resultsByProfile.get(member.profile_id) || [],
          baselineMetrics,
        });
        inserts.push({
          group_id: groupId,
          membership_id: member.id,
          week_start: window.startDate,
          week_end: window.endDate,
          eligible_from: eligibility.eligibleFrom,
          eligible_through: eligibility.eligibleThrough,
          improvement_pct: score.improvementPct,
          metric_count: score.metricCount,
          improved_metric_count: score.improvedMetricCount,
          declined_metric_count: score.declinedMetricCount,
          unchanged_metric_count: score.unchangedMetricCount,
          score_state: score.reason,
          score_version: IMPROVEMENT_SCORE_VERSION,
          nickname: member.nickname,
          avatar_id: member.avatar_id || "",
          avatar_frame: member.avatar_frame || "",
          avatar_frames_enabled: member.avatar_frames_enabled !== false,
        });
      }

      if (inserts.length) {
        const { error: insertError } = await adminClient
          .from("group_weekly_improvement_results")
          .upsert(inserts, {
            onConflict: "group_id,membership_id,week_start,score_version",
            ignoreDuplicates: true,
          });
        if (insertError) throw insertError;
      }

      const { data: frozenRows, error: frozenError } = await adminClient
        .from("group_weekly_improvement_results")
        .select("membership_id,nickname,avatar_id,avatar_frame,avatar_frames_enabled,improvement_pct,metric_count,improved_metric_count,declined_metric_count,unchanged_metric_count,score_state")
        .eq("group_id", groupId)
        .eq("week_start", window.startDate)
        .eq("score_version", IMPROVEMENT_SCORE_VERSION);
      if (frozenError) throw frozenError;

      history.push({
        startDate: window.startDate,
        endDate: window.endDate,
        baselineStart: shiftImprovementYmd(window.startDate, -28),
        baselineEnd: shiftImprovementYmd(window.startDate, -1),
        state: "frozen",
        available: true,
        rows: rankImprovementRows((frozenRows || []).map(safeFrozenRow)),
      });
    }

    return json({
      scoreVersion: IMPROVEMENT_SCORE_VERSION,
      baselineDays: 28,
      competitionStartDate: groupStart,
      current,
      history,
    });
  } catch (error) {
    console.error("Group Improvement failure", error);
    return json({ error: "Could not calculate Group Improvement" }, 500);
  }
});
