import { describe, expect, it } from "vitest";
import {
  buildManualVerificationCandidates,
  buildVerifiedActivityGroups,
  canonicalActivityFamily,
  findManualVerificationMatch,
  scoreProviderObservationPair,
} from "./verificationMatchingEngine.js";

function observation(overrides = {}) {
  return {
    id: overrides.id || "obs-garmin",
    profile_id: "p1",
    provider: "garmin",
    provider_activity_id: overrides.provider_activity_id || "g1",
    started_at: "2026-09-12T09:00:00.000Z",
    local_date_ymd: "2026-09-12",
    source_timezone: "Europe/London",
    activity_type: "run",
    distance_m: 5000,
    moving_duration_sec: 1500,
    elapsed_duration_sec: 1550,
    source_deleted_at: null,
    ...overrides,
  };
}

describe("Verification matching engine", () => {
  it("normalizes activity families without making unlike sports compatible", () => {
    expect(canonicalActivityFamily("TrailRun")).toBe("run");
    expect(canonicalActivityFamily("MountainBikeRide")).toBe("cycle");
    expect(canonicalActivityFamily("Soccer")).toBe("football");
    expect(canonicalActivityFamily("Weight Training")).toBe("strength");
  });

  it("scores a Garmin and Strava representation of the same physical run highly", () => {
    const garmin = observation();
    const strava = observation({
      id: "obs-strava",
      provider: "strava",
      provider_activity_id: "s1",
      started_at: "2026-09-12T09:00:20.000Z",
      activity_type: "Run",
      distance_m: 5020,
      moving_duration_sec: 1490,
    });

    expect(scoreProviderObservationPair(garmin, strava)).toBe(1);
  });

  it("never auto-deduplicates two different activities from the same provider", () => {
    const first = observation({ id: "g1", provider_activity_id: "1" });
    const second = observation({ id: "g2", provider_activity_id: "2", started_at: "2026-09-12T09:00:15.000Z" });
    expect(scoreProviderObservationPair(first, second)).toBe(0);
  });

  it("refuses clearly incompatible sports and activities that are too far apart", () => {
    const run = observation();
    const ride = observation({
      id: "s-ride",
      provider: "strava",
      provider_activity_id: "ride",
      activity_type: "Ride",
    });
    const laterRun = observation({
      id: "s-late",
      provider: "strava",
      provider_activity_id: "late",
      started_at: "2026-09-12T09:30:00.000Z",
    });

    expect(scoreProviderObservationPair(run, ride)).toBe(0);
    expect(scoreProviderObservationPair(run, laterRun)).toBe(0);
  });

  it("does not trust Strava's obscured midnight timestamp enough to auto-merge on metrics alone", () => {
    const garmin = observation({ started_at: "2026-09-12T00:00:00.000Z" });
    const strava = observation({
      id: "s-hidden",
      provider: "strava",
      provider_activity_id: "hidden",
      started_at: "2026-09-12T00:00:01.000Z",
    });

    expect(scoreProviderObservationPair(garmin, strava)).toBe(0.6);
    const groups = buildVerifiedActivityGroups([garmin, strava]);
    expect(groups).toHaveLength(2);
  });

  it("builds deterministic provider groups regardless of input order and ignores deleted evidence", () => {
    const garmin = observation();
    const strava = observation({
      id: "obs-strava",
      provider: "strava",
      provider_activity_id: "s1",
      started_at: "2026-09-12T09:00:30.000Z",
      distance_m: 5030,
      moving_duration_sec: 1510,
    });
    const separate = observation({
      id: "obs-separate",
      provider: "strava",
      provider_activity_id: "s2",
      started_at: "2026-09-12T13:00:00.000Z",
      distance_m: 8000,
      moving_duration_sec: 2600,
    });
    const deleted = observation({
      id: "obs-deleted",
      provider: "strava",
      provider_activity_id: "deleted",
      source_deleted_at: "2026-09-12T14:00:00Z",
    });

    const forward = buildVerifiedActivityGroups([garmin, strava, separate, deleted]);
    const reverse = buildVerifiedActivityGroups([deleted, separate, strava, garmin]);

    expect(forward).toEqual(reverse);
    expect(forward).toHaveLength(2);
    const merged = forward.find((group) => group.observationIds.length === 2);
    expect(merged).toMatchObject({
      identityMethod: "automatic_dedup",
      identityConfidence: 1,
      observationIds: ["obs-garmin", "obs-strava"],
    });
    expect(merged.summary.providers).toEqual(["garmin", "strava"]);
  });

  it("extracts objective manual cardio candidates without rewriting the workout record", () => {
    const logs = [{
      id: "log-1",
      profile_id: "p1",
      date_ymd: "2026-09-12",
      log_json: {
        blocks: [{
          id: "run-block",
          typeId: "cardio",
          cardioType: "run",
          cardio: { distanceKm: 5, durationMin: 25 },
        }],
      },
    }];
    const before = JSON.stringify(logs);
    const candidates = buildManualVerificationCandidates(logs, { profileId: "p1" });

    expect(candidates).toEqual([{
      id: "log-1:run-block:cardio:0",
      profileId: "p1",
      manualLogId: "log-1",
      manualBlockId: "run-block",
      dateYmd: "2026-09-12",
      kind: "cardio",
      activityType: "run",
      distanceM: 5000,
      durationSec: 1500,
    }]);
    expect(JSON.stringify(logs)).toBe(before);
  });

  it("matches one verified physical activity to one strong manual cardio candidate", () => {
    const group = buildVerifiedActivityGroups([
      observation(),
      observation({
        id: "obs-strava",
        provider: "strava",
        provider_activity_id: "s1",
        started_at: "2026-09-12T09:00:20.000Z",
        distance_m: 5020,
        moving_duration_sec: 1490,
      }),
    ])[0];
    const candidates = [{
      id: "log-1:run",
      profileId: "p1",
      manualLogId: "log-1",
      manualBlockId: "run",
      dateYmd: "2026-09-12",
      activityType: "run",
      distanceM: 5000,
      durationSec: 1500,
    }];

    expect(findManualVerificationMatch(group, candidates)).toMatchObject({
      state: "matched",
      confidence: 1,
      candidate: { manualLogId: "log-1", manualBlockId: "run" },
    });
  });

  it("refuses an automatic manual link when two candidates are effectively tied", () => {
    const group = buildVerifiedActivityGroups([observation()])[0];
    const candidate = {
      profileId: "p1",
      manualLogId: "log-1",
      dateYmd: "2026-09-12",
      activityType: "run",
      distanceM: 5000,
      durationSec: 1500,
    };
    const result = findManualVerificationMatch(group, [
      { ...candidate, id: "a", manualBlockId: "a" },
      { ...candidate, id: "b", manualBlockId: "b" },
    ]);

    expect(result.state).toBe("ambiguous");
    expect(result.candidate).toBeNull();
    expect(result.alternatives).toHaveLength(2);
  });
});
