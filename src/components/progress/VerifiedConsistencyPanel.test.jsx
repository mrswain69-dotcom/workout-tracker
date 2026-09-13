// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import VerifiedConsistencyPanel from "./VerifiedConsistencyPanel.jsx";

afterEach(() => cleanup());

const schedule = {
  Mon: [{ id: "run", typeId: "run" }],
  Tue: [{ id: "duration", typeId: "duration" }],
  Wed: [], Thu: [], Fri: [], Sat: [], Sun: [],
};

function verificationData(date = "2026-09-14") {
  return {
    observations: [{
      id: "o1",
      provider: "strava",
      local_date_ymd: date,
      activity_type: "run",
      distance_m: 5000,
      moving_duration_sec: 1500,
    }],
    verifiedActivities: [{
      id: "v1",
      activity_type: "run",
      started_at: `${date}T17:00:00.000Z`,
      status: "active",
      identity_method: "single_source",
    }],
    observationLinks: [{ verified_activity_id: "v1", observation_id: "o1" }],
    manualLinks: [],
    connections: [],
  };
}

describe("VerifiedConsistencyPanel Stage 6 UI", () => {
  it("shows a verified run satisfying the matching planned run with zero bonus XP", () => {
    render(
      <VerifiedConsistencyPanel
        verificationData={verificationData()}
        logs={[]}
        consistencySnapshots={[{ effective_date: "2026-09-01", schedule_json: schedule }]}
      />
    );

    const panel = screen.getByLabelText("Verified plan completion");
    expect(within(panel).getByRole("heading", { name: "Verified training can satisfy the plan" })).toBeTruthy();
    expect(within(panel).getByText("Consistency evidence · 0 bonus XP")).toBeTruthy();
    expect(within(panel).getByText("Run ← Run")).toBeTruthy();
    expect(within(panel).getByText("Planned day satisfied")).toBeTruthy();
    expect(within(panel).getByText("Plan blocks verified").parentElement?.textContent).toContain("1");
    expect(within(panel).getByText("Days completed by verification").parentElement?.textContent).toContain("1");
  });

  it("does not claim that the same verified run satisfies a generic duration block", () => {
    render(
      <VerifiedConsistencyPanel
        verificationData={verificationData("2026-09-15")}
        logs={[]}
        consistencySnapshots={[{ effective_date: "2026-09-01", schedule_json: schedule }]}
      />
    );

    const panel = screen.getByLabelText("Verified plan completion");
    expect(within(panel).getByText("Plan blocks verified").parentElement?.textContent).toContain("0");
    expect(within(panel).getByText(/generic Duration stay manual/i)).toBeTruthy();
    expect(within(panel).getByText(/No verified activity currently satisfies/i)).toBeTruthy();
  });
});
