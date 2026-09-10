import {
  buildAssessmentRunHistory,
  buildAssessmentTestHistory,
} from "./assessmentHistoryEngine.js";

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

function profileIdOf(run) {
  return cleanText(valueOf(run, "profileId", "profile_id", ""));
}

function templateIdOf(run) {
  return cleanText(
    valueOf(run, "assessmentTemplateId", "assessment_template_id", "")
  );
}

function runIdOf(run) {
  return cleanText(run?.id);
}

function dateOf(run) {
  return cleanText(valueOf(run, "dateYmd", "date_ymd", ""));
}

function templateSnapshotOf(run) {
  return valueOf(run, "templateSnapshot", "template_snapshot", {}) || {};
}

function assessmentNameOf(run) {
  return cleanText(templateSnapshotOf(run)?.template?.name, "Assessment");
}

function assessmentVersionOf(run) {
  const value = Number(valueOf(run, "templateVersion", "template_version", 0));
  return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
}

function resultRunId(row) {
  return cleanText(
    valueOf(row, "assessmentRunId", "assessment_run_id", "")
  );
}

function testIdOf(row) {
  return cleanText(valueOf(row, "testId", "test_id", ""));
}

function isCompleted(run) {
  return cleanText(run?.status).toLowerCase() === "completed";
}

function isValidResult(row) {
  return row?.is_valid !== false && row?.isValid !== false;
}

export function scopeAssessmentProgressHistory(
  { runs = [], results = [] } = {},
  { profileId = null, assessmentTemplateId = null } = {}
) {
  const safeRuns = (Array.isArray(runs) ? runs : []).filter((run) => {
    if (profileId && profileIdOf(run) !== String(profileId)) return false;
    if (
      assessmentTemplateId &&
      templateIdOf(run) !== String(assessmentTemplateId)
    ) {
      return false;
    }
    return true;
  });

  const runIds = new Set(safeRuns.map(runIdOf).filter(Boolean));
  const safeResults = (Array.isArray(results) ? results : []).filter((row) =>
    runIds.has(resultRunId(row))
  );

  return { runs: safeRuns, results: safeResults };
}

function comparisonDimensions(history) {
  const comparison = history?.previousComparison;
  if (!comparison?.available || !comparison.comparison) return [];
  const dimensions = comparison.comparison.dimensions || {};
  return Object.entries(dimensions)
    .map(([dimension, detail]) => ({ dimension, ...(detail || {}) }))
    .filter((item) => item.status && item.status !== "unavailable");
}

function classifyDimensions(dimensions) {
  if (!dimensions.length) return "unavailable";
  const statuses = new Set(dimensions.map((item) => item.status));
  if (statuses.size === 1) return dimensions[0].status;
  if (statuses.has("improved") && statuses.has("declined")) return "mixed";
  if (statuses.has("improved")) return "improved";
  if (statuses.has("declined")) return "declined";
  return "unchanged";
}

function improvementRankValue(dimensions) {
  const safePercentages = dimensions
    .filter((item) => item.status === "improved")
    .map((item) => Number(item.percentageImprovement))
    .filter(Number.isFinite);
  if (!safePercentages.length) return null;
  return Math.max(...safePercentages);
}

function latestPbEvents(history) {
  if (!history?.latest || history.latest.runId === "") return [];
  const latestNewPb = history.pb?.latestNewPb || {};
  if (history.metric?.sideMode === "separate") {
    return ["left", "right"]
      .filter((dimension) => latestNewPb.dimensions?.[dimension] === true)
      .map((dimension) => ({
        testId: history.testId,
        testName: history.testName,
        dimension,
        entry: history.latest,
      }));
  }
  return latestNewPb.overall === true
    ? [
        {
          testId: history.testId,
          testName: history.testName,
          dimension: "overall",
          entry: history.latest,
        },
      ]
    : [];
}

