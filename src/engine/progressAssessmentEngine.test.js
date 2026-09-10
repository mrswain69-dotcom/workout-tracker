import { describe, expect, it } from "vitest";
import {
  buildAssessmentProgress,
  scopeAssessmentProgressHistory,
} from "./progressAssessmentEngine.js";

function run({
  id,
  date,
  profileId = "wilf",
  templateId = "benchmark",
  status = "completed",
  name = "Football Monthly Benchmark",
  version = 1,
}) {
  return {
    id,
    family_id: "family-1",
    profile_id: profileId,
    assessment_template_id: templateId,
    date_ymd: date,
    status,
    completed_at: status === "completed" ? `${date}T18:00:00Z` : null,
    template_version: version,
    template_snapshot: { template: { name } },
  };
}

function scalarResult({
  id,
  runId,
  testId,
  name,
  value,
  direction = "higher",
  unit = "reps",
  allowNegative = false,
  percentageImprovement,
  valid = true,
  pbEligible = true,
  position = 1,
}) {
  return {
    id,
    family_id: "family-1",
    assessment_run_id: runId,
    test_id: testId,
    position,
    test_name_snapshot: name,
    metric_snapshot: {
      metricType: "numeric",
      unit,
      scoringDirection: direction,
      attemptCount: 1,
      resultStrategy: "single",
      sideMode: "none",
      allowNegative,
      pbEligible,
      metricConfig: {
        decimalPlaces: 2,
        percentageDecimalPlaces: 1,
        ...(percentageImprovement
          ? { percentageImprovement }
          : {}),
      },
    },
    retained_result: { overall: value },
    comparable_value: value,
    comparable_dimensions: {},
    is_valid: valid,
  };
}

function sideResult({
  id,
  runId,
  testId,
  name,
  left,
  right,
  direction = "higher",
  unit = "reps",
  position = 1,
}) {
  return {
    id,
    family_id: "family-1",
    assessment_run_id: runId,
    test_id: testId,
    position,
    test_name_snapshot: name,
    metric_snapshot: {
      metricType: "numeric",
      unit,
      scoringDirection: direction,
      attemptCount: 1,
      resultStrategy: "single",
      sideMode: "separate",
      pbEligible: true,
      metricConfig: { decimalPlaces: 1, percentageDecimalPlaces: 1 },
    },
    retained_result: { left, right },
    comparable_value: null,
    comparable_dimensions: { left, right },
    is_valid: true,
  };
}

describe("scopeAssessmentProgressHistory", () => {
  it("keeps only the selected athlete and their result rows", () => {
    const runs = [
      run({ id: "wilf-1", date: "2026-09-21", profileId: "wilf" }),
      run({ id: "xander-1", date: "2026-09-21", profileId: "xander" }),
    ];
    const results = [
      scalarResult({ id: "wr", runId: "wilf-1", testId: "sprint", name: "Sprint", value: 2.1 }),
      scalarResult({ id: "xr", runId: "xander-1", testId: "sprint", name: "Sprint", value: 2.0 }),
    ];
    const scoped = scopeAssessmentProgressHistory(
      { runs, results },
      { profileId: "wilf" }
    );
    expect(scoped.runs.map((item) => item.id)).toEqual(["wilf-1"]);
    expect(scoped.results.map((item) => item.id)).toEqual(["wr"]);
  });

  it("can scope one Assessment Template without reclassifying other runs", () => {
    const runs = [
      run({ id: "football", date: "2026-09-21", templateId: "football" }),
      run({ id: "mobility", date: "2026-09-22", templateId: "mobility" }),
    ];
    const scoped = scopeAssessmentProgressHistory(
      { runs, results: [] },
      { assessmentTemplateId: "football" }
    );
    expect(scoped.runs.map((item) => item.id)).toEqual(["football"]);
  });
});

