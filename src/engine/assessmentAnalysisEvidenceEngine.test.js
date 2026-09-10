import { describe, expect, it } from "vitest";
import {
  buildAssessmentAnalysisInterval,
  buildAssessmentAnalysisPair,
  buildAssessmentTrainingEvidence,
  buildRelevantTrainingEvidence,
  resolveAnalysisMovementDevelopmentTags,
  resolveAnalysisTestDevelopmentTags,
} from "./assessmentAnalysisEvidenceEngine.js";

function run({
  id,
  date,
  profileId = "wilf",
  templateId = "football",
  status = "completed",
  testTags = ["first-touch"],
  includeFrozenTestTags = true,
}) {
  const snapshotTest = {
    testId: "receive-test",
    displayLabel: "Outside-foot receive",
  };
  if (includeFrozenTestTags) snapshotTest.developmentTagIds = testTags;
  return {
    id,
    profile_id: profileId,
    assessment_template_id: templateId,
    date_ymd: date,
    status,
    completed_at: status === "completed" ? `${date}T18:00:00Z` : null,
    template_version: 1,
    template_snapshot: {
      template: { id: templateId, name: templateId === "football" ? "Football Benchmark" : "Mobility Benchmark" },
      tests: [snapshotTest],
    },
  };
}

function result({ runId, value, testId = "receive-test", name = "Outside-foot receive" }) {
  return {
    id: `${runId}-${testId}`,
    assessment_run_id: runId,
    test_id: testId,
    position: 1,
    test_name_snapshot: name,
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

function movement({
  id = "outside-receive",
  name = "Outside-foot receive",
  tags = ["first-touch"],
  includeFrozenTags = true,
  method = "repetitions",
  completed = true,
  resultData = { overall: { count: 20 } },
} = {}) {
  const row = {
    movementId: id,
    name,
    displayLabel: name,
    trackingMethod: method,
    trackingConfig: method === "attempts_successes" ? { sideMode: "none" } : {},
    completed,
    skipped: false,
    result: resultData,
  };
  if (includeFrozenTags) row.developmentTagIds = tags;
  return row;
}

function session({
  date,
  profileId = "wilf",
  templateId = "session-b",
  code = "B",
  name = "Receiving & First Touch",
  completed = true,
  movements = [movement()],
} = {}) {
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
            name,
            completed,
            movements,
          },
        },
      ],
    },
  };
}

function legacy(date, profileId = "wilf") {
  return {
    id: `legacy-${date}`,
    profile_id: profileId,
    date_ymd: date,
    log_json: {
      date_ymd: date,
      blocks: [{ typeId: "strength", exercises: [{ name: "Outside-foot receive", reps: 999 }] }],
    },
  };
}

const interval = buildAssessmentAnalysisInterval("2026-09-01", "2026-10-01");

describe("Phase 4 Stage 1 Assessment pair", () => {
  it("returns no_baseline with zero completed Assessments", () => {
    const pair = buildAssessmentAnalysisPair({ profileId: "wilf" });
    expect(pair.state).toBe("no_baseline");
    expect(pair.latestRun).toBeNull();
    expect(pair.previousRun).toBeNull();
  });

  it("returns baseline_only with one completed Assessment", () => {
    const pair = buildAssessmentAnalysisPair({
      runs: [run({ id: "r1", date: "2026-09-01" })],
      results: [result({ runId: "r1", value: 5 })],
      profileId: "wilf",
    });
    expect(pair.state).toBe("baseline_only");
    expect(pair.assessmentProgress.completedAssessmentCount).toBe(1);
    expect(pair.interval.valid).toBe(false);
  });

  it("pairs the latest Assessment only with the previous completed run of the same template", () => {
    const runs = [
      run({ id: "football-old", date: "2026-08-01", templateId: "football" }),
      run({ id: "mobility", date: "2026-09-15", templateId: "mobility" }),
      run({ id: "football-new", date: "2026-10-01", templateId: "football" }),
    ];
    const results = [
      result({ runId: "football-old", value: 5 }),
      result({ runId: "football-new", value: 8 }),
    ];
    const pair = buildAssessmentAnalysisPair({ runs, results, profileId: "wilf" });
    expect(pair.state).toBe("analysis_ready");
    expect(pair.latestRun.id).toBe("football-new");
    expect(pair.previousRun.id).toBe("football-old");
    expect(pair.assessmentTemplateId).toBe("football");
    expect(pair.assessmentProgress.completedAssessmentCount).toBe(2);
    expect(pair.assessmentProgress.improvedTests).toHaveLength(1);
  });

  it("does not use another athlete's Assessment as the previous benchmark", () => {
    const runs = [
      run({ id: "wilf-new", date: "2026-10-01", profileId: "wilf" }),
      run({ id: "xander-old", date: "2026-09-01", profileId: "xander" }),
    ];
    const pair = buildAssessmentAnalysisPair({ runs, profileId: "wilf" });
    expect(pair.state).toBe("baseline_only");
    expect(pair.latestRun.id).toBe("wilf-new");
  });
});

