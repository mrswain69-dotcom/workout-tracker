// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ProgressDashboard from "./ProgressDashboard.jsx";

function dbApi() {
  return {
    loadSessionLibrary: vi.fn(async () => ({
      data: {
        templates: [
          { id: "a", display_code: "A", name: "Close Control", sort_order: 1, archived: false },
          { id: "b", display_code: "B", name: "First Touch", sort_order: 2, archived: false },
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

function structuredLog({
  id,
  date,
  templateId,
  displayCode,
  sessionName,
  movementId,
  movementName,
  count,
}) {
  return {
    id,
    profile_id: "profile-wilf",
    date_ymd: date,
    log_json: {
      date_ymd: date,
      blocks: [
        {
          id: `${id}-block`,
          typeId: "session",
          session: {
            templateId,
            displayCode,
            name: sessionName,
            completed: true,
            actualDurationSec: 600,
            plannedDurationSec: 900,
            movements: [
              {
                movementId,
                name: movementName,
                trackingMethod: "repetitions",
                trackingConfig: { unit: "reps" },
                completed: true,
                result: { overall: { count } },
              },
            ],
          },
        },
      ],
    },
  };
}

function legacyLog() {
  return {
    id: "legacy-only",
    profile_id: "profile-wilf",
    date_ymd: "2026-05-12",
    log_json: {
      date_ymd: "2026-05-12",
      blocks: [{ typeId: "strength", movements: [] }],
    },
  };
}

afterEach(() => cleanup());

describe("ProgressDashboard Stage 7 range and density UI", () => {
  it("keeps charts, Session distribution and Movement totals on one selected range", async () => {
    const recent = structuredLog({
      id: "recent-a",
      date: "2026-09-08",
      templateId: "a",
      displayCode: "A",
      sessionName: "Close Control",
      movementId: "sole-rolls",
      movementName: "Sole Rolls",
      count: 24,
    });
    const older = structuredLog({
      id: "older-b",
      date: "2026-07-05",
      templateId: "b",
      displayCode: "B",
      sessionName: "First Touch",
      movementId: "wall-passes",
      movementName: "Wall Passes",
      count: 40,
    });

    render(
      <ProgressDashboard
        familyId="family-1"
        profileId="profile-wilf"
        profileName="Wilf"
        logs={[legacyLog(), older, recent]}
        currentStreak={3}
        currentXp={2400}
        referenceDate="2026-09-10"
        dbApi={dbApi()}
      />
    );

    await waitFor(() => expect(screen.queryByText("Loading Progress data…")).toBeNull());

    const rangeGroup = screen.getByRole("group", { name: "Training detail range" });
    expect(rangeGroup).toBeTruthy();
    const recentButton = screen.getByRole("button", { name: "Last 4 weeks" });
    const allTimeButton = screen.getByRole("button", { name: "All time" });
    expect(recentButton.getAttribute("aria-pressed")).toBe("true");
    expect(allTimeButton.getAttribute("aria-pressed")).toBe("false");

    expect(screen.getByText("Sole Rolls")).toBeTruthy();
    expect(screen.queryByText("Wall Passes")).toBeNull();
    expect(screen.getByText(/100% of completed Sessions/)).toBeTruthy();

    fireEvent.click(allTimeButton);

    expect(allTimeButton.getAttribute("aria-pressed")).toBe("true");
    expect(recentButton.getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByText("Wall Passes")).toBeTruthy();
    expect(screen.getByText("40 recorded executions")).toBeTruthy();
    expect(screen.getAllByText(/50% of completed Sessions/)).toHaveLength(2);
    expect(screen.getByLabelText("Completed Sessions by active months")).toBeTruthy();
    expect(screen.getByLabelText("Training time by active months")).toBeTruthy();
  });

  it("keeps the legacy parity message explicit rather than implying old Stats were replaced", async () => {
    render(
      <ProgressDashboard
        familyId="family-1"
        profileId="profile-wilf"
        profileName="Wilf"
        logs={[]}
        referenceDate="2026-09-10"
        dbApi={dbApi()}
      />
    );

    await waitFor(() => expect(screen.queryByText("Loading Progress data…")).toBeNull());
    expect(screen.getByText("Legacy workout history retained below")).toBeTruthy();
    expect(screen.getByText(/do not yet have truthful Progress parity/)).toBeTruthy();
  });
});
