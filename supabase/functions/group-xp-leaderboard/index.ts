import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import {
  XP_ENGINE_SCORE_VERSION,
  XP_RULES,
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

function safeNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function setHasData(set: any) {
  if (!set || typeof set !== "object") return false;
  return (
    safeNumber(set.reps) > 0 ||
    safeNumber(set.timeSeconds) > 0 ||
    safeNumber(set.count) > 0 ||
    safeNumber(set.distanceKm) > 0 ||
    safeNumber(set.durationMin) > 0
  );
}

function physicalBlockHasData(block: any) {
  if (!block || block.cancelled || block.suspendedByRecoveryMode) return false;
  const typeId = String(block.typeId || "").toLowerCase();

  if (["strength", "hiit", "box"].includes(typeId)) {
    return Object.values(block.sets || {}).some(
      (sets: any) => Array.isArray(sets) && sets.some(setHasData)
    );
  }
  if (typeId === "cardio") {
    return (
      safeNumber(block?.cardio?.distanceKm) > 0 ||
      safeNumber(block?.cardio?.durationMin) > 0
    );
  }
  if (typeId === "duration") {
    return safeNumber(block?.duration?.minutes) > 0;
  }
  if (typeId === "session") {
    return !!block?.session?.completed || safeNumber(block?.session?.actualDurationSec) > 0;
  }
  return false;
}

function blockCategory(block: any) {
  const typeId = String(block?.typeId || "").toLowerCase();
  if (["strength", "hiit", "box"].includes(typeId)) return "Strength";
  if (typeId === "cardio") return "Cardio";
  if (typeId === "duration") return "Duration";
  if (typeId === "session") return "Session";
  return "Activity";
}

function verificationEligiblePhysicalXp(block: any) {
  if (!physicalBlockHasData(block)) return 0;
  const typeId = String(block?.typeId || "").toLowerCase();

  if (["strength", "hiit", "box"].includes(typeId)) {
    const completedSets = Object.values(block?.sets || {}).reduce(
      (sum: number, sets: any) =>
        sum +
        (Array.isArray(sets)
          ? sets.filter(setHasData).length
          : 0),
      0
    );
    return completedSets > 0
      ? completedSets * XP_RULES.strengthSet + XP_RULES.blockComplete
      : 0;
  }

  if (typeId === "cardio") {
    const minutes = safeNumber(block?.cardio?.durationMin);
    const km = safeNumber(block?.cardio?.distanceKm);
    let xp =
      (minutes > 0 ? Math.ceil(minutes * XP_RULES.cardioPerMin) : 0) +
      (km > 0 ? Math.ceil(km * XP_RULES.cardioPerKm) : 0);
    if (xp > 0) xp += XP_RULES.blockComplete;

    const isWalk = String(block?.cardioType || "").toLowerCase() === "walk";
    if (isWalk) xp = Math.round(xp * 0.6);
    return xp;
  }

  if (typeId === "duration") {
    const minutes = safeNumber(block?.duration?.minutes);
    if (minutes <= 0) return 0;
    return Math.ceil(minutes * XP_RULES.durationPerMin) + XP_RULES.blockComplete;
  }

  if (typeId === "session") {
    return block?.session?.completed ? XP_RULES.sessionComplete : 0;
  }

  return 0;
}

function rankRows(rows: any[]) {
  const included = rows.filter((row) => !row.competition_excluded);
  const excluded = rows.filter((row) => row.competition_excluded);

  const ordered = [...included].sort((a, b) => {
    const xpDiff = Number(b.xp || 0) - Number(a.xp || 0);
    if (xpDiff) return xpDiff;
    return String(a.nickname || "").localeCompare(
      String(b.nickname || ""),
      "en",
      { sensitivity: "base" }
    );
  });

  let lastXp: number | null = null;
  let lastRank = 0;
  const ranked = ordered.map((row, index) => {
    const xp = Number(row.xp || 0);
    if (lastXp === null || xp !== lastXp) lastRank = index + 1;
    lastXp = xp;
    return { ...row, rank: lastRank };
  });

  const excludedBottom = [...excluded]
    .sort((a, b) =>
      String(a.nickname || "").localeCompare(String(b.nickname || ""), "en", {
        sensitivity: "base",
      })
    )
    .map((row) => ({ ...row, rank: null }));

  return [...ranked, ...excludedBottom];
}

function rowsInWindow(rows: any[], startDate: string, endDate: string, eligibleFrom = "") {
  const effectiveStart =
    eligibleFrom && eligibleFrom > startDate ? eligibleFrom : startDate;
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    const date = String(row?.date || "");
    return date >= effectiveStart && date <= endDate;
  });
}

