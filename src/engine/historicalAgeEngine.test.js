import { describe, expect, it } from "vitest";
import {
  calculateAgeOnDate,
  historicalAgeChapter,
  isValidHistoricalDate,
  validateBirthDateForProfile,
} from "./historicalAgeEngine.js";

describe("historicalAgeEngine", () => {
  it("changes age on the actual birthday rather than at the calendar-year boundary", () => {
    expect(calculateAgeOnDate("2014-12-15", "2026-12-14")).toBe(11);
    expect(calculateAgeOnDate("2014-12-15", "2026-12-15")).toBe(12);
    expect(calculateAgeOnDate("2014-12-15", "2027-01-01")).toBe(12);
  });

  it("handles leap-day birthdays deterministically without inventing February 29 in non-leap years", () => {
    expect(calculateAgeOnDate("2012-02-29", "2025-02-28")).toBe(12);
    expect(calculateAgeOnDate("2012-02-29", "2025-03-01")).toBe(13);
    expect(calculateAgeOnDate("2012-02-29", "2028-02-29")).toBe(16);
  });

  it("fails closed for invalid dates and dates before birth", () => {
    expect(isValidHistoricalDate("2026-02-29")).toBe(false);
    expect(calculateAgeOnDate("2015-05-01", "2015-04-30")).toBeNull();
    expect(historicalAgeChapter(null, "2026-09-12")).toEqual({
      age: null,
      label: "Age timeline unavailable",
      available: false,
    });
  });

  it("accepts nullable birth dates but rejects future profile dates", () => {
    expect(validateBirthDateForProfile("", "2026-09-12")).toEqual({ value: null, error: null });
    expect(validateBirthDateForProfile("2014-12-15", "2026-09-12").value).toBe("2014-12-15");
    expect(validateBirthDateForProfile("2027-01-01", "2026-09-12").error?.message).toMatch(/future/i);
  });
});
