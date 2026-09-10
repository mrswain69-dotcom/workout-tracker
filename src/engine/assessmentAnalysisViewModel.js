function cleanText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function count(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
}

function finiteOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function formatAssessmentAnalysisDate(ymd) {
  const text = cleanText(ymd);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "";
  const date = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function runDate(run) {
  return cleanText(run?.dateYmd || run?.date_ymd, "");
}

function stateCopy(state) {
  if (state === "baseline_only") {
    return {
      title: "Baseline established",
      message:
        "Complete the same Assessment Template again to unlock between-benchmark training Analysis.",
    };
  }
  if (state === "analysis_ready") {
    return { title: "Assessment Analysis", message: "" };
  }
  return {
    title: "Build your Assessment baseline",
    message:
      "Complete an Assessment to establish a benchmark before between-benchmark Analysis is available.",
  };
}

function statusMeta(status) {
  const map = {
    improved: { label: "Improved", tone: "positive" },
    declined: { label: "Declined", tone: "caution" },
    unchanged: { label: "Unchanged", tone: "neutral" },
    same: { label: "Unchanged", tone: "neutral" },
    mixed: { label: "Mixed", tone: "mixed" },
    unavailable: { label: "No comparison", tone: "muted" },
  };
  return map[status] || map.unavailable;
}

function evidenceMeta(level) {
  const map = {
    high: { label: "High detail", tone: "positive" },
    medium: { label: "Medium detail", tone: "interaction" },
    low: { label: "Limited detail", tone: "muted" },
    none: { label: "No related structured evidence", tone: "muted" },
  };
  return map[level] || map.none;
}

function pctLabel(value) {
  const number = finiteOrNull(value);
  if (number === null) return "";
  return `${number > 0 ? "+" : ""}${number.toFixed(1).replace(/\.0$/, "")}%`;
}

function buildSummaryCards(summary = {}) {
  return [
    { key: "pb", label: "New PBs", value: count(summary.latestPbCount), tone: "prestige" },
    { key: "improved", label: "Improved", value: count(summary.improved), tone: "positive" },
    { key: "declined", label: "Declined", value: count(summary.declined), tone: "caution" },
    { key: "unchanged", label: "Unchanged", value: count(summary.unchanged), tone: "neutral" },
    { key: "mixed", label: "Mixed", value: count(summary.mixed), tone: "mixed" },
    { key: "unavailable", label: "No comparison", value: count(summary.unavailable), tone: "muted" },
  ];
}

function buildTrainingCards(training = {}, consistency = {}) {
  const consistencyPct = finiteOrNull(consistency?.consistencyPct);
  return [
    {
      key: "sessions",
      label: "Completed Sessions",
      value: count(training?.completedSessions),
      note: "Between Assessments",
    },
    {
      key: "days",
      label: "Session Days",
      value: count(training?.activeSessionDays),
      note: "Completed structured Session days",
    },
    {
      key: "consistency",
      label: "Observed Consistency",
      value: consistencyPct === null ? "—" : `${consistencyPct.toFixed(1).replace(/\.0$/, "")}%`,
      note:
        consistencyPct === null
          ? "Not available"
          : `${count(consistency?.activePeriods)} of ${count(consistency?.eligiblePeriods)} seven-day periods; not plan adherence`,
    },
  ];
}

function buildSessionRows(sessionFocus = {}) {
  return (Array.isArray(sessionFocus?.sessionBalance) ? sessionFocus.sessionBalance : []).map(
    (row) => ({
      templateId: cleanText(row?.templateId),
      displayCode: cleanText(row?.displayCode),
      name: cleanText(row?.name, "Session"),
      completedCount: count(row?.completedCount),
      underrepresented: row?.underrepresented === true,
      lowestCount: row?.lowestCount === true,
    })
  );
}

function buildTestRows(tests = []) {
  return (Array.isArray(tests) ? tests : []).map((test) => {
    const status = statusMeta(cleanText(test?.status, "unavailable"));
    const evidence = evidenceMeta(cleanText(test?.evidenceLevel, "none"));
    const training = test?.training || {};
    const attempts = count(training.attempts);
    const successes = count(training.successes);
    const executions = count(training.recordedExecutions);
    return {
      testId: cleanText(test?.testId),
      testName: cleanText(test?.testName, "Test"),
      status: cleanText(test?.status, "unavailable"),
      statusLabel: status.label,
      statusTone: status.tone,
      evidenceLevel: cleanText(test?.evidenceLevel, "none"),
      evidenceLabel: evidence.label,
      evidenceTone: evidence.tone,
      latestValue: cleanText(test?.latest?.displayValue, "—"),
      previousValue: cleanText(test?.previous?.displayValue, "—"),
      baselineValue: cleanText(test?.baseline?.displayValue, "—"),
      latestPbCount: count(test?.latestPbCount),
      percentageImprovement: finiteOrNull(test?.percentageImprovement),
      percentageImprovementLabel: pctLabel(test?.percentageImprovement),
      metricChanged: test?.metricChanged === true,
      developmentTagIds: Array.isArray(test?.developmentTagIds)
        ? test.developmentTagIds.slice()
        : [],
      developmentTagSource: cleanText(test?.developmentTagSource, "none"),
      completedRelevantSessions: count(training.completedRelevantSessions),
      partialRelevantSessions: count(training.partialRelevantSessions),
      recordedExecutions: executions,
      attempts,
      successes,
      accuracyPct: finiteOrNull(training.accuracyPct),
      volumeFacts: [
        executions > 0 ? `${executions.toLocaleString("en-GB")} recorded executions` : "",
        attempts > 0 ? `${successes.toLocaleString("en-GB")}/${attempts.toLocaleString("en-GB")} successful attempts` : "",
      ].filter(Boolean),
      evidenceSummary: cleanText(test?.evidenceSummary),
      taxonomyNote: cleanText(test?.taxonomyNote),
      narrative: cleanText(test?.narrative),
    };
  });
}

export function buildAssessmentAnalysisViewModel(analysis = null) {
  const source = analysis || {};
  const state = cleanText(source.state, "no_baseline");
  const copy = stateCopy(state);
  const previousDate = runDate(source.previousRun);
  const latestDate = runDate(source.latestRun);
  const focus = source?.sessionFocus?.possibleNextFocus || {};
  const evidenceCounts = source.evidenceCounts || { high: 0, medium: 0, low: 0, none: 0 };

  return {
    state,
    ready: state === "analysis_ready",
    title: copy.title,
    stateMessage: copy.message,
    benchmark: {
      previousDateYmd: previousDate,
      previousDateLabel: formatAssessmentAnalysisDate(previousDate),
      latestDateYmd: latestDate,
      latestDateLabel: formatAssessmentAnalysisDate(latestDate),
      intervalStartDate: cleanText(source?.interval?.startDate),
      intervalEndDate: cleanText(source?.interval?.endDate),
      intervalDays: count(source?.interval?.calendarDays),
    },
    summaryCards: state === "analysis_ready" ? buildSummaryCards(source.summary) : [],
    trainingCards:
      state === "analysis_ready"
        ? buildTrainingCards(source.betweenAssessmentTraining, source.observedConsistency)
        : [],
    evidenceCounts: {
      high: count(evidenceCounts.high),
      medium: count(evidenceCounts.medium),
      low: count(evidenceCounts.low),
      none: count(evidenceCounts.none),
    },
    taxonomyFallbackUsed: source.taxonomyFallbackUsed === true,
    sessionRows: state === "analysis_ready" ? buildSessionRows(source.sessionFocus) : [],
    possibleNextFocus: {
      available: state === "analysis_ready" && focus?.available === true,
      templateId: cleanText(focus?.templateId),
      displayCode: cleanText(focus?.displayCode),
      name: cleanText(focus?.name),
      reason: cleanText(focus?.reason),
      basis: cleanText(focus?.basis, "session_balance_only"),
    },
    tests: state === "analysis_ready" ? buildTestRows(source.tests) : [],
    resultNarrative: cleanText(source.resultNarrative),
    trainingNarrative: cleanText(source.trainingNarrative),
    focusNarrative: cleanText(source.focusNarrative),
    overallNarrative: cleanText(source.overallNarrative),
    causationBoundary: cleanText(source.causationBoundary),
    consistencyBoundary:
      "Observed consistency measures recorded structured-training rhythm across seven-day periods; it is not a formal plan-adherence score.",
  };
}
