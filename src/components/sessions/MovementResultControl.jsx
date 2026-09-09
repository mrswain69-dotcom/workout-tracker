import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  SESSION_SIDE_MODES,
  getSessionCounterSteps,
  getSessionTrackingDefinition,
  normaliseSessionTrackingConfig,
  normaliseSessionTrackingMethod,
} from "../../config/sessionTracking.js";
import { normaliseMovementResult } from "../../engine/sessionEngine.js";
import QuickCounter from "./QuickCounter.jsx";

function cleanIdPart(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function finiteNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function roundTo(value, decimalPlaces = 0) {
  const n = finiteNumber(value);
  if (n === null) return null;
  const places = Math.max(0, Math.min(3, Math.round(Number(decimalPlaces) || 0)));
  const factor = 10 ** places;
  return Math.round(n * factor) / factor;
}

function normaliseEntryValue(value, { allowNegative = false, decimalPlaces = 0 } = {}) {
  let n = roundTo(value, decimalPlaces);
  if (n === null) return null;
  if (!allowNegative) n = Math.max(0, n);
  return n;
}

function durationDisplayValue(durationSec, unit) {
  const seconds = finiteNumber(durationSec);
  if (seconds === null) return null;
  return unit === "minutes" ? seconds / 60 : seconds;
}

function durationStorageValue(displayValue, unit) {
  const value = finiteNumber(displayValue);
  if (value === null) return null;
  return unit === "minutes" ? value * 60 : value;
}

function getBucket(result, key) {
  const bucket = result?.[key];
  return bucket && typeof bucket === "object" && !Array.isArray(bucket) ? bucket : {};
}

function resultWithBucket(result, key, nextBucket) {
  const next = result && typeof result === "object" && !Array.isArray(result)
    ? { ...result }
    : {};

  if (nextBucket && typeof nextBucket === "object" && Object.keys(nextBucket).length) {
    next[key] = nextBucket;
  } else {
    delete next[key];
  }

  return next;
}

function NumericEntry({
  value,
  onChange,
  label,
  unit = "",
  decimalPlaces = 0,
  allowNegative = false,
  disabled = false,
  id,
}) {
  const normalised = normaliseEntryValue(value, { allowNegative, decimalPlaces });
  const [draft, setDraft] = useState(normalised === null ? "" : String(normalised));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(normalised === null ? "" : String(normalised));
  }, [normalised, editing]);

  const commit = () => {
    if (disabled) return;
    const trimmed = String(draft).trim();
    setEditing(false);

    if (!trimmed) {
      setDraft("");
      if (normalised !== null && typeof onChange === "function") onChange(null);
      return;
    }

    const next = normaliseEntryValue(trimmed, { allowNegative, decimalPlaces });
    if (next === null) {
      setDraft(normalised === null ? "" : String(normalised));
      return;
    }

    setDraft(String(next));
    if (next !== normalised && typeof onChange === "function") onChange(next);
  };

  return (
    <div className="session-movement-result__numeric-entry">
      {label ? (
        <label className="session-movement-result__field-label" htmlFor={id || undefined}>
          {label}
        </label>
      ) : null}
      <div className="session-movement-result__numeric-wrap">
        <input
          id={id || undefined}
          className="session-movement-result__numeric-input"
          type="number"
          inputMode={decimalPlaces > 0 ? "decimal" : "numeric"}
          min={allowNegative ? undefined : 0}
          step={decimalPlaces > 0 ? 1 / 10 ** decimalPlaces : 1}
          value={draft}
          disabled={disabled}
          aria-label={label || "Numeric result"}
          onFocus={() => setEditing(true)}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            } else if (event.key === "Escape") {
              event.preventDefault();
              setDraft(normalised === null ? "" : String(normalised));
              setEditing(false);
              event.currentTarget.blur();
            }
          }}
        />
        {unit ? <span className="session-movement-result__unit">{unit}</span> : null}
      </div>
    </div>
  );
}

/**
 * Render the correct result-entry control for a Session movement definition.
 *
 * Result values use the same canonical JSON shape as sessionEngine:
 *   { overall: {...} }
 *   { left: {...}, right: {...} }
 *
 * Completion is intentionally separate from numeric/structured result data.
 */
