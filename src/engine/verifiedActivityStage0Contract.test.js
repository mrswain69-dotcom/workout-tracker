import { describe, expect, it } from "vitest";
import {
  VERIFIED_ACTIVITY_AUTHORITY,
  VERIFICATION_REWARD_POLICY,
  VERIFIED_ACTIVITY_PROVIDERS,
  buildVerificationLink,
  buildVerifiedActivityIdentity,
  normalizeExternalActivityObservation,
} from "./verifiedActivityEngine.js";

describe("Verification Integration Stage 0 contract", () => {
  it("uses one provider-neutral authority model", () => {
    expect(VERIFIED_ACTIVITY_PROVIDERS).toEqual([
      "garmin",
      "strava",
      "apple_health",
      "health_connect",
      "google_fit_legacy",
    ]);
    expect(VERIFIED_ACTIVITY_AUTHORITY).toEqual({
      evidenceAuthority: "external_observation",
      manualLogAuthority: "unchanged",
      xpAuthority: "none",
      improvementAuthority: "compatible_metrics_only",
      consistencyAuthority: "future_match_only",
    });
  });

  it("normalizes external evidence without manufacturing manual workout history", () => {
    const result = normalizeExternalActivityObservation({
      provider: "Garmin",
      providerActivityId: "a-123",
      providerAccountId: "account-1",
      profileId: "profile-1",
      startedAt: "2026-09-12T17:42:06+01:00",
      activityType: "run",
      activityName: "Evening Run",
      distanceM: 5240,
      elapsedDurationSec: 1518,
      averageHeartRateBpm: 148,
    });

    expect(result.error).toBeNull();
    expect(result.value).toMatchObject({
      id: "garmin:a-123",
      provider: "garmin",
      providerActivityId: "a-123",
      profileId: "profile-1",
      activityType: "run",
      verificationState: "unmatched",
      authority: VERIFIED_ACTIVITY_AUTHORITY,
      reward: VERIFICATION_REWARD_POLICY,
    });
    expect(result.value.metrics).toMatchObject({
      distanceM: 5240,
      elapsedDurationSec: 1518,
      averageHeartRateBpm: 148,
      maxHeartRateBpm: null,
    });
    expect(result.value).not.toHaveProperty("log_json");
    expect(result.value).not.toHaveProperty("log");
    expect(result.value).not.toHaveProperty("blocks");
    expect(result.value).not.toHaveProperty("entries");
    expect(result.value).not.toHaveProperty("xp");
  });

  it("keeps verification reward-neutral until a separate XP policy explicitly activates it", () => {
    expect(VERIFICATION_REWARD_POLICY).toEqual({
      policy: "verification_bonus_not_activated",
      multiplier: 1,
      xpDelta: 0,
      eligible: false,
    });

    const result = normalizeExternalActivityObservation({
      provider: "strava",
      providerActivityId: "s-1",
      profileId: "p1",
      startedAt: "2026-09-12T10:00:00Z",
      distanceM: 5000,
    });

    expect(result.value.reward.xpDelta).toBe(0);
    expect(result.value.reward.multiplier).toBe(1);
    expect(result.value.reward.eligible).toBe(false);
  });

  it("allows multiple provider observations to describe one physical verified activity", () => {
    const result = buildVerifiedActivityIdentity({
      id: "verified-1",
      profileId: "p1",
      activityType: "run",
      startedAt: "2026-09-12T10:00:00Z",
      observationIds: ["strava:s1", "garmin:g1", "strava:s1"],
    });

    expect(result.error).toBeNull();
    expect(result.value.observationIds).toEqual(["garmin:g1", "strava:s1"]);
    expect(result.value.verified).toBe(true);
    expect(result.value.reward.xpDelta).toBe(0);
  });

  it("builds a verification relationship without mutating either source authority", () => {
    const result = buildVerificationLink({
      id: "link-1",
      profileId: "p1",
      verifiedActivityId: "verified-1",
      manualLogId: "log-1",
      matchMethod: "automatic",
      matchConfidence: 0.98,
    });

    expect(result.error).toBeNull();
    expect(result.value).toMatchObject({
      linkType: "verification",
      verifiedActivityId: "verified-1",
      manualLogId: "log-1",
      matchMethod: "automatic",
      matchConfidence: 0.98,
      mutation: {
        manualLog: "none",
        externalObservation: "none",
      },
    });
  });

  it("does not fabricate missing provider metrics and marks provider deletions as source evidence changes", () => {
    const result = normalizeExternalActivityObservation({
      provider: "strava",
      providerActivityId: "deleted-1",
      profileId: "p1",
      startedAt: "2026-09-12T10:00:00Z",
      sourceDeletedAt: "2026-09-12T12:00:00Z",
    });

    expect(result.value.verificationState).toBe("source_deleted");
    expect(result.value.metrics).toEqual({
      distanceM: null,
      elapsedDurationSec: null,
      movingDurationSec: null,
      averageHeartRateBpm: null,
      maxHeartRateBpm: null,
      elevationGainM: null,
      caloriesKcal: null,
    });
  });
});
