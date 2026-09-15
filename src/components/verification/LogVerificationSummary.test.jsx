// @vitest-environment jsdom

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LogVerificationSummary, { buildLogVerificationModel } from "./LogVerificationSummary.jsx";

function data() {
  return {
    connections: [{ provider: "strava", status: "active" }],
    observations: [
      {
        id: "obs-run",
        provider: "strava",
        started_at: "2026-09-15T17:00:00Z",
        local_date_ymd: "2026-09-15",
        activity_type: "run",
        distance_m: 5000,
        moving_duration_sec: 1500,
        source_manual_entry: false,
      },
      {
        id: "obs-strength",
        provider: "strava",
        started_at: "2026-09-15T18:00:00Z",
        local_date_ymd: "2026-09-15",
        activity_type: "strength",
        moving_duration_sec: 1800,
        source_manual_entry: false,
      },
    ],
    verifiedActivities: [
      { id: "va-run", activity_type: "run", started_at: "2026-09-15T17:00:00Z", status: "active" },
      { id: "va-strength", activity_type: "strength", started_at: "2026-09-15T18:00:00Z", status: "active" },
    ],
    observationLinks: [
      { verified_activity_id: "va-run", observation_id: "obs-run" },
      { verified_activity_id: "va-strength", observation_id: "obs-strength" },
    ],
    manualLinks: [
      {
        verified_activity_id: "va-strength",
        manual_log_id: "log-1",
        manual_block_id: "strength-1",
        match_method: "manual",
      },
    ],
  };
}

describe("LogVerificationSummary", () => {
  it("rolls verified cardio and session-level strength evidence into a quiet block summary", () => {
    const model = buildLogVerificationModel({
      data: data(),
      dateYmd: "2026-09-15",
      manualLogId: "log-1",
      blocks: [
        { id: "run-1", typeId: "cardio", label: "Run" },
        { id: "strength-1", typeId: "strength", label: "Gym" },
      ],
    });

    expect(model.overallStatus).toBe("verified");
    expect(model.rows.find((row) => row.blockId === "run-1")?.status).toBe("verified");
    expect(model.rows.find((row) => row.blockId === "strength-1")?.status).toBe("verified");
  });

  it("lets one continuous strength evidence session cover overlapping recorded strength blocks", () => {
    const model = buildLogVerificationModel({
      data: data(),
      dateYmd: "2026-09-15",
      manualLogId: "log-1",
      blocks: [
        {
          id: "strength-1",
          typeId: "strength",
          label: "Legs and Chest",
          startedAt: "2026-09-15T18:01:00Z",
          completedAt: "2026-09-15T18:25:00Z",
          sets: { squat: [{ reps: "20", weight: "25" }] },
        },
        {
          id: "strength-extra",
          typeId: "strength",
          label: "Situps",
          startedAt: "2026-09-15T18:20:00Z",
          completedAt: "2026-09-15T18:29:00Z",
          sets: { situps: [{ reps: "30" }] },
        },
      ],
    });

    expect(model.overallStatus).toBe("verified");
    expect(model.verifiedCount).toBe(2);
    expect(model.rows.map((row) => row.status)).toEqual(["verified", "verified"]);
    expect(model.rows[1].matchMethod).toMatch(/session evidence/i);
  });

  it("hides provenance until the athlete taps the compact status", async () => {
    const api = { loadVerifiedActivityData: vi.fn(async () => ({ data: data(), error: null })) };
    render(
      <LogVerificationSummary
        profileId="paul"
        dateYmd="2026-09-15"
        manualLogId="log-1"
        blocks={[{ id: "strength-1", typeId: "strength", label: "Gym" }]}
        api={api}
      />
    );

    const button = await screen.findByRole("button", { name: /^Verified/i });
    expect(screen.queryByText(/Athlete confirmed/i)).toBeNull();
    fireEvent.click(button);
    expect(await screen.findByText(/Athlete confirmed/i)).toBeTruthy();
  });
});
