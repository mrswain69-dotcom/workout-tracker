export const IMPROVEMENT_SCORE_VERSION = 1;
export const IMPROVEMENT_BASELINE_DAYS = 28;
export const IMPROVEMENT_METRIC_CAP_PCT = 50;

const STRENGTH_TYPES = new Set(["strength", "hiit", "box"]);
const CARDIO_TYPES = new Set(["cardio", "run", "swim", "walk", "row", "cycle", "bike"]);

function cleanText(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function finitePositive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function roundTo(value, places = 1) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const factor = 10 ** places;
  return Math.round((number + Number.EPSILON) * factor) / factor;
}

function parseYmd(value) {
  const text = cleanText(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function shiftImprovementYmd(value, days) {
  const date = parseYmd(value);
  if (!date) return "";
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

export function getImprovementWeekStartYmd(referenceYmd) {
  const date = parseYmd(referenceYmd);
  if (!date) return "";
  const diffToMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - diffToMonday);
  return date.toISOString().slice(0, 10);
}

export function getCurrentImprovementWeekWindow(referenceYmd) {
  const startDate = getImprovementWeekStartYmd(referenceYmd);
  if (!startDate) return null;
  return {
    key: startDate,
    startDate,
    endDate: shiftImprovementYmd(startDate, 6),
    complete: false,
  };
}

export function getPreviousCompletedImprovementWeekWindows(referenceYmd, count = 4) {
  const currentStart = getImprovementWeekStartYmd(referenceYmd);
  if (!currentStart) return [];
  const size = Math.max(0, Math.min(12, Number(count) || 0));
  return Array.from({ length: size }, (_, index) => {
    const startDate = shiftImprovementYmd(currentStart, -7 * (index + 1));
    return {
      key: startDate,
      startDate,
      endDate: shiftImprovementYmd(startDate, 6),
      complete: true,
    };
  });
}

function normaliseKeyPart(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";
}

function average(values = []) {
  const valid = values.map(Number).filter(Number.isFinite);
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
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
      return reps && weight ? weight * reps : null;
    })
    .filter(Number.isFinite);
  if (weighted.length) {
    return { metricKind: "weighted_set_work", value: Math.max(...weighted) };
  }

  const reps = valid.map((set) => finitePositive(set.reps)).filter(Number.isFinite);
  if (reps.length) {
    return { metricKind: "reps", value: Math.max(...reps) };
  }
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

export function extractWorkoutImprovementObservations(rows = []) {
  const observations = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const date = workoutDate(row);
    const log = workoutLog(row);
    if (!parseYmd(date) || !log || typeof log !== "object") continue;
    const blocks = Array.isArray(log.blocks) ? log.blocks : [];

    for (const block of blocks) {
      if (!block || block.cancelled) continue;
      const typeId = normaliseKeyPart(block.typeId);

      if (STRENGTH_TYPES.has(typeId)) {
        const setsByMovement = block.sets && typeof block.sets === "object" ? block.sets : {};
        for (const [movement, sets] of Object.entries(setsByMovement)) {
          const best = bestStrengthObservation(sets);
          if (!best) continue;
          observations.push({
            date,
            key: `training:${typeId}:${normaliseKeyPart(movement)}:${best.metricKind}`,
            source: "training",
            direction: "higher",
            percentageAllowed: true,
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
          source: "training",
          direction: "higher",
          percentageAllowed: true,
          value: speed,
        });
      }
    }
  }
  return observations;
}

function metricConfig(snapshot) {
  const direct = snapshot?.metricConfig ?? snapshot?.metric_config;
  return direct && typeof direct === "object" && !Array.isArray(direct) ? direct : {};
}

function assessmentMetricInfo(snapshot = {}) {
  const config = metricConfig(snapshot);
  const direction = cleanText(snapshot.scoringDirection ?? snapshot.scoring_direction ?? "higher").toLowerCase() === "lower"
    ? "lower"
    : "higher";
  const allowNegative = !!(snapshot.allowNegative ?? snapshot.allow_negative ?? false);
  const percentageMode = cleanText(config.percentageImprovement ?? config.percentage_improvement).toLowerCase();
  const percentageAllowed = percentageMode !== "never" && (!allowNegative || percentageMode === "allow");
  const metricType = normaliseKeyPart(snapshot.metricType ?? snapshot.metric_type ?? "numeric");
  const unit = normaliseKeyPart(snapshot.unit || "unitless");
  const comparisonMode = normaliseKeyPart(config.comparisonMode ?? config.comparison_mode ?? "default");
  return { direction, percentageAllowed, signature: `${metricType}:${unit}:${direction}:${comparisonMode}` };
}

export function extractAssessmentImprovementObservations({ runs = [], results = [] } = {}) {
  const runById = new Map(
    (Array.isArray(runs) ? runs : [])
      .filter((run) => run?.id && cleanText(run.status).toLowerCase() === "completed" && parseYmd(run.date_ymd))
      .map((run) => [run.id, run])
  );
  const observations = [];

  for (const result of Array.isArray(results) ? results : []) {
    if (!result || result.is_valid === false) continue;
    const run = runById.get(result.assessment_run_id);
    if (!run) continue;
    const testId = result.test_id || result.assessment_template_test_id;
    if (!testId) continue;
    const info = assessmentMetricInfo(result.metric_snapshot || {});
    if (!info.percentageAllowed) continue;
    const prefix = `assessment:${normaliseKeyPart(testId)}:${info.signature}`;
    const overall = finiteNumber(result.comparable_value);
    if (overall !== null) {
      observations.push({
        date: run.date_ymd,
        key: `${prefix}:overall`,
        source: "assessment",
        direction: info.direction,
        percentageAllowed: true,
        value: overall,
      });
      continue;
    }

    const dimensions = result.comparable_dimensions && typeof result.comparable_dimensions === "object"
      ? result.comparable_dimensions
      : {};
    for (const dimension of ["left", "right"]) {
      const value = finiteNumber(dimensions[dimension]);
      if (value === null) continue;
      observations.push({
        date: run.date_ymd,
        key: `${prefix}:${dimension}`,
        source: "assessment",
        direction: info.direction,
        percentageAllowed: true,
        value,
      });
    }
  }
  return observations;
}

export function buildImprovementObservations(input = {}) {
  return [
    ...extractWorkoutImprovementObservations(input.workoutLogs || []),
    ...extractAssessmentImprovementObservations({
      runs: input.assessmentRuns || [],
      results: input.assessmentResults || [],
    }),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key));
}

