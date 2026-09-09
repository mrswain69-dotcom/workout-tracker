import React, { useEffect, useMemo, useRef, useState } from "react";

function finiteOr(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function normaliseQuickCounterValue(
  value,
  { min = 0, max = Number.POSITIVE_INFINITY, decimalPlaces = 0 } = {}
) {
  const safeMin = finiteOr(min, 0);
  const safeMax = Number.isFinite(Number(max)) ? Number(max) : Number.POSITIVE_INFINITY;
  const places = Math.max(0, Math.min(3, Math.round(finiteOr(decimalPlaces, 0))));
  const factor = 10 ** places;
  const n = finiteOr(value, safeMin);
  const rounded = Math.round(n * factor) / factor;
  return clamp(rounded, safeMin, Math.max(safeMin, safeMax));
}

export function applyQuickCounterDelta(value, delta, options = {}) {
  const current = normaliseQuickCounterValue(value, options);
  const change = finiteOr(delta, 0);
  return normaliseQuickCounterValue(current + change, options);
}

function normaliseSteps(steps, fallback) {
  const source = Array.isArray(steps) ? steps : fallback;
  return [...new Set(
    source
      .map((value) => Math.abs(Math.round(Number(value))))
      .filter((value) => Number.isFinite(value) && value > 0)
  )].sort((a, b) => a - b);
}

export default function QuickCounter({
  value = 0,
  onChange,
  label = "Count",
  unit = "",
  incrementSteps = [1, 5, 10],
  decrementSteps = [1, 5],
  min = 0,
  max = Number.POSITIVE_INFINITY,
  decimalPlaces = 0,
  allowDirectEdit = true,
  disabled = false,
  className = "",
  id,
}) {
  const options = useMemo(
    () => ({ min, max, decimalPlaces }),
    [min, max, decimalPlaces]
  );

  const normalisedValue = normaliseQuickCounterValue(value, options);
  const liveValueRef = useRef(normalisedValue);
  const [draft, setDraft] = useState(String(normalisedValue));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    liveValueRef.current = normalisedValue;
    if (!editing) setDraft(String(normalisedValue));
  }, [normalisedValue, editing]);

  const plusSteps = useMemo(
    () => normaliseSteps(incrementSteps, [1, 5, 10]),
    [incrementSteps]
  );
  const minusSteps = useMemo(
    () => normaliseSteps(decrementSteps, [1, 5]).sort((a, b) => b - a),
    [decrementSteps]
  );

  const emit = (next, meta) => {
    liveValueRef.current = next;
    setDraft(String(next));
    if (typeof onChange === "function") onChange(next, meta);
  };

  const changeBy = (delta) => {
    if (disabled) return;
    const previous = liveValueRef.current;
    const next = applyQuickCounterDelta(previous, delta, options);
    if (next === previous) return;
    emit(next, {
      source: delta >= 0 ? "increment" : "decrement",
      delta,
      previous,
    });
  };

  const commitDraft = () => {
    if (disabled || !allowDirectEdit) return;
    const trimmed = String(draft).trim();
    if (!trimmed || !Number.isFinite(Number(trimmed))) {
      setDraft(String(liveValueRef.current));
      setEditing(false);
      return;
    }

    const previous = liveValueRef.current;
    const next = normaliseQuickCounterValue(Number(trimmed), options);
    setEditing(false);
    if (next === previous) {
      setDraft(String(next));
      return;
    }
    emit(next, { source: "direct", previous });
  };

  const atMin = liveValueRef.current <= normaliseQuickCounterValue(min, options);
  const normalisedMax = Number.isFinite(Number(max))
    ? normaliseQuickCounterValue(max, options)
    : Number.POSITIVE_INFINITY;
  const atMax = liveValueRef.current >= normalisedMax;
  const inputId = id || undefined;

  return (
    <div
      className={`session-quick-counter${className ? ` ${className}` : ""}`}
      data-testid="quick-counter"
      aria-disabled={disabled ? "true" : undefined}
    >
      {label ? (
        <label className="session-quick-counter__label" htmlFor={inputId}>
          {label}
        </label>
      ) : null}

      <div className="session-quick-counter__controls">
        <div className="session-quick-counter__decrement" aria-label="Decrease controls">
          {minusSteps.map((step) => (
            <button
              key={`minus-${step}`}
              type="button"
              className="session-quick-counter__button session-quick-counter__button--decrement"
              onClick={() => changeBy(-step)}
              disabled={disabled || atMin}
              aria-label={`Decrease by ${step}`}
            >
              −{step}
            </button>
          ))}
        </div>

        <div className="session-quick-counter__value-wrap">
          {allowDirectEdit ? (
            <input
              id={inputId}
              className="session-quick-counter__value"
              type="number"
              inputMode={decimalPlaces > 0 ? "decimal" : "numeric"}
              min={Number.isFinite(Number(min)) ? min : undefined}
              max={Number.isFinite(Number(max)) ? max : undefined}
              step={decimalPlaces > 0 ? 1 / 10 ** decimalPlaces : 1}
              value={draft}
              disabled={disabled}
              aria-label={label || "Counter value"}
              onFocus={() => setEditing(true)}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={commitDraft}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitDraft();
                  event.currentTarget.blur();
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  setDraft(String(liveValueRef.current));
                  setEditing(false);
                  event.currentTarget.blur();
                }
              }}
            />
          ) : (
            <output
              className="session-quick-counter__value session-quick-counter__value--read-only"
              aria-label={label || "Counter value"}
            >
              {normalisedValue}
            </output>
          )}
          {unit ? <span className="session-quick-counter__unit">{unit}</span> : null}
        </div>

        <div className="session-quick-counter__increment" aria-label="Increase controls">
          {plusSteps.map((step) => (
            <button
              key={`plus-${step}`}
              type="button"
              className="session-quick-counter__button session-quick-counter__button--increment"
              onClick={() => changeBy(step)}
              disabled={disabled || atMax}
              aria-label={`Increase by ${step}`}
            >
              +{step}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
