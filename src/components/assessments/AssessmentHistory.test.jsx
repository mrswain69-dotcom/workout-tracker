// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AssessmentHistory from "./AssessmentHistory.jsx";

function run(id, date, notes = "") {
  return {
    id,
    status: "completed",
    date_ymd: date,
    completed_at: `${date}T18:00:00Z`,
    template_version: 1,
    template_snapshot: { template: { name: "Monthly Benchmark", version: 1 } },
    notes,
  };
}

function result(id, runId, value, extra = {}) {
  const dimensions = extra.dimensions || null;
  return {
    id,
    assessment_run_id: runId,
    test_id: extra.testId || "test-1",
    position: 1,
    test_name_snapshot: extra.name || "10 m acceleration",
    metric_snapshot: {
      metricType: "numeric",
      unit: extra.unit || "s",
      scoringDirection: extra.direction || "lower",
      attemptCount: 1,
      resultStrategy: "single",
      sideMode: dimensions ? "separate" : "none",
      pbEligible: true,
      metricConfig: { decimalPlaces: 2, percentageDecimalPlaces: 1 },
    },
    retained_result: dimensions || { overall: value },
    comparable_value: dimensions ? null : value,
    comparable_dimensions: dimensions || {},
    is_valid: true,
  };
}

function dbWith(data) {
  return { loadCompletedAssessmentHistory: vi.fn(async () => ({ data, error: null })) };
}

describe("AssessmentHistory", () => {
  it("shows the no-history state and scopes the read to the selected athlete", async () => {
    const dbApi = dbWith({ runs: [], results: [] });
    render(<AssessmentHistory familyId="f1" profileId="wilf" athleteName="Wilf" dbApi={dbApi} />);
    expect(await screen.findByText(/No completed Assessment results yet/i)).toBeTruthy();
    expect(dbApi.loadCompletedAssessmentHistory).toHaveBeenCalledWith("f1", "wilf");
  });

  it("shows latest, previous, baseline and PB with direction-aware comparisons", async () => {
    const data = {
      runs: [run("r1", "2026-01-01"), run("r2", "2026-02-01"), run("r3", "2026-03-01")],
      results: [result("x1", "r1", 2.2), result("x2", "r2", 2.05), result("x3", "r3", 2.1)],
    };
    render(<AssessmentHistory familyId="f1" profileId="p1" athleteName="Wilf" dbApi={dbWith(data)} />);
    const heading = await screen.findByRole("heading", { name: "10 m acceleration" });
    const card = heading.closest("article");
    expect(within(card).getByText("2.1 s")).toBeTruthy();
    expect(within(card).getByText("2.05 s")).toBeTruthy();
    expect(within(card).getByText("2.2 s")).toBeTruthy();
    expect(within(card).getByText(/Declined 0.05 s/i)).toBeTruthy();
    expect(within(card).getByText(/Improved 0.1 s/i)).toBeTruthy();
  });

  it("derives separate left/right PBs and new-PB status", async () => {
    const data = {
      runs: [run("r1", "2026-01-01"), run("r2", "2026-02-01")],
      results: [
        result("x1", "r1", null, { name: "Calf raises", unit: "reps", direction: "higher", dimensions: { left: 18, right: 20 } }),
        result("x2", "r2", null, { name: "Calf raises", unit: "reps", direction: "higher", dimensions: { left: 22, right: 19 } }),
      ],
    };
    render(<AssessmentHistory familyId="f1" profileId="p1" dbApi={dbWith(data)} />);
    expect(await screen.findByText("New L")).toBeTruthy();
    expect(screen.getByText(/L 22 reps · R 19 reps/)).toBeTruthy();
    expect(screen.getByText(/L: Improved 4 reps/i)).toBeTruthy();
    expect(screen.getByText(/R: Declined 1 reps/i)).toBeTruthy();
  });

  it("keeps changed-metric history visible but withholds incompatible comparisons", async () => {
    const data = {
      runs: [run("r1", "2026-01-01"), run("r2", "2026-02-01")],
      results: [result("x1", "r1", 2.1), result("x2", "r2", 650, { unit: "ms" })],
    };
    render(<AssessmentHistory familyId="f1" profileId="p1" dbApi={dbWith(data)} />);
    expect(await screen.findByText(/frozen metric changed/i)).toBeTruthy();
    expect(screen.getAllByText(/comparison withheld/i).length).toBeGreaterThan(0);
  });

  it("shows the underlying completed Assessment record and reloads for a profile switch", async () => {
    const dbApi = dbWith({
      runs: [run("r1", "2026-01-01", "Dry pitch")],
      results: [result("x1", "r1", 2.1)],
    });
    const { rerender } = render(<AssessmentHistory familyId="f1" profileId="wilf" athleteName="Wilf" dbApi={dbApi} />);
    await screen.findByText("10 m acceleration");
    fireEvent.click(screen.getByRole("button", { name: "Completed Assessments" }));
    expect(screen.getByRole("heading", { name: "Monthly Benchmark" })).toBeTruthy();
    expect(screen.getByText("Dry pitch")).toBeTruthy();
    rerender(<AssessmentHistory familyId="f1" profileId="xander" athleteName="Xander" dbApi={dbApi} />);
    await waitFor(() => expect(dbApi.loadCompletedAssessmentHistory).toHaveBeenCalledWith("f1", "xander"));
  });
});
