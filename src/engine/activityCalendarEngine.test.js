import { describe, expect, it } from "vitest";
import {
  buildActivityCalendarDay,
  buildRecentActivityCalendarDays,
} from "./activityCalendarEngine.js";

describe("activityCalendarEngine", () => {
  it("uses the requested status priority and colours", () => {
    expect(buildActivityCalendarDay({
      dateYmd: "2026-10-01",
      log: { meta: { streakSaved: true }, blocks: [{ typeId: "cardio", cancelled: true }] },
      completed: false,
    }).kind).toBe("streak-saver");

    expect(buildActivityCalendarDay({
      dateYmd: "2026-10-02",
      recoveryMode: "illness",
      completed: true,
    })).toMatchObject({ kind: "illness", icon: "✓", completed: true });

    expect(buildActivityCalendarDay({
      dateYmd: "2026-10-03",
      log: { blocks: [{ typeId: "strength", cancelled: true }, { typeId: "cardio", cancelled: true }] },
    }).kind).toBe("cancelled");

    expect(buildActivityCalendarDay({
      dateYmd: "2026-10-04",
      hasPlanSchedule: true,
      plannedBlocks: [],
    })).toMatchObject({ kind: "none", icon: "–", completed: false });

    expect(buildActivityCalendarDay({
      dateYmd: "2026-10-04",
      log: { blocks: [{ typeId: "recovery", recoveryDone: true }] },
      completed: true,
    })).toMatchObject({ kind: "rest", icon: "○", completed: true });

    expect(buildActivityCalendarDay({
      dateYmd: "2026-10-05",
      plannedBlocks: [{ typeId: "strength" }],
      hasPlanSchedule: true,
      completed: true,
    }).kind).toBe("complete");
  });

  it("keeps empty or incomplete days colourless", () => {
    expect(buildActivityCalendarDay({
      dateYmd: "2026-10-05",
      plannedBlocks: [{ typeId: "strength" }],
      hasPlanSchedule: true,
      completed: false,
    }).kind).toBe("none");
  });

  it("builds an ordered history that always ends today", () => {
    const days = buildRecentActivityCalendarDays("2026-10-05", 7, (dateYmd) => ({ dateYmd }));
    expect(days).toHaveLength(7);
    expect(days[0].dateYmd).toBe("2026-09-29");
    expect(days.at(-1).dateYmd).toBe("2026-10-05");
  });

  it("shows recorded recovery blue even when it does not qualify as a completed streak day", () => {
    expect(buildActivityCalendarDay({
      dateYmd: "2026-10-04",
      log: { blocks: [{ typeId: "recovery", recoveryDone: true, recoveryMode: "light" }] },
      completed: false,
    })).toMatchObject({ kind: "rest", icon: "○", completed: false });
    expect(buildActivityCalendarDay({ log: { blocks: [{ typeId: "recovery" }] } }))
      .toMatchObject({ kind: "rest", icon: "○" });
    expect(buildActivityCalendarDay({ log: { blocks: [{ typeId: "recovery", cancelled: true }] } }).kind).toBe("cancelled");
    expect(buildActivityCalendarDay({ log: { blocks: [{ typeId: "recovery" }, { typeId: "strength" }] } }).kind).toBe("none");
  });
});
