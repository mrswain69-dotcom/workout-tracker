import { describe, expect, it } from "vitest";
import {
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
});