function categoryEvidence(rows: any[]) {
  const totals = new Map<string, number>();
  const fields = [
    ["Strength", "strengthXp"],
    ["Cardio", "cardioXp"],
    ["Duration", "durationXp"],
    ["Sessions", "sessionXp"],
    ["Recovery / physio", "recoveryXp"],
    ["Tasks", "tasksXp"],
    ["Day completion", "dayCompleteXp"],
    ["Progress", "progXp"],
    ["Consistency / streak", "streakXp"],
    ["Daily challenge", "dailyBonusXp"],
  ] as const;

  for (const row of rows) {
    for (const [label, field] of fields) {
      const value = safeNumber(row?.[field]);
      if (value > 0) totals.set(label, (totals.get(label) || 0) + value);
    }
  }

  return [...totals.entries()]
    .map(([label, xp]) => ({ label, xp }))
    .sort((a, b) => b.xp - a.xp || a.label.localeCompare(b.label));
}

function buildVerificationSummary(
  member: any,
  logs: any[],
  links: any[],
  startDate: string,
  endDate: string,
  eligibleFrom: string
) {
  const effectiveStart =
    eligibleFrom && eligibleFrom > startDate ? eligibleFrom : startDate;

  const linkKeys = new Set(
    (links || [])
      .filter((link: any) => link.profile_id === member.profile_id)
      .map((link: any) => `${link.manual_log_id}::${link.manual_block_id || ""}`)
  );

  const logLevelVerified = new Set(
    (links || [])
      .filter(
        (link: any) =>
          link.profile_id === member.profile_id && !link.manual_block_id
      )
      .map((link: any) => String(link.manual_log_id || ""))
  );

  const activities: any[] = [];
  let eligibleCount = 0;
  let verifiedCount = 0;
  let eligiblePhysicalXp = 0;
  let verifiedPhysicalXp = 0;

  for (const row of logs || []) {
    const date = String(row?.date_ymd || "");
    if (row?.profile_id !== member.profile_id) continue;
    if (date < effectiveStart || date > endDate) continue;

    const blocks = Array.isArray(row?.log_json?.blocks)
      ? row.log_json.blocks
      : [];

    for (const block of blocks) {
      if (!physicalBlockHasData(block)) continue;
      eligibleCount += 1;
      const physicalXp = verificationEligiblePhysicalXp(block);
      eligiblePhysicalXp += physicalXp;

      const exactKey = `${row.id}::${String(block.id || "")}`;
      const verified =
        linkKeys.has(exactKey) || logLevelVerified.has(String(row.id || ""));
      if (verified) {
        verifiedCount += 1;
        verifiedPhysicalXp += physicalXp;
      }

      activities.push({
        date,
        label: String(block.label || block.activityName || blockCategory(block)).slice(0, 80),
        category: blockCategory(block),
        verified,
        earnedXp: physicalXp,
      });
    }
  }

  return {
    eligibleActivities: eligibleCount,
    verifiedActivities: verifiedCount,
    eligiblePhysicalXp,
    verifiedPhysicalXp,
    verificationPct:
      eligiblePhysicalXp > 0
        ? Math.round((verifiedPhysicalXp / eligiblePhysicalXp) * 100)
        : null,
    activities,
  };
}

