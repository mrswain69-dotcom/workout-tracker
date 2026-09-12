import { describe, expect, it } from "vitest";
import {
  buildAssessmentHistoryEvents,
  buildGroupAwardHistoryEvents,
  buildHistoricalTimelineEvents,
  buildWorkoutHistoryEvents,
} from "./historicalTimelineEventEngine.js";

describe("historicalTimelineEventEngine", () => {
  it("does not turn an empty or cancelled planned block into historical performance", () => {
    const events = buildWorkoutHistoryEvents([
      {
        id: "log-empty",
        profile_id: "p1",
        date_ymd: "2026-09-01",
        log_json: {
          blocks: [
            {
              id: "planned",
              typeId: "strength",
              cancelled: true,
              movements: [{ id: "squat", name: "Squat" }],
              sets: {},
            },
          ],
        },
      },
    ]);
    expect(events).toEqual([]);
  });

  it("preserves legacy strength evidence without projecting a current movement name backwards", () => {
    const events = buildWorkoutHistoryEvents(
      [
        {
          id: "legacy-1",
          profile_id: "p1",
          date_ymd: "2026-01-10",
          log_json: {
            entries: {
              oldMovementId: [{ reps: "12", weight: "0", timeSeconds: "" }],
            },
          },
        },
      ],
      { profileId: "p1", birthDate: "2014-12-15" }
    );

    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("training_day");
    expect(events[0].age).toBe(11);
    expect(events[0].evidence.recordingModel).toBe("legacy");
    expect(events[0].evidence.strength[0]).toMatchObject({
      source: "legacy",
      movementId: "oldMovementId",
      name: "",
      sets: [{ reps: 12, weight: 0 }],
    });
  });

  it("uses frozen structured Session identity and emits both day and Session evidence", () => {
    const events = buildWorkoutHistoryEvents([
      {
        id: "log-session",
        profile_id: "p1",
        date_ymd: "2026-09-12",
        log_json: {
          blocks: [
            {
              id: "session-block",
              typeId: "session",
              sessionTemplateId: "template-1",
              session: {
                templateId: "template-1",
                displayCode: "A",
                name: "Close Control",
                version: 3,
                completed: true,
                actualDurationSec: 900,
                movements: [],
              },
            },
          ],
        },
      },
    ]);

    expect(events.map((event) => event.eventType)).toEqual(["training_day", "session_completed"]);
    expect(events[1].title).toBe("Close Control");
    expect(events[1].evidence).toMatchObject({
      templateId: "template-1",
      displayCode: "A",
      version: 3,
      completed: true,
      trainingMinutes: 15,
    });
  });

  it("deduplicates the legacy cardio mirror when the same block-level activity is present", () => {
    const events = buildWorkoutHistoryEvents([
      {
        id: "log-cardio",
        profile_id: "p1",
        date_ymd: "2026-08-29",
        log_json: {
          cardio: { distanceKm: "17.06", durationMin: "458", avgSpeedKmh: "2.23" },
          blocks: [
            {
              id: "ben-nevis",
              typeId: "cardio",
              label: "Climb",
              cardioType: "walk",
              cardio: { distanceKm: "17.06", durationMin: "458", avgSpeedKmh: "2.23" },
            },
          ],
        },
      },
    ]);

    expect(events).toHaveLength(1);
    expect(events[0].evidence.cardio).toHaveLength(1);
    expect(events[0].evidence.cardio[0]).toMatchObject({
      source: "block",
      blockId: "ben-nevis",
      cardioType: "walk",
      distanceKm: 17.06,
      durationMin: 458,
    });
  });

  it("creates Assessment evidence only from completed runs and counts only non-invalid result evidence as valid", () => {
    const events = buildAssessmentHistoryEvents(
      [
        {
          id: "run-complete",
          profile_id: "p1",
          assessment_template_id: "assessment-1",
          date_ymd: "2026-06-01",
          status: "completed",
          template_version: 2,
          template_snapshot: { name: "Football Benchmark" },
        },
        {
          id: "run-draft",
          profile_id: "p1",
          date_ymd: "2026-06-02",
          status: "in_progress",
        },
      ],
      [
        { id: "r1", assessment_run_id: "run-complete", is_valid: true },
        { id: "r2", assessment_run_id: "run-complete", is_valid: false },
      ],
      { profileId: "p1" }
    );

    expect(events).toHaveLength(1);
    expect(events[0].title).toBe("Football Benchmark");
    expect(events[0].evidence).toMatchObject({ resultCount: 2, validResultCount: 1, validResultIds: ["r1"] });
  });

  it("keeps only the athlete's supplied membership awards and uses frozen period end as the milestone date", () => {
    const events = buildGroupAwardHistoryEvents(
      [
        {
          id: "award-own",
          group_id: "g1",
          membership_id: "m-own",
          period_type: "season",
          period_start: "2026-07-01",
          period_end: "2026-08-25",
          award_type: "improvement",
          rank: 1,
          score_value: 8.4,
          score_unit: "percent",
        },
        {
          id: "award-other",
          group_id: "g1",
          membership_id: "m-other",
          period_type: "season",
          period_end: "2026-08-25",
          award_type: "xp",
          rank: 1,
        },
      ],
      { profileId: "p1", membershipIds: ["m-own"] }
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      date: "2026-08-25",
      eventType: "season_award",
      profileId: "p1",
    });
    expect(events[0].evidence).toMatchObject({
      membershipId: "m-own",
      awardType: "improvement",
      rank: 1,
    });
  });

  it("combines source families in deterministic date/source order", () => {
    const events = buildHistoricalTimelineEvents({
      profileId: "p1",
      logs: [
        {
          id: "log-1",
          profile_id: "p1",
          date_ymd: "2026-01-01",
          log_json: { entries: { move: [{ reps: 1 }] } },
        },
      ],
      assessmentRuns: [
        {
          id: "run-1",
          profile_id: "p1",
          date_ymd: "2026-01-01",
          status: "completed",
          template_snapshot: { name: "Benchmark" },
        },
      ],
    });

    expect(events.map((event) => event.sourceType)).toEqual(["workout", "assessment"]);
  });
});
