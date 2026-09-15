// @vitest-environment jsdom

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LogVerificationSummary from "./LogVerificationSummary.jsx";

const verifiedData = {
  connections: [{ provider: "strava", status: "active" }],
  observations: [{
    id: "obs-run",
    provider: "strava",
    started_at: "2026-09-15T17:00:00Z",
    local_date_ymd: "2026-09-15",
    activity_type: "run",
    distance_m: 5000,
    moving_duration_sec: 1500,
    source_manual_entry: false,
  }],
  verifiedActivities: [{ id: "va-run", activity_type: "run", started_at: "2026-09-15T17:00:00Z", status: "active" }],
  observationLinks: [{ verified_activity_id: "va-run", observation_id: "obs-run" }],
  manualLinks: [{
    verified_activity_id: "va-run",
    manual_log_id: "log-1",
    manual_block_id: "run-1",
    match_method: "automatic",
  }],
};

const populatedLog = {
  blocks: [{
    id: "run-1",
    typeId: "cardio",
    label: "Run",
    cardioType: "run",
    cardio: { distanceKm: "5", durationMin: "25", avgSpeedKmh: "" },
  }],
  meta: {
    verificationPopulation: {
      version: "verification_auto_population_v1",
      fields: {
        "run-1|cardio.distanceKm": {
          verifiedActivityId: "va-run",
          providers: ["strava"],
          observationIds: ["obs-run"],
          importedValue: "5",
          previousValue: "",
          state: "imported",
        },
      },
      extraBlocks: {},
    },
  },
};

describe("LogVerificationSummary Stage 7.3", () => {
  it("labels auto-filled verification and offers a reversible undo", async () => {
    const onChanged = vi.fn();
    const api = {
      loadVerifiedActivityData: vi.fn(async () => ({ data: verifiedData, error: null })),
      applyRecentVerifiedAutoPopulation: vi.fn(async () => ({ data: { logsChanged: 0, fieldsFilled: 0, extraBlocksCreated: 0 }, error: null })),
      undoVerifiedAutoPopulation: vi.fn(async () => ({ data: { verifiedActivityId: "va-run", fieldsRestored: 1, suppressed: true }, error: null })),
    };

    render(
      <LogVerificationSummary
        profileId="paul"
        dateYmd="2026-09-15"
        manualLogId="log-1"
        blocks={populatedLog.blocks}
        logJson={populatedLog}
        onAutoPopulationChanged={onChanged}
        api={api}
      />
    );

    fireEvent.click(await screen.findByRole("button", { name: /Verified/i }));
    expect(await screen.findByText(/Auto-filled/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Undo automatic fill/i }));
    await waitFor(() => expect(api.undoVerifiedAutoPopulation).toHaveBeenCalledWith("paul", "va-run"));
    expect(onChanged).toHaveBeenCalled();
  });
});
