import {
  buildTrainingWindowSummary,
  buildSessionBalance,
} from "./progressTrainingEngine.js";

function cleanText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function isYmd(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function toUtcDate(ymd) {
  if (!isYmd(ymd)) return null;
  const date = new Date(`${ymd}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function shiftYmd(ymd, days) {
  const date = toUtcDate(ymd);
  if (!date) return "";
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

function diffDaysInclusive(startDate, endDate) {
  const start = toUtcDate(startDate);
  const end = toUtcDate(endDate);
  if (!start || !end || start > end) return 0;
  return Math.floor((end - start) / 86400000) + 1;
}

function formatNumber(value) {
  return Math.max(0, Number(value) || 0).toLocaleString("en-GB");
}

export function buildAnalysisSevenDayPeriods(interval) {
  if (!interval?.valid || !isYmd(interval.startDate) || !isYmd(interval.endDate)) {
    return [];
  }

  const periods = [];
  let cursor = interval.startDate;
  let index = 0;
  while (cursor <= interval.endDate) {
    const candidateEnd = shiftYmd(cursor, 6);
    const endDate = candidateEnd && candidateEnd < interval.endDate
      ? candidateEnd
      : interval.endDate;
    periods.push({
      index,
      startDate: cursor,
      endDate,
      dayCount: diffDaysInclusive(cursor, endDate),
    });
    index += 1;
    cursor = shiftYmd(endDate, 1);
  }
  return periods;
}

export function buildObservedTrainingConsistency({
  logs = [],
  profileId = "",
  interval = null,
} = {}) {
  const periods = buildAnalysisSevenDayPeriods(interval).map((period) => {
    const summary = buildTrainingWindowSummary(logs, {
      startDate: period.startDate,
      endDate: period.endDate,
      label: `Period ${period.index + 1}`,
      profileId,
    });
    return {
      ...period,
      completedSessions: summary.completedSessions,
      activeSessionDays: summary.completedSessionDays,
      active: summary.completedSessions > 0,
    };
  });

  const eligiblePeriods = periods.length;
  const activePeriods = periods.filter((period) => period.active).length;
  const totalSummary = interval?.valid
    ? buildTrainingWindowSummary(logs, {
        startDate: interval.startDate,
        endDate: interval.endDate,
        label: "Between Assessments",
        profileId,
      })
    : buildTrainingWindowSummary([], { label: "Between Assessments" });

  return {
    kind: "observed_structured_training_consistency",
    isPlanAdherence: false,
    interval,
    eligiblePeriods,
    activePeriods,
    consistencyPct:
      eligiblePeriods > 0
        ? Math.round((activePeriods / eligiblePeriods) * 1000) / 10
        : null,
    completedSessions: totalSummary.completedSessions,
    partialSessions: totalSummary.partialSessions,
    activeSessionDays: totalSummary.completedSessionDays,
    periods,
  };
}

export function buildBetweenAssessmentTrainingSummary({
  logs = [],
  profileId = "",
  interval = null,
  sessionTemplates = [],
} = {}) {
  if (!interval?.valid) {
    return {
      interval,
      completedSessions: 0,
      partialSessions: 0,
      activeSessionDays: 0,
      totalMinutes: 0,
      recordedExecutions: 0,
      attempts: 0,
      successes: 0,
      accuracyPct: null,
      sessionDistribution: [],
    };
  }

  const summary = buildTrainingWindowSummary(logs, {
    startDate: interval.startDate,
    endDate: interval.endDate,
    label: "Between Assessments",
    profileId,
  });
  const sessionDistribution = buildSessionBalance(logs, sessionTemplates, {
    startDate: interval.startDate,
    endDate: interval.endDate,
    profileId,
  });

  return {
    interval,
    completedSessions: summary.completedSessions,
    partialSessions: summary.partialSessions,
    activeSessionDays: summary.completedSessionDays,
    totalMinutes: summary.totalMinutes,
    recordedExecutions: summary.recordedExecutions,
    attempts: summary.attempts,
    successes: summary.successes,
    accuracyPct: summary.accuracyPct,
    sessionDistribution,
  };
}

function plural(value, one, many = `${one}s`) {
  return Number(value) === 1 ? one : many;
}

export function buildTrainingEvidenceSummary(evidence = {}) {
  const level = cleanText(evidence.evidenceLevel, "none");
  const sessions = Math.max(0, Number(evidence.completedRelevantSessions) || 0);
  const executions = Math.max(0, Number(evidence.recordedExecutions) || 0);
  const attempts = Math.max(0, Number(evidence.attempts) || 0);
  const successes = Math.max(0, Number(evidence.successes) || 0);
  const snapshotSessions = Math.max(0, Number(evidence.relatedSnapshotSessions) || 0);
  const fallback = !!evidence.usedCurrentTaxonomyFallback;

  let sentence;
  if (level === "high") {
    const details = [];
    if (executions > 0) {
      details.push(`${formatNumber(executions)} recorded ${plural(executions, "execution")}`);
    }
    if (attempts > 0) {
      details.push(`${formatNumber(successes)}/${formatNumber(attempts)} successful attempts`);
    }
    const detailText = details.length ? `, including ${details.join(" and ")}` : "";
    sentence = `${formatNumber(sessions)} completed related ${plural(sessions, "Session")} were recorded between benchmarks${detailText}.`;
  } else if (level === "medium") {
    sentence = `${formatNumber(sessions)} completed related ${plural(sessions, "Session")} contained recorded practice between benchmarks; detailed compatible volume was not recorded.`;
  } else if (level === "low") {
    sentence = `Related structured training appeared in ${formatNumber(snapshotSessions)} recorded ${plural(snapshotSessions, "Session snapshot")}, but completion and volume evidence is incomplete.`;
  } else {
    sentence = "No related structured training was recorded between these benchmarks; this does not establish that no related training occurred outside recorded structured Sessions.";
  }

  return {
    evidenceLevel: level,
    sentence,
    taxonomyNote: fallback
      ? "Some historical Movement relationships use the current Development Tag taxonomy because frozen tag IDs were unavailable in those snapshots."
      : "",
  };
}
