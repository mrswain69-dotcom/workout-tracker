// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AssessmentAnalysisProgress from "./AssessmentAnalysisProgress.jsx";

function baseModel(overrides = {}) {
  return {
    state: "analysis_ready",
    ready: true,
    title: "Assessment Analysis",
    stateMessage: "",
    benchmark: {
      previousDateLabel: "1 Sep 2026",
      latestDateLabel: "1 Oct 2026",
      intervalDays: 29,
    },
    summaryCards: [
      { key: "pb", label: "New PBs", value: 1, tone: "prestige" },
      { key: "improved", label: "Improved", value: 1, tone: "positive" },
      { key: "declined", label: "Declined", value: 0, tone: "caution" },
      { key: "unchanged", label: "Unchanged", value: 0, tone: "neutral" },
      { key: "mixed", label: "Mixed", value: 0, tone: "mixed" },
      { key: "unavailable", label: "No comparison", value: 0, tone: "muted" },
    ],
    trainingCards: [
      { key: "sessions", label: "Completed Sessions", value: 5, note: "Between Assessments" },
      { key: "days", label: "Session Days", value: 4, note: "Completed structured Session days" },
      { key: "consistency", label: "Observed Consistency", value: "75%", note: "3 of 4 seven-day periods; not plan adherence" },
    ],
    evidenceCounts: { high: 1, medium: 0, low: 0, none: 0 },
    taxonomyFallbackUsed: false,
    sessionRows: [
      { templateId: "a", displayCode: "A", name: "Close Control", completedCount: 4, underrepresented: false },
      { templateId: "b", displayCode: "B", name: "Receiving", completedCount: 1, underrepresented: true },
    ],
    possibleNextFocus: {
      available: true,
      templateId: "b",
      displayCode: "B",
      name: "Receiving",
      reason: "Session B · Receiving was completed less often than at least one other related active Session between benchmarks.",
      basis: "session_balance_only",
    },
    tests: [
      {
        testId: "receive",
        testName: "Outside-foot receive",
        statusLabel: "Improved",
        statusTone: "positive",
        evidenceLabel: "High detail",
        evidenceTone: "positive",
        previousValue: "5 reps",
        latestValue: "8 reps",
        baselineValue: "5 reps",
        latestPbCount: 1,
        percentageImprovementLabel: "+60%",
        completedRelevantSessions: 3,
        partialRelevantSessions: 0,
        volumeFacts: ["186 recorded executions"],
        narrative: "Outside-foot receive improved from 5 reps to 8 reps between the two compatible benchmarks. 3 completed related Sessions were recorded between benchmarks, including 186 recorded executions.",
        metricChanged: false,
        taxonomyNote: "",
      },
    ],
    overallNarrative: "Latest Test outcomes: 1 improved. 1 new PB was recorded in the latest Assessment. 5 completed structured Sessions were recorded across the 29-day between-Assessment interval.",
    causationBoundary: "Analysis describes recorded training alongside benchmark change; it does not establish that training caused the result.",
    consistencyBoundary: "Observed consistency measures recorded structured-training rhythm across seven-day periods; it is not a formal plan-adherence score.",
    ...overrides,
  };
}

afterEach(() => cleanup());

describe("Phase 4 Stage 5 AssessmentAnalysisProgress", () => {
  it("renders a deliberate zero-Assessment state and Assess action", () => {
    const onOpenAssessments = vi.fn();
    render(
      <AssessmentAnalysisProgress
        model={baseModel({
          state: "no_baseline",
          ready: false,
          title: "Build your Assessment baseline",
          stateMessage: "Complete an Assessment to establish a benchmark before between-benchmark Analysis is available.",
          summaryCards: [],
          trainingCards: [],
          sessionRows: [],
          tests: [],
        })}
        onOpenAssessments={onOpenAssessments}
      />
    );

    expect(screen.getByText("0 BENCHMARKS")).toBeTruthy();
    expect(screen.getByText("Build your Assessment baseline")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open Assess" }));
    expect(onOpenAssessments).toHaveBeenCalledTimes(1);
  });

  it("renders the baseline-only state without fake comparison metrics", () => {
    render(
      <AssessmentAnalysisProgress
        model={baseModel({
          state: "baseline_only",
          ready: false,
          title: "Baseline established",
          stateMessage: "Complete the same Assessment Template again to unlock between-benchmark training Analysis.",
          benchmark: { latestDateLabel: "1 Sep 2026", intervalDays: 0 },
          summaryCards: [],
          trainingCards: [],
          sessionRows: [],
          tests: [],
        })}
      />
    );

    expect(screen.getByText("1 BENCHMARK")).toBeTruthy();
    expect(screen.getByText("Baseline completed 1 Sep 2026")).toBeTruthy();
    expect(screen.queryByText("Observed Consistency")).toBeNull();
    expect(screen.queryByText("New PBs")).toBeNull();
  });

  it("renders ready Analysis with summary, rhythm, Session balance and expandable Test evidence", () => {
    render(<AssessmentAnalysisProgress model={baseModel()} />);

    expect(screen.getByLabelText("Assessment comparison period")).toBeTruthy();
    expect(screen.getByText("1 Sep 2026")).toBeTruthy();
    expect(screen.getByText("1 Oct 2026")).toBeTruthy();
    expect(screen.getByText("Observed Consistency")).toBeTruthy();
    expect(screen.getByText("75%")).toBeTruthy();
    expect(screen.getByText("Session B · Receiving")).toBeTruthy();
    expect(screen.getByText("Based on recorded Session balance only — not an automatic load prescription.")).toBeTruthy();
    expect(screen.getAllByText("High detail")).toHaveLength(2);
    expect(screen.getByText("Outside-foot receive")).toBeTruthy();

    fireEvent.click(screen.getByText("Outside-foot receive"));
    expect(screen.getByText(/186 recorded executions/)).toBeTruthy();
    expect(screen.getByText(/does not establish that training caused the result/)).toBeTruthy();
  });

  it("shows no automatic focus when the model says the recorded evidence is balanced", () => {
    render(
      <AssessmentAnalysisProgress
        model={baseModel({
          sessionRows: [
            { templateId: "a", displayCode: "A", name: "Close Control", completedCount: 2, underrepresented: false },
            { templateId: "b", displayCode: "B", name: "Receiving", completedCount: 2, underrepresented: false },
          ],
          possibleNextFocus: { available: false, templateId: "", displayCode: "", name: "", reason: "", basis: "session_balance_only" },
        })}
      />
    );

    expect(screen.getByText("No automatic focus suggested")).toBeTruthy();
    expect(screen.queryByText("POSSIBLE NEXT FOCUS")).toBeNull();
  });

  it("surfaces taxonomy fallback provenance without changing the Test result", () => {
    render(<AssessmentAnalysisProgress model={baseModel({ taxonomyFallbackUsed: true })} />);
    expect(screen.getByText(/current Development Tag taxonomy/)).toBeTruthy();
    expect(screen.getAllByText("Improved")).toHaveLength(2);
  });
});
