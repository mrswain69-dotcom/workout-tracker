export const GROUP_TEAM_PR_SCORE_VERSION = 1;

const STRENGTH_TYPES = new Set(["strength", "hiit", "box"]);
const CARDIO_TYPES = new Set(["cardio", "run", "swim", "walk", "row", "cycle", "bike"]);

function cleanText(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function finitePositive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function finiteNullable(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round1(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round((number + Number.EPSILON) * 10) / 10 : null;
}

function parseYmd(value) {
  const text = cleanText(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normaliseKeyPart(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";
}

function maxYmd(...values) {
  return values.filter((value) => parseYmd(value)).sort().at(-1) || "";
}

function minYmd(...values) {
  return values.filter((value) => parseYmd(value)).sort()[0] || "";
}

function workoutDate(row) {
  return cleanText(row?.date_ymd || row?.date);
}

function workoutLog(row) {
  return row?.log ?? row?.log_json ?? null;
}

function bestStrengthObservation(sets = []) {
  const valid = (Array.isArray(sets) ? sets : []).filter((set) => set && typeof set === "object");
  const weighted = valid
    .map((set) => {
      const reps = finitePositive(set.reps);
      const weight = finitePositive(set.weight);
      return reps && weight ? reps * weight : null;
    })
    .filter(Number.isFinite);
  if (weighted.length) return { metricKind: "weighted_set_work", value: Math.max(...weighted) };

  const reps = valid.map((set) => finitePositive(set.reps)).filter(Number.isFinite);
  if (reps.length) return { metricKind: "reps", value: Math.max(...reps) };
  return null;
}

function cardioSpeed(block) {
  const cardio = block?.cardio && typeof block.cardio === "object" ? block.cardio : {};
  const direct = finitePositive(cardio.avgSpeedKmh);
  if (direct) return direct;
  const distance = finitePositive(cardio.distanceKm);
  const duration = finitePositive(cardio.durationMin);
  if (!distance || !duration) return null;
  return distance / (duration / 60);
}

function cardioDistanceBucket(block) {
  const distance = finitePositive(block?.cardio?.distanceKm);
  if (!distance || distance < 0.25) return null;
  return Math.round(distance * 2) / 2;
}

export function extractTrainingPrObservations(rows = []) {
  const observations = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const date = workoutDate(row);
    const log = workoutLog(row);
    if (!parseYmd(date) || !log || typeof log !== "object") continue;

    for (const block of Array.isArray(log.blocks) ? log.blocks : []) {
      if (!block || block.cancelled) continue;
      const typeId = normaliseKeyPart(block.typeId);

      if (STRENGTH_TYPES.has(typeId)) {
        const setsByMovement = block.sets && typeof block.sets === "object" ? block.sets : {};
        for (const [movementId, sets] of Object.entries(setsByMovement)) {
          const best = bestStrengthObservation(sets);
          if (!best) continue;
          observations.push({
            date,
            key: `strength:${typeId}:${normaliseKeyPart(movementId)}:${best.metricKind}`,
            value: best.value,
          });
        }
        continue;
      }

      if (CARDIO_TYPES.has(typeId)) {
        const speed = cardioSpeed(block);
        const bucket = cardioDistanceBucket(block);
        if (!speed || bucket === null) continue;
        const sport = normaliseKeyPart(block.cardioType || typeId);
        observations.push({
          date,
          key: `cardio:${sport}:${bucket.toFixed(1)}km:speed`,
          value: speed,
        });
      }
    }
  }

  return observations.sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key));
}

function collapseSameDayObservations(observations = []) {
  const best = new Map();
  for (const observation of observations) {
    const id = `${observation.date}|${observation.key}`;
    const current = best.get(id);
    if (!current || observation.value > current.value) best.set(id, observation);
  }
  return [...best.values()].sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key));
}

export function buildTrainingPrSummary({
  logs = [],
  window,
  referenceDate = "",
  eligibleFrom = "",
  eligibleThrough = "",
} = {}) {
  if (!window || !parseYmd(window.startDate) || !parseYmd(window.endDate)) {
    throw new Error("Invalid PR competition window");
  }

  const startDate = maxYmd(window.startDate, eligibleFrom) || window.startDate;
  const throughDate = minYmd(window.endDate, referenceDate, eligibleThrough)
    || minYmd(window.endDate, referenceDate)
    || minYmd(window.endDate, eligibleThrough)
    || window.endDate;

  if (startDate > throughDate) {
    return {
      state: "not_started",
      startDate: window.startDate,
      endDate: window.endDate,
      eligibleFrom: startDate,
      throughDate,
      prCount: 0,
      latestPrDate: null,
    };
  }

  const observations = collapseSameDayObservations(
    extractTrainingPrObservations(logs).filter((item) => item.date <= throughDate)
  );
  const bestByKey = new Map();
  let prCount = 0;
  let latestPrDate = null;

  for (const observation of observations) {
    const previousBest = bestByKey.get(observation.key);
    const inEligibleWindow = observation.date >= startDate && observation.date <= throughDate;
    if (inEligibleWindow && previousBest !== undefined && observation.value > previousBest + Number.EPSILON) {
      prCount += 1;
      latestPrDate = observation.date;
    }
    if (previousBest === undefined || observation.value > previousBest) {
      bestByKey.set(observation.key, observation.value);
    }
  }

  return {
    state: prCount > 0 ? "scored" : "no_prs",
    startDate: window.startDate,
    endDate: window.endDate,
    eligibleFrom: startDate,
    throughDate,
    prCount,
    latestPrDate,
  };
}

