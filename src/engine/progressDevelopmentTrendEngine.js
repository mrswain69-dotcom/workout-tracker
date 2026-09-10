import { compareAssessmentHistoryEntries } from "./assessmentHistoryEngine.js";
import { buildAssessmentProgress } from "./progressAssessmentEngine.js";

function cleanText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function valueOf(obj, camelKey, snakeKey, fallback = undefined) {
  if (!obj || typeof obj !== "object") return fallback;
  if (obj[camelKey] !== undefined) return obj[camelKey];
  if (snakeKey && obj[snakeKey] !== undefined) return obj[snakeKey];
  return fallback;
}

function finiteOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function roundTo(value, places = 3) {
  const number = finiteOrNull(value);
  if (number === null) return null;
  const factor = 10 ** places;
  return Math.round((number + Number.EPSILON) * factor) / factor;
}

function mean(values) {
  const numbers = (Array.isArray(values) ? values : [])
    .map(finiteOrNull)
    .filter((value) => value !== null);
  if (!numbers.length) return null;
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

function developmentTagIdOf(row) {
  return cleanText(valueOf(row, "developmentTagId", "development_tag_id", row?.id));
}

function developmentTagNameOf(row) {
  return cleanText(row?.name, "Development");
}

function developmentTagSlugOf(row) {
  return cleanText(row?.slug, "");
}

function relationTagIdOf(row) {
  return cleanText(valueOf(row, "developmentTagId", "development_tag_id", ""));
}

function relationTestIdOf(row) {
  return cleanText(valueOf(row, "testId", "test_id", ""));
}

function statusScore(status) {
  if (status === "improved") return 1;
  if (status === "declined") return -1;
  if (status === "same" || status === "unchanged") return 0;
  return null;
}

function classifySignals(scores) {
  const safeScores = (Array.isArray(scores) ? scores : [])
    .map(finiteOrNull)
    .filter((value) => value !== null);
  if (!safeScores.length) return "baseline_set";

  const total = safeScores.reduce((sum, value) => sum + value, 0);
  if (total > 0) return "improving";
  if (total < 0) return "declining";
  if (safeScores.some((value) => value !== 0)) return "mixed";
  return "unchanged";
}

function trendRecordScore(record) {
  const directionScore = finiteOrNull(record?.directionScore);
  if (directionScore !== null) return directionScore;
  return finiteOrNull(record?.trendScore);
}

function classifyTrendRecords(records) {
  const ready = (Array.isArray(records) ? records : [])
    .map((record) => ({
      score: trendRecordScore(record),
      state: cleanText(record?.status || record?.state, ""),
    }))
    .filter((record) => record.score !== null);
  if (!ready.length) return "baseline_set";

  const total = ready.reduce((sum, record) => sum + record.score, 0);
  if (total > 0) return "improving";
  if (total < 0) return "declining";

  const states = new Set(ready.map((record) => record.state));
  if (
    states.has("mixed") ||
    (states.has("improving") && states.has("declining")) ||
    ready.some((record) => record.score !== 0)
  ) {
    return "mixed";
  }
  return "unchanged";
}

function latestCompatibleMetricCohort(history) {
  const entries = Array.isArray(history?.entries) ? history.entries : [];
  const latest = entries.at(-1) || null;
  if (!latest) return [];

  const latestMetricKey = cleanText(latest.metricKey, "");
  let start = entries.length - 1;
  while (
    start > 0 &&
    cleanText(entries[start - 1]?.metricKey, "") === latestMetricKey
  ) {
    start -= 1;
  }
  return entries.slice(start);
}

function comparisonSignal(current, previous) {
  const compared = compareAssessmentHistoryEntries(current, previous);
  if (!compared?.available || !compared.comparison) {
    return {
      available: false,
      reason: compared?.reason || "unavailable",
      directionScore: null,
      status: "unavailable",
      percentageImprovement: null,
      percentageSafe: false,
      dimensions: [],
    };
  }

  const dimensions = Object.entries(compared.comparison.dimensions || {})
    .map(([dimension, detail]) => ({ dimension, ...(detail || {}) }))
    .filter((detail) => detail.status && detail.status !== "unavailable");

  if (!dimensions.length) {
    return {
      available: false,
      reason: "no_comparable_dimensions",
      directionScore: null,
      status: "unavailable",
      percentageImprovement: null,
      percentageSafe: false,
      dimensions: [],
    };
  }

  const scores = dimensions
    .map((detail) => statusScore(detail.status))
    .filter((value) => value !== null);
  const directionScore = roundTo(mean(scores));
  const status = classifySignals(scores);
  const percentages = dimensions.map((detail) =>
    finiteOrNull(detail.percentageImprovement)
  );
  const percentageSafe = percentages.every((value) => value !== null);
  const percentageImprovement = percentageSafe
    ? roundTo(mean(percentages))
    : null;

  return {
    available: true,
    reason: null,
    directionScore,
    status,
    percentageImprovement,
    percentageSafe,
    dimensions,
  };
}

function recentComparisonSignals(cohort) {
  if (!Array.isArray(cohort) || cohort.length < 2) return [];

  // Stage 3 deliberately uses at most the latest three compatible points.
  // That yields one comparison for two points and two recent comparisons for
  // three-or-more points, without letting very old history dominate the signal.
  const startIndex = Math.max(1, cohort.length - 2);
  const signals = [];
  for (let index = startIndex; index < cohort.length; index += 1) {
    const signal = comparisonSignal(cohort[index], cohort[index - 1]);
    if (signal.available) signals.push(signal);
  }
  return signals;
}

function testTrendStrength(state, signals) {
  if (state !== "improving" && state !== "declining") return null;
  if (!Array.isArray(signals) || signals.length < 2) return "normal";

  const isSustained =
    state === "improving"
      ? signals.every((signal) => signal.directionScore > 0)
      : signals.every((signal) => signal.directionScore < 0);
  return isSustained ? "strong" : "normal";
}

export function buildDevelopmentTestTrend(history = null) {
  const cohort = latestCompatibleMetricCohort(history);
  const latest = cohort.at(-1) || null;
  const base = {
    testId: cleanText(history?.testId, ""),
    testName: cleanText(history?.testName, "Test"),
    historyCount: Number(history?.count || 0),
    compatibleHistoryCount: cohort.length,
    latestDateYmd: cleanText(latest?.dateYmd, ""),
    metricKey: cleanText(latest?.metricKey, ""),
  };

  if (!latest) {
    return {
      ...base,
      state: "no_baseline",
      trendScore: null,
      strength: null,
      recentComparisonCount: 0,
      normalizedPercentageImprovement: null,
      percentageSafe: false,
      latestComparison: null,
      recentComparisons: [],
    };
  }

  if (cohort.length === 1) {
    return {
      ...base,
      state: "baseline_set",
      trendScore: null,
      strength: null,
      recentComparisonCount: 0,
      normalizedPercentageImprovement: null,
      percentageSafe: false,
      latestComparison: null,
      recentComparisons: [],
    };
  }

  const recentComparisons = recentComparisonSignals(cohort);
  if (!recentComparisons.length) {
    return {
      ...base,
      state: "baseline_set",
      trendScore: null,
      strength: null,
      recentComparisonCount: 0,
      normalizedPercentageImprovement: null,
      percentageSafe: false,
      latestComparison: null,
      recentComparisons: [],
    };
  }

  const trendScore = roundTo(
    mean(recentComparisons.map((signal) => signal.directionScore))
  );
  const state = classifyTrendRecords(recentComparisons);
  const percentageSafe = recentComparisons.every(
    (signal) => signal.percentageSafe === true
  );
  const normalizedPercentageImprovement = percentageSafe
    ? roundTo(
        mean(
          recentComparisons.map((signal) => signal.percentageImprovement)
        )
      )
    : null;

  return {
    ...base,
    state,
    trendScore,
    strength: testTrendStrength(state, recentComparisons),
    recentComparisonCount: recentComparisons.length,
    normalizedPercentageImprovement,
    percentageSafe,
    latestComparison: recentComparisons.at(-1) || null,
    recentComparisons,
  };
}

function tagState(testTrends) {
  const observed = testTrends.filter((trend) => trend.state !== "no_baseline");
  if (!observed.length) return "no_baseline";

  const comparisonReady = observed.filter((trend) => trend.trendScore !== null);
  if (!comparisonReady.length) return "baseline_set";
  return classifyTrendRecords(comparisonReady);
}

function tagTrendStrength(state, testTrends) {
  if (state !== "improving" && state !== "declining") return null;

  const ready = testTrends.filter((trend) => trend.trendScore !== null);
  if (!ready.length) return null;

  const aligned = ready.filter((trend) => trend.state === state);
  const hasConflict = ready.some((trend) => {
    if (trend.state === "mixed") return true;
    if (state === "improving") return trend.state === "declining";
    return trend.state === "improving";
  });

  if (hasConflict || aligned.length !== ready.length) return "normal";
  if (aligned.length >= 2) return "strong";
  return aligned[0]?.strength === "strong" ? "strong" : "normal";
}

function buildTagTrend(tag, linkedTestIds, historyByTestId) {
  const testTrends = linkedTestIds.map((testId) => {
    const history = historyByTestId.get(testId) || null;
    if (history) return buildDevelopmentTestTrend(history);
    return {
      testId,
      testName: "Test",
      historyCount: 0,
      compatibleHistoryCount: 0,
      latestDateYmd: "",
      metricKey: "",
      state: "no_baseline",
      trendScore: null,
      strength: null,
      recentComparisonCount: 0,
      normalizedPercentageImprovement: null,
      percentageSafe: false,
      latestComparison: null,
      recentComparisons: [],
    };
  });

  const observed = testTrends.filter((trend) => trend.state !== "no_baseline");
  const comparisonReady = testTrends.filter((trend) => trend.trendScore !== null);
  const state = tagState(testTrends);
  const trendScore = comparisonReady.length
    ? roundTo(mean(comparisonReady.map((trend) => trend.trendScore)))
    : null;
  const percentageSafe =
    comparisonReady.length > 0 &&
    comparisonReady.every((trend) => trend.percentageSafe === true);
  const normalizedPercentageImprovement = percentageSafe
    ? roundTo(
        mean(
          comparisonReady.map(
            (trend) => trend.normalizedPercentageImprovement
          )
        )
      )
    : null;

  const latestDateYmd = observed
    .map((trend) => trend.latestDateYmd)
    .filter(Boolean)
    .sort()
    .at(-1) || "";

  return {
    developmentTagId: developmentTagIdOf(tag),
    name: developmentTagNameOf(tag),
    slug: developmentTagSlugOf(tag),
    state,
    trendScore,
    strength: tagTrendStrength(state, testTrends),
    linkedTestCount: linkedTestIds.length,
    observedTestCount: observed.length,
    comparisonReadyTestCount: comparisonReady.length,
    normalizedPercentageImprovement,
    percentageSafe,
    latestDateYmd,
    testTrends,
  };
}

export function buildDevelopmentTrendsFromAssessmentProgress({
  assessmentProgress = null,
  developmentTags = [],
  testDevelopmentTags = [],
} = {}) {
  const historyByTestId = new Map(
    (Array.isArray(assessmentProgress?.testHistory)
      ? assessmentProgress.testHistory
      : []
    )
      .map((history) => [cleanText(history?.testId, ""), history])
      .filter(([testId]) => !!testId)
  );

  const linkedTestsByTagId = new Map();
  for (const relation of Array.isArray(testDevelopmentTags)
    ? testDevelopmentTags
    : []) {
    const tagId = relationTagIdOf(relation);
    const testId = relationTestIdOf(relation);
    if (!tagId || !testId) continue;
    if (!linkedTestsByTagId.has(tagId)) linkedTestsByTagId.set(tagId, new Set());
    linkedTestsByTagId.get(tagId).add(testId);
  }

  const trends = (Array.isArray(developmentTags) ? developmentTags : [])
    .map((tag) => {
      const tagId = developmentTagIdOf(tag);
      const linked = Array.from(linkedTestsByTagId.get(tagId) || []).sort();
      if (!tagId || !linked.length) return null;
      return buildTagTrend(tag, linked, historyByTestId);
    })
    .filter(Boolean)
    .sort(
      (a, b) =>
        a.name.localeCompare(b.name) ||
        a.developmentTagId.localeCompare(b.developmentTagId)
    );

  const counts = trends.reduce(
    (acc, trend) => {
      acc[trend.state] = (acc[trend.state] || 0) + 1;
      return acc;
    },
    {
      no_baseline: 0,
      baseline_set: 0,
      improving: 0,
      declining: 0,
      unchanged: 0,
      mixed: 0,
    }
  );

  return {
    completedAssessmentCount: Number(
      assessmentProgress?.completedAssessmentCount || 0
    ),
    baselineState: assessmentProgress?.baselineState || "no_baseline",
    trendCount: trends.length,
    counts,
    trends,
  };
}

export function buildDevelopmentTrends({
  runs = [],
  results = [],
  profileId = null,
  assessmentTemplateId = null,
  developmentTags = [],
  testDevelopmentTags = [],
} = {}) {
  const assessmentProgress = buildAssessmentProgress({
    runs,
    results,
    profileId,
    assessmentTemplateId,
  });

  return buildDevelopmentTrendsFromAssessmentProgress({
    assessmentProgress,
    developmentTags,
    testDevelopmentTags,
  });
}
