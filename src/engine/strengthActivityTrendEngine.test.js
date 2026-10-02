import { describe, expect, it } from "vitest";
import { buildStrengthActivityTrend } from "./strengthActivityTrendEngine.js";

describe("buildStrengthActivityTrend", () => {
  it("compares equal rolling windows rather than partial and full calendar months", () => {
    const trend = buildStrengthActivityTrend(
      new Map([
        ["2026-10-01", 12],
        ["2026-09-20", 8],
        ["2026-09-04", 10],
      ]),
      "2026-10-02"
    );

    expect(trend.currentSets).toBe(20);
    expect(trend.previousSets).toBe(10);
    expect(trend.percentageChange).toBe(100);
  });

  it("does not describe no recent strength activity as a minus one hundred percent trend", () => {
    const trend = buildStrengthActivityTrend(
      new Map([["2026-09-01", 10]]),
      "2026-10-02"
    );

    expect(trend.state).toBe("no_current");
    expect(trend.percentageChange).toBeNull();
  });

  it("waits for a previous rolling window before calculating a percentage", () => {
    const trend = buildStrengthActivityTrend(
      new Map([["2026-10-01", 10]]),
      "2026-10-02"
    );

    expect(trend.state).toBe("no_baseline");
    expect(trend.percentageChange).toBeNull();
  });
});