export function rankTeamPrRows(rows = []) {
  const ordered = [...(Array.isArray(rows) ? rows : [])].sort((a, b) => {
    const aCount = Math.max(0, Number(a?.prCount || 0));
    const bCount = Math.max(0, Number(b?.prCount || 0));
    if (aCount !== bCount) return bCount - aCount;
    return cleanText(a?.nickname).localeCompare(cleanText(b?.nickname), "en", { sensitivity: "base" });
  });

  let lastCount = null;
  let lastRank = 0;
  return ordered.map((row, index) => {
    const count = Math.max(0, Number(row?.prCount || 0));
    if (!count) return { ...row, rank: null };
    if (lastCount === null || count !== lastCount) lastRank = index + 1;
    lastCount = count;
    return { ...row, rank: lastRank };
  });
}

export function buildTeamConsistency(rows = []) {
  const source = Array.isArray(rows) ? rows : [];
  if (source.some((row) => row?.consistencyState === "schedule_unavailable")) {
    return { available: false, reason: "schedule_unavailable", plannedDays: 0, completedDays: 0, consistencyPct: null };
  }

  const plannedDays = source.reduce((sum, row) => sum + Math.max(0, Number(row?.plannedDays || 0)), 0);
  const completedDays = source.reduce((sum, row) => sum + Math.max(0, Number(row?.completedDays || 0)), 0);
  if (!plannedDays) {
    return { available: true, reason: "no_planned_days", plannedDays: 0, completedDays: 0, consistencyPct: null };
  }

  return {
    available: true,
    reason: "scored",
    plannedDays,
    completedDays,
    consistencyPct: round1((completedDays / plannedDays) * 100),
  };
}

export function buildTeamImprovementPoint(period = null) {
  if (!period?.available) return null;
  const scores = (Array.isArray(period?.rows) ? period.rows : [])
    .filter((row) => Number(row?.improvementMetricCount || row?.metricCount || 0) > 0)
    .map((row) => finiteNullable(row?.improvementPct))
    .filter((value) => value !== null);
  if (!scores.length) return {
    startDate: period.startDate || "",
    endDate: period.endDate || "",
    state: period.state || "live",
    improvementPct: null,
    scoredAthletes: 0,
  };
  return {
    startDate: period.startDate || "",
    endDate: period.endDate || "",
    state: period.state || "live",
    improvementPct: round1(scores.reduce((sum, value) => sum + value, 0) / scores.length),
    scoredAthletes: scores.length,
  };
}

export function buildTeamImprovementSeries(current = null, history = []) {
  return [...(Array.isArray(history) ? history : []), current]
    .filter(Boolean)
    .map(buildTeamImprovementPoint)
    .filter(Boolean)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

function participated(row) {
  return Number(row?.xp || 0) > 0
    || Number(row?.completedDays || 0) > 0
    || Number(row?.improvementMetricCount || 0) > 0;
}

export function buildTeamSeasonSummary(period = null) {
  if (!period?.available) return null;
  const rows = Array.isArray(period?.rows) ? period.rows : [];
  const improvement = buildTeamImprovementPoint(period);
  return {
    seasonNumber: Number(period?.seasonNumber || 1),
    weekNumber: Number(period?.weekNumber || 1),
    startDate: period?.startDate || "",
    endDate: period?.endDate || "",
    athleteCount: rows.length,
    participatingAthletes: rows.filter(participated).length,
    teamXp: rows.reduce((sum, row) => sum + Math.max(0, Number(row?.xp || 0)), 0),
    consistency: buildTeamConsistency(rows),
    improvementPct: improvement?.improvementPct ?? null,
    improvementScoredAthletes: improvement?.scoredAthletes || 0,
  };
}

export function selectTeamTopThree(period = null, metric = "xp") {
  const rows = Array.isArray(period?.rows) ? period.rows : [];
  const rankKey = metric === "consistency"
    ? "consistencyRank"
    : metric === "improvement"
      ? "improvementRank"
      : "xpRank";
  return rows
    .filter((row) => {
      const rank = Number(row?.[rankKey]);
      if (!rank || rank > 3) return false;
      if (metric === "consistency") return Number(row?.plannedDays || 0) > 0 && finiteNullable(row?.consistencyPct) !== null;
      if (metric === "improvement") return Number(row?.improvementMetricCount || 0) > 0 && finiteNullable(row?.improvementPct) !== null;
      return finiteNullable(row?.xp) !== null;
    })
    .sort((a, b) => Number(a?.[rankKey]) - Number(b?.[rankKey]) || cleanText(a?.nickname).localeCompare(cleanText(b?.nickname), "en", { sensitivity: "base" }));
}
