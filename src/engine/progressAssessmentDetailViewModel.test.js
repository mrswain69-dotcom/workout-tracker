import { describe, expect, it } from "vitest";
import {
  buildAssessmentDetailViewModel,
  buildAssessmentTestChartRows,
  buildDevelopmentDetailViewModel,
  developmentTrendGlyph,
  formatAssessmentChartDate,
} from "./progressAssessmentDetailViewModel.js";

function metric({ sideMode = "none", unit = "s", scoringDirection = "lower", metricType = "numeric", comparisonMode = "successes" } = {}) {
  return {
    metricType,
    unit,
    scoringDirection,
    sideMode,
    metricConfig: { comparisonMode },
  };
}

function entry({ dateYmd, metricKey = "m1", value = null, left = null, right = null, displayValue = "", sideMode = "none" }) {
  return {
    dateYmd,
    metricKey,
    metric: metric({ sideMode }),
    comparableValue: value,
    comparableDimensions: sideMode === "separate" ? { left, right } : {},
    displayValue: displayValue || (sideMode === "separate" ? `L ${left} · R ${right}` : String(value)),
    recordMarkers: { overall: false, left: false, right: false },
  };
}

function history({ testId = "test-1", testName = "10 m acceleration", entries = [], metricValue = metric(), metricChanged = false } = {}) {
  return {
    testId,
    testName,
    count: entries.length,
    entries,
    latest: entries.at(-1) || null,
    baseline: entries[0] || null,
    metric: metricValue,
    metricChanged,
  };
}

describe("Stage 6 Assessment detail view model", () => {
  it("formats compact benchmark chart dates", () => {
    expect(formatAssessmentChartDate("2026-09-21")).toBe("21 Sept");
    expect(formatAssessmentChartDate("bad")).toBe("");
  });

  it("keeps a one-point Test as baseline-only rather than manufacturing a chart trend", () => {
    const rows = buildAssessmentTestChartRows({
      testHistory: [history({ entries: [entry({ dateYmd: "2026-09-21", value: 2.1 })] })],
      latestTestStatuses: [],
      latestPbEvents: [],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      status: "baseline",
      statusLabel: "Baseline",
      compatibleHistoryCount: 1,
      hasChart: false,
      latestPbCount: 0,
    });
  });

  it("charts only the latest contiguous metric cohort after a metric change", () => {
    const rows = buildAssessmentTestChartRows({
      testHistory: [
        history({
          metricChanged: true,
          entries: [
            entry({ dateYmd: "2026-07-01", metricKey: "old", value: 2.3 }),
            entry({ dateYmd: "2026-08-01", metricKey: "new", value: 2.2 }),
            entry({ dateYmd: "2026-09-01", metricKey: "new", value: 2.1 }),
          ],
        }),
      ],
      latestTestStatuses: [
        { testId: "test-1", status: "improved", comparisonAvailable: true, dimensions: [] },
      ],
    });

    expect(rows[0].points.map((point) => point.dateYmd)).toEqual([
      "2026-08-01",
      "2026-09-01",
    ]);
    expect(rows[0].hiddenPriorMetricCount).toBe(1);
    expect(rows[0].hasChart).toBe(true);
  });

  it("preserves separate left/right chart dimensions and mixed comparison semantics", () => {
    const sideMetric = metric({ sideMode: "separate", unit: "reps", scoringDirection: "higher" });
    const rows = buildAssessmentTestChartRows({
      testHistory: [
        history({
          testId: "bilateral",
          testName: "Single-leg calf raises",
          metricValue: sideMetric,
          entries: [
            entry({ dateYmd: "2026-08-01", sideMode: "separate", left: 20, right: 20 }),
            entry({ dateYmd: "2026-09-01", sideMode: "separate", left: 22, right: 18 }),
          ],
        }),
      ],
      latestTestStatuses: [
        {
          testId: "bilateral",
          status: "mixed",
          comparisonAvailable: true,
          dimensions: [
            { dimension: "left", status: "improved", percentageImprovement: 10 },
            { dimension: "right", status: "declined", percentageImprovement: -10 },
          ],
        },
      ],
    });

    expect(rows[0].sideMode).toBe("separate");
    expect(rows[0].points.at(-1)).toMatchObject({ left: 22, right: 18 });
    expect(rows[0].status).toBe("mixed");
    expect(rows[0].comparisonDimensions.map((row) => row.status)).toEqual([
      "improved",
      "declined",
    ]);
  });

  it("keeps percentage-safe and absolute-only improvements in separate presentation buckets", () => {
    const safe = { testId: "a", testName: "Broad jump", percentageRank: 8.4, latest: { displayValue: "180 cm" } };
    const unsafe = { testId: "b", testName: "Toe touch", percentageRank: null, latest: { displayValue: "+2 cm" } };
    const model = buildAssessmentDetailViewModel({
      completedAssessmentCount: 2,
      latestPbCount: 2,
      latestPbTestCount: 2,
      improvedTests: [safe, unsafe],
      decliningTests: [],
      unchangedTests: [],
      mixedTests: [],
      unavailableTests: [],
      biggestImprovements: [safe],
      absoluteOnlyImprovements: [unsafe],
      testHistory: [],
    });

    expect(model.hasComparison).toBe(true);
    expect(model.biggestImprovements[0].percentage).toBe(8.4);
    expect(model.absoluteOnlyImprovements[0].percentage).toBeNull();
  });
});

describe("Stage 6 Development detail view model", () => {
  it("maps strong directional states to double-arrow glyphs without changing the underlying state", () => {
    expect(developmentTrendGlyph("improving", "strong")).toBe("↑↑");
    expect(developmentTrendGlyph("declining", "strong")).toBe("↓↓");
    expect(developmentTrendGlyph("mixed", null)).toBe("↕");
    expect(developmentTrendGlyph("unchanged", null)).toBe("→");
  });

  it("preserves percentage-safety boundaries at both Tag and linked-Test level", () => {
    const model = buildDevelopmentDetailViewModel({
      completedAssessmentCount: 3,
      counts: { improving: 1 },
      trends: [
        {
          developmentTagId: "strength",
          name: "Strength",
          state: "improving",
          strength: "strong",
          linkedTestCount: 2,
          observedTestCount: 2,
          comparisonReadyTestCount: 2,
          percentageSafe: false,
          normalizedPercentageImprovement: null,
          latestDateYmd: "2026-09-21",
          testTrends: [
            {
              testId: "pressups",
              testName: "Strict press-ups",
              state: "improving",
              strength: "strong",
              historyCount: 3,
              compatibleHistoryCount: 3,
              recentComparisonCount: 2,
              percentageSafe: true,
              normalizedPercentageImprovement: 7.5,
              latestDateYmd: "2026-09-21",
            },
            {
              testId: "toe-touch",
              testName: "Toe-touch flexibility",
              state: "improving",
              strength: "normal",
              historyCount: 3,
              compatibleHistoryCount: 3,
              recentComparisonCount: 2,
              percentageSafe: false,
              normalizedPercentageImprovement: null,
              latestDateYmd: "2026-09-21",
            },
          ],
        },
      ],
    });

    expect(model.rows[0]).toMatchObject({
      state: "improving",
      glyph: "↑↑",
      percentageSafe: false,
      normalizedPercentageImprovement: null,
      comparisonReadyTestCount: 2,
    });
    expect(model.rows[0].tests[0].normalizedPercentageImprovement).toBe(7.5);
    expect(model.rows[0].tests[1].percentageSafe).toBe(false);
  });
});
