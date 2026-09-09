import { describe, expect, it } from "vitest";
import {
  calculatePercentageImprovement,
  canCalculatePercentageImprovement,
  compareAssessmentResults,
  formatAssessmentMetricValue,
  isBetterAssessmentValue,
  normaliseAssessmentMetricDefinition,
  normaliseAssessmentResult,
  validateAssessmentMetricDefinition,
  validateAssessmentResult,
} from "./assessmentMetricEngine.js";

function scalarTest(overrides = {}) {
  return {
    metric_type: "numeric",
    unit: "",
    scoring_direction: "higher",
    attempt_count: 1,
    result_strategy: "single",
    side_mode: "none",
    allow_negative: false,
    pb_eligible: true,
    metric_config: { decimalPlaces: 2 },
    ...overrides,
  };
}

describe("normaliseAssessmentMetricDefinition", () => {
  it("normalises the Stage 1 snake_case Test fields", () => {
    const definition = normaliseAssessmentMetricDefinition(
      scalarTest({
        metric_type: "time",
        unit: "s",
        scoring_direction: "lower",
        attempt_count: 3,
        result_strategy: "best",
        side_mode: "separate",
        allow_negative: true,
        pb_eligible: false,
      })
    );

    expect(definition).toMatchObject({
      metricType: "time",
      unit: "s",
      scoringDirection: "lower",
      attemptCount: 3,
      resultStrategy: "best",
      sideMode: "separate",
      allowNegative: true,
      pbEligible: false,
    });
  });

  it("falls back safely for unsupported enums", () => {
    const definition = normaliseAssessmentMetricDefinition({
      scoring_direction: "fastest-ish",
      result_strategy: "median",
      side_mode: "alternating",
      attempt_count: 0,
    });

    expect(definition.scoringDirection).toBe("higher");
    expect(definition.resultStrategy).toBe("single");
    expect(definition.sideMode).toBe("none");
    expect(definition.attemptCount).toBe(1);
  });

  it("normalises successes_attempts as the canonical attempts_successes metric", () => {
    expect(
      normaliseAssessmentMetricDefinition({ metric_type: "successes_attempts" })
        .metricType
    ).toBe("attempts_successes");
  });

  it("rejects average as a strategy for attempts/successes pairs", () => {
    const validation = validateAssessmentMetricDefinition({
      metric_type: "attempts_successes",
      result_strategy: "average",
    });

    expect(validation.valid).toBe(false);
    expect(validation.errors[0]).toMatch(/cannot use the average/i);
  });
});

describe("scalar attempt retention", () => {
  it("retains the first valid value for a single-result Test", () => {
    const result = normaliseAssessmentResult(
      scalarTest({ result_strategy: "single" }),
      { attempts: [7.126, 9.2] }
    );

    expect(result.valid).toBe(true);
    expect(result.retainedResult).toBe(7.13);
    expect(result.comparableValue).toBe(7.13);
  });

  it("retains the highest value when higher is better", () => {
    const result = normaliseAssessmentResult(
      scalarTest({ result_strategy: "best", scoring_direction: "higher" }),
      { attempts: [1.82, 1.91, 1.87] }
    );

    expect(result.retainedResult).toBe(1.91);
  });

  it("retains the lowest value when lower is better", () => {
    const result = normaliseAssessmentResult(
      scalarTest({
        metric_type: "time",
        unit: "s",
        result_strategy: "best",
        scoring_direction: "lower",
      }),
      { attempts: [1.82, 1.79, 1.87] }
    );

    expect(result.retainedResult).toBe(1.79);
    expect(result.displayValue).toBe("1.79 s");
  });

  it("calculates an arithmetic mean for average-result Tests", () => {
    const result = normaliseAssessmentResult(
      scalarTest({ result_strategy: "average", metric_config: { decimalPlaces: 1 } }),
      { attempts: [10, 11, 13] }
    );

    expect(result.retainedResult).toBe(11.3);
    expect(result.comparableValue).toBe(11.3);
  });

  it("accepts a scalar directly as a single attempt", () => {
    const result = normaliseAssessmentResult(scalarTest(), 14);
    expect(result.valid).toBe(true);
    expect(result.dimensions.overall.attempts).toEqual([14]);
    expect(result.retainedResult).toBe(14);
  });

  it("accepts a value bucket used by simple form controls", () => {
    const result = normaliseAssessmentResult(scalarTest(), { value: "12.345" });
    expect(result.retainedResult).toBe(12.35);
  });
});

