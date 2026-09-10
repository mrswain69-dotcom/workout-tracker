// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ProgressDashboard from "./ProgressDashboard.jsx";

afterEach(() => cleanup());

function run(id, date) {
  return {
    id,
    family_id: "family-1",
    profile_id: "profile-wilf",
    assessment_template_id: "football-benchmark",
    date_ymd: date,
    status: "completed",
    completed_at: `${date}T18:00:00Z`,
    template_version: 1,
    template_snapshot: { template: { name: "Football Monthly Benchmark" } },
  };
}

function result({ id, runId, testId, name, value, direction, unit, position }) {
  return {
    id,
    family_id: "family-1",
    assessment_run_id: runId,
    test_id: testId,
    position,
    section_label_snapshot: "Athletic",
    test_name_snapshot: name,
    metric_snapshot: {
      metricType: "numeric",
      unit,
      scoringDirection: direction,
      attemptCount: 1,
      resultStrategy: "single",
      sideMode: "none",
      pbEligible: true,
      metricConfig: { decimalPlaces: 2, percentageDecimalPlaces: 1 },
    },
    retained_result: { overall: value },
    comparable_value: value,
    comparable_dimensions: {},
    is_valid: true,
  };
}

function dbApi() {
  const runs = [run("r1", "2026-08-01"), run("r2", "2026-09-01")];
  const results = [
    result({ id: "s1", runId: "r1", testId: "sprint", name: "10 m acceleration", value: 2.2, direction: "lower", unit: "s", position: 1 }),
    result({ id: "p1", runId: "r1", testId: "press", name: "Strict press-ups", value: 10, direction: "higher", unit: "reps", position: 2 }),
    result({ id: "s2", runId: "r2", testId: "sprint", name: "10 m acceleration", value: 2.0, direction: "lower", unit: "s", position: 1 }),
    result({ id: "p2", runId: "r2", testId: "press", name: "Strict press-ups", value: 12, direction: "higher", unit: "reps", position: 2 }),
  ];

  return {
    loadSessionLibrary: vi.fn(async () => ({ data: { templates: [] }, error: null })),
    loadAssessmentLibrary: vi.fn(async () => ({
      data: {
        developmentTags: [
          { id: "tag-acc", name: "Acceleration", slug: "acceleration" },
          { id: "tag-strength", name: "Strength", slug: "strength" },
        ],
        testDevelopmentTags: [
          { test_id: "sprint", development_tag_id: "tag-acc" },
          { test_id: "press", development_tag_id: "tag-strength" },
        ],
      },
      error: null,
    })),
    loadCompletedAssessmentHistory: vi.fn(async () => ({
      data: { runs, results },
      error: null,
    })),
    listAssessmentRuns: vi.fn(async () => ({ data: runs, error: null })),
    listAssessmentSchedules: vi.fn(async () => ({ data: [], error: null })),
  };
}

describe("ProgressDashboard Stage 6 integration", () => {
  it("wires Assessment charts and detailed Development Trends into Progress without removing Stage 5 or legacy Stats bridge", async () => {
    render(
      <ProgressDashboard
        familyId="family-1"
        profileId="profile-wilf"
        profileName="Wilf"
        logs={[]}
        currentStreak={2}
        currentXp={3000}
        referenceDate="2026-09-10"
        dbApi={dbApi()}
      />
    );

    await waitFor(() => expect(screen.queryByText("Loading Progress data…")).toBeNull());

    expect(screen.getByLabelText("Latest benchmark Test status summary")).toBeTruthy();
    expect(screen.getByLabelText("10 m acceleration Assessment history chart")).toBeTruthy();
    expect(screen.getByLabelText("Strict press-ups Assessment history chart")).toBeTruthy();
    expect(screen.getByLabelText("Detailed Development trends")).toBeTruthy();
    expect(screen.getByText("Acceleration")).toBeTruthy();
    expect(screen.getByText("Strength")).toBeTruthy();

    expect(screen.getByText(/Training charts will appear after structured Session activity is recorded/)).toBeTruthy();
    expect(screen.getByText("Legacy workout history retained below")).toBeTruthy();
  });
});
