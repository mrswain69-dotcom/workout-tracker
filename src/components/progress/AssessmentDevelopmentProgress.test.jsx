// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  AssessmentProgressDetails,
  DevelopmentTrendDetails,
} from "./AssessmentDevelopmentProgress.jsx";

afterEach(() => cleanup());

function metric({ sideMode = "none", unit = "s", scoringDirection = "lower" } = {}) {
  return {
    metricType: "numeric",
    unit,
    scoringDirection,
    sideMode,
    metricConfig: { comparisonMode: "successes" },
  };
}

function historyEntry({ dateYmd, value = null, left = null, right = null, sideMode = "none", displayValue }) {
  return {
    dateYmd,
    metricKey: sideMode === "separate" ? "side-metric" : "scalar-metric",
    metric: metric({ sideMode, unit: sideMode === "separate" ? "reps" : "s", scoringDirection: sideMode === "separate" ? "higher" : "lower" }),
    comparableValue: value,
    comparableDimensions: sideMode === "separate" ? { left, right } : {},
    displayValue,
    sectionLabel: "Athletic",
    recordMarkers: { overall: false, left: false, right: false },
  };
}

function assessmentProgress() {
  const sprintEntries = [
    historyEntry({ dateYmd: "2026-08-01", value: 2.2, displayValue: "2.2 s" }),
    historyEntry({ dateYmd: "2026-09-01", value: 2.0, displayValue: "2.0 s" }),
  ];
  const calfEntries = [
    historyEntry({ dateYmd: "2026-08-01", sideMode: "separate", left: 20, right: 20, displayValue: "L 20 reps · R 20 reps" }),
    historyEntry({ dateYmd: "2026-09-01", sideMode: "separate", left: 22, right: 18, displayValue: "L 22 reps · R 18 reps" }),
  ];
  return {
    completedAssessmentCount: 2,
    latestPbCount: 1,
    latestPbTestCount: 1,
    improvedTests: [
      { testId: "sprint", testName: "10 m acceleration", percentageRank: 9.1, latest: sprintEntries[1] },
    ],
    decliningTests: [],
    unchangedTests: [],
    mixedTests: [{ testId: "calf" }],
    unavailableTests: [],
    biggestImprovements: [
      { testId: "sprint", testName: "10 m acceleration", percentageRank: 9.1, latest: sprintEntries[1] },
    ],
    absoluteOnlyImprovements: [],
    latestPbEvents: [{ testId: "sprint" }],
    latestTestStatuses: [
      {
        testId: "sprint",
        status: "improved",
        comparisonAvailable: true,
        dimensions: [
          { dimension: "overall", status: "improved", percentageImprovement: 9.1 },
        ],
      },
      {
        testId: "calf",
        status: "mixed",
        comparisonAvailable: true,
        dimensions: [
          { dimension: "left", status: "improved", percentageImprovement: 10 },
          { dimension: "right", status: "declined", percentageImprovement: -10 },
        ],
      },
    ],
    testHistory: [
      {
        testId: "sprint",
        testName: "10 m acceleration",
        count: 2,
        entries: sprintEntries,
        latest: sprintEntries[1],
        baseline: sprintEntries[0],
        metric: sprintEntries[1].metric,
        metricChanged: false,
      },
      {
        testId: "calf",
        testName: "Single-leg calf raises",
        count: 2,
        entries: calfEntries,
        latest: calfEntries[1],
        baseline: calfEntries[0],
        metric: calfEntries[1].metric,
        metricChanged: false,
      },
    ],
  };
}

function developmentTrends() {
  return {
    completedAssessmentCount: 3,
    counts: {
      no_baseline: 0,
      baseline_set: 0,
      improving: 1,
      declining: 0,
      unchanged: 0,
      mixed: 1,
    },
    trends: [
      {
        developmentTagId: "acceleration",
        name: "Acceleration",
        state: "improving",
        strength: "strong",
        linkedTestCount: 1,
        observedTestCount: 1,
        comparisonReadyTestCount: 1,
        percentageSafe: true,
        normalizedPercentageImprovement: 6.4,
        latestDateYmd: "2026-09-01",
        testTrends: [
          {
            testId: "sprint",
            testName: "10 m acceleration",
            state: "improving",
            strength: "strong",
            historyCount: 3,
            compatibleHistoryCount: 3,
            recentComparisonCount: 2,
            percentageSafe: true,
            normalizedPercentageImprovement: 6.4,
            latestDateYmd: "2026-09-01",
          },
        ],
      },
      {
        developmentTagId: "mobility",
        name: "Mobility",
        state: "mixed",
        strength: null,
        linkedTestCount: 1,
        observedTestCount: 1,
        comparisonReadyTestCount: 1,
        percentageSafe: false,
        normalizedPercentageImprovement: null,
        latestDateYmd: "2026-09-01",
        testTrends: [
          {
            testId: "toe-touch",
            testName: "Toe-touch flexibility",
            state: "mixed",
            strength: null,
            historyCount: 3,
            compatibleHistoryCount: 3,
            recentComparisonCount: 2,
            percentageSafe: false,
            normalizedPercentageImprovement: null,
            latestDateYmd: "2026-09-01",
          },
        ],
      },
    ],
  };
}

describe("Stage 6 AssessmentProgressDetails", () => {
  it("renders genuine per-Test charts, PB summary and mixed bilateral semantics", () => {
    render(<AssessmentProgressDetails assessmentProgress={assessmentProgress()} />);

    expect(screen.getByLabelText("Latest benchmark Test status summary")).toBeTruthy();
    expect(screen.getByText("Largest percentage-safe improvements")).toBeTruthy();
    expect(screen.getByText("+9.1%")).toBeTruthy();
    expect(screen.getByLabelText("10 m acceleration Assessment history chart")).toBeTruthy();
    expect(screen.getByLabelText("Single-leg calf raises Assessment history chart")).toBeTruthy();
    expect(screen.getByText("Left: Improved · +10%")).toBeTruthy();
    expect(screen.getByText("Right: Declined · -10%")).toBeTruthy();
    expect(screen.getByText(/Different units are never plotted on the same performance axis/)).toBeTruthy();
  });
});

describe("Stage 6 DevelopmentTrendDetails", () => {
  it("renders detailed Tag and linked-Test trends while preserving percentage-safety and Phase 4 boundary", () => {
    render(<DevelopmentTrendDetails developmentTrends={developmentTrends()} />);

    expect(screen.getByLabelText("Detailed Development trends")).toBeTruthy();
    expect(screen.getByText("Acceleration")).toBeTruthy();
    expect(screen.getByText("+6.4% normalized recent change")).toBeTruthy();
    expect(screen.getByText("Sustained/aligned recent signal across compatible benchmark evidence.")).toBeTruthy();
    expect(screen.getByText("Mobility")).toBeTruthy();
    expect(screen.getByText("Direction is valid, but no combined percentage is shown because not every contributing Test is percentage-safe.")).toBeTruthy();
    expect(screen.getByText(/do not claim that a particular training Session caused a Test result/)).toBeTruthy();
  });
});
