import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import { buildXpDebugRows, sumXpRowsInRange } from "./xpEngine.js";
import { scoreConsistencyWindow } from "./consistencyEngine.js";
import {
  IMPROVEMENT_SCORE_VERSION,
  buildImprovementBaseline,
  scoreImprovementWindow,
  shiftImprovementYmd,
} from "./improvementEngine.js";
import {
  GROUP_PERIOD_SCORE_VERSION,
  addGroupPeriodRanks,
  buildGroupProgressAwards,
  getCurrentGroupSeasonWindow,
  getGroupMonthWindow,
  getPreviousCompletedGroupMonthWindows,
  getPreviousCompletedGroupSeasonWindows,
} from "./groupPeriodEngine.js";

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

function membershipOverlaps(member: any, startDate: string, endDate: string) {
  const joinedDate = londonYmd(member?.joined_at);
  const leftDate = londonYmd(member?.left_at);
  return !!joinedDate && joinedDate <= endDate && (!leftDate || leftDate >= startDate);
}

function memberBounds(member: any, groupStart: string, period: any, referenceDate: string, live: boolean) {
  const joinedDate = londonYmd(member?.joined_at);
  const leftDate = londonYmd(member?.left_at);
  const eligibleFrom = maxYmd(period.startDate, groupStart, joinedDate);
  const eligibleThrough = live
    ? minYmd(period.endDate, referenceDate, leftDate) || minYmd(period.endDate, referenceDate) || period.endDate
    : minYmd(period.endDate, leftDate) || period.endDate;
  return { eligibleFrom, eligibleThrough };
}