describe("signed values and validation", () => {
  it("rejects negative values unless the Test explicitly allows them", () => {
    const result = normaliseAssessmentResult(scalarTest(), -4);
    expect(result.valid).toBe(false);
    expect(result.retainedResult).toBeNull();
    expect(result.errors[0]).toMatch(/not a valid result/i);
  });

  it("preserves signed values for metrics such as toe-touch flexibility", () => {
    const result = normaliseAssessmentResult(
      scalarTest({
        unit: "cm",
        allow_negative: true,
        metric_config: { decimalPlaces: 1 },
      }),
      -4.26
    );

    expect(result.valid).toBe(true);
    expect(result.retainedResult).toBe(-4.3);
    expect(result.displayValue).toBe("-4.3 cm");
  });

  it("rejects empty results", () => {
    const validation = validateAssessmentResult(scalarTest(), {});
    expect(validation.valid).toBe(false);
    expect(validation.errors).toEqual(["overall result is required."]);
  });

  it("keeps valid attempts while reporting malformed attempts", () => {
    const result = normaliseAssessmentResult(
      scalarTest({ result_strategy: "best" }),
      { attempts: [5, "bad", 8] }
    );

    expect(result.valid).toBe(false);
    expect(result.dimensions.overall.attempts).toEqual([5, 8]);
    expect(result.retainedResult).toBe(8);
  });
});

describe("left/right dimensions", () => {
  it("retains and compares left/right sides independently", () => {
    const definition = scalarTest({
      side_mode: "separate",
      result_strategy: "best",
      unit: "reps",
      metric_config: { decimalPlaces: 0 },
    });

    const result = normaliseAssessmentResult(definition, {
      left: { attempts: [20, 23] },
      right: { attempts: [25, 24] },
    });

    expect(result.valid).toBe(true);
    expect(result.retainedResult).toEqual({ left: 23, right: 25 });
    expect(result.comparableValue).toBeNull();
    expect(result.comparableDimensions).toEqual({ left: 23, right: 25 });
    expect(result.displayValue).toBe("L 23 reps · R 25 reps");
  });

  it("does not silently collapse a missing side into an overall score", () => {
    const result = normaliseAssessmentResult(
      scalarTest({ side_mode: "separate" }),
      { left: 10 }
    );

    expect(result.valid).toBe(false);
    expect(result.comparableValue).toBeNull();
    expect(result.comparableDimensions).toEqual({ left: 10 });
    expect(result.errors).toContain("right result is required.");
  });

  it("reports improvement separately for each side", () => {
    const definition = scalarTest({ side_mode: "separate" });
    const comparison = compareAssessmentResults(
      definition,
      { left: 12, right: 15 },
      { left: 10, right: 16 }
    );

    expect(comparison.overall).toBeNull();
    expect(comparison.dimensions.left.status).toBe("improved");
    expect(comparison.dimensions.left.improvementValue).toBe(2);
    expect(comparison.dimensions.right.status).toBe("declined");
    expect(comparison.dimensions.right.improvementValue).toBe(-1);
  });
});

describe("attempts/successes metrics", () => {
  it("stores a fixed attempts/successes result and compares by successes", () => {
    const definition = {
      metric_type: "attempts_successes",
      scoring_direction: "higher",
      result_strategy: "single",
      metric_config: { comparisonMode: "successes" },
    };
    const result = normaliseAssessmentResult(definition, {
      attempts: 10,
      successes: 7,
    });

    expect(result.valid).toBe(true);
    expect(result.retainedResult).toEqual({ attempts: 10, successes: 7 });
    expect(result.comparableValue).toBe(7);
    expect(result.displayValue).toBe("7/10");
  });

  it("enforces a configured fixed number of trials per attempts/successes result", () => {
    const definition = {
      metric_type: "attempts_successes",
      result_strategy: "single",
      metric_config: { fixedAttempts: 10 },
    };
    expect(
      normaliseAssessmentResult(definition, { attempts: 10, successes: 7 }).valid
    ).toBe(true);
    const invalid = normaliseAssessmentResult(definition, {
      attempts: 8,
      successes: 7,
    });
    expect(invalid.valid).toBe(false);
    expect(invalid.errors[0]).toMatch(/must use 10 attempts/i);
  });

  it("can compare attempts/successes by success rate", () => {
    const definition = {
      metric_type: "attempts_successes",
      scoring_direction: "higher",
      result_strategy: "single",
      metric_config: {
        comparisonMode: "rate",
        decimalPlaces: 1,
        showRate: true,
      },
    };
    const result = normaliseAssessmentResult(definition, {
      attempts: 12,
      successes: 9,
    });

    expect(result.comparableValue).toBe(75);
    expect(result.displayValue).toBe("9/12 (75%)");
  });

  it("rejects successes greater than attempts", () => {
    const result = normaliseAssessmentResult(
      { metric_type: "attempts_successes" },
      { attempts: 5, successes: 6 }
    );

    expect(result.valid).toBe(false);
    expect(result.retainedResult).toBeNull();
  });

  it("selects the best pair using the configured comparison mode", () => {
    const result = normaliseAssessmentResult(
      {
        metric_type: "attempts_successes",
        result_strategy: "best",
        scoring_direction: "higher",
        metric_config: { comparisonMode: "rate", decimalPlaces: 1 },
      },
      [
        { attempts: 10, successes: 8 },
        { attempts: 5, successes: 5 },
      ]
    );

    expect(result.retainedResult).toEqual({ attempts: 5, successes: 5 });
    expect(result.comparableValue).toBe(100);
  });
});

