// Phase 1 Sessions: generic movement tracking contract.
//
// This module is intentionally UI- and database-agnostic. It defines the
// tracking methods Workout Tracker understands, their safe defaults, and the
// normalisation/validation rules used by the Session engine and later UI.
//
// Important design rules:
// - Detailed movement counting is optional by default.
// - Session completion is separate from whether a movement has a numeric result.
// - Left/right is a dimension of a tracking method, not its own tracking method.
// - Quick counters must be easy to correct and must not create XP by themselves.

export const SESSION_TRACKING_SCHEMA_VERSION = 1;

export const SESSION_SIDE_MODES = Object.freeze({
  NONE: "none",
  SEPARATE: "separate",
  ALTERNATING: "alternating",
});

export const SESSION_SIDE_MODE_OPTIONS = Object.freeze([
  {
    value: SESSION_SIDE_MODES.NONE,
    label: "No left / right split",
    description: "Record one overall result.",
  },
  {
    value: SESSION_SIDE_MODES.SEPARATE,
    label: "Track left and right separately",
    description: "Store independent left-side and right-side results.",
  },
  {
    value: SESSION_SIDE_MODES.ALTERNATING,
    label: "Alternating sides",
    description: "The drill alternates sides but records one overall result.",
  },
]);

export const SESSION_DEFAULT_QUICK_STEPS = Object.freeze([1, 5, 10]);
export const SESSION_DEFAULT_CORRECTION_STEPS = Object.freeze([1, 5]);

// These are suggested UI choices, not a closed database enum. A custom unit
// can still be stored in tracking_config for future sports/tests.
export const SESSION_UNIT_OPTIONS = Object.freeze([
  { value: "reps", label: "reps" },
  { value: "touches", label: "touches" },
  { value: "attempts", label: "attempts" },
  { value: "successes", label: "successes" },
  { value: "score", label: "score" },
  { value: "seconds", label: "seconds" },
  { value: "minutes", label: "minutes" },
  { value: "m", label: "metres" },
  { value: "km", label: "kilometres" },
  { value: "mi", label: "miles" },
  { value: "kg", label: "kilograms" },
  { value: "lb", label: "pounds" },
]);

const BASE_DEFAULT_CONFIG = Object.freeze({
  schemaVersion: SESSION_TRACKING_SCHEMA_VERSION,
  required: false,
  allowDirectEdit: true,
  allowNegative: false,
  decimalPlaces: 0,
  sideMode: SESSION_SIDE_MODES.NONE,
  quickSteps: SESSION_DEFAULT_QUICK_STEPS,
  countLabel: "reps",
  unit: "reps",
  allowWeight: false,
  weightUnit: "kg",
});

export const SESSION_TRACKING_METHODS = Object.freeze({
  completion: Object.freeze({
    key: "completion",
    label: "Completed / practised",
    shortLabel: "Completion",
    description: "Record that the movement was practised without requiring a number.",
    resultKind: "completion",
    supportsSides: false,
    usesQuickCounter: false,
    defaults: Object.freeze({
      countLabel: "",
      unit: "",
      quickSteps: [],
      allowDirectEdit: false,
    }),
  }),

  repetitions: Object.freeze({
    key: "repetitions",
    label: "Repetitions",
    shortLabel: "Reps",
    description: "Record a count such as clean repetitions or touches.",
    resultKind: "count",
    supportsSides: true,
    usesQuickCounter: true,
    defaults: Object.freeze({
      countLabel: "reps",
      unit: "reps",
    }),
  }),

  sets_reps: Object.freeze({
    key: "sets_reps",
    label: "Sets × repetitions",
    shortLabel: "Sets / reps",
    description: "Record individual sets, repetitions and optional resistance.",
    resultKind: "sets",
    supportsSides: false,
    usesQuickCounter: false,
    defaults: Object.freeze({
      countLabel: "reps",
      unit: "reps",
      allowWeight: false,
      weightUnit: "kg",
      quickSteps: [],
    }),
  }),

  duration: Object.freeze({
    key: "duration",
    label: "Duration",
    shortLabel: "Time",
    description: "Record how long the movement was performed.",
    resultKind: "duration",
    supportsSides: true,
    usesQuickCounter: false,
    defaults: Object.freeze({
      countLabel: "time",
      unit: "seconds",
      decimalPlaces: 0,
      quickSteps: [],
    }),
  }),

  distance: Object.freeze({
    key: "distance",
    label: "Distance",
    shortLabel: "Distance",
    description: "Record a measured distance.",
    resultKind: "value",
    supportsSides: true,
    usesQuickCounter: false,
    defaults: Object.freeze({
      countLabel: "distance",
      unit: "m",
      decimalPlaces: 1,
      quickSteps: [],
    }),
  }),

  weight: Object.freeze({
    key: "weight",
    label: "Weight / resistance",
    shortLabel: "Weight",
    description: "Record a resistance value such as kilograms or pounds.",
    resultKind: "value",
    supportsSides: true,
    usesQuickCounter: false,
    defaults: Object.freeze({
      countLabel: "weight",
      unit: "kg",
      weightUnit: "kg",
      decimalPlaces: 1,
      quickSteps: [],
    }),
  }),

  successful_executions: Object.freeze({
    key: "successful_executions",
    label: "Successful executions",
    shortLabel: "Successful",
    description: "Count clean or successful executions without separately counting attempts.",
    resultKind: "count",
    supportsSides: true,
    usesQuickCounter: true,
    defaults: Object.freeze({
      countLabel: "successful executions",
      unit: "successes",
    }),
  }),

  attempts_successes: Object.freeze({
    key: "attempts_successes",
    label: "Attempts + successes",
    shortLabel: "Attempts / successes",
    description: "Record attempts and successful attempts so accuracy can be calculated.",
    resultKind: "attempts_successes",
    supportsSides: true,
    usesQuickCounter: true,
    defaults: Object.freeze({
      countLabel: "attempts",
      unit: "attempts",
      attemptsLabel: "Attempts",
      successesLabel: "Successful",
    }),
  }),

  best_score: Object.freeze({
    key: "best_score",
    label: "Best score",
    shortLabel: "Best",
    description: "Record the best result achieved during repeated attempts.",
    resultKind: "best",
    supportsSides: true,
    usesQuickCounter: true,
    defaults: Object.freeze({
      countLabel: "best score",
      unit: "score",
    }),
  }),

  numeric: Object.freeze({
    key: "numeric",
    label: "Numeric result",
    shortLabel: "Number",
    description: "Record a generic numeric result for a movement or future test.",
    resultKind: "value",
    supportsSides: true,
    usesQuickCounter: false,
    defaults: Object.freeze({
      countLabel: "result",
      unit: "",
      decimalPlaces: 1,
      quickSteps: [],
    }),
  }),
});

