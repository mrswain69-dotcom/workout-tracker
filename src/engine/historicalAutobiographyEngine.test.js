import { describe, expect, it } from "vitest";
import { buildHistoricalAutobiographyFoundation } from "./historicalAutobiographyEngine.js";

function durationLog(date, blockId = "planned") {
  return {
    profile_id: "p1",
    date_ymd: date,
    log: {
      blocks: [
        {
          id: blockId,
          typeId: "duration",
          loggedAt: `${date}T17:00:00.000Z`,
          duration: { minutes: 20 },
        },
      ],
    },
  };
}

function baseEvent(date, id = date) {
  return {
    id: `workout:${id}:training_day:${date}`,
    profileId: "p1",
    date,
    sourceType: "workout",
    sourceId: id,
    eventType: "training_day",
    title: "Training recorded",
    evidence: { duration: [{ minutes: 20 }] },
    evidenceState: "recorded",
  };
}

const fullWeekSchedule = {
  Mon: [{ id: "planned", typeId: "duration" }],
  Tue: [],
  Wed: [{ id: "planned", typeId: "duration" }],
  Thu: [],
  Fri: [],
  Sat: [],
  Sun: [],
};

describe("Historical Autobiography Stage 4 composition", () => {
  it("puts supported Consistency milestones into the correct age chapter", () => {
    const result = buildHistoricalAutobiographyFoundation({
      profileId: "p1",
      birthDate: "2012-06-15",
      referenceDate: "2026-01-11",
      events: [baseEvent("2026-01-05"), baseEvent("2026-01-07")],
      workoutLogs: [durationLog("2026-01-05"), durationLog("2026-01-07")],
      consistencySnapshots: [
        {
          profile_id: "p1",
          effective_date: "2026-01-05",
          schedule_json: fullWeekSchedule,
        },
      ],
    });

    expect(result.available).toBe(true);
    expect(result.chapters).toHaveLength(1);
    expect(result.chapters[0].age).toBe(13);
    expect(result.chapters[0].consistency.state).toBe("ready");
    expect(result.chapters[0].consistency.milestones).toHaveLength(1);
    expect(result.chapters[0].consistency.milestones[0].title).toBe(
      "Perfect consistency week"
    );
    expect(result.chapters[0].knowledge).toEqual({
      state: "not_available_yet",
      milestones: [],
    });
  });

  it("preserves frozen award types and gives them autobiography labels", () => {
    const result = buildHistoricalAutobiographyFoundation({
      profileId: "p1",
      birthDate: "2012-06-15",
      events: [
        baseEvent("2026-01-05"),
        {
          id: "group_award:a",
          profileId: "p1",
          date: "2026-01-10",
          sourceType: "group_award",
          sourceId: "a",
          eventType: "season_award",
          title: "Group progress award",
          evidence: { awardType: "season_consistency" },
          evidenceState: "recorded",
        },
      ],
    });

    expect(result.chapters[0].awards).toHaveLength(1);
    expect(result.chapters[0].awards[0].title).toBe(
      "Season Consistency Champion"
    );
    expect(result.chapters[0].awards[0].evidence.awardType).toBe(
      "season_consistency"
    );
  });

  it("keeps date history usable when birth_date is absent while age chapters stay unavailable", () => {
    const result = buildHistoricalAutobiographyFoundation({
      profileId: "p1",
      events: [baseEvent("2023-01-01"), baseEvent("2026-01-01")],
    });

    expect(result.available).toBe(false);
    expect(result.reason).toBe("birth_date_required");
    expect(result.chapters).toEqual([]);
    expect(result.events).toHaveLength(2);
    expect(result.careerSummary.available).toBe(true);
    expect(result.careerSummary.coverage.ageTimelineAvailable).toBe(false);
  });
});
