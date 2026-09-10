function cleanText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function finiteOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function count(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
}

export function formatAssessmentChartDate(ymd) {
  const text = cleanText(ymd);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "";
  const date = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

function currentMetricCohort(history = {}) {
  const entries = Array.isArray(history?.entries) ? history.entries : [];
  const latest = entries.at(-1) || null;
  if (!latest) return [];
  const metricKey = cleanText(latest.metricKey);
  let start = entries.length - 1;
  while (start > 0 && cleanText(entries[start - 1]?.metricKey) === metricKey) {
    start -= 1;
  }
  return entries.slice(start);
}

function metricLabel(metric = {}) {
  if (metric.metricType === "attempts_successes" && metric.metricConfig?.comparisonMode === "rate") {
    return "Success rate (%)";
  }
  const unit = cleanText(metric.unit);
  if (unit) return unit;
  const type = cleanText(metric.metricType, "result").replaceAll("_", " ");
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function comparisonStatusLabel(status) {
  const labels = {
    improved: "Improved",
    declined: "Declined",
    same: "Unchanged",
    unchanged: "Unchanged",
    mixed: "Mixed",
    unavailable: "No comparison",
  };
  return labels[status] || "Baseline";
}

function buildChartPoints(history = {}) {
  const cohort = currentMetricCohort(history);
  const sideMode = cohort.at(-1)?.metric?.sideMode || history?.metric?.sideMode || "none";
  return cohort.map((entry) => ({
    dateYmd: cleanText(entry?.dateYmd),
    label: formatAssessmentChartDate(entry?.dateYmd),
    displayValue: cleanText(entry?.displayValue, "—"),
    overall: sideMode === "separate" ? null : finiteOrNull(entry?.comparableValue),
    left: sideMode === "separate" ? finiteOrNull(entry?.comparableDimensions?.left) : null,
    right: sideMode === "separate" ? finiteOrNull(entry?.comparableDimensions?.right) : null,
    pbOverall: entry?.recordMarkers?.overall === true,
    pbLeft: entry?.recordMarkers?.left === true,
    pbRight: entry?.recordMarkers?.right === true,
  }));
}

function buildComparisonDimensions(status = null) {
  return (Array.isArray(status?.dimensions) ? status.dimensions : []).map((row) => ({
    dimension: cleanText(row?.dimension, "overall"),
    status: cleanText(row?.status, "unavailable"),
    statusLabel: comparisonStatusLabel(row?.status),
    rawChange: finiteOrNull(row?.rawChange),
    improvementValue: finiteOrNull(row?.improvementValue),
    percentageImprovement: finiteOrNull(row?.percentageImprovement),
  }));
}

export function buildAssessmentTestChartRows(assessmentProgress = null) {
  const statusesByTestId = new Map(
    (Array.isArray(assessmentProgress?.latestTestStatuses)
      ? assessmentProgress.latestTestStatuses
      : []
    ).map((status) => [cleanText(status?.testId), status])
  );
  const pbCounts = new Map();
  for (const event of Array.isArray(assessmentProgress?.latestPbEvents)
    ? assessmentProgress.latestPbEvents
    : []) {
    const testId = cleanText(event?.testId);
    if (!testId) continue;
    pbCounts.set(testId, (pbCounts.get(testId) || 0) + 1);
  }

  return (Array.isArray(assessmentProgress?.testHistory)
    ? assessmentProgress.testHistory
    : []
  )
    .map((history) => {
      const testId = cleanText(history?.testId);
      const status = statusesByTestId.get(testId) || null;
      const points = buildChartPoints(history);
      const latest = points.at(-1) || null;
      const metric = history?.metric || {};
      const sideMode = metric.sideMode || "none";
      const numericPointCount = points.filter((point) =>
        sideMode === "separate"
          ? point.left !== null || point.right !== null
          : point.overall !== null
      ).length;
      return {
        testId,
        testName: cleanText(history?.testName, "Test"),
        sectionLabel: cleanText(history?.latest?.sectionLabel || history?.baseline?.sectionLabel),
        historyCount: count(history?.count),
        compatibleHistoryCount: points.length,
        metricChanged: history?.metricChanged === true,
        hiddenPriorMetricCount: Math.max(0, count(history?.count) - points.length),
        metricType: cleanText(metric.metricType, "numeric"),
        metricLabel: metricLabel(metric),
        scoringDirection: cleanText(metric.scoringDirection, "higher"),
        directionLabel:
          metric.scoringDirection === "lower" ? "Lower is better" : "Higher is better",
        sideMode,
        latestValue: latest?.displayValue || "—",
        latestDateYmd: latest?.dateYmd || "",
        latestDateLabel: latest?.label || "",
        status: cleanText(status?.status, points.length > 1 ? "unavailable" : "baseline"),
        statusLabel: comparisonStatusLabel(
          status?.status || (points.length > 1 ? "unavailable" : "baseline")
        ),
        comparisonAvailable: status?.comparisonAvailable === true,
        comparisonReason: cleanText(status?.comparisonReason),
        comparisonDimensions: buildComparisonDimensions(status),
        latestPbCount: pbCounts.get(testId) || 0,
        hasChart: numericPointCount >= 2,
        points,
      };
    })
    .sort((a, b) => {
      const section = a.sectionLabel.localeCompare(b.sectionLabel);
      return section || a.testName.localeCompare(b.testName);
    });
}

function improvementRow(item = {}) {
  return {
    testId: cleanText(item?.testId),
    testName: cleanText(item?.testName, "Test"),
    percentage: finiteOrNull(item?.percentageRank),
    latestValue: cleanText(item?.latest?.displayValue, "—"),
  };
}

export function buildAssessmentDetailViewModel(assessmentProgress = null) {
  const completedCount = count(assessmentProgress?.completedAssessmentCount);
  const testRows = buildAssessmentTestChartRows(assessmentProgress);
  const improvedCount = Array.isArray(assessmentProgress?.improvedTests)
    ? assessmentProgress.improvedTests.length
    : 0;
  const decliningCount = Array.isArray(assessmentProgress?.decliningTests)
    ? assessmentProgress.decliningTests.length
    : 0;
  const unchangedCount = Array.isArray(assessmentProgress?.unchangedTests)
    ? assessmentProgress.unchangedTests.length
    : 0;
  const mixedCount = Array.isArray(assessmentProgress?.mixedTests)
    ? assessmentProgress.mixedTests.length
    : 0;
  const unavailableCount = Array.isArray(assessmentProgress?.unavailableTests)
    ? assessmentProgress.unavailableTests.length
    : 0;

  return {
    completedCount,
    hasBaseline: completedCount > 0,
    hasComparison: completedCount > 1,
    trendReady: completedCount > 2,
    latestPbCount: count(assessmentProgress?.latestPbCount),
    latestPbTestCount: count(assessmentProgress?.latestPbTestCount),
    statusCounts: {
      improved: improvedCount,
      declining: decliningCount,
      unchanged: unchangedCount,
      mixed: mixedCount,
      unavailable: unavailableCount,
    },
    biggestImprovements: (Array.isArray(assessmentProgress?.biggestImprovements)
      ? assessmentProgress.biggestImprovements
      : []
    )
      .slice(0, 5)
      .map(improvementRow),
    absoluteOnlyImprovements: (Array.isArray(assessmentProgress?.absoluteOnlyImprovements)
      ? assessmentProgress.absoluteOnlyImprovements
      : []
    ).map(improvementRow),
    testRows,
    chartReadyTestCount: testRows.filter((row) => row.hasChart).length,
  };
}

export function developmentTrendGlyph(state, strength = null) {
  if (state === "improving") return strength === "strong" ? "↑↑" : "↑";
  if (state === "declining") return strength === "strong" ? "↓↓" : "↓";
  if (state === "unchanged") return "→";
  if (state === "mixed") return "↕";
  if (state === "baseline_set") return "•";
  return "—";
}

function developmentStateLabel(state) {
  const labels = {
    no_baseline: "No baseline",
    baseline_set: "Baseline set",
    improving: "Improving",
    declining: "Declining",
    unchanged: "Unchanged",
    mixed: "Mixed",
  };
  return labels[state] || "Building";
}

function buildDevelopmentTestRows(rows = []) {
  return (Array.isArray(rows) ? rows : []).map((test) => ({
    testId: cleanText(test?.testId),
    testName: cleanText(test?.testName, "Test"),
    state: cleanText(test?.state, "no_baseline"),
    stateLabel: developmentStateLabel(test?.state),
    glyph: developmentTrendGlyph(test?.state, test?.strength),
    strength: cleanText(test?.strength),
    historyCount: count(test?.historyCount),
    compatibleHistoryCount: count(test?.compatibleHistoryCount),
    recentComparisonCount: count(test?.recentComparisonCount),
    percentageSafe: test?.percentageSafe === true,
    normalizedPercentageImprovement: finiteOrNull(
      test?.normalizedPercentageImprovement
    ),
    latestDateYmd: cleanText(test?.latestDateYmd),
    latestDateLabel: formatAssessmentChartDate(test?.latestDateYmd),
  }));
}

export function buildDevelopmentDetailViewModel(developmentTrends = null) {
  const rows = (Array.isArray(developmentTrends?.trends)
    ? developmentTrends.trends
    : []
  ).map((trend) => ({
    developmentTagId: cleanText(trend?.developmentTagId),
    name: cleanText(trend?.name, "Development"),
    slug: cleanText(trend?.slug),
    state: cleanText(trend?.state, "no_baseline"),
    stateLabel: developmentStateLabel(trend?.state),
    glyph: developmentTrendGlyph(trend?.state, trend?.strength),
    strength: cleanText(trend?.strength),
    linkedTestCount: count(trend?.linkedTestCount),
    observedTestCount: count(trend?.observedTestCount),
    comparisonReadyTestCount: count(trend?.comparisonReadyTestCount),
    percentageSafe: trend?.percentageSafe === true,
    normalizedPercentageImprovement: finiteOrNull(
      trend?.normalizedPercentageImprovement
    ),
    latestDateYmd: cleanText(trend?.latestDateYmd),
    latestDateLabel: formatAssessmentChartDate(trend?.latestDateYmd),
    tests: buildDevelopmentTestRows(trend?.testTrends),
  }));

  return {
    completedAssessmentCount: count(developmentTrends?.completedAssessmentCount),
    rows,
    counts: developmentTrends?.counts || {
      no_baseline: 0,
      baseline_set: 0,
      improving: 0,
      declining: 0,
      unchanged: 0,
      mixed: 0,
    },
    comparisonReadyCount: rows.filter((row) => row.comparisonReadyTestCount > 0).length,
  };
}
