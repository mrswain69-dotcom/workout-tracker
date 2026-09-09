import { describe, expect, it } from "vitest";
import {
  assessmentMetricComparisonKey,
  buildAssessmentRunHistory,
  buildAssessmentTestHistory,
  compareAssessmentHistoryEntries,
  formatAssessmentHistoryEntry,
} from "./assessmentHistoryEngine.js";

function run(id, date, status = "completed") {
  return {
    id,
    status,
    date_ymd: date,
    completed_at: `${date}T18:00:00Z`,
    template_snapshot: { template: { name: "Monthly Benchmark" } },
  };
}

function result({
  id,
  runId,
  testId = "test-1",
  name = "10 m acceleration",
  value,
  metric = {},
  valid = true,
  dimensions = null,
}) {
  const baseMetric = {
    metricType: "numeric",
    unit: "s",
    scoringDirection: "lower",
    attemptCount: 1,
    resultStrategy: "single",
    sideMode: dimensions ? "separate" : "none",
    pbEligible: true,
    metricConfig: { decimalPlaces: 2, percentageDecimalPlaces: 1 },
    ...metric,
  };
  return {
    id,
    family_id: "family-1",
    assessment_run_id: runId,
    test_id: testId,
    position: 1,
    test_name_snapshot: name,
    metric_snapshot: baseMetric,
    retained_result: dimensions || { overall: value },
    comparable_value: dimensions ? null : value,
    comparable_dimensions: dimensions || {},
    is_valid: valid,
  };
}

describe("assessmentMetricComparisonKey", () => {
  it("treats attempt count and result strategy changes as comparable when the retained metric meaning is unchanged", () => {
    const a = assessmentMetricComparisonKey({
      metricType: "numeric",
      unit: "s",
      scoringDirection: "lower",
      sideMode: "none",
      attemptCount: 1,
      resultStrategy: "single",
    });
    const b = assessmentMetricComparisonKey({
      metricType: "numeric",
      unit: "s",
      scoringDirection: "lower",
      sideMode: "none",
      attemptCount: 3,
      resultStrategy: "best",
    });
    expect(a).toBe(b);
  });

  it("separates histories when unit, direction or side semantics change", () => {
    const base = assessmentMetricComparisonKey({
      metricType: "numeric",
      unit: "s",
      scoringDirection: "lower",
      sideMode: "none",
    });
    expect(
      assessmentMetricComparisonKey({
        metricType: "numeric",
        unit: "cm",
        scoringDirection: "higher",
        sideMode: "none",
      })
    ).not.toBe(base);
  });
});

