import React, { useEffect, useRef } from "react";
import { normaliseSessionTrackingMethod } from "../../config/sessionTracking.js";
import MovementResultControl from "./MovementResultControl.jsx";

function cleanText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

export function formatSessionMovementDuration(seconds) {
  if (seconds === null || seconds === undefined || seconds === "") return "";
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  if (!total) return "";

  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

/**
 * One reusable movement/drill card inside a structured Session.
 *
 * Behaviour rules:
 * - "Done" and "Skipped" are mutually exclusive.
 * - Recording any numeric/structured result automatically marks the movement done.
 * - Skipping preserves any existing result but disables result editing; the Session
 *   engine ignores skipped movement results, so unskipping can safely restore them.
 * - Notes remain editable while skipped so the user can explain why a drill was skipped.
 */
export default function SessionMovementCard({
  movement,
  onChange,
  disabled = false,
  showNotes = true,
  showStatusControls = true,
  className = "",
}) {
  const safeMovement = movement && typeof movement === "object" ? movement : {};
  const liveMovementRef = useRef(safeMovement);

  useEffect(() => {
    liveMovementRef.current = safeMovement;
  }, [safeMovement]);

  const label = cleanText(
    safeMovement.displayLabel,
    cleanText(safeMovement.name, "Movement")
  );
  const instructions = cleanText(safeMovement.instructions, "");
  const durationLabel = formatSessionMovementDuration(safeMovement.plannedDurationSec);
  const trackingMethod = normaliseSessionTrackingMethod(safeMovement.trackingMethod);
  const completed = !!safeMovement.completed;
  const skipped = !!safeMovement.skipped;

  const emitPatch = (patch, meta = {}) => {
    const previous = liveMovementRef.current;
    const next = {
      ...previous,
      ...patch,
    };
    liveMovementRef.current = next;

    if (typeof onChange === "function") {
      onChange(next, {
        previous,
        movementId: next.movementId || "",
        templateMovementId: next.templateMovementId || "",
        ...meta,
      });
    }
  };

  const markDone = () => {
    if (disabled) return;
    const current = liveMovementRef.current;
    if (current.completed && !current.skipped) return;
    emitPatch(
      { completed: true, skipped: false },
      { source: "status", status: "completed" }
    );
  };

  const toggleSkipped = () => {
    if (disabled) return;
    const current = liveMovementRef.current;
    const nextSkipped = !current.skipped;
    emitPatch(
      {
        skipped: nextSkipped,
        completed: nextSkipped ? false : !!current.completed,
      },
      { source: "status", status: nextSkipped ? "skipped" : "unskipped" }
    );
  };

  const handleCompletedChange = (nextCompleted, meta = {}) => {
    if (disabled) return;
    emitPatch(
      {
        completed: !!nextCompleted,
        skipped: nextCompleted ? false : !!liveMovementRef.current.skipped,
      },
      { source: "completion", control: meta }
    );
  };

  const handleResultChange = (nextResult, meta = {}) => {
    if (disabled || liveMovementRef.current.skipped) return;
    emitPatch(
      {
        result: nextResult,
        completed: true,
        skipped: false,
      },
      { source: "result", control: meta }
    );
  };

  const handleNoteChange = (event) => {
    if (disabled) return;
    emitPatch(
      { note: event.target.value },
      { source: "note" }
    );
  };

  const rootClass = [
    "session-movement-card",
    completed ? "session-movement-card--completed" : "",
    skipped ? "session-movement-card--skipped" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article
      className={rootClass}
      data-testid="session-movement-card"
      data-tracking-method={trackingMethod}
      data-completed={completed ? "true" : "false"}
      data-skipped={skipped ? "true" : "false"}
      aria-label={label}
    >
      <header className="session-movement-card__header">
        <div className="session-movement-card__title-wrap">
          <h4 className="session-movement-card__title">{label}</h4>
          {durationLabel ? (
            <span className="session-movement-card__duration" aria-label={`Planned duration ${durationLabel}`}>
              {durationLabel}
            </span>
          ) : null}
        </div>

        {showStatusControls ? (
          <div className="session-movement-card__status-controls" aria-label="Movement status">
            {trackingMethod !== "completion" ? (
              <button
                type="button"
                className={`session-movement-card__status session-movement-card__status--done${
                  completed && !skipped ? " session-movement-card__status--active" : ""
                }`}
                aria-pressed={completed && !skipped}
                disabled={disabled}
                onClick={markDone}
              >
                Done
              </button>
            ) : null}

            <button
              type="button"
              className={`session-movement-card__status session-movement-card__status--skip${
                skipped ? " session-movement-card__status--active" : ""
              }`}
              aria-pressed={skipped}
              disabled={disabled}
              onClick={toggleSkipped}
            >
              {skipped ? "Skipped" : "Skip"}
            </button>
          </div>
        ) : null}
      </header>

      {instructions ? (
        <p className="session-movement-card__instructions">{instructions}</p>
      ) : null}

      <div className="session-movement-card__result">
        <MovementResultControl
          movement={safeMovement}
          trackingMethod={trackingMethod}
          trackingConfig={safeMovement.trackingConfig}
          result={safeMovement.result}
          completed={completed}
          label={label}
          idPrefix={safeMovement.templateMovementId || safeMovement.movementId || undefined}
          disabled={disabled || skipped}
          onChange={handleResultChange}
          onCompletedChange={handleCompletedChange}
        />
      </div>

      {skipped ? (
        <div className="session-movement-card__skipped-message" role="status">
          Skipped — result entry is paused.
        </div>
      ) : null}

      {showNotes ? (
        <div className="session-movement-card__notes">
          <label className="session-movement-card__notes-label">
            Notes
            <textarea
              className="session-movement-card__notes-input"
              value={safeMovement.note || ""}
              disabled={disabled}
              rows={2}
              aria-label={`${label} notes`}
              onChange={handleNoteChange}
              placeholder="Optional note"
            />
          </label>
        </div>
      ) : null}
    </article>
  );
}