function safeImprovementValue(score: any) {
  const raw = score?.improvementPct;
  if (raw === null || raw === undefined || raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function frozenRow(row: any) {
  return {
    membership_id: row.membership_id,
    nickname: row.nickname,
    avatar_id: row.avatar_id || "",
    avatar_frame: row.avatar_frame || "",
    avatar_frames_enabled: row.avatar_frames_enabled !== false,
    xp: Number(row.xp || 0),
    plannedDays: Number(row.planned_days || 0),
    completedDays: Number(row.completed_days || 0),
    consistencyPct: row.consistency_pct === null || row.consistency_pct === undefined ? null : Number(row.consistency_pct),
    consistencyState: row.consistency_state || "schedule_unavailable",
    improvementPct: row.improvement_pct === null || row.improvement_pct === undefined ? null : Number(row.improvement_pct),
    improvementMetricCount: Number(row.improvement_metric_count || 0),
    improvementState: row.improvement_state || "no_comparable_baseline",
  };
}

function awardRow(row: any) {
  return {
    membership_id: row.membership_id,
    awardType: row.award_type,
    periodType: row.period_type,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    seasonNumber: row.season_number,
    rank: row.rank,
    scoreValue: row.score_value === null || row.score_value === undefined ? null : Number(row.score_value),
    scoreUnit: row.score_unit,
    nickname: row.nickname,
    avatar_id: row.avatar_id || "",
    avatar_frame: row.avatar_frame || "",
    avatar_frames_enabled: row.avatar_frames_enabled !== false,
    awardedAt: row.awarded_at,
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
      console.error("Group Seasons & Awards function is missing required Supabase environment keys.");
      return json({ error: "Seasons service unavailable" }, 503);
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

    // Security boundary: prove the exact caller-owned active membership under RLS
    // before any privileged cross-family competition reads are made.
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

    const groupStart = String(group.competition_start_date || referenceDate);
    const currentMonth = getGroupMonthWindow(referenceDate);
    const monthHistory = getPreviousCompletedGroupMonthWindows(referenceDate, 3);
    const currentSeason = getCurrentGroupSeasonWindow(groupStart, referenceDate);
    const seasonHistory = getPreviousCompletedGroupSeasonWindows(groupStart, referenceDate, 2);

    const { data: memberships, error: membershipError } = await adminClient
      .from("group_memberships")
      .select("id,profile_id,nickname,role,avatar_id,avatar_frame,avatar_frames_enabled,status,joined_at,left_at")
      .eq("group_id", groupId)
      .order("joined_at", { ascending: true });
    if (membershipError) throw membershipError;

    const allMemberships = memberships || [];
    const activeMembers = allMemberships.filter((member: any) => member.status === "active");
    const profileIds = [...new Set(allMemberships.map((member: any) => member.profile_id).filter(Boolean))];

    const allPeriods = [currentMonth, ...monthHistory, currentSeason, ...seasonHistory].filter(Boolean);
    const oldestPeriodStart = allPeriods.map((period: any) => period.startDate).filter(validYmd).sort()[0] || referenceDate;
    const improvementEarliest = shiftImprovementYmd(oldestPeriodStart, -28);

    let profiles: any[] = [];
    let logs: any[] = [];
    let assessmentRuns: any[] = [];
    let assessmentResults: any[] = [];
    let scheduleRows: any[] = [];
    let baselineRows: any[] = [];

    if (profileIds.length) {
      const [profilesResult, logsResult, runsResult, schedulesResult, baselinesResult] = await Promise.all([
        adminClient.from("profiles").select("id,plan_json").in("id", profileIds),
        // XP is authoritative over the full ledger, so do not truncate old log history here.
        adminClient.from("logs").select("profile_id,date_ymd,log_json").in("profile_id", profileIds).lte("date_ymd", referenceDate).order("date_ymd", { ascending: true }),
        adminClient.from("assessment_runs").select("id,profile_id,date_ymd,status").in("profile_id", profileIds).eq("status", "completed").gte("date_ymd", improvementEarliest).lte("date_ymd", referenceDate).order("date_ymd", { ascending: true }),
        adminClient.from("profile_consistency_schedule_snapshots").select("profile_id,effective_date,schedule_json").in("profile_id", profileIds).lte("effective_date", referenceDate).order("effective_date", { ascending: true }),
        adminClient.from("profile_period_improvement_baselines").select("profile_id,period_type,period_start,baseline_json").in("profile_id", profileIds).eq("score_version", IMPROVEMENT_SCORE_VERSION),
      ]);
      if (profilesResult.error) throw profilesResult.error;
      if (logsResult.error) throw logsResult.error;
      if (runsResult.error) throw runsResult.error;
      if (schedulesResult.error) throw schedulesResult.error;
      if (baselinesResult.error) throw baselinesResult.error;
      profiles = profilesResult.data || [];
      logs = logsResult.data || [];
      assessmentRuns = runsResult.data || [];
      scheduleRows = schedulesResult.data || [];
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

    const planByProfile = new Map(profiles.map((profile: any) => [profile.id, profile.plan_json || {}]));
    const logsByProfile = new Map<string, any[]>();
    for (const row of logs) {
      const list = logsByProfile.get(row.profile_id) || [];
      list.push({ date_ymd: row.date_ymd, log: row.log_json, log_json: row.log_json });
      logsByProfile.set(row.profile_id, list);
    }

    const schedulesByProfile = new Map<string, any[]>();
    for (const row of scheduleRows) {
      const list = schedulesByProfile.get(row.profile_id) || [];
      list.push({ effective_date: row.effective_date, schedule_json: row.schedule_json });
      schedulesByProfile.set(row.profile_id, list);
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

    const ledgerByMembership = new Map<string, any[]>();
    for (const member of allMemberships) {
      ledgerByMembership.set(
        member.id,
        buildXpDebugRows(logsByProfile.get(member.profile_id) || [], planByProfile.get(member.profile_id) || {})
      );
    }

    const baselinesByKey = new Map<string, any>();
    for (const row of baselineRows) {
      baselinesByKey.set(`${row.profile_id}:${row.period_type}:${row.period_start}`, row.baseline_json || {});
    }

    async function baselineFor(profileId: string, periodType: string, period: any) {
      const key = `${profileId}:${periodType}:${period.startDate}`;
      if (baselinesByKey.has(key)) return baselinesByKey.get(key);
      const baseline = buildImprovementBaseline({
        window: period,
        workoutLogs: logsByProfile.get(profileId) || [],
        assessmentRuns: runsByProfile.get(profileId) || [],
        assessmentResults: resultsByProfile.get(profileId) || [],
      });
      const { error } = await adminClient
        .from("profile_period_improvement_baselines")
        .upsert({
          profile_id: profileId,
          period_type: periodType,
          period_start: period.startDate,
          baseline_json: baseline,
          score_version: IMPROVEMENT_SCORE_VERSION,
        }, {
          onConflict: "profile_id,period_type,period_start,score_version",
          ignoreDuplicates: true,
        });
      if (error) throw error;
      baselinesByKey.set(key, baseline);
      return baseline;
    }

    async function scoreMember(member: any, periodType: string, period: any, live: boolean) {
      const bounds = memberBounds(member, groupStart, period, referenceDate, live);
      if (!bounds.eligibleFrom || !bounds.eligibleThrough || bounds.eligibleFrom > bounds.eligibleThrough) {
        return {
          membership_id: member.id,
          nickname: member.nickname,
          role: member.role,
          avatar_id: member.avatar_id || "",
          avatar_frame: member.avatar_frame || "",
          avatar_frames_enabled: member.avatar_frames_enabled !== false,
          xp: 0,
          plannedDays: 0,
          completedDays: 0,
          consistencyPct: null,
          consistencyState: "not_started",
          improvementPct: null,
          improvementMetricCount: 0,
          improvementState: "not_started",
          eligibleFrom: bounds.eligibleFrom || period.startDate,
          eligibleThrough: bounds.eligibleThrough || period.endDate,
        };
      }

      const xp = sumXpRowsInRange(
        ledgerByMembership.get(member.id) || [],
        bounds.eligibleFrom,
        bounds.eligibleThrough,
        bounds.eligibleFrom
      );

      const consistency = scoreConsistencyWindow({
        window: { ...period, complete: !live },
        referenceDate: live ? referenceDate : period.endDate,
        eligibleFrom: bounds.eligibleFrom,
        eligibleThrough: bounds.eligibleThrough,
        scheduleSnapshots: schedulesByProfile.get(member.profile_id) || [],
        logs: logsByProfile.get(member.profile_id) || [],
      });

      const baselineMetrics = await baselineFor(member.profile_id, periodType, period);
      const improvement = scoreImprovementWindow({
        window: { ...period, complete: !live },
        referenceDate: live ? referenceDate : period.endDate,
        eligibleFrom: bounds.eligibleFrom,
        eligibleThrough: bounds.eligibleThrough,
        workoutLogs: logsByProfile.get(member.profile_id) || [],
        assessmentRuns: runsByProfile.get(member.profile_id) || [],
        assessmentResults: resultsByProfile.get(member.profile_id) || [],
        baselineMetrics,
      });

      return {
        membership_id: member.id,
        nickname: member.nickname,
        role: member.role,
        avatar_id: member.avatar_id || "",
        avatar_frame: member.avatar_frame || "",
        avatar_frames_enabled: member.avatar_frames_enabled !== false,
        xp: Number(xp || 0),
        plannedDays: Number(consistency.plannedDays || 0),
        completedDays: Number(consistency.completedDays || 0),
        consistencyPct: consistency.consistencyPct === null || consistency.consistencyPct === undefined ? null : Number(consistency.consistencyPct),
        consistencyState: consistency.reason || "schedule_unavailable",
        improvementPct: safeImprovementValue(improvement),
        improvementMetricCount: Number(improvement.metricCount || 0),
        improvementState: improvement.reason || "no_comparable_baseline",
        eligibleFrom: bounds.eligibleFrom,
        eligibleThrough: bounds.eligibleThrough,
      };
    }

    async function livePeriod(periodType: string, period: any) {
      if (!period || referenceDate < groupStart || groupStart > period.endDate) {
        return period ? { ...period, periodType, state: "not_started", available: false, rows: [] } : null;
      }
      const rows = [];
      for (const member of activeMembers) rows.push(await scoreMember(member, periodType, period, true));
      return { ...period, periodType, state: "live", available: true, rows: addGroupPeriodRanks(rows) };
    }

    async function freezePeriod(periodType: string, period: any) {
      if (!period || groupStart > period.endDate) {
        return period ? { ...period, periodType, state: "not_started", available: false, rows: [] } : null;
      }

      const historicalMembers = allMemberships.filter((member: any) => membershipOverlaps(member, period.startDate, period.endDate));
      const { data: existing, error: existingError } = await adminClient
        .from("group_period_results")
        .select("membership_id")
        .eq("group_id", groupId)
        .eq("period_type", periodType)
        .eq("period_start", period.startDate)
        .eq("score_version", GROUP_PERIOD_SCORE_VERSION);
      if (existingError) throw existingError;
      const existingIds = new Set((existing || []).map((row: any) => row.membership_id));
      const inserts = [];

      for (const member of historicalMembers) {
        if (existingIds.has(member.id)) continue;
        const row = await scoreMember(member, periodType, period, false);
        if (row.consistencyState === "not_started" && row.improvementState === "not_started") continue;
        inserts.push({
          group_id: groupId,
          membership_id: member.id,
          period_type: periodType,
          period_start: period.startDate,
          period_end: period.endDate,
          season_number: periodType === "season" ? period.seasonNumber : null,
          eligible_from: row.eligibleFrom,
          eligible_through: row.eligibleThrough,
          xp: row.xp,
          planned_days: row.plannedDays,
          completed_days: row.completedDays,
          consistency_pct: row.consistencyPct,
          consistency_state: row.consistencyState,
          improvement_pct: row.improvementPct,
          improvement_metric_count: row.improvementMetricCount,
          improvement_state: row.improvementState,
          score_version: GROUP_PERIOD_SCORE_VERSION,
          nickname: row.nickname,
          avatar_id: row.avatar_id,
          avatar_frame: row.avatar_frame,
          avatar_frames_enabled: row.avatar_frames_enabled,
        });
      }

      if (inserts.length) {
        const { error: insertError } = await adminClient
          .from("group_period_results")
          .upsert(inserts, {
            onConflict: "group_id,membership_id,period_type,period_start,score_version",
            ignoreDuplicates: true,
          });
        if (insertError) throw insertError;
      }

      const { data: frozenRows, error: frozenError } = await adminClient
        .from("group_period_results")
        .select("membership_id,nickname,avatar_id,avatar_frame,avatar_frames_enabled,xp,planned_days,completed_days,consistency_pct,consistency_state,improvement_pct,improvement_metric_count,improvement_state")
        .eq("group_id", groupId)
        .eq("period_type", periodType)
        .eq("period_start", period.startDate)
        .eq("score_version", GROUP_PERIOD_SCORE_VERSION);
      if (frozenError) throw frozenError;

      const rankedRows = addGroupPeriodRanks((frozenRows || []).map(frozenRow));
      const awards = buildGroupProgressAwards({
        periodType,
        periodStart: period.startDate,
        periodEnd: period.endDate,
        seasonNumber: periodType === "season" ? period.seasonNumber : null,
        state: "frozen",
        rows: rankedRows,
      });
      if (awards.length) {
        const awardInserts = awards.map((award: any) => ({
          group_id: groupId,
          membership_id: award.membership_id,
          period_type: award.periodType,
          period_start: award.periodStart,
          period_end: award.periodEnd,
          season_number: award.seasonNumber,
          award_type: award.awardType,
          rank: award.rank,
          score_value: award.scoreValue,
          score_unit: award.scoreUnit,
          score_version: GROUP_PERIOD_SCORE_VERSION,
          nickname: award.nickname,
          avatar_id: award.avatar_id,
          avatar_frame: award.avatar_frame,
          avatar_frames_enabled: award.avatar_frames_enabled,
        }));
        const { error: awardError } = await adminClient
          .from("group_progress_awards")
          .upsert(awardInserts, {
            onConflict: "group_id,membership_id,period_type,period_start,award_type,score_version",
            ignoreDuplicates: true,
          });
        if (awardError) throw awardError;
      }

      return { ...period, periodType, state: "frozen", available: true, rows: rankedRows };
    }

    const monthlyCurrent = await livePeriod("month", currentMonth);
    const monthlyHistory = [];
    for (const period of monthHistory) monthlyHistory.push(await freezePeriod("month", period));

    const seasonCurrent = await livePeriod("season", currentSeason);
    const completedSeasons = [];
    for (const period of seasonHistory) completedSeasons.push(await freezePeriod("season", period));

    const { data: awardRows, error: awardsError } = await adminClient
      .from("group_progress_awards")
      .select("membership_id,award_type,period_type,period_start,period_end,season_number,rank,score_value,score_unit,nickname,avatar_id,avatar_frame,avatar_frames_enabled,awarded_at")
      .eq("group_id", groupId)
      .eq("score_version", GROUP_PERIOD_SCORE_VERSION)
      .order("period_start", { ascending: false })
      .order("award_type", { ascending: true });
    if (awardsError) throw awardsError;

    return json({
      scoreVersion: GROUP_PERIOD_SCORE_VERSION,
      competitionStartDate: groupStart,
      monthly: { current: monthlyCurrent, history: monthlyHistory.filter(Boolean) },
      season: { current: seasonCurrent, history: completedSeasons.filter(Boolean) },
      awards: (awardRows || []).map(awardRow),
    });
  } catch (error) {
    console.error("Group Seasons & Awards failure", error);
    return json({ error: "Could not calculate Group Seasons & Awards" }, 500);
  }
});