function buildLatestTestStatus(history, latestRunId) {
  if (!history?.latest || history.latest.runId !== latestRunId) return null;
  const dimensions = comparisonDimensions(history);
  const status = classifyDimensions(dimensions);
  const percentageRank = improvementRankValue(dimensions);

  return {
    testId: history.testId,
    testName: history.testName,
    metric: history.metric,
    latest: history.latest,
    baseline: history.baseline,
    previous: history.previous,
    metricChanged: !!history.metricChanged,
    comparisonAvailable: history.previousComparison?.available === true,
    comparisonReason: history.previousComparison?.reason || null,
    status,
    dimensions,
    percentageRank,
    hasSafePercentageImprovement: percentageRank !== null,
    baselineComparison: history.baselineComparison,
    pb: history.pb,
  };
}

function baselineState(completedCount) {
  if (completedCount <= 0) return "no_baseline";
  if (completedCount === 1) return "baseline_established";
  return "comparison_available";
}

export function buildAssessmentProgress({
  runs = [],
  results = [],
  profileId = null,
  assessmentTemplateId = null,
} = {}) {
  const scoped = scopeAssessmentProgressHistory(
    { runs, results },
    { profileId, assessmentTemplateId }
  );
  const completedRuns = scoped.runs.filter(isCompleted);
  const completedRunIds = new Set(completedRuns.map(runIdOf).filter(Boolean));
  const completedResults = scoped.results.filter(
    (row) => completedRunIds.has(resultRunId(row)) && isValidResult(row)
  );

  const runHistory = buildAssessmentRunHistory({
    runs: completedRuns,
    results: completedResults,
  });
  const testHistory = buildAssessmentTestHistory({
    runs: completedRuns,
    results: completedResults,
  });

  const latestRunRecord = runHistory[0] || null;
  const latestRun = latestRunRecord?.run || null;
  const latestRunId = runIdOf(latestRun);
  const latestResultRows = latestRunRecord?.results || [];
  const latestTestIds = new Set(latestResultRows.map(testIdOf).filter(Boolean));

  const latestTestStatuses = testHistory
    .map((history) => buildLatestTestStatus(history, latestRunId))
    .filter(Boolean)
    .filter((item) => latestTestIds.has(item.testId));

  const pbEvents = latestTestStatuses.flatMap((item) => latestPbEvents(item));
  const testsWithNewPb = new Set(pbEvents.map((event) => event.testId)).size;

  const improved = latestTestStatuses.filter((item) => item.status === "improved");
  const declined = latestTestStatuses.filter((item) => item.status === "declined");
  const unchanged = latestTestStatuses.filter((item) => item.status === "same");
  const mixed = latestTestStatuses.filter((item) => item.status === "mixed");
  const unavailable = latestTestStatuses.filter(
    (item) => item.status === "unavailable"
  );

  const biggestImprovements = improved
    .filter((item) => item.percentageRank !== null)
    .sort(
      (a, b) =>
        b.percentageRank - a.percentageRank ||
        a.testName.localeCompare(b.testName)
    );

  const absoluteOnlyImprovements = improved
    .filter((item) => item.percentageRank === null)
    .sort((a, b) => a.testName.localeCompare(b.testName));

  return {
    profileId: profileId ? String(profileId) : null,
    assessmentTemplateId: assessmentTemplateId
      ? String(assessmentTemplateId)
      : null,
    completedAssessmentCount: runHistory.length,
    baselineState: baselineState(runHistory.length),
    hasBaseline: runHistory.length > 0,
    hasComparison: runHistory.length > 1,
    latestAssessment: latestRun
      ? {
          runId: latestRunId,
          dateYmd: dateOf(latestRun),
          name: assessmentNameOf(latestRun),
          templateId: templateIdOf(latestRun),
          templateVersion: assessmentVersionOf(latestRun),
          validResultCount: latestResultRows.length,
        }
      : null,
    latestPbCount: pbEvents.length,
    latestPbTestCount: testsWithNewPb,
    latestPbEvents: pbEvents,
    latestTestStatuses,
    improvedTests: improved,
    decliningTests: declined,
    unchangedTests: unchanged,
    mixedTests: mixed,
    unavailableTests: unavailable,
    biggestImprovements,
    absoluteOnlyImprovements,
    testHistory,
    runHistory,
  };
}
