import { describe, expect, it } from "vitest";
import {
  buildVerifiedCardioEvidence,
  classifyVerifiedCardioType,
  summariseVerifiedCardioEvidence,
} from "./verifiedCardioEvidenceEngine.js";

function baseData() {
  return {
    observations: [],
    verifiedActivities: [],
    observationLinks: [],
    manualLinks: [],
  };
}

describe("verifiedCardioEvidenceEngine", () => {
  it("classifies common endurance and team-sport provider activity types without treating strength as cardio", () => {
    expect(classifyVerifiedCardioType("Run")).toBe("run");
    expect(classifyVerifiedCardioType("TrailRun")).toBe("run");
    expect(classifyVerifiedCardioType("MountainBikeRide")).toBe("cycle");
    expect(classifyVerifiedCardioType("Swim")).toBe("swim");
    expect(classifyVerifiedCardioType("Soccer")).toBe("team_sport");
    expect(classifyVerifiedCardioType("WeightTraining")).toBe("unknown");
  });

  it("counts one canonical activity once even when Strava and Garmin both observed it", () => {
    const data = {
      ...baseData(),
      verifiedActivities: [
        {
          id: "v1",
          activity_type: "run",
          started_at: "2026-09-12T17:00:00.000Z",
          status: "active",
          identity_method: "automatic_dedup",
          identity_confidence: 0.96,
        },
      ],
      observations: [
        {
          id: "o1",
          provider: "strava",
          local_date_ymd: "2026-09-12",
          activity_type: "run",
          distance_m: 5000,
          moving_duration_sec: 1500,
          average_heart_rate_bpm: 148,
        },
        {
          id: "o2",
          provider: "garmin",
          local_date_ymd: "2026-09-12",
          activity_type: "run",
          distance_m: 5010,
          moving_duration_sec: 1502,
          average_heart_rate_bpm: 149,
        },
      ],
      observationLinks: [
        { verified_activity_id: "v1", observation_id: "o1" },
        { verified_activity_id: "v1", observation_id: "o2" },
      ],
    };

    const rows = buildVerifiedCardioEvidence(data);
    const summary = summariseVerifiedCardioEvidence(rows);

    expect(rows).toHaveLength(1);
    expect(rows[0].providers).toEqual(["garmin", "strava"]);
    expect(rows[0].multiSource).toBe(true);
    expect(summary.activityCount).toBe(1);
    expect(summary.multiSourceCount).toBe(1);
    expect(summary.rewardXp).toBe(0);
  });

  it("ignores deleted provider observations and disappears when no live evidence remains", () => {
    const data = {
      ...baseData(),
      verifiedActivities: [
        { id: "v1", activity_type: "run", started_at: "2026-09-12T17:00:00.000Z", status: "active" },
      ],
      observations: [
        {
          id: "o1",
          provider: "strava",
          local_date_ymd: "2026-09-12",
          activity_type: "run",
          distance_m: 5000,
          moving_duration_sec: 1500,
          source_deleted_at: "2026-09-13T08:00:00.000Z",
        },
      ],
      observationLinks: [{ verified_activity_id: "v1", observation_id: "o1" }],
    };

    expect(buildVerifiedCardioEvidence(data)).toEqual([]);
  });

  it("excludes a manually-created Strava activity from verified cardio evidence", () => {
    const data = {
      ...baseData(),
      verifiedActivities: [
        { id: "v1", activity_type: "run", started_at: "2026-09-12T17:00:00.000Z", status: "active" },
      ],
      observations: [
        {
          id: "o1",
          provider: "strava",
          local_date_ymd: "2026-09-12",
          activity_type: "run",
          distance_m: 5000,
          moving_duration_sec: 1500,
          source_manual_entry: true,
        },
      ],
      observationLinks: [{ verified_activity_id: "v1", observation_id: "o1" }],
    };

    expect(buildVerifiedCardioEvidence(data)).toEqual([]);
    expect(summariseVerifiedCardioEvidence(buildVerifiedCardioEvidence(data)).activityCount).toBe(0);
  });

  it("uses genuine direct-provider evidence when a canonical activity also contains a manual Strava observation", () => {
    const data = {
      ...baseData(),
      verifiedActivities: [
        {
          id: "v1",
          activity_type: "run",
          started_at: "2026-09-12T17:00:00.000Z",
          status: "active",
          identity_method: "automatic_dedup",
          identity_confidence: 0.95,
        },
      ],
      observations: [
        {
          id: "o-strava",
          provider: "strava",
          local_date_ymd: "2026-09-12",
          activity_type: "run",
          distance_m: 10000,
          moving_duration_sec: 2400,
          source_manual_entry: true,
        },
        {
          id: "o-garmin",
          provider: "garmin",
          local_date_ymd: "2026-09-12",
          activity_type: "run",
          distance_m: 5000,
          moving_duration_sec: 1500,
          average_heart_rate_bpm: 149,
          source_device_name: "Forerunner Test",
          source_external_id: "garmin-fit-123",
          source_manual_entry: false,
        },
      ],
      observationLinks: [
        { verified_activity_id: "v1", observation_id: "o-strava" },
        { verified_activity_id: "v1", observation_id: "o-garmin" },
      ],
    };

    const [row] = buildVerifiedCardioEvidence(data);
    expect(row.providers).toEqual(["garmin"]);
    expect(row.multiSource).toBe(false);
    expect(row.distanceKm).toBe(5);
    expect(row.durationMin).toBe(25);
    expect(row.averageHeartRateBpm).toBe(149);
    expect(row.excludedManualObservationCount).toBe(1);
    expect(row.verificationLevel).toBe("device_or_file");
    expect(row.sourceDeviceNames).toEqual(["Forerunner Test"]);
  });

  it("labels upload/device provenance separately from provider-recorded evidence", () => {
    const data = {
      ...baseData(),
      verifiedActivities: [
        { id: "v1", activity_type: "run", started_at: "2026-09-12T17:00:00.000Z", status: "active" },
        { id: "v2", activity_type: "run", started_at: "2026-09-13T17:00:00.000Z", status: "active" },
      ],
      observations: [
        {
          id: "o1",
          provider: "strava",
          local_date_ymd: "2026-09-12",
          activity_type: "run",
          distance_m: 5000,
          moving_duration_sec: 1500,
          source_manual_entry: false,
          source_device_name: "Apple Watch",
          source_upload_id: "123456",
        },
        {
          id: "o2",
          provider: "strava",
          local_date_ymd: "2026-09-13",
          activity_type: "run",
          distance_m: 3000,
          moving_duration_sec: 1000,
          source_manual_entry: false,
        },
      ],
      observationLinks: [
        { verified_activity_id: "v1", observation_id: "o1" },
        { verified_activity_id: "v2", observation_id: "o2" },
      ],
    };

    const rows = buildVerifiedCardioEvidence(data);
    const deviceRow = rows.find((row) => row.id === "v1");
    const providerRow = rows.find((row) => row.id === "v2");
    expect(deviceRow.verificationLevel).toBe("device_or_file");
    expect(deviceRow.sourceDeviceNames).toEqual(["Apple Watch"]);
    expect(providerRow.verificationLevel).toBe("provider_recorded");
    expect(providerRow.sourceDeviceNames).toEqual([]);
  });

  it("derives cardio display metrics from genuine provider evidence while retaining evidence-only authority", () => {
    const data = {
      ...baseData(),
      verifiedActivities: [
        { id: "v1", activity_type: "run", started_at: "2026-09-12T17:00:00.000Z", status: "active" },
      ],
      observations: [
        {
          id: "o1",
          provider: "strava",
          local_date_ymd: "2026-09-12",
          activity_type: "run",
          distance_m: 5000,
          moving_duration_sec: 1500,
          average_heart_rate_bpm: 148,
          max_heart_rate_bpm: 164,
        },
      ],
      observationLinks: [{ verified_activity_id: "v1", observation_id: "o1" }],
      manualLinks: [
        {
          verified_activity_id: "v1",
          manual_log_id: "log1",
          manual_block_id: "run1",
        },
      ],
    };

    const [row] = buildVerifiedCardioEvidence(data);
    expect(row.distanceKm).toBe(5);
    expect(row.durationMin).toBe(25);
    expect(row.averageSpeedKmh).toBe(12);
    expect(row.paceMinPerKm).toBe(5);
    expect(row.averageHeartRateBpm).toBe(148);
    expect(row.maxHeartRateBpm).toBe(164);
    expect(row.matchedManual).toBe(true);
    expect(row.verificationEligible).toBe(true);
    expect(row.verificationLevel).toBe("provider_recorded");
    expect(row.authority).toBe("verified_evidence_only");
    expect(row.rewardXp).toBe(0);
  });

  it("summarises only the requested historical range without creating PB or improvement fields", () => {
    const rows = [
      {
        id: "v2",
        date: "2026-09-12",
        distanceKm: 5,
        durationMin: 25,
        averageHeartRateBpm: 148,
        providers: ["strava"],
        matchedManual: true,
        multiSource: false,
      },
      {
        id: "v1",
        date: "2025-09-12",
        distanceKm: 3,
        durationMin: 18,
        averageHeartRateBpm: null,
        providers: ["strava"],
        matchedManual: false,
        multiSource: false,
      },
    ];

    const summary = summariseVerifiedCardioEvidence(rows, {
      startDate: "2026-01-01",
      endDate: "2026-12-31",
    });

    expect(summary.activityCount).toBe(1);
    expect(summary.totalDistanceKm).toBe(5);
    expect(summary.totalDurationMin).toBe(25);
    expect(summary.matchedManualCount).toBe(1);
    expect(summary).not.toHaveProperty("personalBest");
    expect(summary).not.toHaveProperty("improvement");
    expect(summary.authority).toBe("verified_evidence_only");
  });
});