describe("buildAssessmentProgress baseline states", () => {
  it("returns a deliberate no-baseline model for empty history", () => {
    const progress = buildAssessmentProgress({ profileId: "wilf" });
    expect(progress.completedAssessmentCount).toBe(0);
    expect(progress.baselineState).toBe("no_baseline");
    expect(progress.hasBaseline).toBe(false);
    expect(progress.hasComparison).toBe(false);
    expect(progress.latestAssessment).toBeNull();
    expect(progress.latestPbCount).toBe(0);
    expect(progress.latestTestStatuses).toEqual([]);
  });

  it("treats the first completed Assessment as baseline, not a set of PB events", () => {
    const runs = [run({ id: "r1", date: "2026-09-21" })];
    const results = [
      scalarResult({ id: "a", runId: "r1", testId: "press", name: "Press-ups", value: 12 }),
      scalarResult({ id: "b", runId: "r1", testId: "sprint", name: "Sprint", value: 2.2, direction: "lower", unit: "s" }),
    ];
    const progress = buildAssessmentProgress({ runs, results, profileId: "wilf" });
    expect(progress.baselineState).toBe("baseline_established");
    expect(progress.hasBaseline).toBe(true);
    expect(progress.hasComparison).toBe(false);
    expect(progress.latestAssessment.dateYmd).toBe("2026-09-21");
    expect(progress.latestAssessment.validResultCount).toBe(2);
    expect(progress.latestPbCount).toBe(0);
    expect(progress.unavailableTests).toHaveLength(2);
    expect(progress.improvedTests).toHaveLength(0);
  });

  it("excludes in-progress and cancelled runs from baseline/comparison state", () => {
    const runs = [
      run({ id: "r1", date: "2026-09-21" }),
      run({ id: "r2", date: "2026-10-19", status: "in_progress" }),
      run({ id: "r3", date: "2026-11-16", status: "cancelled" }),
    ];
    const results = [
      scalarResult({ id: "a", runId: "r1", testId: "press", name: "Press-ups", value: 12 }),
      scalarResult({ id: "b", runId: "r2", testId: "press", name: "Press-ups", value: 15 }),
      scalarResult({ id: "c", runId: "r3", testId: "press", name: "Press-ups", value: 18 }),
    ];
    const progress = buildAssessmentProgress({ runs, results });
    expect(progress.completedAssessmentCount).toBe(1);
    expect(progress.latestAssessment.runId).toBe("r1");
  });
});

