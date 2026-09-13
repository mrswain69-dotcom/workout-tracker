// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import VerifiedActivitySection from "./VerifiedActivitySection.jsx";

function emptyData() {
  return {
    profileId: "p1",
    connections: [],
    observations: [],
    verifiedActivities: [],
    observationLinks: [],
    manualLinks: [],
  };
}

function apiFor(data = emptyData()) {
  return {
    loadVerifiedActivityData: vi.fn(async () => ({ data, error: null })),
    startStravaConnection: vi.fn(async () => ({
      data: { authorizeUrl: "https://www.strava.com/oauth/authorize?state=test" },
      error: null,
    })),
    disconnectStravaConnection: vi.fn(async () => ({
      data: { provider: "strava", status: "disconnected" },
      error: null,
    })),
    reconcileVerifiedActivityData: vi.fn(async () => ({
      data: { verifiedActivityCount: data.verifiedActivities.length },
      error: null,
    })),
  };
}

afterEach(() => cleanup());

describe("VerifiedActivitySection Stage 4 UI", () => {
  it("shows provider availability without inventing connected or verified activity", async () => {
    const api = apiFor();
    render(<VerifiedActivitySection profileId="p1" profileName="Wilf" api={api} />);

    expect(await screen.findByRole("heading", { name: "Connected Sources" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Connect Strava" })).toBeTruthy();
    expect(screen.getByText("Garmin Connect")).toBeTruthy();
    expect(screen.getByText("Apple Health")).toBeTruthy();
    expect(screen.getByText("Health Connect")).toBeTruthy();
    expect(screen.getByText("0 bonus XP · evidence only")).toBeTruthy();
    expect(screen.getByText("No synced activity yet.")).toBeTruthy();
    expect(api.loadVerifiedActivityData).toHaveBeenCalledWith("p1");
  });

  it("starts Strava OAuth through the server action and navigates only to the returned provider URL", async () => {
    const api = apiFor();
    const navigateToProvider = vi.fn();
    render(
      <VerifiedActivitySection
        profileId="p1"
        api={api}
        navigateToProvider={navigateToProvider}
      />
    );

    fireEvent.click(await screen.findByRole("button", { name: "Connect Strava" }));

    await waitFor(() =>
      expect(api.startStravaConnection).toHaveBeenCalledWith("p1", { includePrivate: false })
    );
    expect(navigateToProvider).toHaveBeenCalledWith(
      "https://www.strava.com/oauth/authorize?state=test"
    );
  });

  it("shows deduplicated provider provenance and a clear manual match as evidence, not extra XP", async () => {
    const data = {
      profileId: "p1",
      connections: [
        {
          id: "c1",
          profile_id: "p1",
          provider: "strava",
          status: "active",
          auto_sync_enabled: true,
          last_sync_at: "2026-09-13T08:30:00.000Z",
        },
      ],
      observations: [
        {
          id: "o1",
          profile_id: "p1",
          provider: "strava",
          local_date_ymd: "2026-09-12",
          distance_m: 5010,
          moving_duration_sec: 1500,
          average_heart_rate_bpm: 148,
        },
        {
          id: "o2",
          profile_id: "p1",
          provider: "garmin",
          local_date_ymd: "2026-09-12",
          distance_m: 5000,
          moving_duration_sec: 1502,
        },
      ],
      verifiedActivities: [
        {
          id: "v1",
          profile_id: "p1",
          activity_type: "run",
          started_at: "2026-09-12T17:00:00.000Z",
          status: "active",
          identity_method: "automatic_dedup",
          identity_confidence: 0.95,
          match_version: "verification_match_v1",
        },
      ],
      observationLinks: [
        { verified_activity_id: "v1", observation_id: "o1" },
        { verified_activity_id: "v1", observation_id: "o2" },
      ],
      manualLinks: [
        {
          id: "l1",
          verified_activity_id: "v1",
          manual_log_id: "log1",
          manual_block_id: "run1",
          match_method: "automatic",
          match_confidence: 0.94,
        },
      ],
    };
    const api = apiFor(data);

    render(<VerifiedActivitySection profileId="p1" profileName="Wilf" api={api} />);

    expect(await screen.findByText("Matched to Workout Tracker")).toBeTruthy();
    expect(screen.getAllByText("Strava").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Garmin")).toBeTruthy();
    expect(screen.getByText("One activity · multiple sources")).toBeTruthy();
    expect(screen.getByText(/5\.01 km/)).toBeTruthy();
    expect(screen.getByText(/25 min/)).toBeTruthy();
    expect(screen.getByText(/148 bpm avg/)).toBeTruthy();
    expect(screen.getByText("0 bonus XP · evidence only")).toBeTruthy();
  });

  it("refreshes derived verification through the authenticated reconciler and then reloads read-only data", async () => {
    const api = apiFor();
    render(<VerifiedActivitySection profileId="p1" api={api} />);

    await screen.findByRole("heading", { name: "Connected Sources" });
    fireEvent.click(screen.getByRole("button", { name: "Refresh evidence" }));

    await waitFor(() => expect(api.reconcileVerifiedActivityData).toHaveBeenCalledWith("p1"));
    await waitFor(() => expect(api.loadVerifiedActivityData.mock.calls.length).toBeGreaterThanOrEqual(2));
    expect(await screen.findByText("Verification evidence refreshed from current source truth.")).toBeTruthy();
  });
});
