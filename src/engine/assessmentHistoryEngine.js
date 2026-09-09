import {
  compareAssessmentResults,
  formatAssessmentMetricValue,
  isBetterAssessmentValue,
  normaliseAssessmentMetricDefinition,
} from "./assessmentMetricEngine.js";

function cleanText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function jsonObject(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...value }
    : {};
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

function dateTimeValue(run = {}) {
  const date = cleanText(valueOf(run, "dateYmd", "date_ymd", ""));
  const completed = cleanText(valueOf(run, "completedAt", "completed_at", ""));
  const started = cleanText(valueOf(run, "startedAt", "started_at", ""));
  const source = completed || started || (date ? `${date}T00:00:00` : "");
  const parsed = source ? Date.parse(source) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

export function assessmentMetricComparisonKey(rawMetric = {}) {
  const metric = normaliseAssessmentMetricDefinition(rawMetric);
  return JSON.stringify({
    metricType: metric.metricType,
    unit: metric.unit,
    scoringDirection: metric.scoringDirection,
    sideMode: metric.sideMode,
    comparisonMode: metric.metricConfig.comparisonMode,
    fixedAttempts:
      metric.metricType === "attempts_successes" &&
      metric.metricConfig.comparisonMode === "successes"
        ? metric.metricConfig.fixedAttempts
        : null,
  });
}

function comparableForEntry(entry, dimension = "overall") {
  if (!entry) return null;
  if (entry.metric.sideMode === "separate") {
    return finiteOrNull(entry.comparableDimensions?.[dimension]);
  }
  return finiteOrNull(entry.comparableValue);
}

export function formatAssessmentHistoryEntry(entry) {
  if (!entry) return "—";
  const metric = entry.metric;
  const retained = entry.retainedResult || {};
  if (metric.sideMode === "separate") {
    return `L ${formatAssessmentMetricValue(retained.left, metric)} · R ${formatAssessmentMetricValue(retained.right, metric)}`;
  }
  return formatAssessmentMetricValue(retained.overall, metric);
}

function normaliseHistoryEntry(row, run) {
  const metric = normaliseAssessmentMetricDefinition(
    valueOf(row, "metricSnapshot", "metric_snapshot", {})
  );
  const retainedResult = jsonObject(
    valueOf(row, "retainedResult", "retained_result", {})
  );
  const comparableDimensions = jsonObject(
    valueOf(row, "comparableDimensions", "comparable_dimensions", {})
  );

  const entry = {
    id: cleanText(row?.id),
    runId: cleanText(valueOf(row, "assessmentRunId", "assessment_run_id", "")),
    testId: cleanText(valueOf(row, "testId", "test_id", "")),
    testName: cleanText(
      valueOf(row, "testNameSnapshot", "test_name_snapshot", "Test"),
      "Test"
    ),
    position: Number(row?.position || 0),
    sectionLabel: cleanText(
      valueOf(row, "sectionLabelSnapshot", "section_label_snapshot", "")
    ),
    dateYmd: cleanText(valueOf(run, "dateYmd", "date_ymd", "")),
    completedAt: cleanText(valueOf(run, "completedAt", "completed_at", "")),
    assessmentName: cleanText(
      valueOf(run, "templateSnapshot", "template_snapshot", {})?.template?.name,
      "Assessment"
    ),
    metric,
    metricKey: assessmentMetricComparisonKey(metric),
    retainedResult,
    comparableValue: finiteOrNull(
      valueOf(row, "comparableValue", "comparable_value", null)
    ),
    comparableDimensions,
    notes: cleanText(row?.notes, ""),
    pbEligible: metric.pbEligible !== false,
    timeValue: dateTimeValue(run),
  };
  entry.displayValue = formatAssessmentHistoryEntry(entry);
  return entry;
}

export function compareAssessmentHistoryEntries(current, reference) {
  if (!current || !reference) {
    return { available: false, reason: "missing", comparison: null };
  }
  if (current.metricKey !== reference.metricKey) {
    return { available: false, reason: "metric_changed", comparison: null };
  }
  return {
    available: true,
    reason: null,
    comparison: compareAssessmentResults(
      current.metric,
      current.retainedResult,
      reference.retainedResult
    ),
  };
}

function bestEntry(entries, metric, dimension) {
  let best = null;
  let bestValue = null;
  for (const entry of entries) {
    if (!entry.pbEligible) continue;
    const value = comparableForEntry(entry, dimension);
    if (value === null) continue;
    if (bestValue === null) {
      best = entry;
      bestValue = value;
      continue;
    }
    if (isBetterAssessmentValue(metric, value, bestValue)) {
      best = entry;
      bestValue = value;
    }
  }
  return best;
}

function buildPbSummary(entries, latest) {
  if (!latest) {
    return {
      eligible: false,
      overall: null,
      dimensions: {},
      latestNewPb: { overall: false, dimensions: {} },
    };
  }

  const cohort = entries.filter((entry) => entry.metricKey === latest.metricKey);
  const prior = cohort.filter((entry) => entry !== latest);
  const eligible = cohort.some((entry) => entry.pbEligible);

  if (latest.metric.sideMode === "separate") {
    const dimensions = {};
    const latestNew = {};
    for (const dimension of ["left", "right"]) {
      dimensions[dimension] = bestEntry(cohort, latest.metric, dimension);
      const priorBest = bestEntry(prior, latest.metric, dimension);
      const latestValue = comparableForEntry(latest, dimension);
      const priorValue = comparableForEntry(priorBest, dimension);
      latestNew[dimension] =
        latest.pbEligible &&
        latestValue !== null &&
        priorValue !== null &&
        isBetterAssessmentValue(latest.metric, latestValue, priorValue) === true;
    }
    return {
      eligible,
      overall: null,
      dimensions,
      latestNewPb: { overall: false, dimensions: latestNew },
    };
  }

  const overall = bestEntry(cohort, latest.metric, "overall");
  const priorBest = bestEntry(prior, latest.metric, "overall");
  const latestValue = comparableForEntry(latest, "overall");
  const priorValue = comparableForEntry(priorBest, "overall");

  return {
    eligible,
    overall,
    dimensions: {},
    latestNewPb: {
      overall:
        latest.pbEligible &&
        latestValue !== null &&
        priorValue !== null &&
        isBetterAssessmentValue(latest.metric, latestValue, priorValue) === true,
      dimensions: {},
    },
  };
}

function annotateRecordProgress(entries, latestMetricKey) {
  const bestByDimension = new Map();
  return entries.map((entry) => {
    const markers = { overall: false, left: false, right: false };
    if (entry.metricKey !== latestMetricKey || !entry.pbEligible) {
      return { ...entry, recordMarkers: markers };
    }

    const dimensions = entry.metric.sideMode === "separate"
      ? ["left", "right"]
      : ["overall"];
    for (const dimension of dimensions) {
      const value = comparableForEntry(entry, dimension);
      if (value === null) continue;
      const previousBest = bestByDimension.get(dimension);
      if (previousBest === undefined) {
        bestByDimension.set(dimension, value);
        continue;
      }
      if (isBetterAssessmentValue(entry.metric, value, previousBest)) {
        markers[dimension] = true;
        bestByDimension.set(dimension, value);
      }
    }
    return { ...entry, recordMarkers: markers };
  });
}

export function buildAssessmentTestHistory({ runs = [], results = [] } = {}) {
  const completedRuns = (Array.isArray(runs) ? runs : []).filter(
    (run) => cleanText(run?.status).toLowerCase() === "completed"
  );
  const runsById = new Map(
    completedRuns.map((run) => [cleanText(run.id), run])
  );
  const grouped = new Map();

  for (const row of Array.isArray(results) ? results : []) {
    if (row?.is_valid === false || row?.isValid === false) continue;
    const runId = cleanText(valueOf(row, "assessmentRunId", "assessment_run_id", ""));
    const run = runsById.get(runId);
    if (!run) continue;
    const testId = cleanText(valueOf(row, "testId", "test_id", ""));
    if (!testId) continue;
    const entry = normaliseHistoryEntry(row, run);
    if (!grouped.has(testId)) grouped.set(testId, []);
    grouped.get(testId).push(entry);
  }

  const summaries = [];
  for (const [testId, unsortedEntries] of grouped.entries()) {
    const entries = unsortedEntries.slice().sort((a, b) => {
      if (a.timeValue !== b.timeValue) return a.timeValue - b.timeValue;
      if (a.runId !== b.runId) return a.runId.localeCompare(b.runId);
      return a.position - b.position;
    });
    const baseline = entries[0] || null;
    const latest = entries.at(-1) || null;
    const previous = entries.length > 1 ? entries.at(-2) : null;
    const annotated = annotateRecordProgress(entries, latest?.metricKey || "");
    const latestAnnotated = annotated.at(-1) || null;
    const baselineAnnotated = annotated[0] || null;
    const previousAnnotated = annotated.length > 1 ? annotated.at(-2) : null;
    const pb = buildPbSummary(annotated, latestAnnotated);

    summaries.push({
      testId,
      testName: latestAnnotated?.testName || baselineAnnotated?.testName || "Test",
      metric: latestAnnotated?.metric || baselineAnnotated?.metric || normaliseAssessmentMetricDefinition({}),
      metricKey: latestAnnotated?.metricKey || "",
      count: annotated.length,
      entries: annotated,
      baseline: baselineAnnotated,
      previous: previousAnnotated,
      latest: latestAnnotated,
      previousComparison: compareAssessmentHistoryEntries(
        latestAnnotated,
        previousAnnotated
      ),
      baselineComparison: compareAssessmentHistoryEntries(
        latestAnnotated,
        baselineAnnotated
      ),
      pb,
      metricChanged: annotated.some(
        (entry) => latestAnnotated && entry.metricKey !== latestAnnotated.metricKey
      ),
    });
  }

  return summaries.sort((a, b) => a.testName.localeCompare(b.testName));
}

export function buildAssessmentRunHistory({ runs = [], results = [] } = {}) {
  const rowsByRun = new Map();
  for (const row of Array.isArray(results) ? results : []) {
    const runId = cleanText(valueOf(row, "assessmentRunId", "assessment_run_id", ""));
    if (!runId) continue;
    if (!rowsByRun.has(runId)) rowsByRun.set(runId, []);
    rowsByRun.get(runId).push(row);
  }

  return (Array.isArray(runs) ? runs : [])
    .filter((run) => cleanText(run?.status).toLowerCase() === "completed")
    .map((run) => ({
      run,
      results: (rowsByRun.get(cleanText(run.id)) || [])
        .filter((row) => row?.is_valid !== false && row?.isValid !== false)
        .sort((a, b) => Number(a.position || 0) - Number(b.position || 0)),
    }))
    .sort((a, b) => dateTimeValue(b.run) - dateTimeValue(a.run));
}