describe("latest Assessment comparisons and PB events", () => {
  it("classifies higher-is-better improvement and a genuine new PB", () => {
    const runs = [
      run({ id: "r1", date: "2026-09-21" }),
      run({ id: "r2", date: "2026-10-19" }),
    ];
    const results = [
      scalarResult({ id: "a", runId: "r1", testId: "press", name: "Press-ups", value: 10 }),
      scalarResult({ id: "b", runId: "r2", testId: "press", name: "Press-ups", value: 12 }),
    ];
    const progress = buildAssessmentProgress({ runs, results });
    expect(progress.baselineState).toBe("comparison_available");
    expect(progress.improvedTests).toHaveLength(1);
    expect(progress.improvedTests[0].dimensions[0].percentageImprovement).toBe(20);
    expect(progress.latestPbCount).toBe(1);
    expect(progress.latestPbTestCount).toBe(1);
    expect(progress.latestPbEvents[0].dimension).toBe("overall");
  });

  it("respects lower-is-better direction", () => {
    const runs = [
      run({ id: "r1", date: "2026-09-21" }),
      run({ id: "r2", date: "2026-10-19" }),
    ];
    const results = [
      scalarResult({ id: "a", runId: "r1", testId: "sprint", name: "10 m acceleration", value: 2.0, direction: "lower", unit: "s" }),
      scalarResult({ id: "b", runId: "r2", testId: "sprint", name: "10 m acceleration", value: 1.8, direction: "lower", unit: "s" }),
    ];
    const progress = buildAssessmentProgress({ runs, results });
    expect(progress.improvedTests[0].dimensions[0].status).toBe("improved");
    expect(progress.improvedTests[0].dimensions[0].percentageImprovement).toBe(10);
    expect(progress.latestPbCount).toBe(1);
  });

  it("does not call a tied PB a new PB and classifies it as unchanged", () => {
    const runs = [
      run({ id: "r1", date: "2026-09-21" }),
      run({ id: "r2", date: "2026-10-19" }),
    ];
    const results = [
      scalarResult({ id: "a", runId: "r1", testId: "press", name: "Press-ups", value: 12 }),
      scalarResult({ id: "b", runId: "r2", testId: "press", name: "Press-ups", value: 12 }),
    ];
    const progress = buildAssessmentProgress({ runs, results });
    expect(progress.unchangedTests).toHaveLength(1);
    expect(progress.latestPbCount).toBe(0);
  });

  it("classifies a regression as declining without generating a PB", () => {
    const runs = [
      run({ id: "r1", date: "2026-09-21" }),
      run({ id: "r2", date: "2026-10-19" }),
    ];
    const results = [
      scalarResult({ id: "a", runId: "r1", testId: "press", name: "Press-ups", value: 14 }),
      scalarResult({ id: "b", runId: "r2", testId: "press", name: "Press-ups", value: 11 }),
    ];
    const progress = buildAssessmentProgress({ runs, results });
    expect(progress.decliningTests).toHaveLength(1);
    expect(progress.latestPbCount).toBe(0);
  });

  it("counts independent left/right PB events and preserves a mixed Test status", () => {
    const runs = [
      run({ id: "r1", date: "2026-09-21" }),
      run({ id: "r2", date: "2026-10-19" }),
    ];
    const results = [
      sideResult({ id: "a", runId: "r1", testId: "calf", name: "Calf raises", left: 18, right: 20 }),
      sideResult({ id: "b", runId: "r2", testId: "calf", name: "Calf raises", left: 22, right: 19 }),
    ];
    const progress = buildAssessmentProgress({ runs, results });
    expect(progress.mixedTests).toHaveLength(1);
    expect(progress.latestPbCount).toBe(1);
    expect(progress.latestPbTestCount).toBe(1);
    expect(progress.latestPbEvents[0].dimension).toBe("left");
  });

  it("can count two bilateral PB events from one canonical Test", () => {
    const runs = [
      run({ id: "r1", date: "2026-09-21" }),
      run({ id: "r2", date: "2026-10-19" }),
    ];
    const results = [
      sideResult({ id: "a", runId: "r1", testId: "calf", name: "Calf raises", left: 18, right: 20 }),
      sideResult({ id: "b", runId: "r2", testId: "calf", name: "Calf raises", left: 22, right: 23 }),
    ];
    const progress = buildAssessmentProgress({ runs, results });
    expect(progress.latestPbCount).toBe(2);
    expect(progress.latestPbTestCount).toBe(1);
    expect(progress.improvedTests).toHaveLength(1);
  });
});

describe("safe improvement ranking", () => {
  it("ranks compatible improvements by safe percentage rather than raw units", () => {
    const runs = [
      run({ id: "r1", date: "2026-09-21" }),
      run({ id: "r2", date: "2026-10-19" }),
    ];
    const results = [
      scalarResult({ id: "p1", runId: "r1", testId: "press", name: "Press-ups", value: 10 }),
      scalarResult({ id: "p2", runId: "r2", testId: "press", name: "Press-ups", value: 12 }),
      scalarResult({ id: "s1", runId: "r1", testId: "sprint", name: "Sprint", value: 2.0, direction: "lower", unit: "s" }),
      scalarResult({ id: "s2", runId: "r2", testId: "sprint", name: "Sprint", value: 1.9, direction: "lower", unit: "s" }),
    ];
    const progress = buildAssessmentProgress({ runs, results });
    expect(progress.biggestImprovements.map((item) => item.testName)).toEqual([
      "Press-ups",
      "Sprint",
    ]);
    expect(progress.biggestImprovements.map((item) => item.percentageRank)).toEqual([
      20,
      5,
    ]);
  });

  it("keeps signed/percentage-unsafe improvement visible but out of cross-unit ranking", () => {
    const runs = [
      run({ id: "r1", date: "2026-09-21" }),
      run({ id: "r2", date: "2026-10-19" }),
    ];
    const results = [
      scalarResult({
        id: "f1",
        runId: "r1",
        testId: "flex",
        name: "Toe-touch flexibility",
        value: -4,
        unit: "cm",
        allowNegative: true,
        percentageImprovement: "never",
      }),
      scalarResult({
        id: "f2",
        runId: "r2",
        testId: "flex",
        name: "Toe-touch flexibility",
        value: 2,
        unit: "cm",
        allowNegative: true,
        percentageImprovement: "never",
      }),
    ];
    const progress = buildAssessmentProgress({ runs, results });
    expect(progress.improvedTests).toHaveLength(1);
    expect(progress.biggestImprovements).toHaveLength(0);
    expect(progress.absoluteOnlyImprovements.map((item) => item.testName)).toEqual([
      "Toe-touch flexibility",
    ]);
  });
});