export function buildImprovementBaseline({ window, workoutLogs = [], assessmentRuns = [], assessmentResults = [] } = {}) {
  if (!window || !parseYmd(window.startDate)) return {};
  const baselineStart = shiftImprovementYmd(window.startDate, -IMPROVEMENT_BASELINE_DAYS);
  const baselineEnd = shiftImprovementYmd(window.startDate, -1);
  const observations = buildImprovementObservations({ workoutLogs, assessmentRuns, assessmentResults });
  const byKey = new Map();

  for (const observation of observations) {
    if (observation.date < baselineStart || observation.date > baselineEnd) continue;
    if (!observation.percentageAllowed) continue;
    const list = byKey.get(observation.key) || [];
    list.push(observation);
    byKey.set(observation.key, list);
  }

  const baseline = {};
  for (const [key, items] of byKey.entries()) {
    const baselineAverage = average(items.map((item) => item.value));
    if (!(baselineAverage > 0)) continue;
    baseline[key] = {
      average: baselineAverage,
      direction: items[0]?.direction === "lower" ? "lower" : "higher",
      source: items[0]?.source === "assessment" ? "assessment" : "training",
      observations: items.length,
    };
  }
  return baseline;
}

function maxYmd(...values) {
  return values.filter((value) => parseYmd(value)).sort().at(-1) || "";
}

function minYmd(...values) {
  return values.filter((value) => parseYmd(value)).sort()[0] || "";
}

