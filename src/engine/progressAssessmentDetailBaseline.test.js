import { describe, expect, it } from "vitest";
import { buildAssessmentTestChartRows } from "./progressAssessmentDetailViewModel.js";

function metricKey(unit) {
  return JSON.stringify({ unit });
}

function entry(dateYmd, value, key) {
  return {
    dateYmd,
    metricKey: key,
    metric: {
      metricType: "numeric",
      unit: "s",
      scoringDirection: "lower",
      sideMode: "none",
      metricConfig: { comparisonMode: "successes" },
    },
    comparableValue: value,
    comparableDimensions: {},
    displayValue: `${value} s`,
    recordMarkers: { overall: false, left: false, right: false },
  };
}

describe("Stage 6 baseline presentation semantics", () => {
  it("shows the first genuine Assessment result as Baseline even when the comparison engine reports unavailable", () => {
    const only = entry("2026-09-21", 2.1, metricKey("s"));
    const rows = buildAssessmentTestChartRows({
      testHistory: [
        {
          testId: "sprint",
          testName: "10 m acceleration",
          count: 1,
          entries: [only],
          baseline: only,
          latest: only,
          metric: only.metric,
          metricChanged: false,
        },
      ],
      latestTestStatuses: [
        {
          testId: "sprint",
          status: "unavailable",
          comparisonAvailable: false,
          comparisonReason: "missing",
          dimensions: [],
        },
      ],
    });

    expect(rows[0]).toMatchObject({
      status: "baseline",
      statusLabel: "Baseline",
      comparisonAvailable: false,
      compatibleHistoryCount: 1,
      hasChart: false,
    });
  });

  it("resets the visible Test chart to Baseline when a metric change leaves one current-compatible point", () => {
    const oldEntry = entry("2026-08-01", 2.2, metricKey("old-s"));
    const currentEntry = entry("2026-09-01", 2.0, metricKey("new-s"));
    const rows = buildAssessmentTestChartRows({
      testHistory: [
        {
          testId: "sprint",
          testName: "10 m acceleration",
          count: 2,
          entries: [oldEntry, currentEntry],
          baseline: oldEntry,
          latest: currentEntry,
          metric: currentEntry.metric,
          metricChanged: true,
        },
      ],
      latestTestStatuses: [
        {
          testId: "sprint",
          status: "unavailable",
          comparisonAvailable: false,
          comparisonReason: "metric_changed",
          dimensions: [],
        },
      ],
    });

    expect(rows[0]).toMatchObject({
      status: "baseline",
      statusLabel: "Baseline",
      compatibleHistoryCount: 1,
      hiddenPriorMetricCount: 1,
      metricChanged: true,
      hasChart: false,
    });
  });
});
