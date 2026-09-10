// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import AssessmentAnalysisProgress from "./AssessmentAnalysisProgress.jsx";

function testRow(index) {
  return {
    testId: `test-${index}`,
    testName: `Long-form performance benchmark ${index} with a deliberately descriptive Test name`,
    status: "improved",
    statusLabel: "Improved",
    statusTone: "positive",
    evidenceLevel: "high",
    evidenceLabel: "High detail",
    evidenceTone: "positive",
    latestValue: `${index + 10} reps`,
    previousValue: `${index + 8} reps`,
    baselineValue: `${index + 8} reps`,
    latestPbCount: index % 3 === 0 ? 1 : 0,
    percentageImprovementLabel: "+10%",
    completedRelevantSessions: 3,
    partialRelevantSessions: 0,
    volumeFacts: [`${100 + index} recorded executions`],
    narrative: `Test ${index} improved between compatible benchmarks. Recorded related training is described alongside the result without assigning causation.`,
    metricChanged: false,
    taxonomyNote: "",
  };
}

function model() {
  return {
    state: "analysis_ready",
    ready: true,
    title: "Assessment Analysis",
    stateMessage: "",
    benchmark: {
      previousDateLabel: "1 Aug 2026",
      latestDateLabel: "1 Sep 2026",
      intervalDays: 30,
    },
    summaryCards: [
      { key: "pb", label: "New PBs", value: 8, tone: "prestige" },
      { key: "improved", label: "Improved", value: 24, tone: "positive" },
      { key: "declined", label: "Declined", value: 0, tone: "caution" },
      { key: "unchanged", label: "Unchanged", value: 0, tone: "neutral" },
      { key: "mixed", label: "Mixed", value: 0, tone: "mixed" },
      { key: "unavailable", label: "No comparison", value: 0, tone: "muted" },
    ],
    trainingCards: [
      { key: "sessions", label: "Completed Sessions", value: 10, note: "Between Assessments" },
      { key: "days", label: "Session Days", value: 8, note: "Completed structured Session days" },
      { key: "consistency", label: "Observed Consistency", value: "75%", note: "3 of 4 seven-day periods; not plan adherence" },
    ],
    evidenceCounts: { high: 24, medium: 0, low: 0, none: 0 },
    taxonomyFallbackUsed: false,
    sessionRows: [],
    possibleNextFocus: { available: false, templateId: "", displayCode: "", name: "", reason: "", basis: "session_balance_only" },
    tests: Array.from({ length: 24 }, (_, index) => testRow(index + 1)),
    overallNarrative: "Latest benchmark results and recorded training are summarised without causal claims.",
    causationBoundary: "Analysis describes recorded training alongside benchmark change; it does not establish that training caused the result.",
    consistencyBoundary: "Observed consistency measures recorded structured-training rhythm across seven-day periods; it is not a formal plan-adherence score.",
  };
}

afterEach(() => cleanup());

describe("Phase 4 Stage 6 Analysis information density", () => {
  it("keeps a large Test set collapsed by default and expands only the requested Test", () => {
    const { container } = render(<AssessmentAnalysisProgress model={model()} />);
    const details = Array.from(container.querySelectorAll("details.analysis-test"));

    expect(details).toHaveLength(24);
    expect(details.every((row) => row.open === false)).toBe(true);

    fireEvent.click(details[7].querySelector("summary"));

    expect(details[7].open).toBe(true);
    expect(details.filter((row) => row.open)).toHaveLength(1);
  });
});
