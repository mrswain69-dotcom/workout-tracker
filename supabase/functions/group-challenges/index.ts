import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import {
  GROUP_CHALLENGE_MAX_OPEN,
  GROUP_CHALLENGE_RULES_VERSION,
  allocateGroupChallengeRewards,
  buildGroupChallengeDefinition,
  countChallengeDays,
  evaluateGroupChallenge,
  groupChallengeDisplayState,
  shiftChallengeYmd,
} from "./groupChallengeEngine.js";
import {
  buildGroupChallengeTrainingXpRows,
  sumGroupChallengeTrainingXp,
} from "./groupChallengeXpEngine.js";
import { scoreConsistencyWindow } from "./consistencyEngine.js";
import {
  IMPROVEMENT_SCORE_VERSION,
  buildImprovementBaseline,
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
      // Fall through to legacy key while project key migration completes.
    }
  }
  return Deno.env.get(legacyName) || "";
}

function membershipOverlaps(member: any, startDate: string, endDate: string) {
  const joinedDate = londonYmd(member?.joined_at);
  const leftDate = londonYmd(member?.left_at);
  return !!joinedDate && joinedDate <= endDate && (!leftDate || leftDate >= startDate);
}

function memberBounds(member: any, challenge: any, throughDate: string) {
  const joinedDate = londonYmd(member?.joined_at);
  const leftDate = londonYmd(member?.left_at);
  const eligibleFrom = maxYmd(challenge.start_date, joinedDate);
  const eligibleThrough = minYmd(challenge.end_date, throughDate, leftDate)
    || minYmd(challenge.end_date, throughDate)
    || challenge.end_date;
  return { eligibleFrom, eligibleThrough };
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

async function fetchAllRuns(adminClient: any, profileIds: string[], startDate: string, endDate: string) {
  if (!profileIds.length) return [];
  const rows: any[] = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await adminClient
      .from("assessment_runs")
      .select("id,profile_id,date_ymd,status")
      .in("profile_id", profileIds)
      .eq("status", "completed")
      .gte("date_ymd", startDate)
      .lte("date_ymd", endDate)
      .order("date_ymd", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const page = data || [];
    rows.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

async function fetchAllSchedules(adminClient: any, profileIds: string[], referenceDate: string) {
  if (!profileIds.length) return [];
  const rows: any[] = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await adminClient
      .from("profile_consistency_schedule_snapshots")
      .select("profile_id,effective_date,schedule_json")
      .in("profile_id", profileIds)
      .lte("effective_date", referenceDate)
      .order("effective_date", { ascending: true })
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

async function fetchAllAssessmentResults(adminClient: any, runIds: string[]) {
  if (!runIds.length) return [];
  const rows: any[] = [];
  const pageSize = 1000;
  for (let offset = 0; offset < runIds.length; offset += 200) {
    const slice = runIds.slice(offset, offset + 200);
    let from = 0;
    while (true) {
      const { data, error } = await adminClient
        .from("assessment_test_results")
        .select("assessment_run_id,test_id,assessment_template_test_id,metric_snapshot,comparable_value,comparable_dimensions,is_valid")
        .in("assessment_run_id", slice)
        .eq("is_valid", true)
        .order("assessment_run_id", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      const page = data || [];
      rows.push(...page);
      if (page.length < pageSize) break;
      from += pageSize;
    }
  }
  return rows;
}

function safeEvidence(score: any) {
  if (!score) return {};
  if ("eligibleAthleteDays" in score) {
    return {
      totalXp: Number(score.totalXp || 0),
      eligibleAthleteDays: Number(score.eligibleAthleteDays || 0),
      contributingAthletes: Array.isArray(score.contributors) ? score.contributors.length : 0,
    };
  }
  if ("plannedDays" in score) {
    return {
      plannedDays: Number(score.plannedDays || 0),
      completedDays: Number(score.completedDays || 0),
      contributingAthletes: Array.isArray(score.contributors) ? score.contributors.length : 0,
    };
  }
  return {
    scoredAthletes: Number(score.scoredAthletes || 0),
  };
}

function challengeRowForClient(challenge: any, referenceDate: string, score: any = null, rewardSummary: any = null) {
  const state = groupChallengeDisplayState(challenge, referenceDate);
  const finalEvidence = challenge?.final_evidence && typeof challenge.final_evidence === "object"
    ? challenge.final_evidence
    : {};
  const evidence = score ? safeEvidence(score) : {
    totalXp: finalEvidence.totalXp,
    eligibleAthleteDays: finalEvidence.eligibleAthleteDays,
    plannedDays: finalEvidence.plannedDays,
    completedDays: finalEvidence.completedDays,
    scoredAthletes: finalEvidence.scoredAthletes,
    contributingAthletes: finalEvidence.contributingAthletes,
  };
  return {
    id: challenge.id,
    templateKey: challenge.template_key,
    metricType: challenge.metric_type,
    title: challenge.title,
    description: challenge.description,
    targetValue: Number(challenge.target_value),
    targetUnit: challenge.target_unit,
    startDate: challenge.start_date,
    endDate: challenge.end_date,
    durationDays: Number(challenge.duration_days),
    rewardPoolXp: Number(challenge.reward_pool_xp || 0),
    rulesVersion: Number(challenge.rules_version || 1),
    state,
    currentValue: score?.value ?? (challenge.final_value === null || challenge.final_value === undefined ? null : Number(challenge.final_value)),
    progressPct: score?.progressPct ?? (challenge.outcome === "completed" ? 100 : null),
    scoreAvailable: score ? !!score.available : challenge.outcome !== "unavailable",
    scoreReason: score?.reason || challenge.final_reason || null,
    achieved: score ? !!score.achieved : challenge.outcome === "completed",
    evidence,
    rewardSummary: rewardSummary || { distributedXp: 0, recipients: 0 },
    createdAt: challenge.created_at,
    finalizedAt: challenge.finalized_at,
    cancelledAt: challenge.cancelled_at,
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
      console.error("Group Challenges service is missing required Supabase environment keys.");
      return json({ error: "Challenges service unavailable" }, 503);
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
    const action = typeof body?.action === "string" ? body.action : "list";
    const referenceDate = londonYmd();

    if (action === "profile_rewards") {
      const profileId = typeof body?.profileId === "string" ? body.profileId : "";
      if (!profileId) return json({ error: "Profile is required" }, 400);

      // Ownership boundary: prove this private athlete profile belongs to the caller under RLS
      // before reading its server-only Challenge XP awards.
      const { data: ownedProfile, error: profileError } = await userClient
        .from("profiles")
        .select("id")
        .eq("id", profileId)
        .eq("archived", false)
        .maybeSingle();
      if (profileError || !ownedProfile) return json({ error: "Profile access required" }, 403);

      const { data: rewards, error: rewardError } = await adminClient
        .from("group_challenge_rewards")
        .select("challenge_id,xp_awarded,awarded_on,awarded_at")
        .eq("profile_id", profileId)
        .order("awarded_on", { ascending: true })
        .order("awarded_at", { ascending: true });
      if (rewardError) throw rewardError;
      const rows = rewards || [];
      const challengeIds = [...new Set(rows.map((row: any) => row.challenge_id).filter(Boolean))];
      const titleById = new Map<string, string>();
      if (challengeIds.length) {
        const { data: challenges, error } = await adminClient
          .from("group_challenges")
          .select("id,title")
          .in("id", challengeIds);
        if (error) throw error;
        for (const challenge of challenges || []) titleById.set(challenge.id, challenge.title);
      }
      return json({
        rewards: rows.map((reward: any) => ({
          challengeId: reward.challenge_id,
          awardedOn: reward.awarded_on,
          xpAwarded: Number(reward.xp_awarded || 0),
          title: titleById.get(reward.challenge_id) || "Group Challenge",
        })),
      });
    }

    const groupId = typeof body?.groupId === "string" ? body.groupId : "";
    const membershipId = typeof body?.membershipId === "string" ? body.membershipId : "";
    if (!groupId || !membershipId) return json({ error: "Group membership is required" }, 400);

    // Membership boundary: prove the caller's exact active membership under RLS before any
    // privileged Group, challenge, cross-family log or Assessment reads occur.
    const { data: callerMembership, error: callerMembershipError } = await userClient
      .from("group_memberships")
      .select("id,group_id,profile_id,role")
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
      .select("id,group_id,family_id,profile_id,nickname,role,avatar_id,avatar_frame,avatar_frames_enabled,status,joined_at,left_at")
      .eq("group_id", groupId)
      .order("joined_at", { ascending: true });
    if (membershipError) throw membershipError;
    const allMemberships = memberships || [];
    const activeMembers = allMemberships.filter((member: any) => member.status === "active");

    if (action === "create") {
      if (callerMembership.role !== "admin") return json({ error: "Group Admin access required" }, 403);
      if (activeMembers.length < 2) return json({ error: "A Group Challenge needs at least two active athletes" }, 400);

      const templateKey = typeof body?.templateKey === "string" ? body.templateKey : "";
      const durationDays = Number(body?.durationDays);
      const startDate = validYmd(body?.startDate) ? body.startDate : "";
      const definition = buildGroupChallengeDefinition({ templateKey, durationDays, startDate });
      if (!definition) return json({ error: "Choose a valid controlled challenge and duration" }, 400);
      if (definition.startDate < referenceDate) return json({ error: "Challenges cannot start in the past" }, 400);
      if (definition.startDate > shiftChallengeYmd(referenceDate, 28)) return json({ error: "Challenges can be scheduled up to 28 days ahead" }, 400);

      const { data: openChallenges, error: openError } = await adminClient
        .from("group_challenges")
        .select("id,metric_type,start_date,end_date")
        .eq("group_id", groupId)
        .is("cancelled_at", null)
        .is("finalized_at", null);
      if (openError) throw openError;
      if ((openChallenges || []).length >= GROUP_CHALLENGE_MAX_OPEN) {
        return json({ error: `A Group can have at most ${GROUP_CHALLENGE_MAX_OPEN} open challenges` }, 400);
      }
      const overlapsSameMetric = (openChallenges || []).some((challenge: any) =>
        challenge.metric_type === definition.metricType
        && challenge.start_date <= definition.endDate
        && challenge.end_date >= definition.startDate
      );
      if (overlapsSameMetric) return json({ error: "The same challenge metric cannot overlap itself" }, 400);

      const { data: created, error: createError } = await adminClient
        .from("group_challenges")
        .insert({
          group_id: groupId,
          created_by_membership_id: membershipId,
          template_key: definition.templateKey,
          metric_type: definition.metricType,
          title: definition.title,
          description: definition.description,
          target_value: definition.targetValue,
          target_unit: definition.targetUnit,
          start_date: definition.startDate,
          end_date: definition.endDate,
          duration_days: definition.durationDays,
          reward_pool_xp: definition.rewardPoolXp,
          rules_version: GROUP_CHALLENGE_RULES_VERSION,
        })
        .select("*")
        .single();
      if (createError) throw createError;
      return json({ challenge: challengeRowForClient(created, referenceDate) });
    }

    if (action === "cancel") {
      if (callerMembership.role !== "admin") return json({ error: "Group Admin access required" }, 403);
      const challengeId = typeof body?.challengeId === "string" ? body.challengeId : "";
      if (!challengeId) return json({ error: "Challenge is required" }, 400);
      const { data: challenge, error: challengeError } = await adminClient
        .from("group_challenges")
        .select("id,end_date,finalized_at,cancelled_at")
        .eq("id", challengeId)
        .eq("group_id", groupId)
        .maybeSingle();
      if (challengeError || !challenge) return json({ error: "Challenge not found" }, 404);
      if (challenge.finalized_at) return json({ error: "Completed challenge history cannot be cancelled" }, 400);
      if (challenge.cancelled_at) return json({ ok: true });
      if (referenceDate > challenge.end_date) return json({ error: "Ended challenges must be finalized, not cancelled" }, 400);

      const { error: cancelError } = await adminClient
        .from("group_challenges")
        .update({ cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", challengeId)
        .eq("group_id", groupId)
        .is("finalized_at", null)
        .is("cancelled_at", null);
      if (cancelError) throw cancelError;
      await adminClient.from("profile_group_challenge_improvement_baselines").delete().eq("challenge_id", challengeId);
      await adminClient.from("group_challenge_rewards").delete().eq("challenge_id", challengeId);
      return json({ ok: true });
    }

    if (action !== "list") return json({ error: "Unsupported challenge action" }, 400);

    const { data: challengesData, error: challengesError } = await adminClient
      .from("group_challenges")
      .select("*")
      .eq("group_id", groupId)
      .order("start_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (challengesError) throw challengesError;
    let challenges = challengesData || [];

    const scoreable = challenges.filter((challenge: any) =>
      !challenge.cancelled_at && !challenge.finalized_at && referenceDate >= challenge.start_date
    );
    const profileIds = [...new Set(allMemberships.map((member: any) => member.profile_id).filter(Boolean))];
    const planByProfile = new Map<string, any>();
    const logsByProfile = new Map<string, any[]>();
    const schedulesByProfile = new Map<string, any[]>();
    const runsByProfile = new Map<string, any[]>();
    const resultsByProfile = new Map<string, any[]>();
    const baselineByKey = new Map<string, any>();

    if (scoreable.length && profileIds.length) {
      const needsImprovement = scoreable.some((challenge: any) => challenge.metric_type === "improvement");
      const oldestImprovementStart = needsImprovement
        ? scoreable.filter((challenge: any) => challenge.metric_type === "improvement").map((challenge: any) => challenge.start_date).sort()[0]
        : referenceDate;
      const assessmentStart = shiftImprovementYmd(oldestImprovementStart, -28);

      const [profilesResult, logs, schedules, runs] = await Promise.all([
        adminClient.from("profiles").select("id,plan_json").in("id", profileIds),
        fetchAllLogs(adminClient, profileIds, referenceDate),
        fetchAllSchedules(adminClient, profileIds, referenceDate),
        needsImprovement ? fetchAllRuns(adminClient, profileIds, assessmentStart, referenceDate) : Promise.resolve([]),
      ]);
      if (profilesResult.error) throw profilesResult.error;
      for (const profile of profilesResult.data || []) planByProfile.set(profile.id, profile.plan_json || {});
      for (const row of logs) {
        const list = logsByProfile.get(row.profile_id) || [];
        list.push({ date_ymd: row.date_ymd, log: row.log_json, log_json: row.log_json });
        logsByProfile.set(row.profile_id, list);
      }
      for (const row of schedules) {
        const list = schedulesByProfile.get(row.profile_id) || [];
        list.push({ effective_date: row.effective_date, schedule_json: row.schedule_json });
        schedulesByProfile.set(row.profile_id, list);
      }

      const runProfile = new Map<string, string>();
      for (const run of runs) {
        runProfile.set(run.id, run.profile_id);
        const list = runsByProfile.get(run.profile_id) || [];
        list.push(run);
        runsByProfile.set(run.profile_id, list);
      }
      if (runs.length) {
        const results = await fetchAllAssessmentResults(adminClient, runs.map((run: any) => run.id));
        for (const result of results) {
          const profileId = runProfile.get(result.assessment_run_id);
          if (!profileId) continue;
          const list = resultsByProfile.get(profileId) || [];
          list.push(result);
          resultsByProfile.set(profileId, list);
        }
      }

      const improvementChallengeIds = scoreable
        .filter((challenge: any) => challenge.metric_type === "improvement")
        .map((challenge: any) => challenge.id);
      if (improvementChallengeIds.length) {
        const { data: baselines, error } = await adminClient
          .from("profile_group_challenge_improvement_baselines")
          .select("challenge_id,profile_id,baseline_json,score_version")
          .in("challenge_id", improvementChallengeIds)
          .eq("score_version", IMPROVEMENT_SCORE_VERSION);
        if (error) throw error;
        for (const row of baselines || []) baselineByKey.set(`${row.challenge_id}:${row.profile_id}`, row.baseline_json || {});
      }
    }

    const challengeScores = new Map<string, any>();

    async function improvementBaseline(challenge: any, member: any) {
      const key = `${challenge.id}:${member.profile_id}`;
      if (baselineByKey.has(key)) return baselineByKey.get(key);
      const window = { startDate: challenge.start_date, endDate: challenge.end_date, complete: false };
      const baseline = buildImprovementBaseline({
        window,
        workoutLogs: logsByProfile.get(member.profile_id) || [],
        assessmentRuns: runsByProfile.get(member.profile_id) || [],
        assessmentResults: resultsByProfile.get(member.profile_id) || [],
      });
      const { error } = await adminClient
        .from("profile_group_challenge_improvement_baselines")
        .upsert({
          challenge_id: challenge.id,
          profile_id: member.profile_id,
          baseline_json: baseline,
          score_version: IMPROVEMENT_SCORE_VERSION,
        }, {
          onConflict: "challenge_id,profile_id,score_version",
          ignoreDuplicates: true,
        });
      if (error) throw error;
      baselineByKey.set(key, baseline);
      return baseline;
    }

    async function scoreChallenge(challenge: any, complete: boolean) {
      const throughDate = complete ? challenge.end_date : minYmd(challenge.end_date, referenceDate) || challenge.end_date;
      const eligibleMembers = allMemberships.filter((member: any) => membershipOverlaps(member, challenge.start_date, throughDate));
      const rows: any[] = [];

      for (const member of eligibleMembers) {
        const bounds = memberBounds(member, challenge, throughDate);
        if (!bounds.eligibleFrom || !bounds.eligibleThrough || bounds.eligibleFrom > bounds.eligibleThrough) continue;

        if (challenge.metric_type === "xp_rate") {
          const xpRows = buildGroupChallengeTrainingXpRows(
            logsByProfile.get(member.profile_id) || [],
            planByProfile.get(member.profile_id) || {}
          );
          rows.push({
            membership_id: member.id,
            xp: sumGroupChallengeTrainingXp(xpRows, bounds.eligibleFrom, bounds.eligibleThrough),
            eligibleDays: countChallengeDays(bounds.eligibleFrom, bounds.eligibleThrough),
          });
          continue;
        }

        if (challenge.metric_type === "consistency") {
          const consistency = scoreConsistencyWindow({
            window: { startDate: challenge.start_date, endDate: challenge.end_date, complete },
            referenceDate: complete ? challenge.end_date : referenceDate,
            eligibleFrom: bounds.eligibleFrom,
            eligibleThrough: bounds.eligibleThrough,
            scheduleSnapshots: schedulesByProfile.get(member.profile_id) || [],
            logs: logsByProfile.get(member.profile_id) || [],
          });
          rows.push({
            membership_id: member.id,
            plannedDays: consistency.plannedDays,
            completedDays: consistency.completedDays,
            consistencyState: consistency.reason,
          });
          continue;
        }

        const baseline = await improvementBaseline(challenge, member);
        const improvement = scoreImprovementWindow({
          window: { startDate: challenge.start_date, endDate: challenge.end_date, complete },
          referenceDate: complete ? challenge.end_date : referenceDate,
          eligibleFrom: bounds.eligibleFrom,
          eligibleThrough: bounds.eligibleThrough,
          workoutLogs: logsByProfile.get(member.profile_id) || [],
          assessmentRuns: runsByProfile.get(member.profile_id) || [],
          assessmentResults: resultsByProfile.get(member.profile_id) || [],
          baselineMetrics: baseline,
        });
        rows.push({
          membership_id: member.id,
          improvementPct: improvement.improvementPct,
          metricCount: improvement.metricCount,
        });
      }

      return evaluateGroupChallenge({
        metricType: challenge.metric_type,
        targetValue: challenge.target_value,
        rows,
      });
    }

    async function ensureRewards(challenge: any, contributorIds: string[], awardDate: string) {
      if (challenge.outcome !== "completed") return;
      const allocation = allocateGroupChallengeRewards(challenge.reward_pool_xp, contributorIds);
      const memberById = new Map(allMemberships.map((member: any) => [member.id, member]));
      const rewardRows = allocation.allocations.map((item: any) => {
        const member = memberById.get(item.membershipId);
        if (!member) return null;
        return {
          challenge_id: challenge.id,
          group_id: groupId,
          membership_id: member.id,
          family_id: member.family_id,
          profile_id: member.profile_id,
          xp_awarded: item.xp,
          awarded_on: awardDate,
          nickname: member.nickname,
          avatar_id: member.avatar_id || "",
          avatar_frame: member.avatar_frame || "",
          avatar_frames_enabled: member.avatar_frames_enabled !== false,
        };
      }).filter(Boolean);
      if (rewardRows.length) {
        const { error } = await adminClient
          .from("group_challenge_rewards")
          .upsert(rewardRows, { onConflict: "challenge_id,membership_id", ignoreDuplicates: true });
        if (error) throw error;
      }
    }

    for (const challenge of scoreable) {
      const complete = referenceDate > challenge.end_date;
      const score = await scoreChallenge(challenge, complete);
      challengeScores.set(challenge.id, score);
      if (!complete) continue;

      const outcome = score.available ? (score.achieved ? "completed" : "missed") : "unavailable";
      const safe = safeEvidence(score);
      const finalEvidence = {
        ...safe,
        contributingAthletes: Array.isArray(score.contributors) ? score.contributors.length : 0,
        contributorMembershipIds: Array.isArray(score.contributors) ? score.contributors : [],
        awardDate: referenceDate,
      };
      const { data: finalized, error: finalizeError } = await adminClient
        .from("group_challenges")
        .update({
          outcome,
          final_value: score.available ? score.value : null,
          final_reason: score.available ? "scored" : score.reason,
          final_evidence: finalEvidence,
          finalized_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", challenge.id)
        .eq("group_id", groupId)
        .is("finalized_at", null)
        .is("cancelled_at", null)
        .select("*")
        .maybeSingle();
      if (finalizeError) throw finalizeError;
      if (finalized) {
        Object.assign(challenge, finalized);
        await ensureRewards(challenge, finalEvidence.contributorMembershipIds, referenceDate);
      }
    }

    // Retry reward materialisation for a previously finalized success if a transient insert failed.
    for (const challenge of challenges.filter((item: any) => item.outcome === "completed" && !item.cancelled_at)) {
      const evidence = challenge.final_evidence && typeof challenge.final_evidence === "object" ? challenge.final_evidence : {};
      const contributorIds = Array.isArray(evidence.contributorMembershipIds) ? evidence.contributorMembershipIds : [];
      const awardDate = validYmd(evidence.awardDate) ? evidence.awardDate : londonYmd(challenge.finalized_at) || referenceDate;
      await ensureRewards(challenge, contributorIds, awardDate);
    }

    // Refresh challenges after any finalization and build only aggregate reward summaries for clients.
    const { data: refreshed, error: refreshError } = await adminClient
      .from("group_challenges")
      .select("*")
      .eq("group_id", groupId)
      .order("start_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (refreshError) throw refreshError;
    challenges = refreshed || [];
    const challengeIds = challenges.map((challenge: any) => challenge.id);
    const rewardSummaryByChallenge = new Map<string, any>();
    if (challengeIds.length) {
      const { data: rewards, error } = await adminClient
        .from("group_challenge_rewards")
        .select("challenge_id,xp_awarded")
        .in("challenge_id", challengeIds);
      if (error) throw error;
      for (const reward of rewards || []) {
        const current = rewardSummaryByChallenge.get(reward.challenge_id) || { distributedXp: 0, recipients: 0 };
        current.distributedXp += Number(reward.xp_awarded || 0);
        current.recipients += 1;
        rewardSummaryByChallenge.set(reward.challenge_id, current);
      }
    }

    const completedChallenges = challenges.filter((challenge: any) => challenge.outcome === "completed").length;
    const rows = challenges.map((challenge: any) => challengeRowForClient(
      challenge,
      referenceDate,
      challenge.finalized_at || challenge.cancelled_at || referenceDate < challenge.start_date
        ? null
        : challengeScores.get(challenge.id) || null,
      rewardSummaryByChallenge.get(challenge.id) || { distributedXp: 0, recipients: 0 }
    ));

    return json({
      rulesVersion: GROUP_CHALLENGE_RULES_VERSION,
      maxOpenChallenges: GROUP_CHALLENGE_MAX_OPEN,
      teamBadge: {
        key: "group_challenges_10",
        title: "Challenge Unit",
        completedChallenges,
        target: 10,
        unlocked: completedChallenges >= 10,
      },
      challenges: rows,
    });
  } catch (error) {
    console.error("Group Challenges failed", error);
    return json({ error: "Could not process Group Challenges" }, 500);
  }
});
