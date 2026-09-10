import { describe, expect, it } from "vitest";
import {
  ASSESSMENT_ANALYSIS_CAUSATION_BOUNDARY,
  buildAssessmentAnalysis,
} from "./assessmentAnalysisEngine.js";

function run({ id, date, profileId = "wilf", templateId = "football" }) {
  return {
    id,
    profile_id: profileId,
    assessment_template_id: templateId,
    date_ymd: date,
    status: "completed",
    completed_at: `${date}T18:00:00Z`,
    template_version: 1,
    template_snapshot: {
      template: { id: templateId, name: "Football Benchmark" },
      tests: [
        {
          testId: "receive-test",
          displayLabel: "Outside-foot receive",
          developmentTagIds: ["first-touch"],
        },
      ],
    },
  };
}

function result({ runId, value }) {
  return {
    id: `${runId}-receive-test`,
    assessment_run_id: runId,
    test_id: "receive-test",
    position: 1,
    test_name_snapshot: "Outside-foot receive",
    metric_snapshot: {
      metricType: "numeric",
      unit: "reps",
      scoringDirection: "higher",
      attemptCount: 1,
      resultStrategy: "single",
      sideMode: "none",
      allowNegative: false,
      pbEligible: true,
      metricConfig: { decimalPlaces: 0, percentageDecimalPlaces: 1 },
    },
    retained_result: { overall: value },
    comparable_value: value,
    comparable_dimensions: {},
    is_valid: true,
  };
}

function session({ date, templateId, code, movementId, count, profileId = "wilf" }) {
  return {
    id: `${profileId}-${date}-${templateId}`,
    profile_id: profileId,
    date_ymd: date,
    log_json: {
      date_ymd: date,
      blocks: [
        {
          id: `block-${date}-${templateId}`,
          typeId: "session",
          session: {
            schemaVersion: 2,
            templateId,
            displayCode: code,
            name: `Session ${code}`,
            completed: true,
            actualDurationSec: 600,
            movements: [
              {
                movementId,
                name: movementId,
                developmentTagIds: ["first-touch"],
                trackingMethod: "repetitions",
                trackingConfig: { unit: "reps" },
                completed: true,
                skipped: false,
                result: { overall: { count } },
              },
            ],
          },
        },
      ],
    },
  };
}

function sessionLibrary() {
  return {
    templates: [
      { id: "a", display_code: "A", name: "Close Control", sort_order: 1, archived: false },
      { id: "b", display_code: "B", name: "Receiving", sort_order: 2, archived: false },
    ],
    templateMovements: [
      { session_template_id: "a", movement_id: "receive-a" },
      { session_template_id: "b", movement_id: "receive-b" },
    ],
    movementDevelopmentTags: [
      { movement_id: "receive-a", development_tag_id: "first-touch" },
      { movement_id: "receive-b", development_tag_id: "first-touch" },
    ],
  };
}

function readyAnalysis(overrides = {}) {
  return buildAssessmentAnalysis({
    runs: [run({ id: "r1", date: "2026-09-01" }), run({ id: "r2", date: "2026-10-01" })],
    results: [result({ runId: "r1", value: 5 }), result({ runId: "r2", value: 8 })],
    logs: [
      session({ date: "2026-09-05", templateId: "a", code: "A", movementId: "receive-a", count: 20 }),
      session({ date: "2026-09-12", templateId: "a", code: "A", movementId: "receive-a", count: 25 }),
      session({ date: "2026-09-19", templateId: "b", code: "B", movementId: "receive-b", count: 15 }),
    ],
    profileId: "wilf",
    sessionLibrary: sessionLibrary(),
    assessmentLibrary: {},
    ...overrides,
  });
}