export function scoreImprovementWindow({
  window,
  referenceDate = "",
  eligibleFrom = "",
  eligibleThrough = "",
  workoutLogs = [],
  assessmentRuns = [],
  assessmentResults = [],
  baselineMetrics = null,
} = {}) {
  if (!window || !parseYmd(window.startDate) || !parseYmd(window.endDate)) {
    throw new Error("Invalid improvement window");
  }

  const startDate = maxYmd(window.startDate, eligibleFrom) || window.startDate;
  const throughDate = window.complete
    ? minYmd(window.endDate, eligibleThrough) || window.endDate
    : minYmd(window.endDate, referenceDate, eligibleThrough) || minYmd(window.endDate, referenceDate) || window.endDate;

  if (startDate > throughDate) {
    return {
      available: false,
      reason: "not_started",
      startDate: window.startDate,
      endDate: window.endDate,
      baselineStart: shiftImprovementYmd(window.startDate, -IMPROVEMENT_BASELINE_DAYS),
      baselineEnd: shiftImprovementYmd(window.startDate, -1),
      improvementPct: null,
      metricCount: 0,
      improvedMetricCount: 0,
      declinedMetricCount: 0,
      unchangedMetricCount: 0,
      cappedMetricCount: 0,
    };
  }

  const baseline = baselineMetrics && typeof baselineMetrics === "object" && !Array.isArray(baselineMetrics)
    ? baselineMetrics
    : buildImprovementBaseline({ window, workoutLogs, assessmentRuns, assessmentResults });
  const observations = buildImprovementObservations({ workoutLogs, assessmentRuns, assessmentResults });
  const currentByKey = new Map();

  for (const observation of observations) {
    if (observation.date < startDate || observation.date > throughDate) continue;
    const list = currentByKey.get(observation.key) || [];
    list.push(observation);
    currentByKey.set(observation.key, list);
  }

  if (!currentByKey.size) {
    return {
      available: true,
      reason: "no_current_performance",
      startDate: window.startDate,
      endDate: window.endDate,
      baselineStart: shiftImprovementYmd(window.startDate, -IMPROVEMENT_BASELINE_DAYS),
      baselineEnd: shiftImprovementYmd(window.startDate, -1),
      improvementPct: null,
      metricCount: 0,
      improvedMetricCount: 0,
      declinedMetricCount: 0,
      unchangedMetricCount: 0,
      cappedMetricCount: 0,
    };
  }

  const metricSignals = [];
  for (const [key, items] of currentByKey.entries()) {
    const baselineMetric = baseline[key];
    const baselineAverage = finitePositive(baselineMetric?.average);
    const currentAverage = average(items.map((item) => item.value));
    if (!baselineAverage || !(currentAverage > 0)) continue;
    const direction = baselineMetric.direction === "lower" ? "lower" : "higher";
    const rawPct = direction === "lower"
      ? ((baselineAverage - currentAverage) / baselineAverage) * 100
      : ((currentAverage - baselineAverage) / baselineAverage) * 100;
    if (!Number.isFinite(rawPct)) continue;
    const cappedPct = Math.max(-IMPROVEMENT_METRIC_CAP_PCT, Math.min(IMPROVEMENT_METRIC_CAP_PCT, rawPct));
    metricSignals.push({ key, rawPct, cappedPct });
  }

  if (!metricSignals.length) {
    return {
      available: true,
      reason: "no_comparable_baseline",
      startDate: window.startDate,
      endDate: window.endDate,
      baselineStart: shiftImprovementYmd(window.startDate, -IMPROVEMENT_BASELINE_DAYS),
      baselineEnd: shiftImprovementYmd(window.startDate, -1),
      improvementPct: null,
      metricCount: 0,
      improvedMetricCount: 0,
      declinedMetricCount: 0,
      unchangedMetricCount: 0,
      cappedMetricCount: 0,
    };
  }

  const improvementPct = roundTo(average(metricSignals.map((metric) => metric.cappedPct)), 1);
  const epsilon = 0.05;
  return {
    available: true,
    reason: "scored",
    startDate: window.startDate,
    endDate: window.endDate,
    baselineStart: shiftImprovementYmd(window.startDate, -IMPROVEMENT_BASELINE_DAYS),
    baselineEnd: shiftImprovementYmd(window.startDate, -1),
    improvementPct,
    metricCount: metricSignals.length,
    improvedMetricCount: metricSignals.filter((metric) => metric.cappedPct > epsilon).length,
    declinedMetricCount: metricSignals.filter((metric) => metric.cappedPct < -epsilon).length,
    unchangedMetricCount: metricSignals.filter((metric) => Math.abs(metric.cappedPct) <= epsilon).length,
    cappedMetricCount: metricSignals.filter((metric) => Math.abs(metric.rawPct) > IMPROVEMENT_METRIC_CAP_PCT).length,
  };
}

export function rankImprovementRows(rows = []) {
  const ordered = [...(Array.isArray(rows) ? rows : [])].sort((a, b) => {
    const aScored = Number.isFinite(Number(a?.improvementPct));
    const bScored = Number.isFinite(Number(b?.improvementPct));
    if (aScored !== bScored) return aScored ? -1 : 1;
    if (aScored && bScored) {
      const difference = Number(b.improvementPct) - Number(a.improvementPct);
      if (difference) return difference;
    }
    return cleanText(a?.nickname).localeCompare(cleanText(b?.nickname), "en", { sensitivity: "base" });
  });

  let lastScore = null;
  let lastRank = 0;
  return ordered.map((row, index) => {
    const scored = Number.isFinite(Number(row?.improvementPct));
    if (!scored) return { ...row, rank: null };
    const score = Number(row.improvementPct);
    if (lastScore === null || score !== lastScore) lastRank = index + 1;
    lastScore = score;
    return { ...row, rank: lastRank };
  });
}
