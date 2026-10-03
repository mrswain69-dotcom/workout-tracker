import { describe, expect, it } from "vitest";
import { movementEntriesComplete } from "./movementEntryCompletion.js";

describe("required movement entries", () => {
  it("requires every visible field in every planned or added set", () => {
    const movement = { trackWeight: true, trackDuration: true };
    const set = { reps: "12", weight: "6", timeSeconds: "30" };
    expect(movementEntriesComplete(movement, [set, { reps: "1" }], 2)).toBe(false);
    expect(movementEntriesComplete(movement, [set, set], 2)).toBe(true);
    expect(movementEntriesComplete(movement, [set, set, {}], 2)).toBe(false);
    expect(movementEntriesComplete(movement, [set], 2)).toBe(false);
    expect(movementEntriesComplete(movement, [{ ...set, timeSeconds: "" }], 1)).toBe(false);
  });
  it("accepts explicit zero weight for bodyweight work but rejects missing or invalid values", () => {
    expect(movementEntriesComplete({ trackWeight: true }, [{ reps: "6", weight: "0" }], 1)).toBe(true);
    expect(movementEntriesComplete({}, [{ reps: "6" }], 1)).toBe(true);
    for (const reps of ["", " ", "0", "-1", "NaN"]) {
      expect(movementEntriesComplete({}, [{ reps }], 1)).toBe(false);
    }
  });
});
