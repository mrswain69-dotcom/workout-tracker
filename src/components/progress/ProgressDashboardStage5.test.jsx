// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ProgressDashboard from "./ProgressDashboard.jsx";

function dbApi() {
  return {
    loadSessionLibrary: vi.fn(async () => ({
      data: {
        templates: [
          { id: "a", display_code: "A", name: "Close Control", sort_order: 1, archived: false },
          { id: "b", display_code: "B", name: "First Touch", sort_order: 2, archived: false },
          { id: "c", display_code: "C", name: "Weak Foot", sort_order: 3, archived: false },
        ],
      },
      error: null,
    })),
    loadAssessmentLibrary: vi.fn(async () => ({
      data: { developmentTags: [], testDevelopmentTags: [] },
      error: null,
    })),
    loadCompletedAssessmentHistory: vi.fn(async () => ({
      data: { runs: [], results: [] },
      error: null,
    })),
    listAssessmentRuns: vi.fn(async () => ({ data: [], error: null })),
    listAssessmentSchedules: vi.fn(async () => ({ data: [], error: null })),
  };
}

function structuredLog() {
  return {
    id: "log-stage5",
    profile_id: "profile-wilf",
    date_ymd: "2026-09-08",
    log_json: {
      date_ymd: "2026-09-08",
      blocks: [
        {
          id: "session-a-block",
          typeId: "session",
          session: {
            templateId: "a",
            displayCode: "A",
            name: "Close Control",
            completed: true,
            actualDurationSec: 600,
            plannedDurationSec: 900,
            movements: [
              {
                movementId: "sole-rolls",
                name: "Sole Rolls",
                trackingMethod: "repetitions",
                trackingConfig: { unit: "reps" },
                completed: true,
                result: { overall: { count: 24 } },
              },
            ],
          },
        },
        {
          id: "session-b-block",
          typeId: "session",
          session: {
            templateId: "b",
            displayCode: "B",
            name: "First Touch",
            completed: true,
            actualDurationSec: 600,
            plannedDurationSec: 900,
            movements: [
              {
                movementId: "first-touch",
                name: "First Touch Through Gate",
                trackingMethod: "attempts_successes",
                trackingConfig: { sideMode: "separate", unit: "attempts" },
                completed: true,
                result: {
                  left: { attempts: 5, successes: 4 },
                  right: { attempts: 5, successes: 4 },
                },
              },
            ],
          },
        },
        {
          id: "session-c-block",
          typeId: "session",
          session: {
            templateId: "c",
            displayCode: "C",
            name: "Weak Foot",
            completed: true,
            actualDurationSec: 600,
            plannedDurationSec: 900,
            movements: [
              {
                movementId: "keepy-ups",
                name: "Weak-Foot Keepy-Uppys",
                trackingMethod: "best_score",
                trackingConfig: { unit: "touches" },
                completed: true,
                result: { overall: { best: 18 } },
              },
            ],
          },
        },
      ],
    },
  };
}

afterEach(() => cleanup());

describe("ProgressDashboard Stage 5 training UI", () => {
  it("renders training charts, Session distribution and typed Movement totals from genuine structured history", async () => {
    render(
      <ProgressDashboard
        familyId="family-1"
        profileId="profile-wilf"
        profileName="Wilf"
        logs={[structuredLog()]}
        currentStreak={3}
        currentXp={2400}
        referenceDate="2026-09-10"
        dbApi={dbApi()}
      />
    );

    await waitFor(() => expect(screen.getByText("Wilf · Progress")).toBeTruthy());
    await waitFor(() => expect(screen.queryByText("Loading Progress data…")).toBeNull());

    expect(screen.getByLabelText("Completed Sessions by 7-day period")).toBeTruthy();
    expect(screen.getByLabelText("Training time by 7-day period")).toBeTruthy();
    expect(screen.getByText("Session distribution")).toBeTruthy();
    expect(screen.getByLabelText("Session distribution")).toBeTruthy();
    expect(screen.getByText("Movement totals")).toBeTruthy();
    expect(screen.getByLabelText("Movement totals")).toBeTruthy();

    expect(screen.getByText("Sole Rolls")).toBeTruthy();
    expect(screen.getByText("24 recorded executions")).toBeTruthy();
    expect(screen.getByText("First Touch Through Gate")).toBeTruthy();
    expect(screen.getByText("8/10 successful · 80%")).toBeTruthy();
    expect(screen.getByText("Weak-Foot Keepy-Uppys")).toBeTruthy();
    expect(screen.getByText("Best score 18")).toBeTruthy();

    const distributionShares = screen.getAllByText(/33\.3% of completed Sessions/);
    expect(distributionShares).toHaveLength(3);
  });
});