describe("formatAssessmentMetricValue", () => {
  it("formats generic values with units", () => {
    expect(
      formatAssessmentMetricValue(2.418, {
        unit: "m",
        metric_config: { decimalPlaces: 2 },
      })
    ).toBe("2.42 m");
  });

  it("supports fixed decimal display without changing the comparable number", () => {
    const definition = {
      unit: "s",
      metric_config: { decimalPlaces: 2, fixedDecimals: true },
    };
    expect(formatAssessmentMetricValue(2, definition)).toBe("2.00 s");
    expect(normaliseAssessmentResult(definition, 2).comparableValue).toBe(2);
  });

  it("uses an em dash for missing or invalid display values", () => {
    expect(formatAssessmentMetricValue(null, scalarTest())).toBe("—");
    expect(formatAssessmentMetricValue("bad", scalarTest())).toBe("—");
  });
});

describe("higher/lower-is-better comparisons", () => {
  it("identifies improvement when higher is better", () => {
    expect(isBetterAssessmentValue(scalarTest(), 12, 10)).toBe(true);
    expect(isBetterAssessmentValue(scalarTest(), 8, 10)).toBe(false);
  });

  it("identifies improvement when lower is better", () => {
    const definition = scalarTest({ scoring_direction: "lower" });
    expect(isBetterAssessmentValue(definition, 1.8, 2)).toBe(true);
    expect(isBetterAssessmentValue(definition, 2.1, 2)).toBe(false);
  });

  it("returns null when comparison values are unavailable", () => {
    expect(isBetterAssessmentValue(scalarTest(), null, 10)).toBeNull();
  });

  it("reports raw change separately from performance improvement", () => {
    const comparison = compareAssessmentResults(
      scalarTest({ scoring_direction: "lower", metric_config: { decimalPlaces: 2 } }),
      1.8,
      2
    );

    expect(comparison.overall.rawChange).toBe(-0.2);
    expect(comparison.overall.improvementValue).toBe(0.2);
    expect(comparison.overall.status).toBe("improved");
  });

  it("reports same when the comparable values are equal", () => {
    const comparison = compareAssessmentResults(scalarTest(), 10, 10);
    expect(comparison.overall.status).toBe("same");
    expect(comparison.overall.improvementValue).toBe(0);
  });
});

describe("percentage-improvement safety", () => {
  it("calculates positive improvement for higher-is-better metrics", () => {
    expect(calculatePercentageImprovement(scalarTest(), 12, 10)).toBe(20);
  });

  it("calculates positive improvement for lower-is-better metrics", () => {
    expect(
      calculatePercentageImprovement(
        scalarTest({ scoring_direction: "lower" }),
        1.8,
        2
      )
    ).toBe(10);
  });

  it("returns a negative percentage when performance declined", () => {
    expect(calculatePercentageImprovement(scalarTest(), 8, 10)).toBe(-20);
  });

  it("does not calculate percentage improvement from a zero baseline", () => {
    expect(canCalculatePercentageImprovement(scalarTest(), 5, 0)).toBe(false);
    expect(calculatePercentageImprovement(scalarTest(), 5, 0)).toBeNull();
  });

  it("does not calculate percentages for signed metrics by default", () => {
    const definition = scalarTest({ allow_negative: true });
    expect(canCalculatePercentageImprovement(definition, -2, -5)).toBe(false);
    expect(calculatePercentageImprovement(definition, -2, -5)).toBeNull();
  });

  it("requires an explicit opt-in before a signed metric can use percentages", () => {
    const definition = scalarTest({
      allow_negative: true,
      metric_config: {
        decimalPlaces: 1,
        percentageImprovement: "allow",
        percentageDecimalPlaces: 1,
      },
    });

    expect(canCalculatePercentageImprovement(definition, 6, 5)).toBe(true);
    expect(calculatePercentageImprovement(definition, 6, 5)).toBe(20);
  });

  it("supports explicitly disabling percentages for any metric", () => {
    const definition = scalarTest({
      metric_config: { percentageImprovement: "never" },
    });
    expect(calculatePercentageImprovement(definition, 12, 10)).toBeNull();
  });

  it("uses configured percentage precision", () => {
    const definition = scalarTest({
      metric_config: { percentageDecimalPlaces: 2 },
    });
    expect(calculatePercentageImprovement(definition, 11, 9)).toBe(22.22);
  });
});
