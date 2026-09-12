const PROVIDERS = new Set([
  "garmin",
  "strava",
  "apple_health",
  "health_connect",
  "google_fit_legacy",
]);

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function finiteOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function nonNegativeOrNull(value) {
  const number = finiteOrNull(value);
  return number !== null && number >= 0 ? number : null;
}

function positiveOrNull(value) {
  const number = finiteOrNull(value);
  return number !== null && number > 0 ? number : null;
}

function validIso(value) {
  const text = cleanText(value);
  if (!text) return "";
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

export const VERIFIED_ACTIVITY_PROVIDERS = Object.freeze([...PROVIDERS]);

export const VERIFIED_ACTIVITY_AUTHORITY = Object.freeze({
  evidenceAuthority: "external_observation",
  manualLogAuthority: "unchanged",
  xpAuthority: "none",
  improvementAuthority: "compatible_metrics_only",
  consistencyAuthority: "future_match_only",
});

export const VERIFICATION_REWARD_POLICY = Object.freeze({
  policy: "verification_bonus_not_activated",
  multiplier: 1,
  xpDelta: 0,
  eligible: false,
});

export function isSupportedVerifiedActivityProvider(provider) {
  return PROVIDERS.has(cleanText(provider).toLowerCase());
}

export function normalizeExternalActivityObservation(input = {}) {
  const provider = cleanText(input.provider).toLowerCase();
  const providerActivityId = cleanText(input.providerActivityId);
  const profileId = cleanText(input.profileId);
  const startedAt = validIso(input.startedAt);

  if (!isSupportedVerifiedActivityProvider(provider)) {
    return { value: null, error: new Error("Unsupported verification provider.") };
  }
  if (!providerActivityId) {
    return { value: null, error: new Error("Provider activity ID is required.") };
  }
  if (!profileId) {
    return { value: null, error: new Error("Athlete profile is required.") };
  }
  if (!startedAt) {
    return { value: null, error: new Error("Activity start time is required.") };
  }

  const sourceCreatedAt = validIso(input.sourceCreatedAt) || null;
  const sourceUpdatedAt = validIso(input.sourceUpdatedAt) || null;
  const sourceDeletedAt = validIso(input.sourceDeletedAt) || null;

  const metrics = {
    distanceM: nonNegativeOrNull(input.distanceM),
    elapsedDurationSec: nonNegativeOrNull(input.elapsedDurationSec),
    movingDurationSec: nonNegativeOrNull(input.movingDurationSec),
    averageHeartRateBpm: positiveOrNull(input.averageHeartRateBpm),
    maxHeartRateBpm: positiveOrNull(input.maxHeartRateBpm),
    elevationGainM: nonNegativeOrNull(input.elevationGainM),
    caloriesKcal: nonNegativeOrNull(input.caloriesKcal),
  };

  return {
    value: {
      id: `${provider}:${providerActivityId}`,
      provider,
      providerActivityId,
      providerAccountId: cleanText(input.providerAccountId) || null,
      profileId,
      startedAt,
      activityType: cleanText(input.activityType).toLowerCase() || "unknown",
      activityName: cleanText(input.activityName) || null,
      metrics,
      sourceCreatedAt,
      sourceUpdatedAt,
      sourceDeletedAt,
      verificationState: sourceDeletedAt ? "source_deleted" : "unmatched",
      authority: VERIFIED_ACTIVITY_AUTHORITY,
      reward: VERIFICATION_REWARD_POLICY,
    },
    error: null,
  };
}

export function buildVerifiedActivityIdentity({
  id,
  profileId,
  activityType = "unknown",
  startedAt,
  observationIds = [],
} = {}) {
  const cleanId = cleanText(id);
  const cleanProfileId = cleanText(profileId);
  const cleanStartedAt = validIso(startedAt);
  const uniqueObservationIds = [...new Set(
    (Array.isArray(observationIds) ? observationIds : [])
      .map(cleanText)
      .filter(Boolean)
  )].sort();

  if (!cleanId || !cleanProfileId || !cleanStartedAt) {
    return { value: null, error: new Error("Verified activity identity is incomplete.") };
  }
  if (!uniqueObservationIds.length) {
    return { value: null, error: new Error("At least one external observation is required.") };
  }

  return {
    value: {
      id: cleanId,
      profileId: cleanProfileId,
      startedAt: cleanStartedAt,
      activityType: cleanText(activityType).toLowerCase() || "unknown",
      observationIds: uniqueObservationIds,
      verified: true,
      authority: "derived_external_identity",
      reward: VERIFICATION_REWARD_POLICY,
    },
    error: null,
  };
}

export function buildVerificationLink({
  id,
  profileId,
  verifiedActivityId,
  manualLogId,
  matchMethod = "manual",
  matchConfidence = null,
} = {}) {
  const cleanId = cleanText(id);
  const cleanProfileId = cleanText(profileId);
  const cleanVerifiedActivityId = cleanText(verifiedActivityId);
  const cleanManualLogId = cleanText(manualLogId);

  if (!cleanId || !cleanProfileId || !cleanVerifiedActivityId || !cleanManualLogId) {
    return { value: null, error: new Error("Verification link is incomplete.") };
  }

  const confidence = finiteOrNull(matchConfidence);
  return {
    value: {
      id: cleanId,
      profileId: cleanProfileId,
      verifiedActivityId: cleanVerifiedActivityId,
      manualLogId: cleanManualLogId,
      linkType: "verification",
      matchMethod: cleanText(matchMethod).toLowerCase() || "manual",
      matchConfidence:
        confidence !== null && confidence >= 0 && confidence <= 1 ? confidence : null,
      reward: VERIFICATION_REWARD_POLICY,
      mutation: {
        manualLog: "none",
        externalObservation: "none",
      },
    },
    error: null,
  };
}
