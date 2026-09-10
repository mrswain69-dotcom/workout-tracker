// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ProgressDashboard from "./ProgressDashboard.jsx";

function run(id, date) {
  return {
    id,
    profile_id: "profile-wilf",
    assessment_template_id: "football",
    date_ymd: date,
    status: "completed",
    completed_at: `${date}T18:00:00Z`,
    template_version: 1,
    template_snapshot: {
      template: { id: "football", name: "Football Benchmark" },
      tests: [
        {
          testId: "receive-test",
          displayLabel: "Outside-foot receive",
          developmentTagIds: ["first-touch"],
        },
      ],
    },
  };
}

function result(runId, value) {
  return {
    id: `${runId}-receive`,
    assessment_run_id: runId,
    test_id: "receive-test",
    position: 1,
    test_name_snapshot: "Outside-foot receive",
    metric_snapshot: {
      metricType: "numeric",
      unit: "reps",
      scoringDirection: "higher",
      attemptCount: 1,
      resultStrategy: "single",
      sideMode: "none",
      allowNegative: false,
      pbEligible: true,
      metricConfig: { decimalPlaces: 0, percentageDecimalPlaces: 1 },
    },
    retained_result: { overall: value },
    comparable_value: value,
    comparable_dimensions: {},
    is_valid: true,
  };
}

function sessionLog(date, templateId, code, movementId, count) {
  return {
    id: `log-${date}-${templateId}`,
    profile_id: "profile-wilf",
    date_ymd: date,
    log_json: {
      date_ymd: date,
      blocks: [
        {
          id: `block-${date}-${templateId}`,
          typeId: "session",
          session: {
            schemaVersion: 2,
            templateId,
            displayCode: code,
            name: code === "A" ? "Close Control" : "Receiving",
            completed: true,
            actualDurationSec: 600,
            movements: [
              {
                movementId,
                name: movementId,
                developmentTagIds: ["first-touch"],
                trackingMethod: "repetitions",
                trackingConfig: { unit: "reps" },
                completed: true,
                skipped: false,
                result: { overall: { count } },
              },
            ],
          },
        },
      ],
    },
  };
}

function readyDbApi() {
  const runs = [run("r1", "2026-08-01"), run("r2", "2026-09-01")];
  const results = [result("r1", 5), result("r2", 8)];
  return {
    loadSessionLibrary: vi.fn(async () => ({
      data: {
        templates: [
          { id: "a", display_code: "A", name: "Close Control", sort_order: 1, archived: false },
          { id: "b", display_code: "B", name: "Receiving", sort_order: 2, archived: false },
        ],
        templateMovements: [
          { session_template_id: "a", movement_id: "receive-a" },
          { session_template_id: "b", movement_id: "receive-b" },
        ],
        movementDevelopmentTags: [
          { movement_id: "receive-a", development_tag_id: "first-touch" },
          { movement_id: "receive-b", development_tag_id: "first-touch" },
        ],
      },
      error: null,
    })),
    loadAssessmentLibrary: vi.fn(async () => ({
      data: {
        developmentTags: [{ id: "first-touch", name: "First Touch", slug: "first-touch", archived: false }],
        testDevelopmentTags: [{ test_id: "receive-test", development_tag_id: "first-touch" }],
      },
      error: null,
    })),
    loadCompletedAssessmentHistory: vi.fn(async () => ({ data: { runs, results }, error: null })),
    listAssessmentRuns: vi.fn(async () => ({ data: runs, error: null })),
    listAssessmentSchedules: vi.fn(async () => ({ data: [], error: null })),
  };
}

function emptyDbApi() {
  return {
    loadSessionLibrary: vi.fn(async () => ({ data: { templates: [], templateMovements: [], movementDevelopmentTags: [] }, error: null })),
    loadAssessmentLibrary: vi.fn(async () => ({ data: { developmentTags: [], testDevelopmentTags: [] }, error: null })),
    loadCompletedAssessmentHistory: vi.fn(async () => ({ data: { runs: [], results: [] }, error: null })),
    listAssessmentRuns: vi.fn(async () => ({ data: [], error: null })),
    listAssessmentSchedules: vi.fn(async () => ({ data: [], error: null })),
  };
}

afterEach(() => cleanup());

describe("Phase 4 Stage 5 ProgressDashboard integration", () => {
  it("renders ready Assessment Analysis from the same Progress source data without another remote API", async () => {
    const api = readyDbApi();
    render(
      <ProgressDashboard
        familyId="family-1"
        profileId="profile-wilf"
        profileName="Wilf"
        referenceDate="2026-09-10"
        logs={[
          sessionLog("2026-08-05", "a", "A", "receive-a", 20),
          sessionLog("2026-08-12", "a", "A", "receive-a", 25),
          sessionLog("2026-08-20", "b", "B", "receive-b", 15),
        ]}
        dbApi={api}
      />
    );

    await waitFor(() => expect(screen.queryByText("Loading Progress data…")).toBeNull());

    const analysis = screen.getByLabelText("Assessment Analysis");
    const analysisScreen = within(analysis);
    const comparison = analysisScreen.getByLabelText("Assessment comparison period");
    expect(comparison).toBeTruthy();
    expect(within(comparison).getByText("1 Aug 2026")).toBeTruthy();
    expect(within(comparison).getByText("1 Sept 2026")).toBeTruthy();
    expect(analysisScreen.getByText("Observed Consistency")).toBeTruthy();
    expect(analysisScreen.getByText("POSSIBLE NEXT FOCUS")).toBeTruthy();
    expect(analysisScreen.getByText("Session B · Receiving")).toBeTruthy();
    expect(analysisScreen.getByText("Outside-foot receive")).toBeTruthy();
    expect(analysisScreen.getByText(/does not establish that training caused the result/)).toBeTruthy();

    expect(api.loadSessionLibrary).toHaveBeenCalledTimes(1);
    expect(api.loadAssessmentLibrary).toHaveBeenCalledTimes(1);
    expect(api.loadCompletedAssessmentHistory).toHaveBeenCalledTimes(1);
    expect(api.listAssessmentRuns).toHaveBeenCalledTimes(1);
    expect(api.listAssessmentSchedules).toHaveBeenCalledTimes(1);
  });

  it("keeps the production empty-history state useful and does not invent Analysis", async () => {
    render(
      <ProgressDashboard
        familyId="family-1"
        profileId="profile-wilf"
        profileName="Wilf"
        referenceDate="2026-09-10"
        logs={[]}
        dbApi={emptyDbApi()}
      />
    );

    await waitFor(() => expect(screen.queryByText("Loading Progress data…")).toBeNull());
    const analysis = screen.getByLabelText("Assessment Analysis");
    const analysisScreen = within(analysis);
    expect(analysisScreen.getByText("Build your Assessment baseline")).toBeTruthy();
    expect(analysisScreen.queryByText("Observed Consistency")).toBeNull();
    expect(analysisScreen.queryByText("POSSIBLE NEXT FOCUS")).toBeNull();
  });
});
