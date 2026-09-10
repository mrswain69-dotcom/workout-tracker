// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ProgressDashboard from "./ProgressDashboard.jsx";

function dbApi(overrides = {}) {
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
      data: {
        developmentTags: [
          { id: "acceleration", name: "Acceleration" },
          { id: "strength", name: "Strength" },
        ],
        testDevelopmentTags: [
          { test_id: "sprint", development_tag_id: "acceleration" },
          { test_id: "press", development_tag_id: "strength" },
        ],
      },
      error: null,
    })),
    loadCompletedAssessmentHistory: vi.fn(async () => ({
      data: { runs: [], results: [] },
      error: null,
    })),
    listAssessmentRuns: vi.fn(async () => ({ data: [], error: null })),
    listAssessmentSchedules: vi.fn(async () => ({
      data: [
        {
          id: "schedule-1",
          family_id: "family-1",
          profile_id: "profile-wilf",
          assessment_template_id: "benchmark",
          start_date: "2026-09-21",
          cadence_days: 28,
          window_days: 7,
          workflow_config: {},
          active: true,
        },
      ],
      error: null,
    })),
    ...overrides,
  };
}

afterEach(() => cleanup());

describe("ProgressDashboard Stage 4 shell", () => {
  it("renders the real zero-history state without inventing Session or Assessment results", async () => {
    const api = dbApi();
    render(
      <ProgressDashboard
        familyId="family-1"
        profileId="profile-wilf"
        profileName="Wilf"
        logs={[]}
        currentStreak={4}
        currentXp={1680}
        referenceDate="2026-09-10"
        dbApi={api}
      />
    );

    expect(screen.getByText("Loading Progress data…")).toBeTruthy();

    await waitFor(() =>
      expect(screen.getByText("Wilf · Progress")).toBeTruthy()
    );
    await waitFor(() =>
      expect(screen.queryByText("Loading Progress data…")).toBeNull()
    );

    expect(screen.getAllByText("No baseline yet").length).toBeGreaterThan(0);
    expect(screen.getByText(/No structured Sessions logged yet/)).toBeTruthy();
    expect(screen.getByText(/First benchmark:/)).toBeTruthy();
    expect(screen.getAllByText(/21 Sept 2026/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("4d")).toBeTruthy();
    expect(screen.getByText("1,680")).toBeTruthy();
    expect(screen.getByText("A")).toBeTruthy();
    expect(screen.getByText("B")).toBeTruthy();
    expect(screen.getByText("C")).toBeTruthy();

    expect(api.loadSessionLibrary).toHaveBeenCalledWith("family-1");
    expect(api.loadCompletedAssessmentHistory).toHaveBeenCalledWith(
      "family-1",
      "profile-wilf"
    );
    expect(api.listAssessmentSchedules).toHaveBeenCalledWith("family-1", {
      profileId: "profile-wilf",
      activeOnly: true,
    });
  });

  it("routes the Progress Assessment action through the supplied app callback", async () => {
    const openAssess = vi.fn();
    render(
      <ProgressDashboard
        familyId="family-1"
        profileId="profile-wilf"
        logs={[]}
        referenceDate="2026-09-10"
        onOpenAssessments={openAssess}
        dbApi={dbApi()}
      />
    );

    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: "Open Assess" }).length).toBeGreaterThan(0)
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Open Assess" })[0]);
    expect(openAssess).toHaveBeenCalledTimes(1);
  });

  it("keeps the shell usable when one remote Progress source fails", async () => {
    const failingApi = dbApi({
      loadAssessmentLibrary: vi.fn(async () => ({
        data: null,
        error: new Error("assessment library unavailable"),
      })),
    });

    render(
      <ProgressDashboard
        familyId="family-1"
        profileId="profile-wilf"
        logs={[]}
        referenceDate="2026-09-10"
        dbApi={failingApi}
      />
    );

    await waitFor(() =>
      expect(screen.getByText("Some Progress data could not be loaded.")).toBeTruthy()
    );
    expect(screen.getByText("Training progress")).toBeTruthy();
    expect(screen.getByText("Benchmark progress")).toBeTruthy();
    expect(screen.getByText("Development trends")).toBeTruthy();
  });

  it("retries the remote Progress load without changing workout history", async () => {
    const api = dbApi();
    api.loadAssessmentLibrary
      .mockResolvedValueOnce({ data: null, error: new Error("temporary") })
      .mockResolvedValue({
        data: { developmentTags: [], testDevelopmentTags: [] },
        error: null,
      });

    render(
      <ProgressDashboard
        familyId="family-1"
        profileId="profile-wilf"
        logs={[]}
        referenceDate="2026-09-10"
        dbApi={api}
      />
    );

    await waitFor(() => expect(screen.getByText("Retry")).toBeTruthy());
    fireEvent.click(screen.getByText("Retry"));

    await waitFor(() => expect(api.loadAssessmentLibrary).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.queryByText("Some Progress data could not be loaded.")).toBeNull()
    );
  });
});
