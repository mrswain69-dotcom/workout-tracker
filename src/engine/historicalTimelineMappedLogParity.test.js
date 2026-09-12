import { describe, expect, it } from "vitest";
import { buildWorkoutHistoryEvents } from "./historicalTimelineEventEngine.js";

const payload = {
  blocks: [
    {
      id: "duration-1",
      typeId: "duration",
      label: "Football training",
      duration: { minutes: 30 },
      loggedAt: "2026-01-05T17:00:00.000Z",
    },
  ],
};

describe("Historical Timeline mapped live-log parity", () => {
  it("treats App mapped { log } rows the same as raw Supabase { log_json } rows", () => {
    const raw = buildWorkoutHistoryEvents(
      [
        {
          id: "log-1",
          profile_id: "p1",
          date_ymd: "2026-01-05",
          log_json: payload,
        },
      ],
      { profileId: "p1", birthDate: "2012-06-15" }
    );

    const mapped = buildWorkoutHistoryEvents(
      [
        {
          id: "log-1",
          profile_id: "p1",
          date_ymd: "2026-01-05",
          log: payload,
        },
      ],
      { profileId: "p1", birthDate: "2012-06-15" }
    );

    expect(mapped).toEqual(raw);
    expect(mapped).toHaveLength(1);
    expect(mapped[0]).toMatchObject({
      eventType: "training_day",
      date: "2026-01-05",
      age: 13,
      evidence: {
        recordingModel: "block_log",
        duration: [
          {
            blockId: "duration-1",
            label: "Football training",
            minutes: 30,
          },
        ],
      },
    });
  });
});
