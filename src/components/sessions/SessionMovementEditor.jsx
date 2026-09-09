import React, { useMemo, useState } from "react";
import {
  SESSION_SIDE_MODE_OPTIONS,
  SESSION_TRACKING_METHOD_OPTIONS,
  SESSION_UNIT_OPTIONS,
  normaliseSessionTrackingConfig,
  normaliseSessionTrackingMethod,
  trackingMethodSupportsSides,
  trackingMethodUsesQuickCounter,
} from "../../config/sessionTracking.js";

function cleanText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function finiteNonNegativeInt(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.round(n));
}

export function formatDurationClock(seconds) {
  if (seconds === null || seconds === undefined || seconds === "") return "";
  const total = finiteNonNegativeInt(seconds, 0);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export function parseDurationClock(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;

  if (/^\d+$/.test(text)) {
    return finiteNonNegativeInt(text, 0);
  }

  const match = text.match(/^(\d+):([0-5]?\d)$/);
  if (!match) return null;
  return finiteNonNegativeInt(match[1], 0) * 60 + finiteNonNegativeInt(match[2], 0);
}

function normaliseQuickStepsText(value) {
  const values = String(value ?? "")
    .split(/[\s,]+/)
    .map((part) => Math.round(Number(part)))
    .filter((part) => Number.isFinite(part) && part > 0 && part <= 100000);
  return [...new Set(values)].sort((a, b) => a - b);
}

export function normaliseSessionMovementDraft(raw = {}, position = 1) {
  const trackingMethod = normaliseSessionTrackingMethod(
    raw.trackingMethod ?? raw.tracking_method ?? "completion"
  );
  const trackingConfig = normaliseSessionTrackingConfig(
    trackingMethod,
    raw.trackingConfig ?? raw.tracking_config ?? {}
  );

  const durationRaw = raw.plannedDurationSec ?? raw.planned_duration_sec;

  return {
    id: cleanText(raw.id, ""),
    localId: cleanText(raw.localId, ""),
    movementId: cleanText(raw.movementId ?? raw.movement_id, ""),
    position: Math.max(1, finiteNonNegativeInt(raw.position, position) || position),
    displayLabel: cleanText(raw.displayLabel ?? raw.display_label, ""),
    instructions: cleanText(raw.instructions, ""),
    plannedDurationSec:
      durationRaw === null || durationRaw === undefined || durationRaw === ""
        ? null
        : finiteNonNegativeInt(durationRaw, 0),
    trackingMethod,
    trackingConfig,
  };
}

function Field({ label, children, className = "" }) {
  return (
    <label className={`session-movement-editor__field${className ? ` ${className}` : ""}`}>
      <span className="session-movement-editor__field-label">{label}</span>
      {children}
    </label>
  );
}

export default function SessionMovementEditor({
  movement,
  canonicalMovements = [],
  onChange,
  onMoveUp,
  onMoveDown,
  onRemove,
  canMoveUp = true,
  canMoveDown = true,
  disabled = false,
}) {
  const draft = normaliseSessionMovementDraft(movement, movement?.position || 1);
  const [durationDraft, setDurationDraft] = useState(
    formatDurationClock(draft.plannedDurationSec)
  );

  const availableMovements = useMemo(
    () =>
      (Array.isArray(canonicalMovements) ? canonicalMovements : [])
        .filter((item) => item && !item.archived)
        .slice()
        .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""))),
    [canonicalMovements]
  );

  const selectedCanonical = availableMovements.find(
    (item) => String(item.id) === draft.movementId
  );

  const emit = (patch, meta = {}) => {
    if (disabled) return;
    const next = normaliseSessionMovementDraft(
      { ...draft, ...patch },
      draft.position
    );
    if (typeof onChange === "function") onChange(next, meta);
  };

  const setTrackingMethod = (trackingMethod) => {
    const method = normaliseSessionTrackingMethod(trackingMethod);
    emit(
      {
        trackingMethod: method,
        trackingConfig: normaliseSessionTrackingConfig(method, {}),
      },
      { source: "tracking-method" }
    );
  };

  const setTrackingConfig = (patch, meta = {}) => {
    emit(
      {
        trackingConfig: normaliseSessionTrackingConfig(draft.trackingMethod, {
          ...draft.trackingConfig,
          ...patch,
          required: false,
        }),
      },
      { source: "tracking-config", ...meta }
    );
  };

  const commitDuration = () => {
    if (disabled) return;
    const text = String(durationDraft || "").trim();
    if (!text) {
      emit({ plannedDurationSec: null }, { source: "duration" });
      return;
    }
    const parsed = parseDurationClock(text);
    if (parsed === null) {
      setDurationDraft(formatDurationClock(draft.plannedDurationSec));
      return;
    }
    setDurationDraft(formatDurationClock(parsed));
    emit({ plannedDurationSec: parsed }, { source: "duration" });
  };

  const method = draft.trackingMethod;
  const config = draft.trackingConfig;
  const usesCounter = trackingMethodUsesQuickCounter(method);
  const supportsSides = trackingMethodSupportsSides(method);
  const isAttempts = method === "attempts_successes";
  const isSets = method === "sets_reps";
  const isCompletion = method === "completion";
  const usesUnit = [
    "repetitions",
    "duration",
    "distance",
    "weight",
    "successful_executions",
    "best_score",
    "numeric",
  ].includes(method);
  const usesDecimals = ["duration", "distance", "weight", "best_score", "numeric"].includes(
    method
  );

  return (
    <section
      className="session-movement-editor"
      data-position={draft.position}
      aria-label={`Movement ${draft.position}`}
    >
      <div className="session-movement-editor__header">
        <strong>Movement {draft.position}</strong>
        <div className="session-movement-editor__order-controls">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={disabled || !canMoveUp}
            aria-label={`Move movement ${draft.position} up`}
          >
            ↑
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={disabled || !canMoveDown}
            aria-label={`Move movement ${draft.position} down`}
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            aria-label={`Remove movement ${draft.position}`}
          >
            Remove
          </button>
        </div>
      </div>

      <div className="session-movement-editor__grid">
        <Field label="Movement">
          <select
            value={draft.movementId}
            disabled={disabled}
            aria-label={`Movement ${draft.position} library movement`}
            onChange={(event) => {
              const previousName = cleanText(selectedCanonical?.name, "");
              const nextId = event.target.value;
              const nextMovement = availableMovements.find(
                (item) => String(item.id) === nextId
              );
              const nextName = cleanText(nextMovement?.name, "");
              const shouldRefreshLabel =
                !draft.displayLabel || draft.displayLabel === previousName;
              emit(
                {
                  movementId: nextId,
                  displayLabel: shouldRefreshLabel ? nextName : draft.displayLabel,
                },
                { source: "movement-selection" }
              );
            }}
          >
            <option value="">Select movement…</option>
            {availableMovements.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Display label">
          <input
            type="text"
            value={draft.displayLabel}
            disabled={disabled}
            aria-label={`Movement ${draft.position} display label`}
            onChange={(event) =>
              emit({ displayLabel: event.target.value }, { source: "display-label" })
            }
          />
        </Field>

        <Field label="Planned duration">
          <input
            type="text"
            inputMode="numeric"
            value={durationDraft}
            disabled={disabled}
            placeholder="2:30"
            aria-label={`Movement ${draft.position} planned duration`}
            onChange={(event) => setDurationDraft(event.target.value)}
            onBlur={commitDuration}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.blur();
              } else if (event.key === "Escape") {
                event.preventDefault();
                setDurationDraft(formatDurationClock(draft.plannedDurationSec));
                event.currentTarget.blur();
              }
            }}
          />
          <small>mm:ss</small>
        </Field>

        <Field label="Tracking method">
          <select
            value={method}
            disabled={disabled}
            aria-label={`Movement ${draft.position} tracking method`}
            onChange={(event) => setTrackingMethod(event.target.value)}
          >
            {SESSION_TRACKING_METHOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Instructions" className="session-movement-editor__field--wide">
        <textarea
          rows={3}
          value={draft.instructions}
          disabled={disabled}
          aria-label={`Movement ${draft.position} instructions`}
          onChange={(event) =>
            emit({ instructions: event.target.value }, { source: "instructions" })
          }
        />
      </Field>

      <div className="session-movement-editor__tracking-settings">
        <div className="session-movement-editor__tracking-heading">
          <strong>Tracking settings</strong>
          <span>Detailed result entry stays optional.</span>
        </div>

        {isCompletion ? (
          <p className="session-movement-editor__hint">
            This movement records only whether it was practised.
          </p>
        ) : (
          <div className="session-movement-editor__grid">
            {!isSets ? (
              <Field label={isAttempts ? "Attempts label" : "Result label"}>
                <input
                  type="text"
                  value={isAttempts ? config.attemptsLabel || "" : config.countLabel || ""}
                  disabled={disabled}
                  aria-label={`Movement ${draft.position} ${isAttempts ? "attempts label" : "result label"}`}
                  onChange={(event) =>
                    setTrackingConfig(
                      isAttempts
                        ? { attemptsLabel: event.target.value }
                        : { countLabel: event.target.value },
                      { field: isAttempts ? "attemptsLabel" : "countLabel" }
                    )
                  }
                />
              </Field>
            ) : null}

            {isAttempts ? (
              <Field label="Successes label">
                <input
                  type="text"
                  value={config.successesLabel || ""}
                  disabled={disabled}
                  aria-label={`Movement ${draft.position} successes label`}
                  onChange={(event) =>
                    setTrackingConfig(
                      { successesLabel: event.target.value },
                      { field: "successesLabel" }
                    )
                  }
                />
              </Field>
            ) : null}

            {usesUnit ? (
              <Field label={method === "weight" ? "Weight unit" : "Unit"}>
                <select
                  value={method === "weight" ? config.weightUnit : config.unit}
                  disabled={disabled}
                  aria-label={`Movement ${draft.position} unit`}
                  onChange={(event) =>
                    setTrackingConfig(
                      method === "weight"
                        ? { unit: event.target.value, weightUnit: event.target.value }
                        : { unit: event.target.value },
                      { field: "unit" }
                    )
                  }
                >
                  <option value="">No unit</option>
                  {SESSION_UNIT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}

            {supportsSides ? (
              <Field label="Left / right">
                <select
                  value={config.sideMode}
                  disabled={disabled}
                  aria-label={`Movement ${draft.position} side mode`}
                  onChange={(event) =>
                    setTrackingConfig(
                      { sideMode: event.target.value },
                      { field: "sideMode" }
                    )
                  }
                >
                  {SESSION_SIDE_MODE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}

            {usesCounter ? (
              <Field label="Quick counter steps">
                <input
                  type="text"
                  value={(config.quickSteps || []).join(", ")}
                  disabled={disabled}
                  aria-label={`Movement ${draft.position} quick counter steps`}
                  onChange={(event) =>
                    setTrackingConfig(
                      { quickSteps: normaliseQuickStepsText(event.target.value) },
                      { field: "quickSteps" }
                    )
                  }
                />
              </Field>
            ) : null}

            {usesDecimals ? (
              <Field label="Decimal places">
                <select
                  value={config.decimalPlaces}
                  disabled={disabled}
                  aria-label={`Movement ${draft.position} decimal places`}
                  onChange={(event) =>
                    setTrackingConfig(
                      { decimalPlaces: Number(event.target.value) },
                      { field: "decimalPlaces" }
                    )
                  }
                >
                  {[0, 1, 2, 3].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}

            {isSets ? (
              <>
                <Field label="Resistance">
                  <input
                    type="checkbox"
                    checked={!!config.allowWeight}
                    disabled={disabled}
                    aria-label={`Movement ${draft.position} track resistance`}
                    onChange={(event) =>
                      setTrackingConfig(
                        { allowWeight: event.target.checked },
                        { field: "allowWeight" }
                      )
                    }
                  />
                </Field>
                {config.allowWeight ? (
                  <Field label="Resistance unit">
                    <select
                      value={config.weightUnit}
                      disabled={disabled}
                      aria-label={`Movement ${draft.position} resistance unit`}
                      onChange={(event) =>
                        setTrackingConfig(
                          { weightUnit: event.target.value },
                          { field: "weightUnit" }
                        )
                      }
                    >
                      {SESSION_UNIT_OPTIONS.filter((item) => ["kg", "lb"].includes(item.value)).map(
                        (option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        )
                      )}
                    </select>
                  </Field>
                ) : null}
              </>
            ) : null}

            {usesCounter ? (
              <Field label="Direct correction">
                <input
                  type="checkbox"
                  checked={!!config.allowDirectEdit}
                  disabled={disabled}
                  aria-label={`Movement ${draft.position} allow direct edit`}
                  onChange={(event) =>
                    setTrackingConfig(
                      { allowDirectEdit: event.target.checked },
                      { field: "allowDirectEdit" }
                    )
                  }
                />
              </Field>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
