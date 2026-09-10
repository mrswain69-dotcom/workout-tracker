import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import {
  CONSISTENCY_SCORE_VERSION,
  getCurrentConsistencyWeekWindow,
  getPreviousCompletedConsistencyWeekWindows,
  rankConsistencyRows,
  scoreConsistencyWindow,
} from "./consistencyEngine.js";

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
    completedDays: Number(score?.completedDays || 0),
    plannedDays: Number(score?.plannedDays || 0),
    consistencyPct:
      score?.consistencyPct === null || score?.consistencyPct === undefined
        ? null
        : Number(score.consistencyPct),
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
    completedDays: Number(row.completed_days || 0),
    plannedDays: Number(row.planned_days || 0),
    consistencyPct:
      row.consistency_pct === null || row.consistency_pct === undefined
        ? null
        : Number(row.consistency_pct),
    scoreState: Number(row.planned_days || 0) > 0 ? "scored" : "no_planned_days",
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
    const publishableKey =
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ||
      Deno.env.get("SUPABASE_ANON_KEY") ||
      "";
    const secretKey =
      Deno.env.get("SUPABASE_SECRET_KEY") ||
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
      "";

    if (!supabaseUrl || !publishableKey || !secretKey) {
      console.error("Group Consistency function is missing required Supabase environment keys.");
      return json({ error: "Consistency service unavailable" }, 503);
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

    // RLS/user-scoped proof comes before any privileged cross-family scoring read.
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
    const currentWindow = getCurrentConsistencyWeekWindow(referenceDate);
    const historyWindows = getPreviousCompletedConsistencyWeekWindows(referenceDate, 4);
    const earliestDate = historyWindows.at(-1)?.startDate || currentWindow?.startDate || referenceDate;
    const latestDate = currentWindow?.endDate || referenceDate;
    const groupStart = String(group.competition_start_date || referenceDate);

    const [snapshotsResult, logsResult] = profileIds.length
      ? await Promise.all([
          adminClient
            .from("profile_consistency_schedule_snapshots")
            .select("profile_id,effective_date,schedule_json")
            .in("profile_id", profileIds)
            .lte("effective_date", latestDate)
            .order("effective_date", { ascending: true }),
          adminClient
            .from("logs")
            .select("profile_id,date_ymd,log_json")
            .in("profile_id", profileIds)
            .gte("date_ymd", earliestDate)
            .lte("date_ymd", latestDate)
            .order("date_ymd", { ascending: true }),
        ])
      : [{ data: [], error: null }, { data: [], error: null }];

    if (snapshotsResult.error) throw snapshotsResult.error;
    if (logsResult.error) throw logsResult.error;

    const schedulesByProfile = new Map<string, any[]>();
    for (const row of snapshotsResult.data || []) {
      const list = schedulesByProfile.get(row.profile_id) || [];
      list.push(row);
      schedulesByProfile.set(row.profile_id, list);
    }

    const logsByProfile = new Map<string, any[]>();
    for (const row of logsResult.data || []) {
      const list = logsByProfile.get(row.profile_id) || [];
      list.push({ date_ymd: row.date_ymd, log_json: row.log_json });
      logsByProfile.set(row.profile_id, list);
    }

    let current: any = null;
    if (currentWindow) {
      const rows = activeMembers.map((member: any) => {
        const eligibility = memberEligibility(member, groupStart, currentWindow);
        const score = scoreConsistencyWindow({
          window: currentWindow,
          referenceDate,
          eligibleFrom: eligibility.eligibleFrom,
          eligibleThrough: eligibility.eligibleThrough,
          scheduleSnapshots: schedulesByProfile.get(member.profile_id) || [],
          logs: logsByProfile.get(member.profile_id) || [],
        });
        return safeLiveRow(member, score);
      });

      current = {
        startDate: currentWindow.startDate,
        endDate: currentWindow.endDate,
        dueThrough: minYmd(referenceDate, currentWindow.endDate) || referenceDate,
        state: "live",
        available: groupStart <= currentWindow.endDate,
        rows: rankConsistencyRows(rows),
      };
    }

    const history: any[] = [];
    for (const window of historyWindows) {
      if (groupStart > window.endDate) {
        history.push({
          startDate: window.startDate,
          endDate: window.endDate,
          state: "not_started",
          available: false,
          rows: [],
        });
        continue;
      }

      const historyMembers = allMemberships.filter((member: any) =>
        membershipOverlapsWindow(member, window.startDate, window.endDate)
      );

      const { data: existing, error: existingError } = await adminClient
        .from("group_weekly_consistency_results")
        .select("membership_id,nickname,avatar_id,avatar_frame,avatar_frames_enabled,planned_days,completed_days,consistency_pct")
        .eq("group_id", groupId)
        .eq("week_start", window.startDate)
        .eq("score_version", CONSISTENCY_SCORE_VERSION);
      if (existingError) throw existingError;

      const existingIds = new Set((existing || []).map((row: any) => row.membership_id));
      const inserts: any[] = [];

      for (const member of historyMembers) {
        if (existingIds.has(member.id)) continue;
        const eligibility = memberEligibility(member, groupStart, window);
        if (!eligibility.eligibleFrom || eligibility.eligibleFrom > eligibility.eligibleThrough) continue;

        const score = scoreConsistencyWindow({
          window,
          referenceDate: window.endDate,
          eligibleFrom: eligibility.eligibleFrom,
          eligibleThrough: eligibility.eligibleThrough,
          scheduleSnapshots: schedulesByProfile.get(member.profile_id) || [],
          logs: logsByProfile.get(member.profile_id) || [],
        });
        if (!score.available) continue;

        inserts.push({
          group_id: groupId,
          membership_id: member.id,
          week_start: window.startDate,
          week_end: window.endDate,
          eligible_from: eligibility.eligibleFrom,
          eligible_through: eligibility.eligibleThrough,
          planned_days: score.plannedDays,
          completed_days: score.completedDays,
          consistency_pct: score.consistencyPct,
          score_version: CONSISTENCY_SCORE_VERSION,
          nickname: member.nickname,
          avatar_id: member.avatar_id || "",
          avatar_frame: member.avatar_frame || "",
          avatar_frames_enabled: member.avatar_frames_enabled !== false,
        });
      }

      if (inserts.length) {
        const { error: insertError } = await adminClient
          .from("group_weekly_consistency_results")
          .upsert(inserts, {
            onConflict: "group_id,membership_id,week_start,score_version",
            ignoreDuplicates: true,
          });
        if (insertError) throw insertError;
      }

      const { data: frozenRows, error: frozenError } = await adminClient
        .from("group_weekly_consistency_results")
        .select("membership_id,nickname,avatar_id,avatar_frame,avatar_frames_enabled,planned_days,completed_days,consistency_pct")
        .eq("group_id", groupId)
        .eq("week_start", window.startDate)
        .eq("score_version", CONSISTENCY_SCORE_VERSION);
      if (frozenError) throw frozenError;

      history.push({
        startDate: window.startDate,
        endDate: window.endDate,
        state: "frozen",
        available: true,
        rows: rankConsistencyRows((frozenRows || []).map(safeFrozenRow)),
      });
    }

    return json({
      scoreVersion: CONSISTENCY_SCORE_VERSION,
      competitionStartDate: groupStart,
      current,
      history,
    });
  } catch (error) {
    console.error("Group Consistency failure", error);
    return json({ error: "Could not calculate Group Consistency" }, 500);
  }
});
