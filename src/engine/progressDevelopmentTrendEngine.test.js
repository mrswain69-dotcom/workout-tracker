import { describe, expect, it } from "vitest";
import {
  buildDevelopmentTestTrend,
  buildDevelopmentTrends,
  buildDevelopmentTrendsFromAssessmentProgress,
} from "./progressDevelopmentTrendEngine.js";
import { buildAssessmentProgress } from "./progressAssessmentEngine.js";

function run({
  id,
  date,
  profileId = "wilf",
  templateId = "benchmark",
  status = "completed",
}) {
  return {
    id,
    family_id: "family-1",
    profile_id: profileId,
    assessment_template_id: templateId,
    date_ymd: date,
    status,
    completed_at: status === "completed" ? `${date}T18:00:00Z` : null,
    template_version: 1,
    template_snapshot: { template: { name: "Football Monthly Benchmark" } },
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
}) {
  return {
    id,
    family_id: "family-1",
    assessment_run_id: runId,
    test_id: testId,
    position: 1,
    test_name_snapshot: name,
    metric_snapshot: {
      metricType: "numeric",
      unit,
      scoringDirection: direction,
      attemptCount: 1,
      resultStrategy: "single",
      sideMode: "none",
      allowNegative,
      pbEligible: true,
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
    is_valid: true,
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
}) {
  return {
    id,
    family_id: "family-1",
    assessment_run_id: runId,
    test_id: testId,
    position: 1,
    test_name_snapshot: name,
    metric_snapshot: {
      metricType: "numeric",
      unit,
      scoringDirection: direction,
      attemptCount: 1,
      resultStrategy: "single",
      sideMode: "separate",
      allowNegative: false,
      pbEligible: true,
      metricConfig: { decimalPlaces: 1, percentageDecimalPlaces: 1 },
    },
    retained_result: { left, right },
    comparable_value: null,
    comparable_dimensions: { left, right },
    is_valid: true,
  };
}

const tags = [
  { id: "acceleration", name: "Acceleration", slug: "acceleration" },
  { id: "first-touch", name: "First Touch", slug: "first-touch" },
  { id: "mobility", name: "Mobility", slug: "mobility" },
  { id: "strength", name: "Strength", slug: "strength" },
];

function link(testId, developmentTagId) {
  return {
    family_id: "family-1",
    test_id: testId,
    development_tag_id: developmentTagId,
  };
}

function trendByName(output, name) {
  return output.trends.find((trend) => trend.name === name);
}

describe("Phase 3 Development Trends early-data states", () => {
  it("returns mapped tags as no-baseline rather than inventing trend data", () => {
    const output = buildDevelopmentTrends({
      profileId: "wilf",
      developmentTags: tags,
      testDevelopmentTags: [
        link("sprint", "acceleration"),
        link("press", "strength"),
      ],
    });

    expect(output.completedAssessmentCount).toBe(0);
    expect(output.trendCount).toBe(2);
    expect(trendByName(output, "Acceleration").state).toBe("no_baseline");
    expect(trendByName(output, "Strength").state).toBe("no_baseline");
    expect(output.counts.no_baseline).toBe(2);
  });

  it("treats one compatible Test result as baseline set", () => {
    const runs = [run({ id: "r1", date: "2026-09-21" })];
    const results = [
      scalarResult({
        id: "s1",
        runId: "r1",
        testId: "sprint",
        name: "10 m acceleration",
        value: 2.1,
        direction: "lower",
        unit: "s",
      }),
    ];

    const output = buildDevelopmentTrends({
      runs,
      results,
      developmentTags: tags,
      testDevelopmentTags: [link("sprint", "acceleration")],
    });
    const trend = trendByName(output, "Acceleration");

    expect(trend.state).toBe("baseline_set");
    expect(trend.observedTestCount).toBe(1);
    expect(trend.comparisonReadyTestCount).toBe(0);
    expect(trend.trendScore).toBeNull();
  });
});

describe("per-Test Development Trend direction", () => {
  it("uses the metric engine direction for higher-is-better Tests", () => {
    const runs = [
      run({ id: "r1", date: "2026-09-21" }),
      run({ id: "r2", date: "2026-10-19" }),
    ];
    const results = [
      scalarResult({ id: "p1", runId: "r1", testId: "press", name: "Press-ups", value: 10 }),
      scalarResult({ id: "p2", runId: "r2", testId: "press", name: "Press-ups", value: 12 }),
    ];

    const output = buildDevelopmentTrends({
      runs,
      results,
      developmentTags: tags,
      testDevelopmentTags: [link("press", "strength")],
    });
    const trend = trendByName(output, "Strength");

    expect(trend.state).toBe("improving");
    expect(trend.trendScore).toBe(1);
    expect(trend.normalizedPercentageImprovement).toBe(20);
    expect(trend.strength).toBe("normal");
  });

  it("uses lower-is-better semantics without treating a falling number as decline", () => {
    const runs = [
      run({ id: "r1", date: "2026-09-21" }),
      run({ id: "r2", date: "2026-10-19" }),
    ];
    const results = [
      scalarResult({ id: "s1", runId: "r1", testId: "sprint", name: "10 m acceleration", value: 2.0, direction: "lower", unit: "s" }),
      scalarResult({ id: "s2", runId: "r2", testId: "sprint", name: "10 m acceleration", value: 1.8, direction: "lower", unit: "s" }),
    ];

    const output = buildDevelopmentTrends({
      runs,
      results,
      developmentTags: tags,
      testDevelopmentTags: [link("sprint", "acceleration")],
    });

    expect(trendByName(output, "Acceleration").state).toBe("improving");
    expect(trendByName(output, "Acceleration").normalizedPercentageImprovement).toBe(10);
  });

  it("classifies an equal result as unchanged rather than missing", () => {
    const runs = [
      run({ id: "r1", date: "2026-09-21" }),
      run({ id: "r2", date: "2026-10-19" }),
    ];
    const results = [
      scalarResult({ id: "p1", runId: "r1", testId: "press", name: "Press-ups", value: 12 }),
      scalarResult({ id: "p2", runId: "r2", testId: "press", name: "Press-ups", value: 12 }),
    ];

    const output = buildDevelopmentTrends({
      runs,
      results,
      developmentTags: tags,
      testDevelopmentTags: [link("press", "strength")],
    });

    expect(trendByName(output, "Strength").state).toBe("unchanged");
    expect(trendByName(output, "Strength").trendScore).toBe(0);
    expect(trendByName(output, "Strength").normalizedPercentageImprovement).toBe(0);
  });

  it("normalises bilateral sides inside one Test instead of counting them as two Tests", () => {
    const runs = [
      run({ id: "r1", date: "2026-09-21" }),
      run({ id: "r2", date: "2026-10-19" }),
    ];
    const results = [
      sideResult({ id: "c1", runId: "r1", testId: "calf", name: "Calf raises", left: 20, right: 20 }),
      sideResult({ id: "c2", runId: "r2", testId: "calf", name: "Calf raises", left: 22, right: 18 }),
    ];

    const output = buildDevelopmentTrends({
      runs,
      results,
      developmentTags: tags,
      testDevelopmentTags: [link("calf", "strength")],
    });
    const trend = trendByName(output, "Strength");

    expect(trend.linkedTestCount).toBe(1);
    expect(trend.comparisonReadyTestCount).toBe(1);
    expect(trend.state).toBe("mixed");
    expect(trend.trendScore).toBe(0);
    expect(trend.testTrends[0].latestComparison.dimensions).toHaveLength(2);
  });
});

describe("three-plus point recent trend logic", () => {
  it("marks two consecutive recent improvements as a strong trend", () => {
    const runs = [
      run({ id: "r1", date: "2026-09-21" }),
      run({ id: "r2", date: "2026-10-19" }),
      run({ id: "r3", date: "2026-11-16" }),
    ];
    const results = [
      scalarResult({ id: "p1", runId: "r1", testId: "press", name: "Press-ups", value: 10 }),
      scalarResult({ id: "p2", runId: "r2", testId: "press", name: "Press-ups", value: 12 }),
      scalarResult({ id: "p3", runId: "r3", testId: "press", name: "Press-ups", value: 15 }),
    ];

    const output = buildDevelopmentTrends({
      runs,
      results,
      developmentTags: tags,
      testDevelopmentTags: [link("press", "strength")],
    });
    const trend = trendByName(output, "Strength");

    expect(trend.state).toBe("improving");
    expect(trend.strength).toBe("strong");
    expect(trend.testTrends[0].recentComparisonCount).toBe(2);
    expect(trend.testTrends[0].strength).toBe("strong");
  });

  it("uses only the latest three compatible points so old history does not dominate", () => {
    const runs = [
      run({ id: "r1", date: "2026-08-24" }),
      run({ id: "r2", date: "2026-09-21" }),
      run({ id: "r3", date: "2026-10-19" }),
      run({ id: "r4", date: "2026-11-16" }),
    ];
    const results = [
      scalarResult({ id: "p1", runId: "r1", testId: "press", name: "Press-ups", value: 20 }),
      scalarResult({ id: "p2", runId: "r2", testId: "press", name: "Press-ups", value: 10 }),
      scalarResult({ id: "p3", runId: "r3", testId: "press", name: "Press-ups", value: 11 }),
      scalarResult({ id: "p4", runId: "r4", testId: "press", name: "Press-ups", value: 12 }),
    ];

    const output = buildDevelopmentTrends({
      runs,
      results,
      developmentTags: tags,
      testDevelopmentTags: [link("press", "strength")],
    });
    const testTrend = trendByName(output, "Strength").testTrends[0];

    expect(testTrend.historyCount).toBe(4);
    expect(testTrend.recentComparisonCount).toBe(2);
    expect(testTrend.state).toBe("improving");
    expect(testTrend.strength).toBe("strong");
  });

  it("returns mixed when recent directional evidence cancels rather than forcing an arrow", () => {
    const runs = [
      run({ id: "r1", date: "2026-09-21" }),
      run({ id: "r2", date: "2026-10-19" }),
      run({ id: "r3", date: "2026-11-16" }),
    ];
    const results = [
      scalarResult({ id: "p1", runId: "r1", testId: "press", name: "Press-ups", value: 10 }),
      scalarResult({ id: "p2", runId: "r2", testId: "press", name: "Press-ups", value: 12 }),
      scalarResult({ id: "p3", runId: "r3", testId: "press", name: "Press-ups", value: 10 }),
    ];

    const output = buildDevelopmentTrends({
      runs,
      results,
      developmentTags: tags,
      testDevelopmentTags: [link("press", "strength")],
    });

    expect(trendByName(output, "Strength").state).toBe("mixed");
    expect(trendByName(output, "Strength").trendScore).toBe(0);
  });
});

describe("multi-Test tag aggregation without raw-unit averaging", () => {
  it("gives canonical Tests equal directional weight even when raw magnitudes differ", () => {
    const runs = [
      run({ id: "r1", date: "2026-09-21" }),
      run({ id: "r2", date: "2026-10-19" }),
    ];
    const results = [
      scalarResult({ id: "p1", runId: "r1", testId: "press", name: "Press-ups", value: 10 }),
      scalarResult({ id: "p2", runId: "r2", testId: "press", name: "Press-ups", value: 20 }),
      scalarResult({ id: "j1", runId: "r1", testId: "jump", name: "Broad jump", value: 200, unit: "cm" }),
      scalarResult({ id: "j2", runId: "r2", testId: "jump", name: "Broad jump", value: 190, unit: "cm" }),
    ];

    const output = buildDevelopmentTrends({
      runs,
      results,
      developmentTags: tags,
      testDevelopmentTags: [
        link("press", "strength"),
        link("jump", "strength"),
      ],
    });
    const trend = trendByName(output, "Strength");

    expect(trend.state).toBe("mixed");
    expect(trend.trendScore).toBe(0);
    expect(trend.comparisonReadyTestCount).toBe(2);
  });

  it("may average safe normalized percentages across unlike units, never raw values", () => {
    const runs = [
      run({ id: "r1", date: "2026-09-21" }),
      run({ id: "r2", date: "2026-10-19" }),
    ];
    const results = [
      scalarResult({ id: "p1", runId: "r1", testId: "press", name: "Press-ups", value: 10 }),
      scalarResult({ id: "p2", runId: "r2", testId: "press", name: "Press-ups", value: 12 }),
      scalarResult({ id: "s1", runId: "r1", testId: "sprint", name: "Sprint", value: 2.0, direction: "lower", unit: "s" }),
      scalarResult({ id: "s2", runId: "r2", testId: "sprint", name: "Sprint", value: 1.8, direction: "lower", unit: "s" }),
    ];

    const customTags = [{ id: "performance", name: "Performance" }];
    const output = buildDevelopmentTrends({
      runs,
      results,
      developmentTags: customTags,
      testDevelopmentTags: [
        link("press", "performance"),
        link("sprint", "performance"),
      ],
    });
    const trend = trendByName(output, "Performance");

    expect(trend.state).toBe("improving");
    expect(trend.strength).toBe("strong");
    expect(trend.percentageSafe).toBe(true);
    expect(trend.normalizedPercentageImprovement).toBe(15);
  });

  it("does not publish a tag percentage when one contributing Test is percentage-unsafe", () => {
    const runs = [
      run({ id: "r1", date: "2026-09-21" }),
      run({ id: "r2", date: "2026-10-19" }),
    ];
    const results = [
      scalarResult({ id: "p1", runId: "r1", testId: "press", name: "Press-ups", value: 10 }),
      scalarResult({ id: "p2", runId: "r2", testId: "press", name: "Press-ups", value: 12 }),
      scalarResult({ id: "f1", runId: "r1", testId: "flex", name: "Toe-touch flexibility", value: -4, unit: "cm", allowNegative: true, percentageImprovement: "never" }),
      scalarResult({ id: "f2", runId: "r2", testId: "flex", name: "Toe-touch flexibility", value: 2, unit: "cm", allowNegative: true, percentageImprovement: "never" }),
    ];

    const customTags = [{ id: "physical", name: "Physical" }];
    const output = buildDevelopmentTrends({
      runs,
      results,
      developmentTags: customTags,
      testDevelopmentTags: [
        link("press", "physical"),
        link("flex", "physical"),
      ],
    });
    const trend = trendByName(output, "Physical");

    expect(trend.state).toBe("improving");
    expect(trend.percentageSafe).toBe(false);
    expect(trend.normalizedPercentageImprovement).toBeNull();
  });
});

describe("compatibility and scoping guards", () => {
  it("resets the current Test trend to baseline after a metric change", () => {
    const runs = [
      run({ id: "r1", date: "2026-09-21" }),
      run({ id: "r2", date: "2026-10-19" }),
      run({ id: "r3", date: "2026-11-16" }),
    ];
    const results = [
      scalarResult({ id: "p1", runId: "r1", testId: "press", name: "Press-ups", value: 10, unit: "reps" }),
      scalarResult({ id: "p2", runId: "r2", testId: "press", name: "Press-ups", value: 12, unit: "reps" }),
      scalarResult({ id: "p3", runId: "r3", testId: "press", name: "Press-ups", value: 20, unit: "kg" }),
    ];

    const output = buildDevelopmentTrends({
      runs,
      results,
      developmentTags: tags,
      testDevelopmentTags: [link("press", "strength")],
    });
    const testTrend = trendByName(output, "Strength").testTrends[0];

    expect(testTrend.historyCount).toBe(3);
    expect(testTrend.compatibleHistoryCount).toBe(1);
    expect(testTrend.state).toBe("baseline_set");
    expect(trendByName(output, "Strength").state).toBe("baseline_set");
  });

  it("keeps another athlete's results out of the selected profile trend", () => {
    const runs = [
      run({ id: "w1", date: "2026-09-21", profileId: "wilf" }),
      run({ id: "w2", date: "2026-10-19", profileId: "wilf" }),
      run({ id: "x1", date: "2026-09-21", profileId: "xander" }),
      run({ id: "x2", date: "2026-10-19", profileId: "xander" }),
    ];
    const results = [
      scalarResult({ id: "w1r", runId: "w1", testId: "press", name: "Press-ups", value: 10 }),
      scalarResult({ id: "w2r", runId: "w2", testId: "press", name: "Press-ups", value: 12 }),
      scalarResult({ id: "x1r", runId: "x1", testId: "press", name: "Press-ups", value: 20 }),
      scalarResult({ id: "x2r", runId: "x2", testId: "press", name: "Press-ups", value: 15 }),
    ];

    const output = buildDevelopmentTrends({
      runs,
      results,
      profileId: "wilf",
      developmentTags: tags,
      testDevelopmentTags: [link("press", "strength")],
    });

    expect(trendByName(output, "Strength").state).toBe("improving");
    expect(trendByName(output, "Strength").testTrends[0].historyCount).toBe(2);
  });

  it("deduplicates repeated Test/Tag relationship rows", () => {
    const output = buildDevelopmentTrends({
      developmentTags: tags,
      testDevelopmentTags: [
        link("press", "strength"),
        link("press", "strength"),
      ],
    });

    expect(trendByName(output, "Strength").linkedTestCount).toBe(1);
  });

  it("ignores relationship rows whose Development Tag definition was not supplied", () => {
    const output = buildDevelopmentTrends({
      developmentTags: tags,
      testDevelopmentTags: [
        link("press", "strength"),
        link("mystery", "missing-tag"),
      ],
    });

    expect(output.trendCount).toBe(1);
    expect(output.trends[0].name).toBe("Strength");
  });

  it("can aggregate directly from an already-built Assessment Progress model", () => {
    const runs = [
      run({ id: "r1", date: "2026-09-21" }),
      run({ id: "r2", date: "2026-10-19" }),
    ];
    const results = [
      scalarResult({ id: "p1", runId: "r1", testId: "press", name: "Press-ups", value: 10 }),
      scalarResult({ id: "p2", runId: "r2", testId: "press", name: "Press-ups", value: 12 }),
    ];
    const assessmentProgress = buildAssessmentProgress({ runs, results });

    const output = buildDevelopmentTrendsFromAssessmentProgress({
      assessmentProgress,
      developmentTags: tags,
      testDevelopmentTags: [
        { testId: "press", developmentTagId: "strength" },
      ],
    });

    expect(output.completedAssessmentCount).toBe(2);
    expect(trendByName(output, "Strength").state).toBe("improving");
  });

  it("exposes the pure per-Test builder for later chart/view-model reuse", () => {
    const runs = [
      run({ id: "r1", date: "2026-09-21" }),
      run({ id: "r2", date: "2026-10-19" }),
    ];
    const results = [
      scalarResult({ id: "p1", runId: "r1", testId: "press", name: "Press-ups", value: 10 }),
      scalarResult({ id: "p2", runId: "r2", testId: "press", name: "Press-ups", value: 11 }),
    ];
    const progress = buildAssessmentProgress({ runs, results });
    const testTrend = buildDevelopmentTestTrend(progress.testHistory[0]);

    expect(testTrend.testId).toBe("press");
    expect(testTrend.state).toBe("improving");
    expect(testTrend.latestDateYmd).toBe("2026-10-19");
  });
});
