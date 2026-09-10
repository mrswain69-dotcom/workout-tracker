import { describe, expect, it } from "vitest";
import {
  buildAssessmentAnalysisViewModel,
  formatAssessmentAnalysisDate,
} from "./assessmentAnalysisViewModel.js";

function readyAnalysis() {
  return {
    state: "analysis_ready",
    previousRun: { date_ymd: "2026-09-01" },
    latestRun: { date_ymd: "2026-10-01" },
    interval: {
      valid: true,
      startDate: "2026-09-02",
      endDate: "2026-09-30",
      calendarDays: 29,
    },
    summary: {
      latestPbCount: 2,
      improved: 2,
      declined: 1,
      unchanged: 1,
      mixed: 1,
      unavailable: 1,
    },
    betweenAssessmentTraining: {
      completedSessions: 7,
      activeSessionDays: 6,
    },
    observedConsistency: {
      activePeriods: 4,
      eligiblePeriods: 5,
      consistencyPct: 80,
    },
    evidenceCounts: { high: 1, medium: 1, low: 1, none: 1 },
    taxonomyFallbackUsed: true,
    sessionFocus: {
      sessionBalance: [
        { templateId: "a", displayCode: "A", name: "Close Control", completedCount: 4, underrepresented: false, lowestCount: false },
        { templateId: "b", displayCode: "B", name: "Receiving", completedCount: 2, underrepresented: true, lowestCount: true },
      ],
      possibleNextFocus: {
        available: true,
        templateId: "b",
        displayCode: "B",
        name: "Receiving",
        reason: "Session B · Receiving was completed less often than at least one other related active Session between benchmarks.",
        basis: "session_balance_only",
      },
    },
    tests: [
      {
        testId: "receive-test",
        testName: "Outside-foot receive",
        status: "improved",
        evidenceLevel: "high",
        latest: { displayValue: "8 reps" },
        previous: { displayValue: "5 reps" },
        baseline: { displayValue: "4 reps" },
        latestPbCount: 1,
        percentageImprovement: 60,
        developmentTagIds: ["first-touch"],
        developmentTagSource: "frozen",
        training: {
          completedRelevantSessions: 3,
          partialRelevantSessions: 1,
          recordedExecutions: 186,
          attempts: 20,
          successes: 15,
          accuracyPct: 75,
        },
        evidenceSummary: "3 completed related Sessions were recorded between benchmarks.",
        narrative: "Outside-foot receive improved alongside recorded related training.",
      },
      {
        testId: "sprint-test",
        testName: "Acceleration",
        status: "declined",
        evidenceLevel: "none",
        latest: { displayValue: "3.4 sec" },
        previous: { displayValue: "3.2 sec" },
        baseline: { displayValue: "3.2 sec" },
        latestPbCount: 0,
        percentageImprovement: null,
        developmentTagIds: ["acceleration"],
        developmentTagSource: "current_taxonomy",
        training: {
          completedRelevantSessions: 0,
          recordedExecutions: 0,
          attempts: 0,
          successes: 0,
          accuracyPct: null,
        },
        taxonomyNote: "Some historical Movement relationships use the current Development Tag taxonomy.",
        evidenceSummary: "No related structured training was recorded between these benchmarks.",
        narrative: "Acceleration declined; no related structured training was recorded between benchmarks.",
      },
    ],
    resultNarrative: "Latest Test outcomes: 2 improved, 1 declined.",
    trainingNarrative: "7 completed structured Sessions were recorded.",
    focusNarrative: "Possible next focus: Session B was underrepresented.",
    overallNarrative: "Latest Test outcomes and recorded training are summarised together.",
    causationBoundary: "Analysis describes recorded training alongside benchmark change; it does not establish that training caused the result.",
  };
}

describe("Phase 4 Stage 4 Analysis date presentation", () => {
  it("formats Assessment dates deterministically in UK style", () => {
    expect(formatAssessmentAnalysisDate("2026-09-01")).toBe("1 Sept 2026");
    expect(formatAssessmentAnalysisDate("not-a-date")).toBe("");
  });
});

describe("Phase 4 Stage 4 Analysis presentation states", () => {
  it("keeps zero Assessments deliberate and empty", () => {
    const model = buildAssessmentAnalysisViewModel({ state: "no_baseline" });
    expect(model.ready).toBe(false);
    expect(model.title).toBe("Build your Assessment baseline");
    expect(model.summaryCards).toEqual([]);
    expect(model.tests).toEqual([]);
    expect(model.stateMessage).toContain("Complete an Assessment");
  });

  it("keeps one Assessment as baseline-only rather than showing fake comparison cards", () => {
    const model = buildAssessmentAnalysisViewModel({
      state: "baseline_only",
      latestRun: { date_ymd: "2026-09-01" },
    });
    expect(model.ready).toBe(false);
    expect(model.title).toBe("Baseline established");
    expect(model.benchmark.latestDateLabel).toBe("1 Sept 2026");
    expect(model.summaryCards).toEqual([]);
    expect(model.trainingCards).toEqual([]);
  });
});

describe("Phase 4 Stage 4 Analysis view-model", () => {
  it("maps the analysis-ready model without recalculating Assessment truth", () => {
    const model = buildAssessmentAnalysisViewModel(readyAnalysis());
    expect(model.ready).toBe(true);
    expect(model.benchmark.previousDateLabel).toBe("1 Sept 2026");
    expect(model.benchmark.latestDateLabel).toBe("1 Oct 2026");
    expect(model.benchmark.intervalDays).toBe(29);
    expect(model.summaryCards.map((card) => [card.label, card.value])).toEqual([
      ["New PBs", 2],
      ["Improved", 2],
      ["Declined", 1],
      ["Unchanged", 1],
      ["Mixed", 1],
      ["No comparison", 1],
    ]);
    expect(model.trainingCards.find((card) => card.key === "consistency")?.value).toBe("80%");
    expect(model.trainingCards.find((card) => card.key === "consistency")?.note).toContain("not plan adherence");
    expect(model.taxonomyFallbackUsed).toBe(true);
    expect(model.sessionRows.find((row) => row.displayCode === "B")?.underrepresented).toBe(true);
    expect(model.possibleNextFocus.available).toBe(true);
  });

  it("preserves typed Test evidence rather than blending executions with attempts", () => {
    const model = buildAssessmentAnalysisViewModel(readyAnalysis());
    const receive = model.tests.find((test) => test.testId === "receive-test");
    expect(receive.statusLabel).toBe("Improved");
    expect(receive.evidenceLabel).toBe("High detail");
    expect(receive.latestValue).toBe("8 reps");
    expect(receive.previousValue).toBe("5 reps");
    expect(receive.percentageImprovementLabel).toBe("+60%");
    expect(receive.volumeFacts).toEqual([
      "186 recorded executions",
      "15/20 successful attempts",
    ]);
    expect(receive.recordedExecutions).toBe(186);
    expect(receive.attempts).toBe(20);
    expect(receive.successes).toBe(15);
  });

  it("surfaces evidence limitations and the causation/consistency boundaries", () => {
    const model = buildAssessmentAnalysisViewModel(readyAnalysis());
    const sprint = model.tests.find((test) => test.testId === "sprint-test");
    expect(sprint.evidenceLabel).toBe("No related structured evidence");
    expect(sprint.taxonomyNote).toContain("current Development Tag taxonomy");
    expect(model.causationBoundary).toContain("does not establish that training caused the result");
    expect(model.consistencyBoundary).toContain("not a formal plan-adherence score");
  });
});
