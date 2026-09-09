export const ASSESSMENT_SCORING_DIRECTIONS = ["higher", "lower"];
export const ASSESSMENT_RESULT_STRATEGIES = ["single", "best", "average"];
export const ASSESSMENT_SIDE_MODES = ["none", "separate"];

const ATTEMPTS_SUCCESSES_TYPES = new Set([
  "attempts_successes",
  "successes_attempts",
]);

function valueOf(obj, camelKey, snakeKey, fallback = undefined) {
  if (!obj || typeof obj !== "object") return fallback;
  if (obj[camelKey] !== undefined) return obj[camelKey];
  if (snakeKey && obj[snakeKey] !== undefined) return obj[snakeKey];
  return fallback;
}

function cleanText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function finiteInteger(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.round(n);
}

function finiteComparableInput(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function roundTo(value, decimalPlaces = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const places = clamp(finiteInteger(decimalPlaces, 0), 0, 6);
  const factor = 10 ** places;
  return Math.round((n + Number.EPSILON) * factor) / factor;
}

function normaliseEnum(value, allowed, fallback) {
  const text = cleanText(value, fallback).toLowerCase();
  return allowed.includes(text) ? text : fallback;
}

function normaliseMetricType(value) {
  const text = cleanText(value, "numeric").toLowerCase();
  return ATTEMPTS_SUCCESSES_TYPES.has(text) ? "attempts_successes" : text;
}

function metricConfigOf(raw = {}) {
  const config = valueOf(raw, "metricConfig", "metric_config", {});
  return config && typeof config === "object" && !Array.isArray(config)
    ? { ...config }
    : {};
}

export function normaliseAssessmentMetricDefinition(raw = {}) {
  const metricConfig = metricConfigOf(raw);
  const decimalPlaces = clamp(
    finiteInteger(metricConfig.decimalPlaces, 0),
    0,
    6
  );
  const percentageDecimalPlaces = clamp(
    finiteInteger(metricConfig.percentageDecimalPlaces, 1),
    0,
    3
  );

  return {
    metricType: normaliseMetricType(
      valueOf(raw, "metricType", "metric_type", "numeric")
    ),
    unit: cleanText(valueOf(raw, "unit", "unit", ""), ""),
    scoringDirection: normaliseEnum(
      valueOf(raw, "scoringDirection", "scoring_direction", "higher"),
      ASSESSMENT_SCORING_DIRECTIONS,
      "higher"
    ),
    attemptCount: Math.max(
      1,
      finiteInteger(valueOf(raw, "attemptCount", "attempt_count", 1), 1)
    ),
    resultStrategy: normaliseEnum(
      valueOf(raw, "resultStrategy", "result_strategy", "single"),
      ASSESSMENT_RESULT_STRATEGIES,
      "single"
    ),
    sideMode: normaliseEnum(
      valueOf(raw, "sideMode", "side_mode", "none"),
      ASSESSMENT_SIDE_MODES,
      "none"
    ),
    allowNegative: !!valueOf(raw, "allowNegative", "allow_negative", false),
    pbEligible: valueOf(raw, "pbEligible", "pb_eligible", true) !== false,
    metricConfig: {
      ...metricConfig,
      decimalPlaces,
      percentageDecimalPlaces,
      comparisonMode:
        cleanText(metricConfig.comparisonMode, "successes").toLowerCase() ===
        "rate"
          ? "rate"
          : "successes",
    },
  };
}

export function validateAssessmentMetricDefinition(raw = {}) {
  const definition = normaliseAssessmentMetricDefinition(raw);
  const errors = [];

  if (
    definition.metricType === "attempts_successes" &&
    definition.resultStrategy === "average"
  ) {
    errors.push(
      "Attempts/successes Tests cannot use the average result strategy; use single or best."
    );
  }

  return { valid: errors.length === 0, errors, definition };
}

function scalarFrom(value, definition) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (!definition.allowNegative && n < 0) return null;
  return roundTo(n, definition.metricConfig.decimalPlaces);
}

function attemptsSuccessesFrom(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const attempts = Number(value.attempts);
  const successes = Number(value.successes);
  if (!Number.isFinite(attempts) || !Number.isFinite(successes)) return null;
  if (!Number.isInteger(attempts) || !Number.isInteger(successes)) return null;
  if (attempts < 0 || successes < 0 || successes > attempts) return null;
  return { attempts, successes };
}

function rawDimension(result, definition, dimension) {
  if (definition.sideMode === "separate") {
    return result && typeof result === "object" ? result[dimension] : undefined;
  }
  if (
    result &&
    typeof result === "object" &&
    !Array.isArray(result) &&
    result.overall !== undefined
  ) {
    return result.overall;
  }
  return result;
}

