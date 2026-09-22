import { describe, expect, it } from "vitest";
import {
  computeActivityMinutesForDay,
  countCompletedSetsInBlock,
  estimateStrengthMinutes,
  formatActivityMinutes,
} from "./activityTimeEngine.js";

describe("activity time engine", () => {
  it("formats fractional minutes as minutes and seconds", () => {
    expect(formatActivityMinutes(17.466666666666665)).toBe("17m 28s");
    expect(formatActivityMinutes(17)).toBe("17 min");
    expect(formatActivityMinutes(0.5)).toBe("30s");
    expect(formatActivityMinutes(null)).toBe("—");
  });

  it("estimates strength time from work plus rests between sets", () => {
    expect(estimateStrengthMinutes(1, 60)).toBe(0.5);
    expect(estimateStrengthMinutes(3, 60)).toBe(3.5);
    expect(estimateStrengthMinutes(0, 60)).toBe(0);
  });

  it("counts completed strength sets without relying on App-local helpers", () => {
    expect(
      countCompletedSetsInBlock({
        sets: {
          squat: [{ reps: "10" }, { reps: "10" }],
          plank: [{ timeSeconds: "20" }, {}],
        },
      })
    ).toBe(3);
  });

  it("adds completed Session duration to the rest of the day's activity time", () => {
    const minutes = computeActivityMinutesForDay({
      meta: { restSec: 60, dayManualMin: "" },
      blocks: [
        {
          typeId: "strength",
          sets: { squat: [{ reps: "10" }] },
          duration: { minutes: "" },
        },
        {
          typeId: "session",
          session: {
            completed: true,
            actualDurationSec: 1048,
            plannedDurationSec: 900,
            movements: [],
          },
        },
        {
          typeId: "tasks",
          tasksDone: { read: true },
        },
      ],
    });

    expect(minutes).toBeCloseTo(17.9666666667, 5);
    expect(formatActivityMinutes(minutes)).toBe("17m 58s");
  });

  it("never counts task time as training activity time", () => {
    expect(
      computeActivityMinutesForDay({
        blocks: [{ typeId: "tasks", tasksDone: { read: true } }],
      })
    ).toBeNull();
  });
});
