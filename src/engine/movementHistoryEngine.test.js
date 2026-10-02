import { describe, expect, it } from "vitest";
import {
  extractComparableMovementSets,
  findLastComparableMovementSets,
  movementHistoryPoint,
  normaliseMovementHistoryName,
} from "./movementHistoryEngine.js";

function log(date, movement, sets) {
  return {
    date_ymd: date,
    log: {
      blocks: [{ movements: [movement], sets: { [movement.id]: sets } }],
    },
  };
}

describe("movement history matching", () => {
  it("matches one-day movements by a punctuation-insensitive name", () => {
    const current = { id: "planned-situps", name: "Sit-ups" };
    const extra = { id: "extra-situps", name: "Sit ups" };
    const sets = [{ reps: 30 }];

    expect(normaliseMovementHistoryName("Sit-ups")).toBe("situps");
    expect(extractComparableMovementSets(log("2026-09-20", extra, sets).log, current)).toEqual(sets);
  });

  it("uses the newest comparable named movement even when its ID changed", () => {
    const current = { id: "planned", name: "Situps" };
    const logs = [
      log("2026-06-01", { id: "planned", name: "Situps" }, [{ reps: 3 }]),
      log("2026-09-20", { id: "one-day-extra", name: "Sit-ups" }, [{ reps: 30 }]),
    ];

    expect(findLastComparableMovementSets(logs, current, "2026-10-02")).toEqual([{ reps: 30 }]);
  });

  it("plots the best set for each daily history point", () => {
    expect(movementHistoryPoint([{ reps: 30 }, { reps: 3 }, { reps: 24 }])).toEqual({
      reps: 30,
      weight: 0,
      timeSec: 0,
    });
  });
});