describe("Phase 4 Stage 4 combined Assessment Analysis states", () => {
  it("returns a deliberate no-baseline state with no invented analysis", () => {
    const analysis = buildAssessmentAnalysis({ profileId: "wilf" });
    expect(analysis.state).toBe("no_baseline");
    expect(analysis.tests).toEqual([]);
    expect(analysis.sessionFocus.possibleNextFocus.available).toBe(false);
    expect(analysis.overallNarrative).toContain("Complete an Assessment");
    expect(analysis.causationBoundary).toBe(ASSESSMENT_ANALYSIS_CAUSATION_BOUNDARY);
  });

  it("returns baseline-only until the same Assessment Template is completed again", () => {
    const analysis = buildAssessmentAnalysis({
      runs: [run({ id: "r1", date: "2026-09-01" })],
      results: [result({ runId: "r1", value: 5 })],
      profileId: "wilf",
    });
    expect(analysis.state).toBe("baseline_only");
    expect(analysis.summary.completedAssessments).toBe(1);
    expect(analysis.tests).toEqual([]);
    expect(analysis.overallNarrative).toContain("baseline Assessment is established");
  });
});

describe("Phase 4 Stage 4 analysis-ready model", () => {
  it("combines benchmark change, related training, consistency and Session imbalance", () => {
    const analysis = readyAnalysis();
    expect(analysis.state).toBe("analysis_ready");
    expect(analysis.summary.improved).toBe(1);
    expect(analysis.summary.latestPbCount).toBe(1);
    expect(analysis.tests).toHaveLength(1);
    expect(analysis.tests[0].status).toBe("improved");
    expect(analysis.tests[0].evidenceLevel).toBe("high");
    expect(analysis.tests[0].training.completedRelevantSessions).toBe(3);
    expect(analysis.tests[0].training.recordedExecutions).toBe(60);
    expect(analysis.betweenAssessmentTraining.completedSessions).toBe(3);
    expect(analysis.observedConsistency.eligiblePeriods).toBe(5);
    expect(analysis.observedConsistency.activePeriods).toBe(3);
    expect(analysis.observedConsistency.consistencyPct).toBe(60);
    expect(analysis.sessionFocus.sessionBalance.map((row) => [row.displayCode, row.completedCount])).toEqual([
      ["A", 2],
      ["B", 1],
    ]);
    expect(analysis.sessionFocus.possibleNextFocus.displayCode).toBe("B");
    expect(analysis.evidenceCounts).toEqual({ high: 1, medium: 0, low: 0, none: 0 });
    expect(analysis.taxonomyFallbackUsed).toBe(false);
  });

  it("produces an overall narrative that keeps result and training facts descriptive rather than causal", () => {
    const analysis = readyAnalysis();
    expect(analysis.resultNarrative).toContain("1 improved");
    expect(analysis.resultNarrative).toContain("1 new PB");
    expect(analysis.trainingNarrative).toContain("3 completed structured Sessions");
    expect(analysis.trainingNarrative).toContain("3 of 5 seven-day periods");
    expect(analysis.trainingNarrative).toContain("not plan adherence");
    expect(analysis.focusNarrative).toContain("Possible next focus");
    expect(analysis.overallNarrative).not.toMatch(/made your|train harder|should|caused by|because you/i);
    expect(analysis.causationBoundary).toContain("does not establish that training caused the result");
  });

  it("returns no possible focus when relevant active Sessions are evenly represented", () => {
    const analysis = readyAnalysis({
      logs: [
        session({ date: "2026-09-05", templateId: "a", code: "A", movementId: "receive-a", count: 20 }),
        session({ date: "2026-09-12", templateId: "b", code: "B", movementId: "receive-b", count: 20 }),
      ],
    });
    expect(analysis.sessionFocus.possibleNextFocus.available).toBe(false);
    expect(analysis.focusNarrative).toContain("evenly represented");
    expect(analysis.focusNarrative).not.toMatch(/should|train harder|increase/i);
  });

  it("does not let another athlete's training alter the selected athlete's Analysis", () => {
    const analysis = readyAnalysis({
      logs: [
        session({ date: "2026-09-05", templateId: "a", code: "A", movementId: "receive-a", count: 20 }),
        session({ date: "2026-09-12", templateId: "b", code: "B", movementId: "receive-b", count: 20, profileId: "xander" }),
      ],
    });
    expect(analysis.betweenAssessmentTraining.completedSessions).toBe(1);
    expect(analysis.tests[0].training.completedRelevantSessions).toBe(1);
    expect(analysis.sessionFocus.sessionBalance.find((row) => row.displayCode === "B")?.completedCount).toBe(0);
  });
});
