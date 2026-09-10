function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function cleanText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

export function formatProgressDate(ymd) {
  const text = cleanText(ymd);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "";
  const date = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function progressTrainingState(trainingProgress = null) {
  const lifetime = trainingProgress?.lifetime || {};
  const completed = finiteNumber(lifetime.completedSessions);
  const partial = finiteNumber(lifetime.partialSessions);
  const hasHistory = trainingProgress?.hasStructuredSessionHistory === true;

  if (!hasHistory && completed === 0 && partial === 0) return "no_sessions";
  if (completed === 0 && partial > 0) return "partial_only";
  if (completed === 1) return "one_session";
  return "established";
}

export function progressAssessmentState(assessmentProgress = null) {
  const count = finiteNumber(assessmentProgress?.completedAssessmentCount);
  if (count <= 0) return "no_baseline";
  if (count === 1) return "baseline_established";
  if (count === 2) return "comparison_available";
  return "trend_ready";
}

export function progressDevelopmentState(developmentTrends = null) {
  const trends = Array.isArray(developmentTrends?.trends)
    ? developmentTrends.trends
    : [];
  if (!trends.length) return "no_baseline";

  const comparisonReady = trends.filter(
    (trend) => finiteNumber(trend?.comparisonReadyTestCount) > 0
  );
  if (comparisonReady.length) {
    return finiteNumber(developmentTrends?.completedAssessmentCount) >= 3
      ? "trend_ready"
      : "comparison_available";
  }

  return trends.some((trend) => trend?.state === "baseline_set")
    ? "baseline_established"
    : "no_baseline";
}

function scheduleSummary(status = null) {
  if (!status || typeof status !== "object") {
    return {
      state: "none",
      title: "No benchmark scheduled",
      detail: "Assessment scheduling will appear here when available.",
      dateYmd: "",
    };
  }

  const state = cleanText(status.state, "none");
  const cycleStart = cleanText(status.cycleStartYmd);
  const cycleEnd = cleanText(status.cycleEndYmd);
  const nextStart = cleanText(status.nextCycleStartYmd);
  const cycleStartText = formatProgressDate(cycleStart);
  const cycleEndText = formatProgressDate(cycleEnd);
  const nextStartText = formatProgressDate(nextStart);

  if (state === "in_progress") {
    return {
      state,
      title: "Benchmark in progress",
      detail: "Complete the current Assessment to add it to Progress.",
      dateYmd: cycleStart,
    };
  }

  if (state === "overdue") {
    return {
      state,
      title: "Benchmark overdue",
      detail: cycleEndText
        ? `The current benchmark window ended ${cycleEndText}.`
        : "The current benchmark window has passed.",
      dateYmd: cycleStart,
    };
  }

  if (state === "due") {
    return {
      state,
      title: "Benchmark due now",
      detail:
        cycleStartText && cycleEndText
          ? `Current window: ${cycleStartText} – ${cycleEndText}.`
          : "The current benchmark window is open.",
      dateYmd: cycleStart,
    };
  }

  if (state === "completed") {
    return {
      state,
      title: "Benchmark complete",
      detail: nextStartText
        ? `Next benchmark starts ${nextStartText}.`
        : "The current benchmark cycle is complete.",
      dateYmd: nextStart,
    };
  }

  if (state === "upcoming") {
    const days = finiteNumber(status.daysUntilCycle);
    return {
      state,
      title: "Benchmark scheduled",
      detail: cycleStartText
        ? `${cycleStartText}${days > 0 ? ` · ${days} day${days === 1 ? "" : "s"} away` : ""}.`
        : "Your next benchmark is scheduled.",
      dateYmd: cycleStart,
    };
  }

  return {
    state,
    title: "Benchmark schedule unavailable",
    detail: "The schedule could not be interpreted safely.",
    dateYmd: cycleStart,
  };
}

function trainingMessage(state) {
  if (state === "no_sessions") {
    return "No structured Sessions logged yet. Your first completed Session will start building genuine Session history here.";
  }
  if (state === "partial_only") {
    return "Structured Session activity has started, but no Session is complete yet.";
  }
  if (state === "one_session") {
    return "Your first completed Session is recorded. Distribution is real; longer-term patterns will build from here.";
  }
  return "Structured Session history is active and ready for Progress views.";
}

function assessmentMessage(state, assessmentProgress, schedule) {
  if (state === "no_baseline") {
    if (schedule.state === "upcoming") {
      return `No Assessment baseline yet. First benchmark: ${schedule.detail}`;
    }
    if (schedule.state === "due" || schedule.state === "overdue" || schedule.state === "in_progress") {
      return `No completed Assessment baseline yet. ${schedule.title}.`;
    }
    return "No Assessment baseline yet. Your first completed benchmark establishes the baseline without creating fake PBs.";
  }
  if (state === "baseline_established") {
    return "Baseline established. Complete the next compatible benchmark to unlock genuine improvement and decline comparisons.";
  }
  if (state === "comparison_available") {
    return "Comparison available. Latest-vs-previous progress and genuine PB events are now meaningful.";
  }
  const latestDate = formatProgressDate(assessmentProgress?.latestAssessment?.dateYmd);
  return latestDate
    ? `Multi-point Assessment history is available through ${latestDate}.`
    : "Multi-point Assessment history is available for trend views.";
}

function developmentMessage(state, developmentTrends) {
  if (state === "no_baseline") {
    return "No Development baseline yet. Shared Development Tags will connect benchmark Tests into areas such as Acceleration, First Touch, Weak Foot, Strength and Mobility.";
  }
  if (state === "baseline_established") {
    return "Development baselines are set. A second compatible benchmark is needed before direction is shown.";
  }

  const comparisonReady = (developmentTrends?.trends || []).filter(
    (trend) => finiteNumber(trend?.comparisonReadyTestCount) > 0
  ).length;
  if (state === "comparison_available") {
    return `${comparisonReady} development area${comparisonReady === 1 ? " has" : "s have"} comparison data available.`;
  }
  return `${comparisonReady} development area${comparisonReady === 1 ? " has" : "s have"} recent multi-point trend data available.`;
}

export function buildProgressViewModel({
  trainingProgress = null,
  assessmentProgress = null,
  developmentTrends = null,
  assessmentScheduleStatuses = [],
  currentStreak = 0,
  currentXp = 0,
  profileName = "",
} = {}) {
  const trainingState = progressTrainingState(trainingProgress);
  const assessmentState = progressAssessmentState(assessmentProgress);
  const developmentState = progressDevelopmentState(developmentTrends);
  const schedule = scheduleSummary(
    Array.isArray(assessmentScheduleStatuses)
      ? assessmentScheduleStatuses[0] || null
      : null
  );

  const week = trainingProgress?.week || {};
  const month = trainingProgress?.month || {};
  const recent28 = trainingProgress?.recent28 || {};
  const lifetime = trainingProgress?.lifetime || {};
  const sessionBalance = Array.isArray(trainingProgress?.sessionBalance)
    ? trainingProgress.sessionBalance
    : [];

  return {
    profileName: cleanText(profileName, "Athlete"),
    states: {
      training: trainingState,
      assessment: assessmentState,
      development: developmentState,
    },
    training: {
      message: trainingMessage(trainingState),
      sessionsThisWeek: finiteNumber(week.completedSessions),
      sessionsThisMonth: finiteNumber(month.completedSessions),
      currentStreak: Math.max(0, finiteNumber(currentStreak)),
      currentXp: Math.max(0, finiteNumber(currentXp)),
      trainingMinutes28: Math.max(0, finiteNumber(recent28.totalMinutes)),
      recordedExecutions28: Math.max(
        0,
        finiteNumber(recent28.recordedExecutions)
      ),
      lifetimeCompletedSessions: Math.max(
        0,
        finiteNumber(lifetime.completedSessions)
      ),
      lifetimePartialSessions: Math.max(
        0,
        finiteNumber(lifetime.partialSessions)
      ),
      sessionBalance,
    },
    assessment: {
      message: assessmentMessage(assessmentState, assessmentProgress, schedule),
      schedule,
      completedCount: Math.max(
        0,
        finiteNumber(assessmentProgress?.completedAssessmentCount)
      ),
      latestDateYmd: cleanText(assessmentProgress?.latestAssessment?.dateYmd),
      latestDateLabel: formatProgressDate(
        assessmentProgress?.latestAssessment?.dateYmd
      ),
      latestPbCount: Math.max(0, finiteNumber(assessmentProgress?.latestPbCount)),
      improvedCount: Array.isArray(assessmentProgress?.improvedTests)
        ? assessmentProgress.improvedTests.length
        : 0,
      decliningCount: Array.isArray(assessmentProgress?.decliningTests)
        ? assessmentProgress.decliningTests.length
        : 0,
      unchangedCount: Array.isArray(assessmentProgress?.unchangedTests)
        ? assessmentProgress.unchangedTests.length
        : 0,
      mixedCount: Array.isArray(assessmentProgress?.mixedTests)
        ? assessmentProgress.mixedTests.length
        : 0,
    },
    development: {
      message: developmentMessage(developmentState, developmentTrends),
      trendCount: Array.isArray(developmentTrends?.trends)
        ? developmentTrends.trends.length
        : 0,
      comparisonReadyCount: Array.isArray(developmentTrends?.trends)
        ? developmentTrends.trends.filter(
            (trend) => finiteNumber(trend?.comparisonReadyTestCount) > 0
          ).length
        : 0,
      counts: developmentTrends?.counts || {
        no_baseline: 0,
        baseline_set: 0,
        improving: 0,
        declining: 0,
        unchanged: 0,
        mixed: 0,
      },
    },
  };
}
