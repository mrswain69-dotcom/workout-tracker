import { describe, expect, it } from "vitest";
import { buildWorkoutStreakSeries } from "./workoutStreakEngine.js";

const complete = (log) => !!log?.complete;
const block = (id = "training") => ({ id, typeId: "duration" });

function snapshot(effectiveDate, schedule) {
  return { effective_date: effectiveDate, schedule_json: schedule };
}

describe("workout streak schedule rules", () => {
  it("preserves legacy calendar streaks when dated schedule truth is unavailable", () => {
    const result = buildWorkoutStreakSeries({
      records: [
        { date_ymd: "2026-09-21", log: { complete: true } },
        { date_ymd: "2026-09-23", log: { complete: true } },
      ],
      todayYmd: "2026-09-23",
      fallbackPlan: { blocksByWeekday: { Mon: [block("mon")], Wed: [block("wed")] } },
      isDayComplete: complete,
    });

    expect(result.currentDays).toBe(1);
    expect(result.streakByDate["2026-09-23"]).toBe(1);
  });

  it("skips blank days without adding or breaking the streak", () => {
    const result = buildWorkoutStreakSeries({
      records: [
        { date_ymd: "2026-09-21", log: { complete: true } },
        { date_ymd: "2026-09-23", log: { complete: true } },
      ],
      todayYmd: "2026-09-23",
      scheduleSnapshots: [snapshot("2026-09-21", {
        Mon: [block("mon")], Tue: [], Wed: [block("wed")], Thu: [], Fri: [], Sat: [], Sun: [],
      })],
      isDayComplete: complete,
    });

    expect(result.currentDays).toBe(2);
    expect(result.streakByDate).toEqual({ "2026-09-21": 1, "2026-09-23": 2 });
  });

  it("breaks on a missed planned day", () => {
    const result = buildWorkoutStreakSeries({
      records: [
        { date_ymd: "2026-09-21", log: { complete: true } },
        { date_ymd: "2026-09-23", log: { complete: true } },
      ],
      todayYmd: "2026-09-23",
      scheduleSnapshots: [snapshot("2026-09-21", {
        Mon: [block("mon")], Tue: [block("tue")], Wed: [block("wed")], Thu: [], Fri: [], Sat: [], Sun: [],
      })],
      isDayComplete: complete,
    });

    expect(result.currentDays).toBe(1);
    expect(result.streakByDate["2026-09-23"]).toBe(1);
  });

  it("counts a saver and activity completed on an otherwise blank day", () => {
    const result = buildWorkoutStreakSeries({
      records: [
        { date_ymd: "2026-09-21", log: { complete: true } },
        { date_ymd: "2026-09-22", log: { meta: { streakSaved: true } } },
        { date_ymd: "2026-09-24", log: { complete: true } },
      ],
      todayYmd: "2026-09-24",
      scheduleSnapshots: [snapshot("2026-09-21", {
        Mon: [block("mon")], Tue: [block("tue")], Wed: [], Thu: [], Fri: [], Sat: [], Sun: [],
      })],
      isDayComplete: complete,
    });

    expect(result.currentDays).toBe(3);
  });

  it("does not reset an incomplete planned day until it has passed", () => {
    const result = buildWorkoutStreakSeries({
      records: [{ date_ymd: "2026-09-21", log: { complete: true } }],
      todayYmd: "2026-09-22",
      scheduleSnapshots: [snapshot("2026-09-21", {
        Mon: [block("mon")], Tue: [block("tue")], Wed: [], Thu: [], Fri: [], Sat: [], Sun: [],
      })],
      isDayComplete: complete,
    });

    expect(result.currentDays).toBe(1);
  });
});
