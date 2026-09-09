import { describe, expect, it } from "vitest";
import {
  canCalculatePercentageImprovement,
  compareAssessmentResults,
  isBetterAssessmentValue,
  normaliseAssessmentResult,
} from "./assessmentMetricEngine.js";

const TEST = {
  metric_type: "numeric",
  scoring_direction: "higher",
  result_strategy: "single",
  side_mode: "none",
  allow_negative: false,
  metric_config: { decimalPlaces: 1 },
};

describe("assessment metric missing-value regressions", () => {
  it("treats an empty object as a missing result, not a malformed numeric attempt", () => {
    const result = normaliseAssessmentResult(TEST, {});
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(["overall result is required."]);
  });

  it("never coerces null comparison input to zero", () => {
    expect(isBetterAssessmentValue(TEST, null, 10)).toBeNull();
    expect(isBetterAssessmentValue(TEST, 10, null)).toBeNull();
  });

  it("never calculates a percentage from missing values", () => {
    expect(canCalculatePercentageImprovement(TEST, null, 10)).toBe(false);
    expect(canCalculatePercentageImprovement(TEST, 10, null)).toBe(false);
  });

  it("marks a comparison unavailable when one result is missing", () => {
    const comparison = compareAssessmentResults(TEST, null, 10);
    expect(comparison.overall.status).toBe("unavailable");
    expect(comparison.overall.percentageImprovement).toBeNull();
  });

  it("does not coerce blank attempts/successes fields to entered zeroes", () => {
    const definition = {
      metric_type: "attempts_successes",
      scoring_direction: "higher",
      result_strategy: "single",
      side_mode: "none",
      metric_config: { comparisonMode: "successes" },
    };

    const blankSuccesses = normaliseAssessmentResult(definition, {
      overall: { results: [{ attempts: 10, successes: "" }] },
    });
    expect(blankSuccesses.valid).toBe(false);

    const realZero = normaliseAssessmentResult(definition, {
      overall: { results: [{ attempts: 10, successes: 0 }] },
    });
    expect(realZero.valid).toBe(true);
    expect(realZero.retainedResult).toEqual({ attempts: 10, successes: 0 });
  });
});