export const SESSION_TRACKING_METHOD_OPTIONS = Object.freeze(
  Object.values(SESSION_TRACKING_METHODS).map((method) => ({
    value: method.key,
    label: method.label,
    description: method.description,
  }))
);

const TRACKING_METHOD_KEYS = new Set(Object.keys(SESSION_TRACKING_METHODS));
const SIDE_MODE_VALUES = new Set(Object.values(SESSION_SIDE_MODES));

function cleanText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function normaliseBoolean(value, fallback) {
  if (typeof value === "boolean") return value;
  return fallback;
}

function normaliseDecimalPlaces(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(3, Math.round(n)));
}

function normaliseQuickSteps(value, fallback = SESSION_DEFAULT_QUICK_STEPS) {
  const source = Array.isArray(value) ? value : fallback;
  const unique = [];

  for (const raw of source) {
    const n = Math.round(Number(raw));
    if (!Number.isFinite(n) || n <= 0 || n > 100000) continue;
    if (!unique.includes(n)) unique.push(n);
  }

  unique.sort((a, b) => a - b);
  return unique;
}

export function isSessionTrackingMethod(value) {
  return TRACKING_METHOD_KEYS.has(String(value || ""));
}

export function normaliseSessionTrackingMethod(value) {
  return isSessionTrackingMethod(value) ? String(value) : "completion";
}

export function getSessionTrackingDefinition(method) {
  return SESSION_TRACKING_METHODS[normaliseSessionTrackingMethod(method)];
}

export function isSessionSideMode(value) {
  return SIDE_MODE_VALUES.has(String(value || ""));
}

export function trackingMethodSupportsSides(method) {
  return !!getSessionTrackingDefinition(method)?.supportsSides;
}

export function trackingMethodUsesQuickCounter(method) {
  return !!getSessionTrackingDefinition(method)?.usesQuickCounter;
}

/**
 * Produce the canonical tracking_config saved with a template movement and
 * copied into historical Session snapshots.
 */
