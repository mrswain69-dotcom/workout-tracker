// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import VerifiedActivityEvidenceSection, { groupManualMatchCandidates } from "./VerifiedActivityEvidenceSection.jsx";

function emptyApi(overrides = {}) {
  return {
    loadVerifiedActivityData: vi.fn(async () => ({
      data: {
        connections: [{ provider: "strava", status: "active" }],
        observations: [],
        verifiedActivities: [],
        observationLinks: [],
        manualLinks: [],
      },
      error: null,
    })),
    loadManualMatchCandidates: vi.fn(async () => ({ data: { candidates: [] }, error: null })),
    confirmManualVerifiedMatch: vi.fn(async () => ({ data: { matched: true }, error: null })),
    detachVerifiedMatch: vi.fn(async () => ({ data: { detached: true }, error: null })),
    resetVerifiedAutomaticMatching: vi.fn(async () => ({ data: {}, error: null })),
    setVerifiedActivityIgnored: vi.fn(async () => ({ data: {}, error: null })),
    ...overrides,
  };
}

function evidenceData({ linked = false, matchMethod = "automatic", ignored = false } = {}) {
  return {
    connections: [{ provider: "strava", status: "active" }],
    observations: [{
      id: "obs-1",
      provider: "strava",
      started_at: "2026-09-15T17:00:00Z",
      local_date_ymd: "2026-09-15",
      activity_type: "run",
      distance_m: 5000,
      moving_duration_sec: 1500,
      source_manual_entry: false,
      source_device_name: "Garmin",
    }],
    verifiedActivities: [{
      id: "verified-1",
      activity_type: "run",
      started_at: "2026-09-15T17:00:00Z",
      status: ignored ? "ignored" : "active",
      auto_match_suppressed: matchMethod === "manual",
      identity_method: "single_source",
    }],
    observationLinks: [{ verified_activity_id: "verified-1", observation_id: "obs-1" }],
    manualLinks: linked ? [{
      verified_activity_id: "verified-1",
      manual_log_id: "log-1",
      manual_block_id: "run-1",
      match_method: matchMethod,
      match_confidence: 0.92,
      date_offset_days: -1,
    }] : [],
  };
}

afterEach(() => cleanup());

describe("VerifiedActivityEvidenceSection", () => {
  it("keeps connection management out of Progress", async () => {
    const api = emptyApi();
    render(<VerifiedActivityEvidenceSection profileId="paul" profileName="Paul" api={api} />);
    await screen.findByText("Connect a source in Settings → Connections.");
    expect(screen.queryByRole("button", { name: /Connect Strava/i })).toBeNull();
    const connectedSources = screen.getByText("Connected sources").closest("div");
    expect(connectedSources?.textContent).toContain("1");
  });

  it("shows a clean verified indicator with provenance behind the click", async () => {
    const api = emptyApi({
      loadVerifiedActivityData: vi.fn(async () => ({ data: evidenceData({ linked: true, matchMethod: "manual" }), error: null })),
    });
    render(<VerifiedActivityEvidenceSection profileId="paul" profileName="Paul" api={api} />);
    const button = await screen.findByRole("button", { name: /Verified workout/i });
    fireEvent.click(button);
    expect(screen.getByText("Match confirmed by athlete")).toBeTruthy();
    expect(screen.getByText("1 day after planned date")).toBeTruthy();
  });

  it("only offers server-approved compatible manual match candidates", async () => {
    const loadCandidates = vi.fn(async () => ({
      data: {
        candidates: [{
          manualLogId: "log-1",
          manualBlockId: "run-1",
          logDate: "2026-09-14",
          label: "Run",
          distanceM: 5000,
          durationSec: 1500,
          dateOffsetDays: -1,
        }],
      },
      error: null,
    }));
    const confirmMatch = vi.fn(async () => ({ data: { matched: true }, error: null }));
    const loadData = vi
      .fn()
      .mockResolvedValueOnce({ data: evidenceData(), error: null })
      .mockResolvedValue({ data: evidenceData({ linked: true, matchMethod: "manual" }), error: null });
    const api = emptyApi({
      loadVerifiedActivityData: loadData,
      loadManualMatchCandidates: loadCandidates,
      confirmManualVerifiedMatch: confirmMatch,
    });

    render(<VerifiedActivityEvidenceSection profileId="paul" profileName="Paul" api={api} />);
    fireEvent.click(await screen.findByRole("button", { name: /Not linked/i }));
    fireEvent.click(screen.getByRole("button", { name: "Find matching Workout Tracker activity" }));
    await waitFor(() => expect(loadCandidates).toHaveBeenCalledWith("paul", "verified-1"));
    fireEvent.click(await screen.findByRole("button", { name: /Run.*2026-09-14/i }));
    await waitFor(() => expect(confirmMatch).toHaveBeenCalledWith("paul", "verified-1", {
      manualLogId: "log-1",
      manualBlockId: "run-1",
    }));
  });

  it("hides ignored activities from the normal list but lets the athlete restore them", async () => {
    const restore = vi.fn(async () => ({ data: {}, error: null }));
    const api = emptyApi({
      loadVerifiedActivityData: vi.fn(async () => ({ data: evidenceData({ ignored: true }), error: null })),
      setVerifiedActivityIgnored: restore,
    });
    render(<VerifiedActivityEvidenceSection profileId="paul" profileName="Paul" api={api} />);
    const summary = await screen.findByText("1 ignored external activity");
    fireEvent.click(summary);
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    await waitFor(() => expect(restore).toHaveBeenCalledWith("paul", "verified-1", false));
  });

  it("offers overlapping Workout Tracker strength blocks as one physical strength session", () => {
    const grouped = groupManualMatchCandidates([
      {
        manualLogId: "log-1",
        manualBlockId: "Mon_main",
        logDate: "2026-09-14",
        label: "Legs and Chest",
        activityType: "strength",
        startedAt: "2026-09-15T18:55:24.886Z",
        completedAt: "2026-09-15T19:15:35.108Z",
        durationSec: 1210,
        score: 1,
      },
      {
        manualLogId: "log-1",
        manualBlockId: "extra-situps",
        logDate: "2026-09-14",
        label: "Strength",
        activityType: "strength",
        startedAt: "2026-09-15T19:11:03.817Z",
        completedAt: "2026-09-15T19:15:35.108Z",
        durationSec: 271,
        score: 0.91,
      },
    ]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0].manualBlockId).toBe("Mon_main");
    expect(grouped[0].displayLabel).toBe("Strength session · 2 Workout Tracker blocks");
    expect(grouped[0].groupedCount).toBe(2);
    expect(grouped[0].durationSec).toBeGreaterThan(1200);
  });

  it("does not merge separate strength sessions just because they share a Workout Tracker log", () => {
    const grouped = groupManualMatchCandidates([
      { manualLogId: "log-1", manualBlockId: "a", activityType: "strength", startedAt: "2026-09-15T18:00:00Z", completedAt: "2026-09-15T18:20:00Z", score: 0.9 },
      { manualLogId: "log-1", manualBlockId: "b", activityType: "strength", startedAt: "2026-09-15T20:00:00Z", completedAt: "2026-09-15T20:20:00Z", score: 0.8 },
    ]);

    expect(grouped).toHaveLength(2);
    expect(grouped.every((candidate) => !candidate.groupedCount)).toBe(true);
  });
});
