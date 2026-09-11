import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import { GROUP_TEAM_PR_SCORE_VERSION, buildTrainingPrSummary, rankTeamPrRows } from "./groupTeamEngine.js";
import { getCurrentGroupSeasonWindow } from "./groupPeriodEngine.js";

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

async function fetchAllLogs(adminClient: any, profileIds: string[], referenceDate: string) {
  if (!profileIds.length) return [];
  const rows: any[] = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await adminClient
      .from("logs")
      .select("profile_id,date_ymd,log_json")
      .in("profile_id", profileIds)
      .lte("date_ymd", referenceDate)
      .order("date_ymd", { ascending: true })
      .order("profile_id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const page = data || [];
    rows.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }
  return rows;
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
      console.error("Group Team PR service is missing required Supabase environment keys.");
      return json({ error: "Team performance service unavailable" }, 503);
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
    // before any privileged cross-family log reads are made.
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
      .select("id,status,group_type,competition_start_date")
      .eq("id", groupId)
      .eq("status", "active")
      .maybeSingle();
    if (groupError || !group) return json({ error: "Group is not active" }, 404);
    if (!new Set(["squad", "club"]).has(String(group.group_type || ""))) {
      return json({ error: "Squad or Club Group required" }, 400);
    }

    const groupStart = String(group.competition_start_date || referenceDate);
    const season = getCurrentGroupSeasonWindow(groupStart, referenceDate);
    if (!season) return json({ error: "Could not resolve current team season" }, 400);

    const { data: memberships, error: membershipError } = await adminClient
      .from("group_memberships")
      .select("id,profile_id,nickname,avatar_id,avatar_frame,avatar_frames_enabled,status,joined_at,left_at")
      .eq("group_id", groupId)
      .eq("status", "active")
      .order("joined_at", { ascending: true });
    if (membershipError) throw membershipError;

    const members = memberships || [];
    const profileIds = [...new Set(members.map((member: any) => member.profile_id).filter(Boolean))];
    const logs = await fetchAllLogs(adminClient, profileIds, referenceDate);
    const logsByProfile = new Map<string, any[]>();
    for (const row of logs) {
      const list = logsByProfile.get(row.profile_id) || [];
      list.push({ date_ymd: row.date_ymd, log_json: row.log_json });
      logsByProfile.set(row.profile_id, list);
    }

    const rows = members.map((member: any) => {
      const joinedDate = londonYmd(member.joined_at);
      const leftDate = londonYmd(member.left_at);
      const eligibleFrom = maxYmd(season.startDate, groupStart, joinedDate) || season.startDate;
      const eligibleThrough = minYmd(season.endDate, referenceDate, leftDate)
        || minYmd(season.endDate, referenceDate)
        || season.endDate;
      const summary = buildTrainingPrSummary({
        logs: logsByProfile.get(member.profile_id) || [],
        window: season,
        referenceDate,
        eligibleFrom,
        eligibleThrough,
      });
      return {
        membership_id: member.id,
        nickname: member.nickname,
        avatar_id: member.avatar_id || "",
        avatar_frame: member.avatar_frame || "",
        avatar_frames_enabled: member.avatar_frames_enabled !== false,
        prCount: summary.prCount,
        latestPrDate: summary.latestPrDate,
        scoreState: summary.state,
      };
    });

    return json({
      scoreVersion: GROUP_TEAM_PR_SCORE_VERSION,
      groupType: group.group_type,
      current: {
        seasonNumber: season.seasonNumber,
        weekNumber: season.weekNumber,
        startDate: season.startDate,
        endDate: season.endDate,
        state: "live",
        rows: rankTeamPrRows(rows),
      },
    });
  } catch (error) {
    console.error("Group Team PR board failed", error);
    return json({ error: "Could not calculate team PR board" }, 500);
  }
});
