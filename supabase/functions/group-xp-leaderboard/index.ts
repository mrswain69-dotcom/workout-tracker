import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import {
  XP_ENGINE_SCORE_VERSION,
  buildXpDebugRows,
  getCurrentWeekWindow,
  getPreviousCompletedWeekWindows,
  sumXpRowsInRange,
} from "./xpEngine.js";

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

function maxYmd(a: string, b: string) {
  return a > b ? a : b;
}

function rankRows(rows: any[]) {
  const ordered = [...rows].sort((a, b) => {
    const xpDiff = Number(b.xp || 0) - Number(a.xp || 0);
    if (xpDiff) return xpDiff;
    return String(a.nickname || "").localeCompare(String(b.nickname || ""), "en", { sensitivity: "base" });
  });

  let lastXp: number | null = null;
  let lastRank = 0;
  return ordered.map((row, index) => {
    const xp = Number(row.xp || 0);
    if (lastXp === null || xp !== lastXp) lastRank = index + 1;
    lastXp = xp;
    return { ...row, rank: lastRank };
  });
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
      console.error("Group Weekly XP function is missing required Supabase environment keys.");
      return json({ error: "Leaderboard service unavailable" }, 503);
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
    const referenceDate = validYmd(body?.referenceDate)
      ? body.referenceDate
      : new Date().toISOString().slice(0, 10);

    if (!groupId || !membershipId) return json({ error: "Group membership is required" }, 400);

    // User-scoped/RLS-protected lookup proves the caller owns this active membership.
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
      .select("id,status,competition_start_date,xp_history_scope")
      .eq("id", groupId)
      .eq("status", "active")
      .maybeSingle();
    if (groupError || !group) return json({ error: "Group is not active" }, 404);

    const { data: memberships, error: membershipError } = await adminClient
      .from("group_memberships")
      .select("id,profile_id,nickname,role,avatar_id,avatar_frame,avatar_frames_enabled")
      .eq("group_id", groupId)
      .eq("status", "active")
      .order("joined_at", { ascending: true });
    if (membershipError) throw membershipError;

    const activeMembers = memberships || [];
    const profileIds = activeMembers.map((member) => member.profile_id).filter(Boolean);

    const [profilesResult, logsResult] = profileIds.length
      ? await Promise.all([
          adminClient.from("profiles").select("id,plan_json").in("id", profileIds).eq("archived", false),
          adminClient.from("logs").select("profile_id,date_ymd,log_json").in("profile_id", profileIds).lte("date_ymd", getCurrentWeekWindow(referenceDate)?.endDate || referenceDate).order("date_ymd", { ascending: true }),
        ])
      : [{ data: [], error: null }, { data: [], error: null }];

    if (profilesResult.error) throw profilesResult.error;
    if (logsResult.error) throw logsResult.error;

    const planByProfile = new Map((profilesResult.data || []).map((profile: any) => [profile.id, profile.plan_json || {}]));
    const logsByProfile = new Map<string, any[]>();
    for (const logRow of logsResult.data || []) {
      const list = logsByProfile.get(logRow.profile_id) || [];
      list.push({ date_ymd: logRow.date_ymd, log: logRow.log_json });
      logsByProfile.set(logRow.profile_id, list);
    }

    const ledgerByMembership = new Map<string, any[]>();
    for (const member of activeMembers) {
      ledgerByMembership.set(
        member.id,
        buildXpDebugRows(logsByProfile.get(member.profile_id) || [], planByProfile.get(member.profile_id) || {})
      );
    }

    const scopeMode = group.xp_history_scope === "all_history" ? "all_history" : "group_start";
    const groupStart = String(group.competition_start_date || referenceDate);
    const currentWindow = getCurrentWeekWindow(referenceDate);
    const historyWindows = getPreviousCompletedWeekWindows(referenceDate, 4);

    const scoreLiveWindow = (window: any) => {
      const eligibleFrom = scopeMode === "group_start" ? maxYmd(window.startDate, groupStart) : window.startDate;
      const rows = activeMembers.map((member: any) => ({
        membership_id: member.id,
        nickname: member.nickname,
        role: member.role,
        avatar_id: member.avatar_id || "",
        avatar_frame: member.avatar_frame || "",
        avatar_frames_enabled: member.avatar_frames_enabled !== false,
        xp: sumXpRowsInRange(
          ledgerByMembership.get(member.id) || [],
          window.startDate,
          window.endDate,
          scopeMode === "group_start" ? groupStart : ""
        ),
      }));
      return {
        startDate: window.startDate,
        endDate: window.endDate,
        eligibleFrom,
        state: "live",
        available: true,
        rows: rankRows(rows),
      };
    };

    const current = currentWindow ? scoreLiveWindow(currentWindow) : null;
    const history = [];

    for (const window of historyWindows) {
      if (scopeMode === "group_start" && groupStart > window.endDate) {
        history.push({
          startDate: window.startDate,
          endDate: window.endDate,
          eligibleFrom: groupStart,
          state: "not_started",
          available: false,
          rows: [],
        });
        continue;
      }

      const { data: frozenExisting, error: frozenError } = await adminClient
        .from("group_weekly_xp_results")
        .select("membership_id,nickname,avatar_id,avatar_frame,avatar_frames_enabled,xp,eligible_from")
        .eq("group_id", groupId)
        .eq("week_start", window.startDate)
        .eq("scope_mode", scopeMode)
        .eq("score_version", XP_ENGINE_SCORE_VERSION);
      if (frozenError) throw frozenError;

      let frozenRows = frozenExisting || [];
      if (!frozenRows.length) {
        const eligibleFrom = scopeMode === "group_start" ? maxYmd(window.startDate, groupStart) : window.startDate;
        const inserts = activeMembers.map((member: any) => ({
          group_id: groupId,
          membership_id: member.id,
          week_start: window.startDate,
          week_end: window.endDate,
          scope_mode: scopeMode,
          eligible_from: eligibleFrom,
          xp: sumXpRowsInRange(
            ledgerByMembership.get(member.id) || [],
            window.startDate,
            window.endDate,
            scopeMode === "group_start" ? groupStart : ""
          ),
          score_version: XP_ENGINE_SCORE_VERSION,
          nickname: member.nickname,
          avatar_id: member.avatar_id || "",
          avatar_frame: member.avatar_frame || "",
          avatar_frames_enabled: member.avatar_frames_enabled !== false,
        }));

        if (inserts.length) {
          const { error: insertError } = await adminClient
            .from("group_weekly_xp_results")
            .upsert(inserts, {
              onConflict: "group_id,membership_id,week_start,scope_mode,score_version",
              ignoreDuplicates: true,
            });
          if (insertError) throw insertError;
        }

        const { data: refreshed, error: refreshError } = await adminClient
          .from("group_weekly_xp_results")
          .select("membership_id,nickname,avatar_id,avatar_frame,avatar_frames_enabled,xp,eligible_from")
          .eq("group_id", groupId)
          .eq("week_start", window.startDate)
          .eq("scope_mode", scopeMode)
          .eq("score_version", XP_ENGINE_SCORE_VERSION);
        if (refreshError) throw refreshError;
        frozenRows = refreshed || [];
      }

      history.push({
        startDate: window.startDate,
        endDate: window.endDate,
        eligibleFrom:
          frozenRows[0]?.eligible_from ||
          (scopeMode === "group_start" ? maxYmd(window.startDate, groupStart) : window.startDate),
        state: "frozen",
        available: true,
        rows: rankRows(frozenRows),
      });
    }

    return json({
      scoreVersion: XP_ENGINE_SCORE_VERSION,
      scopeMode,
      competitionStartDate: groupStart,
      current,
      history,
    });
  } catch (error) {
    console.error("Group Weekly XP failure", error);
    return json({ error: "Could not calculate Group Weekly XP" }, 500);
  }
});
