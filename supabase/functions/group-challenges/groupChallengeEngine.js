export const GROUP_CHALLENGE_RULES_VERSION = 1;
export const GROUP_CHALLENGE_MAX_OPEN = 3;
export const GROUP_CHALLENGE_MAX_REWARD_PER_ATHLETE = 30;
export const GROUP_CHALLENGE_DURATIONS = Object.freeze([7, 14, 28, 42]);

const DURATION_REWARD_FACTOR = Object.freeze({
  7: 1,
  14: 1.5,
  28: 2,
  42: 2.5,
});

export const GROUP_CHALLENGE_TEMPLATES = Object.freeze([
  Object.freeze({
    key: "xp_100",
    metricType: "xp_rate",
    targetValue: 100,
    targetUnit: "xp_per_athlete_week",
    difficulty: 1,
    title: "Team XP Rhythm",
    description: "Average at least 100 XP per eligible athlete per week across the challenge window.",
  }),
  Object.freeze({
    key: "xp_175",
    metricType: "xp_rate",
    targetValue: 175,
    targetUnit: "xp_per_athlete_week",
    difficulty: 2,
    title: "Team XP Drive",
    description: "Average at least 175 XP per eligible athlete per week across the challenge window.",
  }),
  Object.freeze({
    key: "xp_250",
    metricType: "xp_rate",
    targetValue: 250,
    targetUnit: "xp_per_athlete_week",
    difficulty: 3,
    title: "Team XP Push",
    description: "Average at least 250 XP per eligible athlete per week across the challenge window.",
  }),
  Object.freeze({
    key: "consistency_75",
    metricType: "consistency",
    targetValue: 75,
    targetUnit: "pct",
    difficulty: 1,
    title: "Consistency 75",
    description: "Complete at least 75% of the Group's eligible planned days.",
  }),
  Object.freeze({
    key: "consistency_85",
    metricType: "consistency",
    targetValue: 85,
    targetUnit: "pct",
    difficulty: 2,
    title: "Consistency 85",
    description: "Complete at least 85% of the Group's eligible planned days.",
  }),
  Object.freeze({
    key: "consistency_95",
    metricType: "consistency",
    targetValue: 95,
    targetUnit: "pct",
    difficulty: 3,
    title: "Consistency 95",
    description: "Complete at least 95% of the Group's eligible planned days.",
  }),
  Object.freeze({
    key: "improvement_2",
    metricType: "improvement",
    targetValue: 2,
    targetUnit: "pct",
    difficulty: 1,
    title: "Team Progress +2",
    description: "Average at least +2% self-relative Improvement across athletes with comparable evidence.",
  }),
  Object.freeze({
    key: "improvement_5",
    metricType: "improvement",
    targetValue: 5,
    targetUnit: "pct",
    difficulty: 2,
    title: "Team Progress +5",
    description: "Average at least +5% self-relative Improvement across athletes with comparable evidence.",
  }),
  Object.freeze({
    key: "improvement_8",
    metricType: "improvement",
    targetValue: 8,
    targetUnit: "pct",
    difficulty: 3,
    title: "Team Progress +8",
    description: "Average at least +8% self-relative Improvement across athletes with comparable evidence.",
  }),
]);

const TEMPLATE_BY_KEY = new Map(GROUP_CHALLENGE_TEMPLATES.map((template) => [template.key, template]));

function finiteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round1(value) {
  const number = finiteNumber(value);
  return number === null ? null : Math.round((number + Number.EPSILON) * 10) / 10;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function parseYmd(value) {
  const text = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function shiftChallengeYmd(value, days) {
  const date = parseYmd(value);
  if (!date) return "";
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

export function countChallengeDays(startDate, endDate) {
  const start = parseYmd(startDate);
  const end = parseYmd(endDate);
  if (!start || !end || end < start) return 0;
  return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
}

export function getGroupChallengeTemplate(templateKey) {
  return TEMPLATE_BY_KEY.get(String(templateKey || "")) || null;
}

export function calculateGroupChallengeRewardPool(templateKey, durationDays) {
  const template = getGroupChallengeTemplate(templateKey);
  const duration = Number(durationDays);
  const factor = DURATION_REWARD_FACTOR[duration];
  if (!template || !factor) return null;
  return Math.min(200, Math.round(20 * template.difficulty * factor));
}

export function buildGroupChallengeDefinition({ templateKey, durationDays, startDate } = {}) {
  const template = getGroupChallengeTemplate(templateKey);
  const duration = Number(durationDays);
  if (!template || !GROUP_CHALLENGE_DURATIONS.includes(duration) || !parseYmd(startDate)) return null;
  const rewardPoolXp = calculateGroupChallengeRewardPool(template.key, duration);
  return {
    templateKey: template.key,
    metricType: template.metricType,
    title: template.title,
    description: template.description,
    targetValue: template.targetValue,
    targetUnit: template.targetUnit,
    startDate,
    endDate: shiftChallengeYmd(startDate, duration - 1),
    durationDays: duration,
    rewardPoolXp,
    rulesVersion: GROUP_CHALLENGE_RULES_VERSION,
  };
}

export function groupChallengeDisplayState(challenge, referenceDate) {
  if (!challenge) return "unknown";
  if (challenge.cancelled_at || challenge.cancelledAt) return "cancelled";
  const outcome = challenge.outcome || null;
  if (outcome) return outcome;
  const startDate = challenge.start_date || challenge.startDate || "";
  const endDate = challenge.end_date || challenge.endDate || "";
  if (!parseYmd(referenceDate) || !parseYmd(startDate) || !parseYmd(endDate)) return "unknown";
  if (referenceDate < startDate) return "scheduled";
  if (referenceDate <= endDate) return "live";
  return "awaiting_finalization";
}

export function buildXpRateChallengeScore(rows = []) {
  const source = Array.isArray(rows) ? rows : [];
  const totalXp = source.reduce((sum, row) => sum + Math.max(0, Number(row?.xp || 0)), 0);
  const eligibleAthleteDays = source.reduce((sum, row) => sum + Math.max(0, Number(row?.eligibleDays || 0)), 0);
  const contributors = source.filter((row) => Number(row?.xp || 0) > 0).map((row) => row.membership_id).filter(Boolean);
  if (!eligibleAthleteDays) {
    return {
      available: false,
      reason: "no_eligible_athlete_days",
      value: null,
      totalXp,
      eligibleAthleteDays: 0,
      contributors,
    };
  }
  return {
    available: true,
    reason: "scored",
    value: round1((totalXp / eligibleAthleteDays) * 7),
    totalXp,
    eligibleAthleteDays,
    contributors,
  };
}

export function buildConsistencyChallengeScore(rows = []) {
  const source = Array.isArray(rows) ? rows : [];
  if (source.some((row) => row?.consistencyState === "schedule_unavailable")) {
    return {
      available: false,
      reason: "schedule_unavailable",
      value: null,
      plannedDays: 0,
      completedDays: 0,
      contributors: [],
    };
  }
  const plannedDays = source.reduce((sum, row) => sum + Math.max(0, Number(row?.plannedDays || 0)), 0);
  const completedDays = source.reduce((sum, row) => sum + Math.max(0, Number(row?.completedDays || 0)), 0);
  const contributors = source.filter((row) => Number(row?.completedDays || 0) > 0).map((row) => row.membership_id).filter(Boolean);
  if (!plannedDays) {
    return {
      available: false,
      reason: "no_planned_days",
      value: null,
      plannedDays: 0,
      completedDays: 0,
      contributors,
    };
  }
  return {
    available: true,
    reason: "scored",
    value: round1((completedDays / plannedDays) * 100),
    plannedDays,
    completedDays,
    contributors,
  };
}

export function buildImprovementChallengeScore(rows = []) {
  const source = Array.isArray(rows) ? rows : [];
  const scored = source
    .filter((row) => Number(row?.metricCount || row?.improvementMetricCount || 0) > 0)
    .map((row) => ({ membership_id: row.membership_id, value: finiteNumber(row?.improvementPct) }))
    .filter((row) => row.value !== null);
  if (!scored.length) {
    return {
      available: false,
      reason: "no_comparable_improvement",
      value: null,
      scoredAthletes: 0,
      contributors: [],
    };
  }
  return {
    available: true,
    reason: "scored",
    value: round1(scored.reduce((sum, row) => sum + row.value, 0) / scored.length),
    scoredAthletes: scored.length,
    contributors: scored.map((row) => row.membership_id).filter(Boolean),
  };
}

export function evaluateGroupChallenge({ metricType, targetValue, rows = [] } = {}) {
  const target = finiteNumber(targetValue);
  if (target === null || target <= 0) throw new Error("Invalid challenge target");
  const score = metricType === "xp_rate"
    ? buildXpRateChallengeScore(rows)
    : metricType === "consistency"
      ? buildConsistencyChallengeScore(rows)
      : metricType === "improvement"
        ? buildImprovementChallengeScore(rows)
        : null;
  if (!score) throw new Error("Unsupported challenge metric");
  const value = finiteNumber(score.value);
  return {
    ...score,
    targetValue: target,
    progressPct: value === null ? null : round1(clamp((value / target) * 100, 0, 100)),
    achieved: score.available && value !== null && value >= target,
  };
}

export function allocateGroupChallengeRewards(rewardPoolXp, contributorIds = []) {
  const pool = Math.max(0, Math.min(200, Math.floor(Number(rewardPoolXp) || 0)));
  const ids = [...new Set((Array.isArray(contributorIds) ? contributorIds : []).filter(Boolean).map(String))].sort();
  if (!pool || !ids.length) return { allocations: [], distributedXp: 0, unusedXp: pool };

  const uncappedShare = Math.floor(pool / ids.length);
  const baseShare = Math.min(GROUP_CHALLENGE_MAX_REWARD_PER_ATHLETE, uncappedShare);
  let remaining = pool - baseShare * ids.length;
  const allocations = ids.map((membershipId) => ({ membershipId, xp: baseShare }));

  for (const allocation of allocations) {
    if (remaining <= 0) break;
    const capacity = GROUP_CHALLENGE_MAX_REWARD_PER_ATHLETE - allocation.xp;
    if (capacity <= 0) continue;
    const extra = Math.min(capacity, 1, remaining);
    allocation.xp += extra;
    remaining -= extra;
  }

  const nonZero = allocations.filter((allocation) => allocation.xp > 0);
  const distributedXp = nonZero.reduce((sum, allocation) => sum + allocation.xp, 0);
  return { allocations: nonZero, distributedXp, unusedXp: pool - distributedXp };
}