describe("buildAssessmentTestHistory", () => {
  it("derives latest, previous, original baseline and a lower-is-better PB from completed valid history", () => {
    const runs = [
      run("run-1", "2026-01-01"),
      run("run-2", "2026-02-01"),
      run("run-3", "2026-03-01"),
    ];
    const results = [
      result({ id: "r1", runId: "run-1", value: 2.2 }),
      result({ id: "r2", runId: "run-2", value: 2.1 }),
      result({ id: "r3", runId: "run-3", value: 2.15 }),
    ];

    const [history] = buildAssessmentTestHistory({ runs, results });
    expect(history.baseline.comparableValue).toBe(2.2);
    expect(history.previous.comparableValue).toBe(2.1);
    expect(history.latest.comparableValue).toBe(2.15);
    expect(history.pb.overall.comparableValue).toBe(2.1);
    expect(history.latestNewPb.overall).toBeUndefined();
    expect(history.pb.latestNewPb.overall).toBe(false);
    expect(history.previousComparison.comparison.overall.status).toBe("declined");
    expect(history.baselineComparison.comparison.overall.status).toBe("improved");
  });

  it("marks a latest result as a new PB only when it strictly beats the prior best", () => {
    const runs = [run("run-1", "2026-01-01"), run("run-2", "2026-02-01")];
    const results = [
      result({ id: "r1", runId: "run-1", value: 2.2 }),
      result({ id: "r2", runId: "run-2", value: 2.05 }),
    ];
    const [history] = buildAssessmentTestHistory({ runs, results });
    expect(history.pb.latestNewPb.overall).toBe(true);
    expect(history.entries[0].recordMarkers.overall).toBe(false);
    expect(history.entries[1].recordMarkers.overall).toBe(true);
  });

  it("does not call a tied PB a new PB", () => {
    const runs = [run("run-1", "2026-01-01"), run("run-2", "2026-02-01")];
    const results = [
      result({ id: "r1", runId: "run-1", value: 2.05 }),
      result({ id: "r2", runId: "run-2", value: 2.05 }),
    ];
    const [history] = buildAssessmentTestHistory({ runs, results });
    expect(history.pb.latestNewPb.overall).toBe(false);
    expect(history.entries[1].recordMarkers.overall).toBe(false);
  });

  it("derives independent left/right PBs and comparisons", () => {
    const runs = [run("run-1", "2026-01-01"), run("run-2", "2026-02-01")];
    const results = [
      result({
        id: "r1",
        runId: "run-1",
        dimensions: { left: 18, right: 20 },
        metric: { unit: "reps", scoringDirection: "higher" },
      }),
      result({
        id: "r2",
        runId: "run-2",
        dimensions: { left: 22, right: 19 },
        metric: { unit: "reps", scoringDirection: "higher" },
      }),
    ];
    const [history] = buildAssessmentTestHistory({ runs, results });
    expect(history.pb.dimensions.left.comparableDimensions.left).toBe(22);
    expect(history.pb.dimensions.right.comparableDimensions.right).toBe(20);
    expect(history.pb.latestNewPb.dimensions.left).toBe(true);
    expect(history.pb.latestNewPb.dimensions.right).toBe(false);
    expect(history.previousComparison.comparison.dimensions.left.status).toBe("improved");
    expect(history.previousComparison.comparison.dimensions.right.status).toBe("declined");
  });

  it("keeps incompatible historical entries visible but blocks comparison and PB mixing", () => {
    const runs = [run("run-1", "2026-01-01"), run("run-2", "2026-02-01")];
    const results = [
      result({ id: "r1", runId: "run-1", value: 2.1 }),
      result({
        id: "r2",
        runId: "run-2",
        value: 650,
        metric: { unit: "ms", scoringDirection: "lower" },
      }),
    ];
    const [history] = buildAssessmentTestHistory({ runs, results });
    expect(history.count).toBe(2);
    expect(history.metricChanged).toBe(true);
    expect(history.previousComparison).toEqual({
      available: false,
      reason: "metric_changed",
      comparison: null,
    });
    expect(history.pb.overall.comparableValue).toBe(650);
  });

  it("excludes in-progress, cancelled and invalid results from derived history", () => {
    const runs = [
      run("completed", "2026-01-01"),
      run("progress", "2026-02-01", "in_progress"),
      run("cancelled", "2026-03-01", "cancelled"),
    ];
    const results = [
      result({ id: "ok", runId: "completed", value: 10 }),
      result({ id: "bad", runId: "completed", value: 11, valid: false }),
      result({ id: "progress", runId: "progress", value: 12 }),
      result({ id: "cancel", runId: "cancelled", value: 13 }),
    ];
    const [history] = buildAssessmentTestHistory({ runs, results });
    expect(history.count).toBe(1);
    expect(history.latest.id).toBe("ok");
  });

  it("preserves renamed historical labels while using the latest snapshot name for the summary", () => {
    const runs = [run("run-1", "2026-01-01"), run("run-2", "2026-02-01")];
    const results = [
      result({ id: "r1", runId: "run-1", name: "Sprint", value: 2.2 }),
      result({ id: "r2", runId: "run-2", name: "10 m acceleration", value: 2.1 }),
    ];
    const [history] = buildAssessmentTestHistory({ runs, results });
    expect(history.testName).toBe("10 m acceleration");
    expect(history.entries.map((entry) => entry.testName)).toEqual([
      "Sprint",
      "10 m acceleration",
    ]);
  });

  it("does not use PB-ineligible entries as personal-best candidates", () => {
    const runs = [run("run-1", "2026-01-01"), run("run-2", "2026-02-01")];
    const results = [
      result({ id: "r1", runId: "run-1", value: 2.2 }),
      result({
        id: "r2",
        runId: "run-2",
        value: 2.0,
        metric: { pbEligible: false },
      }),
    ];
    const [history] = buildAssessmentTestHistory({ runs, results });
    expect(history.pb.overall.comparableValue).toBe(2.2);
    expect(history.pb.latestNewPb.overall).toBe(false);
  });

  it("sorts canonical Tests by latest display name", () => {
    const runs = [run("run-1", "2026-01-01")];
    const histories = buildAssessmentTestHistory({
      runs,
      results: [
        result({ id: "b", runId: "run-1", testId: "b", name: "Zig", value: 1 }),
        result({ id: "a", runId: "run-1", testId: "a", name: "Agility", value: 2 }),
      ],
    });
    expect(histories.map((item) => item.testName)).toEqual(["Agility", "Zig"]);
  });
});

describe("history helpers", () => {
  it("formats stored scalar and L/R retained results using the frozen metric", () => {
    const scalar = buildAssessmentTestHistory({
      runs: [run("run-1", "2026-01-01")],
      results: [result({ id: "r1", runId: "run-1", value: 2.04 })],
    })[0].latest;
    expect(formatAssessmentHistoryEntry(scalar)).toBe("2.04 s");

    const sides = buildAssessmentTestHistory({
      runs: [run("run-2", "2026-01-01")],
      results: [
        result({
          id: "r2",
          runId: "run-2",
          dimensions: { left: 12, right: 14 },
          metric: { unit: "reps", scoringDirection: "higher" },
        }),
      ],
    })[0].latest;
    expect(formatAssessmentHistoryEntry(sides)).toBe("L 12 reps · R 14 reps");
  });

  it("returns an explicit missing comparison when a reference result is absent", () => {
    expect(compareAssessmentHistoryEntries(null, null)).toEqual({
      available: false,
      reason: "missing",
      comparison: null,
    });
  });

  it("builds completed Assessment run history newest first and keeps valid rows ordered", () => {
    const runs = [run("run-1", "2026-01-01"), run("run-2", "2026-02-01")];
    const results = [
      { ...result({ id: "r2", runId: "run-2", value: 2 }), position: 2 },
      { ...result({ id: "r1", runId: "run-2", value: 1 }), position: 1 },
    ];
    const history = buildAssessmentRunHistory({ runs, results });
    expect(history.map((item) => item.run.id)).toEqual(["run-2", "run-1"]);
    expect(history[0].results.map((row) => row.position)).toEqual([1, 2]);
  });
});