describe("Phase 4 Stage 1 strict training interval", () => {
  it("excludes both Assessment dates", () => {
    expect(interval).toEqual({
      valid: true,
      previousAssessmentDate: "2026-09-01",
      latestAssessmentDate: "2026-10-01",
      startDate: "2026-09-02",
      endDate: "2026-09-30",
      calendarDays: 29,
      excludesAssessmentDates: true,
    });
  });

  it("returns no usable interval for same-day Assessments", () => {
    const same = buildAssessmentAnalysisInterval("2026-09-01", "2026-09-01");
    expect(same.valid).toBe(false);
    expect(same.calendarDays).toBe(0);
  });
});

describe("Phase 4 Stage 1 Development Tag provenance", () => {
  it("prefers frozen Test tags even when current taxonomy has changed", () => {
    const assessment = run({ id: "r2", date: "2026-10-01", testTags: ["historic-tag"] });
    expect(
      resolveAnalysisTestDevelopmentTags(assessment, "receive-test", [
        { test_id: "receive-test", development_tag_id: "new-tag" },
      ])
    ).toEqual({ tagIds: ["historic-tag"], source: "frozen" });
  });

  it("falls back to current Test taxonomy only when the snapshot property is absent", () => {
    const assessment = run({
      id: "r2",
      date: "2026-10-01",
      includeFrozenTestTags: false,
    });
    expect(
      resolveAnalysisTestDevelopmentTags(assessment, "receive-test", [
        { test_id: "receive-test", development_tag_id: "first-touch" },
      ])
    ).toEqual({ tagIds: ["first-touch"], source: "current_taxonomy" });
  });

  it("treats a frozen empty Movement tag list as authoritative and does not rewrite history", () => {
    const frozenEmpty = movement({ tags: [] });
    expect(
      resolveAnalysisMovementDevelopmentTags(frozenEmpty, [
        { movement_id: "outside-receive", development_tag_id: "first-touch" },
      ])
    ).toEqual({ tagIds: [], source: "frozen" });
  });

  it("allows a v1 Movement snapshot without tag IDs to use current taxonomy as an explicit fallback", () => {
    const old = movement({ includeFrozenTags: false });
    expect(
      resolveAnalysisMovementDevelopmentTags(old, [
        { movement_id: "outside-receive", development_tag_id: "first-touch" },
      ])
    ).toEqual({ tagIds: ["first-touch"], source: "current_taxonomy" });
  });
});

