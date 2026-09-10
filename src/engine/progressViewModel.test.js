import { describe, expect, it } from "vitest";
import {
  buildProgressViewModel,
  formatProgressDate,
  progressAssessmentState,
  progressDevelopmentState,
  progressTrainingState,
} from "./progressViewModel.js";

function training({ completed = 0, partial = 0, week = 0, month = 0 } = {}) {
  return {
    hasStructuredSessionHistory: completed > 0 || partial > 0,
    week: { completedSessions: week },
    month: { completedSessions: month },
    recent28: { totalMinutes: 90, recordedExecutions: 120 },
    lifetime: { completedSessions: completed, partialSessions: partial },
    sessionBalance: [
      { templateId: "a", displayCode: "A", name: "Session A", count: completed },
      { templateId: "b", displayCode: "B", name: "Session B", count: 0 },
      { templateId: "c", displayCode: "C", name: "Session C", count: 0 },
    ],
  };
}

function assessment(count = 0) {
  return {
    completedAssessmentCount: count,
    latestAssessment:
      count > 0 ? { dateYmd: count === 1 ? "2026-09-21" : "2026-10-19" } : null,
    latestPbCount: count > 1 ? 3 : 0,
    improvedTests: count > 1 ? [{}, {}] : [],
    decliningTests: count > 1 ? [{}] : [],
    unchangedTests: [],
    mixedTests: [],
  };
}

function development(completedAssessmentCount, states = []) {
  return {
    completedAssessmentCount,
    trends: states.map((state, index) => ({
      developmentTagId: `t${index}`,
      state,
      comparisonReadyTestCount:
        state === "improving" ||
        state === "declining" ||
        state === "unchanged" ||
        state === "mixed"
          ? 1
          : 0,
    })),
    counts: {},
  };
}

describe("Progress Stage 4 state helpers", () => {
  it("formats deterministic UK dates", () => {
    expect(formatProgressDate("2026-09-21")).toBe("21 Sept 2026");
    expect(formatProgressDate("bad")).toBe("");
  });

  it("distinguishes no Session history, partial-only, one Session and established history", () => {
    expect(progressTrainingState(training())).toBe("no_sessions");
    expect(progressTrainingState(training({ partial: 1 }))).toBe("partial_only");
    expect(progressTrainingState(training({ completed: 1 }))).toBe("one_session");
    expect(progressTrainingState(training({ completed: 2 }))).toBe("established");
  });

  it("maps 0/1/2/3+ Assessments to the locked early-data states", () => {
    expect(progressAssessmentState(assessment(0))).toBe("no_baseline");
    expect(progressAssessmentState(assessment(1))).toBe("baseline_established");
    expect(progressAssessmentState(assessment(2))).toBe("comparison_available");
    expect(progressAssessmentState(assessment(3))).toBe("trend_ready");
  });

  it("keeps Development state at baseline until tag comparisons exist", () => {
    expect(progressDevelopmentState(development(0, []))).toBe("no_baseline");
    expect(progressDevelopmentState(development(1, ["baseline_set"]))).toBe(
      "baseline_established"
    );
    expect(progressDevelopmentState(development(2, ["improving"]))).toBe(
      "comparison_available"
    );
    expect(progressDevelopmentState(development(3, ["improving"]))).toBe(
      "trend_ready"
    );
  });
});

describe("buildProgressViewModel", () => {
  it("builds the deliberate real-production empty state without fake history", () => {
    const model = buildProgressViewModel({
      trainingProgress: training(),
      assessmentProgress: assessment(0),
      developmentTrends: development(0, ["no_baseline", "no_baseline"]),
      currentStreak: 7,
      currentXp: 1234,
      profileName: "Wilf",
      assessmentScheduleStatuses: [
        {
          state: "upcoming",
          cycleStartYmd: "2026-09-21",
          cycleEndYmd: "2026-09-27",
          nextCycleStartYmd: "2026-10-19",
          daysUntilCycle: 11,
        },
      ],
    });

    expect(model.profileName).toBe("Wilf");
    expect(model.states).toEqual({
      training: "no_sessions",
      assessment: "no_baseline",
      development: "no_baseline",
    });
    expect(model.training.sessionsThisWeek).toBe(0);
    expect(model.training.currentStreak).toBe(7);
    expect(model.training.currentXp).toBe(1234);
    expect(model.assessment.completedCount).toBe(0);
    expect(model.assessment.schedule.state).toBe("upcoming");
    expect(model.assessment.schedule.detail).toContain("21 Sept 2026");
    expect(model.assessment.message).toContain("No Assessment baseline yet");
    expect(model.development.message).toContain("No Development baseline yet");
  });

  it("does not present the first benchmark as PB progress", () => {
    const model = buildProgressViewModel({
      trainingProgress: training({ completed: 1, week: 1, month: 1 }),
      assessmentProgress: assessment(1),
      developmentTrends: development(1, ["baseline_set", "baseline_set"]),
    });

    expect(model.states.assessment).toBe("baseline_established");
    expect(model.assessment.latestPbCount).toBe(0);
    expect(model.assessment.message).toContain("Baseline established");
    expect(model.states.development).toBe("baseline_established");
  });

  it("surfaces comparison-ready summary after the second benchmark", () => {
    const model = buildProgressViewModel({
      trainingProgress: training({ completed: 4, week: 2, month: 4 }),
      assessmentProgress: assessment(2),
      developmentTrends: development(2, ["improving", "unchanged"]),
      currentStreak: 3,
      currentXp: 2500,
    });

    expect(model.states.assessment).toBe("comparison_available");
    expect(model.assessment.latestPbCount).toBe(3);
    expect(model.assessment.improvedCount).toBe(2);
    expect(model.states.development).toBe("comparison_available");
    expect(model.development.comparisonReadyCount).toBe(2);
    expect(model.development.message).toContain("2 development areas have");
  });

  it("marks 3+ Assessment history as trend ready", () => {
    const model = buildProgressViewModel({
      trainingProgress: training({ completed: 6 }),
      assessmentProgress: assessment(3),
      developmentTrends: development(3, ["improving", "declining", "mixed"]),
    });

    expect(model.states.assessment).toBe("trend_ready");
    expect(model.states.development).toBe("trend_ready");
    expect(model.development.comparisonReadyCount).toBe(3);
  });

  it("summarises due, overdue, in-progress and completed schedule states", () => {
    const base = {
      trainingProgress: training(),
      assessmentProgress: assessment(0),
      developmentTrends: development(0, []),
    };

    const due = buildProgressViewModel({
      ...base,
      assessmentScheduleStatuses: [
        { state: "due", cycleStartYmd: "2026-09-21", cycleEndYmd: "2026-09-27" },
      ],
    });
    expect(due.assessment.schedule.title).toBe("Benchmark due now");

    const overdue = buildProgressViewModel({
      ...base,
      assessmentScheduleStatuses: [
        { state: "overdue", cycleStartYmd: "2026-09-21", cycleEndYmd: "2026-09-27" },
      ],
    });
    expect(overdue.assessment.schedule.title).toBe("Benchmark overdue");

    const inProgress = buildProgressViewModel({
      ...base,
      assessmentScheduleStatuses: [{ state: "in_progress" }],
    });
    expect(inProgress.assessment.schedule.title).toBe("Benchmark in progress");

    const completed = buildProgressViewModel({
      ...base,
      assessmentScheduleStatuses: [
        { state: "completed", nextCycleStartYmd: "2026-10-19" },
      ],
    });
    expect(completed.assessment.schedule.detail).toContain("19 Oct 2026");
  });
});