function decorateMemberRow(
  member: any,
  ledgerRows: any[],
  logs: any[],
  links: any[],
  startDate: string,
  endDate: string,
  eligibleFrom: string
) {
  const windowRows = rowsInWindow(ledgerRows, startDate, endDate, eligibleFrom);
  const verification = buildVerificationSummary(
    member,
    logs,
    links,
    startDate,
    endDate,
    eligibleFrom
  );

  const earnedXp = sumXpRowsInRange(
    ledgerRows,
    startDate,
    endDate,
    eligibleFrom,
    "earnedXp"
  );

  return {
    membership_id: member.id,
    nickname: member.nickname,
    role: member.role,
    avatar_id: member.avatar_id || "",
    avatar_frame: member.avatar_frame || "",
    avatar_frames_enabled: member.avatar_frames_enabled !== false,
    xp: earnedXp,
    score_kind: "earned_xp",
    xp_evidence_visible: member.xp_evidence_visible === true,
    competition_excluded: member.competition_excluded === true,
    competition_exclusion_label:
      member.competition_exclusion_label || (member.competition_excluded ? "Gamed XP" : ""),
    verificationPct: verification.verificationPct,
    verificationEligibleActivities: verification.eligibleActivities,
    verificationVerifiedActivities: verification.verifiedActivities,
    verificationEligiblePhysicalXp: verification.eligiblePhysicalXp,
    verificationVerifiedPhysicalXp: verification.verifiedPhysicalXp,
    evidence:
      member.xp_evidence_visible === true
        ? {
            earnedXp,
            categories: categoryEvidence(windowRows),
            activities: verification.activities,
          }
        : null,
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

    const { data: authData, error: authError } =
      await userClient.auth.getUser(jwt);
    if (authError || !authData?.user) {
      return json({ error: "Authentication required" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const groupId = typeof body?.groupId === "string" ? body.groupId : "";
    const membershipId =
      typeof body?.membershipId === "string" ? body.membershipId : "";
    const referenceDate = validYmd(body?.referenceDate)
      ? body.referenceDate
      : new Date().toISOString().slice(0, 10);

    if (!groupId || !membershipId) {
      return json({ error: "Group membership is required" }, 400);
    }

    const { data: callerMembership, error: callerMembershipError } =
      await userClient
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
    if (groupError || !group) {
      return json({ error: "Group is not active" }, 404);
    }

    const { data: memberships, error: membershipError } = await adminClient
      .from("group_memberships")
      .select(
        "id,profile_id,nickname,role,avatar_id,avatar_frame,avatar_frames_enabled,status,joined_at,left_at,xp_evidence_visible,competition_excluded,competition_exclusion_label"
      )
      .eq("group_id", groupId)
      .order("joined_at", { ascending: true });
    if (membershipError) throw membershipError;

    const allMemberships = memberships || [];
    const activeMembers = allMemberships.filter(
      (member: any) => member.status === "active"
    );
    const profileIds = [
      ...new Set(
        allMemberships.map((member: any) => member.profile_id).filter(Boolean)
      ),
    ];

    const currentWindow = getCurrentWeekWindow(referenceDate);
    const queryEndDate = currentWindow?.endDate || referenceDate;

    const [profilesResult, logsResult, schedulesResult, linksResult] =
      profileIds.length
        ? await Promise.all([
            adminClient
              .from("profiles")
              .select("id,plan_json")
              .in("id", profileIds)
              .eq("archived", false),
            adminClient
              .from("logs")
              .select("id,profile_id,date_ymd,log_json")
              .in("profile_id", profileIds)
              .lte("date_ymd", queryEndDate)
              .order("date_ymd", { ascending: true }),
            adminClient
              .from("profile_consistency_schedule_snapshots")
              .select("profile_id,effective_date,schedule_json")
              .in("profile_id", profileIds)
              .lte("effective_date", referenceDate)
              .order("effective_date", { ascending: true }),
            adminClient
              .from("external_activity_links")
              .select("profile_id,manual_log_id,manual_block_id")
              .in("profile_id", profileIds),
          ])
        : [
            { data: [], error: null },
            { data: [], error: null },
            { data: [], error: null },
            { data: [], error: null },
          ];

    if (profilesResult.error) throw profilesResult.error;
    if (logsResult.error) throw logsResult.error;
    if (schedulesResult.error) throw schedulesResult.error;
    if (linksResult.error) throw linksResult.error;

    const planByProfile = new Map(
      (profilesResult.data || []).map((profile: any) => [
        profile.id,
        profile.plan_json || {},
      ])
    );

    const logsByProfile = new Map<string, any[]>();
    for (const logRow of logsResult.data || []) {
      const list = logsByProfile.get(logRow.profile_id) || [];
      list.push({ date_ymd: logRow.date_ymd, log: logRow.log_json });
      logsByProfile.set(logRow.profile_id, list);
    }

    const schedulesByProfile = new Map<string, any[]>();
    for (const row of schedulesResult.data || []) {
      const list = schedulesByProfile.get(row.profile_id) || [];
      list.push({
        effective_date: row.effective_date,
        schedule_json: row.schedule_json,
      });
      schedulesByProfile.set(row.profile_id, list);
    }

    const ledgerByMembership = new Map<string, any[]>();
    for (const member of allMemberships) {
      ledgerByMembership.set(
        member.id,
        buildXpDebugRows(
          logsByProfile.get(member.profile_id) || [],
          planByProfile.get(member.profile_id) || {},
          {
            todayYmd: referenceDate,
            scheduleSnapshots:
              schedulesByProfile.get(member.profile_id) || [],
          }
        )
      );
    }

    const scopeMode =
      group.xp_history_scope === "all_history" ? "all_history" : "group_start";
    const groupStart = String(
      group.competition_start_date || referenceDate
    );
    const historyWindows = getPreviousCompletedWeekWindows(referenceDate, 4);
    const allLogs = logsResult.data || [];
    const allLinks = linksResult.data || [];

    const scoreLiveWindow = (window: any) => {
      const eligibleFrom =
        scopeMode === "group_start"
          ? maxYmd(window.startDate, groupStart)
          : window.startDate;

      const rows = activeMembers.map((member: any) =>
        decorateMemberRow(
          member,
          ledgerByMembership.get(member.id) || [],
          allLogs,
          allLinks,
          window.startDate,
          window.endDate,
          scopeMode === "group_start" ? groupStart : ""
        )
      );

      return {
        startDate: window.startDate,
        endDate: window.endDate,
        eligibleFrom,
        state: "live",
        scoreMode: "earned_xp",
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
          scoreMode: "earned_xp",
          available: false,
          rows: [],
        });
        continue;
      }

      // Preserve already-frozen historical standings. The highest score version
      // that already exists for this completed week remains authoritative.
      const { data: anyFrozen, error: anyFrozenError } = await adminClient
        .from("group_weekly_xp_results")
        .select(
          "membership_id,nickname,avatar_id,avatar_frame,avatar_frames_enabled,xp,eligible_from,score_version"
        )
        .eq("group_id", groupId)
        .eq("week_start", window.startDate)
        .eq("scope_mode", scopeMode)
        .order("score_version", { ascending: false });
      if (anyFrozenError) throw anyFrozenError;

      const frozenVersions = (anyFrozen || []).map((row: any) =>
        Number(row.score_version || 0)
      );
      const existingVersion = frozenVersions.length
        ? Math.max(...frozenVersions)
        : 0;

      let frozenRows = existingVersion
        ? (anyFrozen || []).filter(
            (row: any) => Number(row.score_version || 0) === existingVersion
          )
        : [];

      let scoreMode =
        existingVersion > 0 && existingVersion < XP_ENGINE_SCORE_VERSION
          ? "legacy_total_xp"
          : "earned_xp";

      if (!frozenRows.length) {
        const eligibleFrom =
          scopeMode === "group_start"
            ? maxYmd(window.startDate, groupStart)
            : window.startDate;

        const historyMembers = allMemberships.filter((member: any) => {
          if (member.status === "active") return true;
          const joinedDate = String(member.joined_at || "").slice(0, 10);
          const leftDate = String(member.left_at || "").slice(0, 10);
          return (
            !!joinedDate &&
            joinedDate <= window.endDate &&
            (!leftDate || leftDate >= window.startDate)
          );
        });

        const inserts = historyMembers.map((member: any) => ({
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
            scopeMode === "group_start" ? groupStart : "",
            "earnedXp"
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
              onConflict:
                "group_id,membership_id,week_start,scope_mode,score_version",
              ignoreDuplicates: true,
            });
          if (insertError) throw insertError;
        }

        const { data: refreshed, error: refreshError } = await adminClient
          .from("group_weekly_xp_results")
          .select(
            "membership_id,nickname,avatar_id,avatar_frame,avatar_frames_enabled,xp,eligible_from,score_version"
          )
          .eq("group_id", groupId)
          .eq("week_start", window.startDate)
          .eq("scope_mode", scopeMode)
          .eq("score_version", XP_ENGINE_SCORE_VERSION);
        if (refreshError) throw refreshError;

        frozenRows = refreshed || [];
        scoreMode = "earned_xp";
      }

      const currentMemberById = new Map(
        allMemberships.map((member: any) => [member.id, member])
      );

      const decoratedFrozen = frozenRows.map((row: any) => {
        const member = currentMemberById.get(row.membership_id) || {
          id: row.membership_id,
          profile_id: "",
          nickname: row.nickname,
          avatar_id: row.avatar_id,
          avatar_frame: row.avatar_frame,
          avatar_frames_enabled: row.avatar_frames_enabled,
          xp_evidence_visible: false,
          competition_excluded: false,
          competition_exclusion_label: "",
        };

        const evidenceRow = decorateMemberRow(
          member,
          ledgerByMembership.get(row.membership_id) || [],
          allLogs,
          allLinks,
          window.startDate,
          window.endDate,
          scopeMode === "group_start" ? groupStart : ""
        );

        return {
          ...evidenceRow,
          nickname: row.nickname,
          avatar_id: row.avatar_id || "",
          avatar_frame: row.avatar_frame || "",
          avatar_frames_enabled: row.avatar_frames_enabled !== false,
          xp: Number(row.xp || 0),
          score_kind:
            scoreMode === "legacy_total_xp" ? "legacy_total_xp" : "earned_xp",
        };
      });

      history.push({
        startDate: window.startDate,
        endDate: window.endDate,
        eligibleFrom:
          frozenRows[0]?.eligible_from ||
          (scopeMode === "group_start"
            ? maxYmd(window.startDate, groupStart)
            : window.startDate),
        state: "frozen",
        scoreMode,
        scoreVersion:
          frozenRows[0]?.score_version || XP_ENGINE_SCORE_VERSION,
        available: true,
        rows: rankRows(decoratedFrozen),
      });
    }

    return json({
      scoreVersion: XP_ENGINE_SCORE_VERSION,
      scoreMode: "earned_xp",
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