describe("Phase 4 Stage 1 related training evidence", () => {
  it("counts one related completed Session even when several related Movements are performed", () => {
    const evidence = buildRelevantTrainingEvidence({
      logs: [
        session({
          date: "2026-09-10",
          movements: [
            movement({ id: "receive-1", name: "Receive 1", resultData: { overall: { count: 20 } } }),
            movement({ id: "receive-2", name: "Receive 2", resultData: { overall: { count: 30 } } }),
          ],
        }),
      ],
      profileId: "wilf",
      interval,
      developmentTagIds: ["first-touch"],
    });
    expect(evidence.completedRelevantSessions).toBe(1);
    expect(evidence.performedMovementCount).toBe(2);
    expect(evidence.recordedExecutions).toBe(50);
    expect(evidence.evidenceLevel).toBe("high");
  });

  it("keeps executions and attempts/successes as separate evidence measures", () => {
    const evidence = buildRelevantTrainingEvidence({
      logs: [
        session({
          date: "2026-09-10",
          movements: [
            movement({ resultData: { overall: { count: 40 } } }),
            movement({
              id: "gate",
              name: "First-touch gate",
              method: "attempts_successes",
              resultData: { overall: { attempts: 10, successes: 8 } },
            }),
          ],
        }),
      ],
      profileId: "wilf",
      interval,
      developmentTagIds: ["first-touch"],
    });
    expect(evidence.recordedExecutions).toBe(40);
    expect(evidence.attempts).toBe(10);
    expect(evidence.successes).toBe(8);
    expect(evidence.accuracyPct).toBe(80);
    expect(evidence.completedRelevantSessions).toBe(1);
  });

  it("returns medium detail when related practice was performed without a numeric count", () => {
    const evidence = buildRelevantTrainingEvidence({
      logs: [
        session({
          date: "2026-09-12",
          movements: [
            movement({ method: "completion", resultData: null, completed: true }),
          ],
        }),
      ],
      profileId: "wilf",
      interval,
      developmentTagIds: ["first-touch"],
    });
    expect(evidence.evidenceLevel).toBe("medium");
    expect(evidence.completedRelevantSessions).toBe(1);
    expect(evidence.recordedExecutions).toBe(0);
    expect(evidence.attempts).toBe(0);
  });

  it("returns low detail for a related snapshot with no proof the Movement was performed", () => {
    const evidence = buildRelevantTrainingEvidence({
      logs: [
        session({
          date: "2026-09-12",
          completed: false,
          movements: [movement({ completed: false, resultData: null })],
        }),
      ],
      profileId: "wilf",
      interval,
      developmentTagIds: ["first-touch"],
    });
    expect(evidence.evidenceLevel).toBe("low");
    expect(evidence.relatedSnapshotSessions).toBe(1);
    expect(evidence.completedRelevantSessions).toBe(0);
    expect(evidence.performedMovementCount).toBe(0);
  });

  it("excludes activity on both Assessment dates and activity from another athlete", () => {
    const evidence = buildRelevantTrainingEvidence({
      logs: [
        session({ date: "2026-09-01" }),
        session({ date: "2026-09-15", profileId: "xander" }),
        session({ date: "2026-10-01" }),
        session({ date: "2026-09-20" }),
      ],
      profileId: "wilf",
      interval,
      developmentTagIds: ["first-touch"],
    });
    expect(evidence.completedRelevantSessions).toBe(1);
    expect(evidence.recordedExecutions).toBe(20);
  });

  it("never reverse-maps legacy workouts into related Development Tag evidence", () => {
    const evidence = buildRelevantTrainingEvidence({
      logs: [legacy("2026-09-15")],
      profileId: "wilf",
      interval,
      developmentTagIds: ["first-touch"],
      movementDevelopmentTags: [
        { movement_id: "outside-receive", development_tag_id: "first-touch" },
      ],
    });
    expect(evidence.evidenceLevel).toBe("none");
    expect(evidence.completedRelevantSessions).toBe(0);
    expect(evidence.recordedExecutions).toBe(0);
  });

  it("uses frozen Movement tags after live taxonomy removal", () => {
    const evidence = buildRelevantTrainingEvidence({
      logs: [session({ date: "2026-09-15" })],
      profileId: "wilf",
      interval,
      developmentTagIds: ["first-touch"],
      movementDevelopmentTags: [],
    });
    expect(evidence.evidenceLevel).toBe("high");
    expect(evidence.usedCurrentTaxonomyFallback).toBe(false);
  });

  it("reports current-taxonomy fallback when analysing a v1 Movement snapshot", () => {
    const evidence = buildRelevantTrainingEvidence({
      logs: [
        session({
          date: "2026-09-15",
          movements: [movement({ includeFrozenTags: false })],
        }),
      ],
      profileId: "wilf",
      interval,
      developmentTagIds: ["first-touch"],
      movementDevelopmentTags: [
        { movement_id: "outside-receive", development_tag_id: "first-touch" },
      ],
    });
    expect(evidence.evidenceLevel).toBe("high");
    expect(evidence.usedCurrentTaxonomyFallback).toBe(true);
    expect(evidence.movements[0].tagSources).toEqual(["current_taxonomy"]);
  });
});

describe("Phase 4 Stage 1 combined Assessment-to-training evidence", () => {
  it("attaches related interval evidence to the existing Assessment comparison truth", () => {
    const runs = [
      run({ id: "r1", date: "2026-09-01" }),
      run({ id: "r2", date: "2026-10-01" }),
    ];
    const analysis = buildAssessmentTrainingEvidence({
      runs,
      results: [result({ runId: "r1", value: 5 }), result({ runId: "r2", value: 8 })],
      logs: [session({ date: "2026-09-15" })],
      profileId: "wilf",
    });
    expect(analysis.state).toBe("analysis_ready");
    expect(analysis.tests).toHaveLength(1);
    expect(analysis.tests[0].status).toBe("improved");
    expect(analysis.tests[0].developmentTagSource).toBe("frozen");
    expect(analysis.tests[0].training.completedRelevantSessions).toBe(1);
    expect(analysis.tests[0].training.recordedExecutions).toBe(20);
  });
});
