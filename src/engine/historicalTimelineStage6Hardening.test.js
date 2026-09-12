import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ageChapterDateRange, calculateAgeOnDate } from "./historicalAgeEngine.js";
import {
  buildHistoricalTimelineEvents,
  buildWorkoutHistoryEvents,
  sortHistoricalTimelineEvents,
} from "./historicalTimelineEventEngine.js";

describe("Historical Timeline Stage 6 hardening", () => {
  it("reflects corrections and deletions from current source truth instead of retaining stale events", () => {
    const original = {
      id: "log-1",
      profile_id: "p1",
      date_ymd: "2026-01-10",
      log_json: { entries: { squat: [{ reps: 8, weight: 20 }] } },
    };
    const corrected = {
      ...original,
      log_json: { entries: { squat: [{ reps: 10, weight: 22.5 }] } },
    };

    const before = buildWorkoutHistoryEvents([original], { profileId: "p1" });
    const afterCorrection = buildWorkoutHistoryEvents([corrected], { profileId: "p1" });
    const afterDeletion = buildWorkoutHistoryEvents([], { profileId: "p1" });

    expect(before[0].evidence.strength[0].sets[0]).toMatchObject({ reps: 8, weight: 20 });
    expect(afterCorrection[0].evidence.strength[0].sets[0]).toMatchObject({ reps: 10, weight: 22.5 });
    expect(afterDeletion).toEqual([]);
  });

  it("uses stable same-day source ordering and stable ids regardless of input order", () => {
    const fixtures = [
      { id: "knowledge:z", date: "2026-06-01", sourceType: "knowledge" },
      { id: "assessment:a", date: "2026-06-01", sourceType: "assessment" },
      { id: "workout:b", date: "2026-06-01", sourceType: "workout" },
      { id: "workout:a", date: "2026-06-01", sourceType: "workout" },
      { id: "group:a", date: "2026-06-01", sourceType: "group_award" },
    ];

    const forward = sortHistoricalTimelineEvents(fixtures).map((event) => event.id);
    const reverse = sortHistoricalTimelineEvents(fixtures.slice().reverse()).map((event) => event.id);

    expect(forward).toEqual(["workout:a", "workout:b", "assessment:a", "group:a", "knowledge:z"]);
    expect(reverse).toEqual(forward);
  });

  it("keeps birthday chapter boundaries exact", () => {
    expect(calculateAgeOnDate("2014-12-15", "2026-12-14")).toBe(11);
    expect(calculateAgeOnDate("2014-12-15", "2026-12-15")).toBe(12);
    expect(ageChapterDateRange("2014-12-15", 11)).toEqual({
      age: 11,
      startDate: "2025-12-15",
      endDate: "2026-12-14",
    });
  });

  it("keeps the locked leap-day rule across non-leap and leap years", () => {
    expect(calculateAgeOnDate("2012-02-29", "2025-02-28")).toBe(12);
    expect(calculateAgeOnDate("2012-02-29", "2025-03-01")).toBe(13);
    expect(calculateAgeOnDate("2012-02-29", "2028-02-28")).toBe(15);
    expect(calculateAgeOnDate("2012-02-29", "2028-02-29")).toBe(16);
    expect(ageChapterDateRange("2012-02-29", 13)).toEqual({
      age: 13,
      startDate: "2025-03-01",
      endDate: "2026-02-28",
    });
  });

  it("coexists with legacy, block and structured Session history without rewriting formats", () => {
    const events = buildHistoricalTimelineEvents({
      profileId: "p1",
      logs: [
        {
          id: "legacy",
          profile_id: "p1",
          date_ymd: "2026-01-01",
          log_json: { entries: { press: [{ reps: 12 }] } },
        },
        {
          id: "block",
          profile_id: "p1",
          date_ymd: "2026-01-02",
          log_json: {
            blocks: [{ id: "run", typeId: "cardio", cardioType: "run", cardio: { distanceKm: 5, durationMin: 25 } }],
          },
        },
        {
          id: "session",
          profile_id: "p1",
          date_ymd: "2026-01-03",
          log_json: {
            blocks: [{
              id: "s1",
              typeId: "session",
              session: { templateId: "t1", name: "Ball Mastery", completed: true, actualDurationSec: 600, movements: [] },
            }],
          },
        },
      ],
    });

    const trainingDays = events.filter((event) => event.eventType === "training_day");
    expect(trainingDays.map((event) => event.evidence.recordingModel)).toEqual([
      "legacy",
      "block_log",
      "structured_session",
    ]);
    expect(events.some((event) => event.eventType === "session_completed")).toBe(true);
  });

  it("keeps privacy and dense-mobile safeguards locked in source", () => {
    const fn = readFileSync("supabase/functions/historical-timeline-data/index.ts", "utf8");
    const css = readFileSync("src/components/progress/PerformanceAutobiography.css", "utf8");

    expect(fn).toContain('.from("profiles")');
    expect(fn).toContain('.eq("id", profileId)');
    expect(fn).toContain('.eq("family_id", ownedProfile.family_id)');
    expect(fn).not.toContain("service_role");
    expect(css).toContain("@media (max-width: 380px)");
    expect(css).toContain("grid-template-columns: 1fr;");
  });
});