function scalarAttemptInputs(bucket) {
  if (bucket === null || bucket === undefined || bucket === "") return [];
  if (Array.isArray(bucket)) return bucket;
  if (typeof bucket === "object") {
    if (Array.isArray(bucket.attempts)) return bucket.attempts;
    if (bucket.value !== undefined) return [bucket.value];
    if (bucket.retained !== undefined) return [bucket.retained];
    return [];
  }
  return [bucket];
}

function attemptsSuccessesInputs(bucket) {
  if (bucket === null || bucket === undefined) return [];
  if (Array.isArray(bucket)) return bucket;
  if (typeof bucket === "object") {
    if (Array.isArray(bucket.results)) return bucket.results;
    if (bucket.result && typeof bucket.result === "object") return [bucket.result];
    if (!Array.isArray(bucket.attempts) && bucket.attempts !== undefined) {
      return [bucket];
    }
    return [];
  }
  return [bucket];
}

function comparableForValue(value, definition) {
  if (value === null || value === undefined) return null;
  if (definition.metricType === "attempts_successes") {
    if (!value || typeof value !== "object") return null;
    if (definition.metricConfig.comparisonMode === "rate") {
      if (value.attempts <= 0) return null;
      return roundTo(
        (value.successes / value.attempts) * 100,
        definition.metricConfig.decimalPlaces
      );
    }
    return Number.isFinite(Number(value.successes))
      ? Number(value.successes)
      : null;
  }
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function chooseBest(values, definition) {
  let best = null;
  let bestComparable = null;
  for (const value of values) {
    const comparable = comparableForValue(value, definition);
    if (comparable === null) continue;
    if (bestComparable === null) {
      best = value;
      bestComparable = comparable;
      continue;
    }
    const isBetter =
      definition.scoringDirection === "lower"
        ? comparable < bestComparable
        : comparable > bestComparable;
    if (isBetter) {
      best = value;
      bestComparable = comparable;
    }
  }
  return best;
}

function retainValue(values, definition) {
  if (!values.length) return null;
  if (definition.resultStrategy === "best") {
    return chooseBest(values, definition);
  }
  if (definition.resultStrategy === "average") {
    if (definition.metricType === "attempts_successes") return null;
    const total = values.reduce((sum, value) => sum + Number(value), 0);
    return roundTo(
      total / values.length,
      definition.metricConfig.decimalPlaces
    );
  }
  return values[0];
}

function unitSuffix(definition) {
  const unit = cleanText(definition.unit, "");
  return unit ? ` ${unit}` : "";
}

export function formatAssessmentMetricValue(value, rawDefinition = {}) {
  const definition = normaliseAssessmentMetricDefinition(rawDefinition);
  if (value === null || value === undefined) return "—";

  if (definition.metricType === "attempts_successes") {
    const pair = attemptsSuccessesFrom(value);
    if (!pair) return "—";
    const base = `${pair.successes}/${pair.attempts}`;
    if (definition.metricConfig.showRate && pair.attempts > 0) {
      const rate = roundTo(
        (pair.successes / pair.attempts) * 100,
        definition.metricConfig.percentageDecimalPlaces
      );
      return `${base} (${rate}%)`;
    }
    return base;
  }

  const scalar = scalarFrom(value, definition);
  if (scalar === null) return "—";
  const places = definition.metricConfig.decimalPlaces;
  const formatted = definition.metricConfig.fixedDecimals
    ? scalar.toFixed(places)
    : String(scalar);
  return `${formatted}${unitSuffix(definition)}`;
}

function evaluateDimension(bucket, definition, dimension) {
  const errors = [];
  const inputs =
    definition.metricType === "attempts_successes"
      ? attemptsSuccessesInputs(bucket)
      : scalarAttemptInputs(bucket);
  const attempts = [];

  inputs.forEach((input, index) => {
    const parsed =
      definition.metricType === "attempts_successes"
        ? attemptsSuccessesFrom(input)
        : scalarFrom(input, definition);
    if (parsed === null) {
      errors.push(`${dimension} attempt ${index + 1} is not a valid result.`);
    } else {
      attempts.push(parsed);
    }
  });

  if (!inputs.length) {
    errors.push(`${dimension} result is required.`);
  }

  const retained = retainValue(attempts, definition);
  if (
    definition.metricType === "attempts_successes" &&
    definition.resultStrategy === "average" &&
    attempts.length
  ) {
    errors.push(
      `${dimension} cannot calculate an average from attempts/successes pairs.`
    );
  }

  const comparable = comparableForValue(retained, definition);
  return {
    attempts,
    retained,
    comparable,
    display: formatAssessmentMetricValue(retained, definition),
    errors,
  };
}

export function normaliseAssessmentResult(rawDefinition = {}, rawResult = {}) {
  const definitionValidation = validateAssessmentMetricDefinition(rawDefinition);
  const definition = definitionValidation.definition;
  const dimensionNames =
    definition.sideMode === "separate" ? ["left", "right"] : ["overall"];
  const dimensions = {};
  const errors = [...definitionValidation.errors];

  for (const dimension of dimensionNames) {
    const evaluated = evaluateDimension(
      rawDimension(rawResult, definition, dimension),
      definition,
      dimension
    );
    dimensions[dimension] = evaluated;
    errors.push(...evaluated.errors);
  }

  const comparableDimensions = Object.fromEntries(
    dimensionNames
      .filter((dimension) => dimensions[dimension].comparable !== null)
      .map((dimension) => [dimension, dimensions[dimension].comparable])
  );

  const comparableValue =
    definition.sideMode === "none" ? dimensions.overall.comparable : null;
  const displayValue =
    definition.sideMode === "none"
      ? dimensions.overall.display
      : `L ${dimensions.left.display} · R ${dimensions.right.display}`;

  return {
    definition,
    valid: errors.length === 0,
    errors,
    dimensions,
    retainedResult:
      definition.sideMode === "none"
        ? dimensions.overall.retained
        : {
            left: dimensions.left.retained,
            right: dimensions.right.retained,
          },
    comparableValue,
    comparableDimensions,
    displayValue,
  };
}

export function validateAssessmentResult(rawDefinition = {}, rawResult = {}) {
  const result = normaliseAssessmentResult(rawDefinition, rawResult);
  return { valid: result.valid, errors: result.errors };
}

function comparableFromResult(result, definition, dimension) {
  if (result === null || result === undefined) return null;
  if (
    result &&
    typeof result === "object" &&
    result.comparableDimensions &&
    typeof result.comparableDimensions === "object"
  ) {
    return finiteComparableInput(result.comparableDimensions[dimension]);
  }

  const normalised = normaliseAssessmentResult(definition, result);
  return finiteComparableInput(normalised.comparableDimensions[dimension]);
}

export function isBetterAssessmentValue(
  rawDefinition = {},
  currentValue,
  previousValue
) {
  const definition = normaliseAssessmentMetricDefinition(rawDefinition);
  const current = finiteComparableInput(currentValue);
  const previous = finiteComparableInput(previousValue);
  if (current === null || previous === null) return null;
  if (current === previous) return false;
  return definition.scoringDirection === "lower"
    ? current < previous
    : current > previous;
}

export function canCalculatePercentageImprovement(
  rawDefinition = {},
  currentValue,
  previousValue
) {
  const definition = normaliseAssessmentMetricDefinition(rawDefinition);
  const current = finiteComparableInput(currentValue);
  const previous = finiteComparableInput(previousValue);
  if (current === null || previous === null) return false;
  if (definition.metricConfig.percentageImprovement === "never") return false;
  if (previous <= 0) return false;
  if (
    definition.allowNegative &&
    definition.metricConfig.percentageImprovement !== "allow"
  ) {
    return false;
  }
  return true;
}

export function calculatePercentageImprovement(
  rawDefinition = {},
  currentValue,
  previousValue
) {
  const definition = normaliseAssessmentMetricDefinition(rawDefinition);
  if (
    !canCalculatePercentageImprovement(definition, currentValue, previousValue)
  ) {
    return null;
  }

  const current = finiteComparableInput(currentValue);
  const previous = finiteComparableInput(previousValue);
  const raw =
    definition.scoringDirection === "lower"
      ? ((previous - current) / previous) * 100
      : ((current - previous) / previous) * 100;
  return roundTo(raw, definition.metricConfig.percentageDecimalPlaces);
}

export function compareAssessmentResults(
  rawDefinition = {},
  currentResult,
  previousResult
) {
  const definition = normaliseAssessmentMetricDefinition(rawDefinition);
  const dimensionNames =
    definition.sideMode === "separate" ? ["left", "right"] : ["overall"];
  const dimensions = {};

  for (const dimension of dimensionNames) {
    const current = comparableFromResult(currentResult, definition, dimension);
    const previous = comparableFromResult(previousResult, definition, dimension);

    if (current === null || previous === null) {
      dimensions[dimension] = {
        current,
        previous,
        rawChange: null,
        improvementValue: null,
        percentageImprovement: null,
        status: "unavailable",
      };
      continue;
    }

    const rawChange = roundTo(
      current - previous,
      definition.metricConfig.decimalPlaces
    );
    const improvementValue = roundTo(
      definition.scoringDirection === "lower"
        ? previous - current
        : current - previous,
      definition.metricConfig.decimalPlaces
    );
    const percentageImprovement = calculatePercentageImprovement(
      definition,
      current,
      previous
    );

    dimensions[dimension] = {
      current,
      previous,
      rawChange,
      improvementValue,
      percentageImprovement,
      status:
        improvementValue > 0
          ? "improved"
          : improvementValue < 0
          ? "declined"
          : "same",
    };
  }

  return {
    scoringDirection: definition.scoringDirection,
    dimensions,
    overall:
      definition.sideMode === "none" ? dimensions.overall : null,
  };
}