export default function MovementResultControl(props) {
  const movement = props.movement && typeof props.movement === "object"
    ? props.movement
    : {};
  const method = normaliseSessionTrackingMethod(
    props.trackingMethod !== undefined ? props.trackingMethod : movement.trackingMethod
  );
  const rawConfig =
    props.trackingConfig !== undefined ? props.trackingConfig : movement.trackingConfig;
  const config = useMemo(
    () => normaliseSessionTrackingConfig(method, rawConfig || {}),
    [method, rawConfig]
  );
  const definition = getSessionTrackingDefinition(method);
  const suppliedResult = props.result !== undefined ? props.result : movement.result;
  const canonicalResult = normaliseMovementResult(method, suppliedResult, config);
  const liveResultRef = useRef(canonicalResult);
  const onChange = props.onChange;
  const disabled = !!props.disabled;
  const completed =
    props.completed !== undefined ? !!props.completed : !!movement.completed;
  const label =
    props.label !== undefined
      ? props.label
      : movement.displayLabel || movement.name || definition?.label || "Movement";
  const idPrefix = cleanIdPart(
    props.idPrefix || movement.templateMovementId || movement.movementId || ""
  );

  useEffect(() => {
    liveResultRef.current = canonicalResult;
  }, [canonicalResult, method]);

  const emitResult = (rawNext, meta = {}) => {
    const next = normaliseMovementResult(method, rawNext, config);
    liveResultRef.current = next;
    if (typeof onChange === "function") {
      onChange(next, { method, ...meta });
    }
  };

  const updateBucket = (bucketKey, nextBucket, meta = {}) => {
    const rawNext = resultWithBucket(liveResultRef.current, bucketKey, nextBucket);
    emitResult(rawNext, { bucket: bucketKey, ...meta });
  };

  const updateBucketField = (bucketKey, field, value, meta = {}) => {
    const bucket = { ...getBucket(liveResultRef.current, bucketKey) };
    if (value === null || value === undefined || value === "") {
      delete bucket[field];
    } else {
      bucket[field] = value;
    }
    updateBucket(bucketKey, bucket, { field, ...meta });
  };

  const rootClassName = `session-movement-result${
    props.className ? ` ${props.className}` : ""
  }`;

  if (method === "completion") {
    return (
      <div
        className={rootClassName}
        data-tracking-method={method}
        aria-label={label || undefined}
      >
        <button
          type="button"
          className={`session-movement-result__practised${
            completed ? " session-movement-result__practised--active" : ""
          }`}
          aria-pressed={completed}
          disabled={disabled}
          onClick={() => {
            if (disabled) return;
            if (typeof props.onCompletedChange === "function") {
              props.onCompletedChange(!completed, {
                method,
                source: "completion",
                previous: completed,
              });
            }
          }}
        >
          Practised
        </button>
      </div>
    );
  }

  const counterSteps = getSessionCounterSteps(method, config);
  const minimum = config.allowNegative ? -Number.MAX_SAFE_INTEGER : 0;
  const buckets =
    config.sideMode === SESSION_SIDE_MODES.SEPARATE
      ? [
          { key: "left", label: "Left" },
          { key: "right", label: "Right" },
        ]
      : [{ key: "overall", label: "" }];

  const renderBucket = ({ key: bucketKey, label: sideLabel }) => {
    const bucket = getBucket(canonicalResult, bucketKey);
    const fieldPrefix = idPrefix ? `${idPrefix}-${bucketKey}` : "";
    let controls = null;

    if (method === "repetitions" || method === "successful_executions") {
      controls = (
        <QuickCounter
          id={fieldPrefix ? `${fieldPrefix}-count` : undefined}
          value={bucket.count ?? 0}
          onChange={(next, meta) =>
            updateBucketField(bucketKey, "count", next, { source: "counter", counter: meta })
          }
          label={config.countLabel || definition.shortLabel}
          unit={config.unit}
          incrementSteps={counterSteps.increment}
          decrementSteps={counterSteps.decrement}
          min={minimum}
          decimalPlaces={0}
          allowDirectEdit={config.allowDirectEdit}
          disabled={disabled}
        />
      );
    } else if (method === "attempts_successes") {
      controls = (
        <div className="session-movement-result__attempts-successes">
          <QuickCounter
            id={fieldPrefix ? `${fieldPrefix}-attempts` : undefined}
            value={bucket.attempts ?? 0}
            onChange={(next, meta) =>
              updateBucketField(bucketKey, "attempts", next, {
                source: "counter",
                counter: meta,
              })
            }
            label={config.attemptsLabel || "Attempts"}
            unit="attempts"
            incrementSteps={counterSteps.increment}
            decrementSteps={counterSteps.decrement}
            min={0}
            decimalPlaces={0}
            allowDirectEdit={config.allowDirectEdit}
            disabled={disabled}
          />
          <QuickCounter
            id={fieldPrefix ? `${fieldPrefix}-successes` : undefined}
            value={bucket.successes ?? 0}
            onChange={(next, meta) =>
              updateBucketField(bucketKey, "successes", next, {
                source: "counter",
                counter: meta,
              })
            }
            label={config.successesLabel || "Successful"}
            unit="successes"
            incrementSteps={counterSteps.increment}
            decrementSteps={counterSteps.decrement}
            min={0}
            decimalPlaces={0}
            allowDirectEdit={config.allowDirectEdit}
            disabled={disabled}
          />
        </div>
      );
    } else if (method === "best_score") {
      controls = (
        <QuickCounter
          id={fieldPrefix ? `${fieldPrefix}-best` : undefined}
          value={bucket.best ?? 0}
          onChange={(next, meta) =>
            updateBucketField(bucketKey, "best", next, { source: "counter", counter: meta })
          }
          label={config.countLabel || "Best score"}
          unit={config.unit}
          incrementSteps={counterSteps.increment}
          decrementSteps={counterSteps.decrement}
          min={minimum}
          decimalPlaces={config.decimalPlaces}
          allowDirectEdit={config.allowDirectEdit}
          disabled={disabled}
        />
      );
    } else if (method === "duration") {
      const unit = config.unit === "minutes" ? "minutes" : "seconds";
      controls = (
        <NumericEntry
          id={fieldPrefix ? `${fieldPrefix}-duration` : undefined}
          value={durationDisplayValue(bucket.durationSec, unit)}
          onChange={(nextDisplay) => {
            const durationSec = durationStorageValue(nextDisplay, unit);
            updateBucketField(bucketKey, "durationSec", durationSec, {
              source: "direct",
              displayUnit: unit,
            });
          }}
          label={config.countLabel || "Time"}
          unit={unit}
          decimalPlaces={config.decimalPlaces}
          allowNegative={false}
          disabled={disabled}
        />
      );
    } else if (method === "distance" || method === "weight" || method === "numeric") {
      const unit = method === "weight" ? config.weightUnit : config.unit;
      controls = (
        <NumericEntry
          id={fieldPrefix ? `${fieldPrefix}-value` : undefined}
          value={bucket.value ?? null}
          onChange={(next) => {
            if (next === null) {
              updateBucket(bucketKey, null, { source: "direct", field: "value" });
            } else {
              updateBucket(bucketKey, { value: next, unit }, {
                source: "direct",
                field: "value",
              });
            }
          }}
          label={config.countLabel || definition.shortLabel}
          unit={unit}
          decimalPlaces={config.decimalPlaces}
          allowNegative={config.allowNegative}
          disabled={disabled}
        />
      );
    }

    if (!sideLabel) return <div key={bucketKey}>{controls}</div>;

    return (
      <fieldset className="session-movement-result__side" key={bucketKey}>
        <legend>{sideLabel}</legend>
        {controls}
      </fieldset>
    );
  };

  const renderSetsReps = () => {
    const bucket = getBucket(canonicalResult, "overall");
    const sets = Array.isArray(bucket.sets) ? bucket.sets : [];

    const commitSets = (nextSets, meta) => {
      updateBucket("overall", nextSets.length ? { sets: nextSets } : null, meta);
    };

    const updateSetField = (index, field, value) => {
      const liveSets = Array.isArray(getBucket(liveResultRef.current, "overall").sets)
        ? getBucket(liveResultRef.current, "overall").sets.map((set) => ({ ...set }))
        : [];
      const nextSet = { ...(liveSets[index] || {}) };
      if (value === null || value === undefined || value === "") delete nextSet[field];
      else nextSet[field] = value;
      liveSets[index] = nextSet;
      commitSets(liveSets, { source: "sets", setIndex: index, field });
    };

    return (
      <div className="session-movement-result__sets" aria-label={config.countLabel || "Sets and reps"}>
        {sets.map((set, index) => (
          <div className="session-movement-result__set-row" key={`set-${index}`}>
            <span className="session-movement-result__set-number">Set {index + 1}</span>
            <NumericEntry
              id={idPrefix ? `${idPrefix}-set-${index + 1}-reps` : undefined}
              value={set.reps ?? null}
              onChange={(next) => updateSetField(index, "reps", next)}
              label="Reps"
              unit="reps"
              decimalPlaces={0}
              allowNegative={false}
              disabled={disabled}
            />
            {config.allowWeight ? (
              <NumericEntry
                id={idPrefix ? `${idPrefix}-set-${index + 1}-weight` : undefined}
                value={set.weight ?? null}
                onChange={(next) => updateSetField(index, "weight", next)}
                label="Weight"
                unit={config.weightUnit}
                decimalPlaces={2}
                allowNegative={false}
                disabled={disabled}
              />
            ) : null}
            <button
              type="button"
              className="session-movement-result__remove-set"
              disabled={disabled}
              aria-label={`Remove set ${index + 1}`}
              onClick={() => {
                const liveSets = Array.isArray(getBucket(liveResultRef.current, "overall").sets)
                  ? getBucket(liveResultRef.current, "overall").sets
                  : [];
                commitSets(
                  liveSets.filter((_, setIndex) => setIndex !== index),
                  { source: "sets", action: "remove", setIndex: index }
                );
              }}
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          className="session-movement-result__add-set"
          disabled={disabled}
          onClick={() => {
            const liveSets = Array.isArray(getBucket(liveResultRef.current, "overall").sets)
              ? getBucket(liveResultRef.current, "overall").sets.map((set) => ({ ...set }))
              : [];
            commitSets([...liveSets, { reps: 0 }], {
              source: "sets",
              action: "add",
              setIndex: liveSets.length,
            });
          }}
        >
          Add set
        </button>
      </div>
    );
  };

  return (
    <div
      className={rootClassName}
      data-tracking-method={method}
      data-side-mode={config.sideMode}
      aria-label={label || undefined}
    >
      {method === "sets_reps" ? renderSetsReps() : buckets.map(renderBucket)}
    </div>
  );
}