export function normaliseSessionTrackingConfig(method, rawConfig = {}) {
  const safeMethod = normaliseSessionTrackingMethod(method);
  const definition = getSessionTrackingDefinition(safeMethod);
  const raw = rawConfig && typeof rawConfig === "object" && !Array.isArray(rawConfig)
    ? rawConfig
    : {};

  const methodDefaults = definition?.defaults || {};
  const mergedDefaults = {
    ...BASE_DEFAULT_CONFIG,
    ...methodDefaults,
  };

  const supportsSides = !!definition?.supportsSides;
  const sideMode =
    supportsSides && isSessionSideMode(raw.sideMode)
      ? String(raw.sideMode)
      : mergedDefaults.sideMode;

  const usesQuickCounter = !!definition?.usesQuickCounter;
  const quickSteps = usesQuickCounter
    ? normaliseQuickSteps(raw.quickSteps, mergedDefaults.quickSteps)
    : [];

  const config = {
    schemaVersion: SESSION_TRACKING_SCHEMA_VERSION,
    required: normaliseBoolean(raw.required, mergedDefaults.required),
    countLabel: cleanText(raw.countLabel, mergedDefaults.countLabel),
    unit: cleanText(raw.unit, mergedDefaults.unit),
    quickSteps,
    allowDirectEdit: normaliseBoolean(
      raw.allowDirectEdit,
      mergedDefaults.allowDirectEdit
    ),
    allowNegative: normaliseBoolean(raw.allowNegative, mergedDefaults.allowNegative),
    decimalPlaces: normaliseDecimalPlaces(
      raw.decimalPlaces,
      mergedDefaults.decimalPlaces
    ),
    sideMode,
    allowWeight: normaliseBoolean(raw.allowWeight, mergedDefaults.allowWeight),
    weightUnit: cleanText(raw.weightUnit, mergedDefaults.weightUnit),
  };

  // Method-specific labels are kept only where meaningful so historical
  // snapshots remain self-describing without accumulating irrelevant fields.
  if (safeMethod === "attempts_successes") {
    config.attemptsLabel = cleanText(
      raw.attemptsLabel,
      methodDefaults.attemptsLabel || "Attempts"
    );
    config.successesLabel = cleanText(
      raw.successesLabel,
      methodDefaults.successesLabel || "Successful"
    );
  }

  // Completion intentionally has no numeric-entry configuration.
  if (safeMethod === "completion") {
    config.countLabel = "";
    config.unit = "";
    config.quickSteps = [];
    config.allowDirectEdit = false;
    config.allowNegative = false;
    config.decimalPlaces = 0;
    config.sideMode = SESSION_SIDE_MODES.NONE;
    config.allowWeight = false;
  }

  // Sets/reps can optionally record resistance but are not side-split in
  // Phase 1. Per-side strength can be represented as separate template steps.
  if (safeMethod === "sets_reps") {
    config.sideMode = SESSION_SIDE_MODES.NONE;
  }

  // Weight-only tracking uses the selected unit as the resistance unit.
  if (safeMethod === "weight") {
    config.weightUnit = cleanText(raw.weightUnit || raw.unit, "kg");
    config.unit = config.weightUnit;
  }

  return config;
}

/**
 * Validate a proposed config without mutating it. Normalisation remains the
 * source of truth; validation is primarily for editor feedback.
 */
export function validateSessionTrackingConfig(method, rawConfig = {}) {
  const errors = [];
  const warnings = [];

  if (!isSessionTrackingMethod(method)) {
    errors.push(`Unknown tracking method: ${String(method || "")}`);
  }

  const safeMethod = normaliseSessionTrackingMethod(method);
  const definition = getSessionTrackingDefinition(safeMethod);
  const raw = rawConfig && typeof rawConfig === "object" && !Array.isArray(rawConfig)
    ? rawConfig
    : {};

  if (raw.sideMode !== undefined && !isSessionSideMode(raw.sideMode)) {
    errors.push(`Unknown side mode: ${String(raw.sideMode)}`);
  }

  if (
    raw.sideMode !== undefined &&
    raw.sideMode !== SESSION_SIDE_MODES.NONE &&
    !definition.supportsSides
  ) {
    warnings.push(`${definition.label} does not support left/right splitting in Phase 1.`);
  }

  if (raw.quickSteps !== undefined) {
    if (!Array.isArray(raw.quickSteps)) {
      errors.push("quickSteps must be an array of positive numbers.");
    } else if (raw.quickSteps.some((v) => !Number.isFinite(Number(v)) || Number(v) <= 0)) {
      errors.push("quickSteps may only contain positive numbers.");
    }
  }

  if (raw.decimalPlaces !== undefined) {
    const n = Number(raw.decimalPlaces);
    if (!Number.isFinite(n) || n < 0 || n > 3) {
      errors.push("decimalPlaces must be between 0 and 3.");
    }
  }

  if (
    safeMethod === "attempts_successes" &&
    raw.attemptsLabel !== undefined &&
    !cleanText(raw.attemptsLabel)
  ) {
    errors.push("attemptsLabel cannot be blank when provided.");
  }

  if (
    safeMethod === "attempts_successes" &&
    raw.successesLabel !== undefined &&
    !cleanText(raw.successesLabel)
  ) {
    errors.push("successesLabel cannot be blank when provided.");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    normalized: normaliseSessionTrackingConfig(safeMethod, raw),
  };
}

/**
 * Convenience for the future QuickCounter component. Positive steps come from
 * the movement definition. Correction buttons intentionally use only +/−1 and
 * +/−5 style increments unless smaller custom steps make more sense.
 */
export function getSessionCounterSteps(method, rawConfig = {}) {
  const config = normaliseSessionTrackingConfig(method, rawConfig);

  if (!trackingMethodUsesQuickCounter(method)) {
    return { increment: [], decrement: [] };
  }

  const increment = normaliseQuickSteps(
    config.quickSteps,
    SESSION_DEFAULT_QUICK_STEPS
  );

  const decrement = SESSION_DEFAULT_CORRECTION_STEPS.filter((step) =>
    increment.includes(step)
  );

  // Preserve correction controls even if a custom config omitted 1 or 5.
  if (!decrement.length) {
    decrement.push(...increment.slice(0, Math.min(2, increment.length)));
  }

  return { increment, decrement };
}