describe("compatibility and latest-run truth", () => {
  it("keeps a metric change visible but blocks improvement/decline classification", () => {
    const runs = [
      run({ id: "r1", date: "2026-09-21" }),
      run({ id: "r2", date: "2026-10-19" }),
    ];
    const results = [
      scalarResult({ id: "a", runId: "r1", testId: "sprint", name: "Sprint", value: 2.0, direction: "lower", unit: "s" }),
      scalarResult({ id: "b", runId: "r2", testId: "sprint", name: "Sprint", value: 1900, direction: "lower", unit: "ms" }),
    ];
    const progress = buildAssessmentProgress({ runs, results });
    expect(progress.unavailableTests).toHaveLength(1);
    expect(progress.unavailableTests[0].comparisonReason).toBe("metric_changed");
    expect(progress.improvedTests).toHaveLength(0);
    expect(progress.latestPbCount).toBe(0);
  });

  it("uses only valid results in the latest Assessment summary", () => {
    const runs = [
      run({ id: "r1", date: "2026-09-21" }),
      run({ id: "r2", date: "2026-10-19" }),
    ];
    const results = [
      scalarResult({ id: "a", runId: "r1", testId: "press", name: "Press-ups", value: 10 }),
      scalarResult({ id: "b", runId: "r2", testId: "press", name: "Press-ups", value: 12, valid: false }),
    ];
    const progress = buildAssessmentProgress({ runs, results });
    expect(progress.latestAssessment.runId).toBe("r2");
    expect(progress.latestAssessment.validResultCount).toBe(0);
    expect(progress.latestTestStatuses).toEqual([]);
    expect(progress.latestPbCount).toBe(0);
  });

  it("does not classify a Test absent from the latest completed Assessment", () => {
    const runs = [
      run({ id: "r1", date: "2026-09-21" }),
      run({ id: "r2", date: "2026-10-19" }),
    ];
    const results = [
      scalarResult({ id: "a", runId: "r1", testId: "press", name: "Press-ups", value: 10 }),
      scalarResult({ id: "b", runId: "r1", testId: "jump", name: "Broad jump", value: 180, unit: "cm" }),
      scalarResult({ id: "c", runId: "r2", testId: "press", name: "Press-ups", value: 12 }),
    ];
    const progress = buildAssessmentProgress({ runs, results });
    expect(progress.latestTestStatuses.map((item) => item.testName)).toEqual([
      "Press-ups",
    ]);
    expect(progress.testHistory).toHaveLength(2);
  });

  it("retains complete Test history for later charts while summarising only the latest run", () => {
    const runs = [
      run({ id: "r1", date: "2026-09-21" }),
      run({ id: "r2", date: "2026-10-19" }),
      run({ id: "r3", date: "2026-11-16" }),
    ];
    const results = [10, 12, 11].map((value, index) =>
      scalarResult({
        id: `p${index}`,
        runId: `r${index + 1}`,
        testId: "press",
        name: "Press-ups",
        value,
      })
    );
    const progress = buildAssessmentProgress({ runs, results });
    expect(progress.completedAssessmentCount).toBe(3);
    expect(progress.testHistory[0].count).toBe(3);
    expect(progress.latestAssessment.runId).toBe("r3");
    expect(progress.decliningTests).toHaveLength(1);
  });
});
