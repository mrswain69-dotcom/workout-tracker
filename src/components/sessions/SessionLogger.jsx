import React, { useEffect, useMemo, useRef } from "react";
import SessionMovementCard from "./SessionMovementCard.jsx";

function cleanText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

export function formatSessionLoggerDuration(seconds) {
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

export function getSessionLoggerProgress(session) {
  const movements = Array.isArray(session?.movements) ? session.movements : [];
  let completed = 0;
  let skipped = 0;

  for (const movement of movements) {
    if (!movement || typeof movement !== "object") continue;
    if (movement.skipped) skipped += 1;
    else if (movement.completed) completed += 1;
  }

  const active = Math.max(0, movements.length - skipped);
  const remaining = Math.max(0, active - completed);

  return {
    total: movements.length,
    active,
    completed,
    skipped,
    remaining,
  };
}

/**
 * Completing a Session is deliberately independent from detailed result entry.
 * Every movement that has not been explicitly skipped is marked performed, while
 * existing result payloads and movement notes are preserved unchanged.
 */
export function completeSessionForLogging(session) {
  const safe = session && typeof session === "object" ? session : {};
  const movements = (Array.isArray(safe.movements) ? safe.movements : []).map(
    (movement) => {
      const current = movement && typeof movement === "object" ? movement : {};
      if (current.skipped) {
        return { ...current, completed: false, skipped: true };
      }
      return { ...current, completed: true, skipped: false };
    }
  );

  return {
    ...safe,
    completed: true,
    movements,
  };
}

export function reopenSessionForLogging(session) {
  const safe = session && typeof session === "object" ? session : {};
  return {
    ...safe,
    completed: false,
    movements: Array.isArray(safe.movements)
      ? safe.movements.map((movement) => ({ ...movement }))
      : [],
  };
}

function movementKey(movement, index) {
  return (
    cleanText(movement?.templateMovementId, "") ||
    cleanText(movement?.movementId, "") ||
    `movement-${index + 1}`
  );
}

export default function SessionLogger({
  session,
  blockLabel = "",
  onChange,
  disabled = false,
  showMovementNotes = true,
  className = "",
}) {
  const safeSession = session && typeof session === "object" ? session : {};
  const liveSessionRef = useRef(safeSession);

  useEffect(() => {
    liveSessionRef.current = safeSession;
  }, [safeSession]);

  const movements = Array.isArray(safeSession.movements)
    ? safeSession.movements
    : [];
  const progress = useMemo(
    () => getSessionLoggerProgress(safeSession),
    [safeSession]
  );

  const code = cleanText(safeSession.displayCode, "");
  const name = cleanText(safeSession.name, "Session");
  const programmeName = cleanText(safeSession.programmeName, "");
  const description = cleanText(safeSession.description, "");
  const templateVersion = Math.max(1, Number(safeSession.templateVersion) || 1);
  const plannedDuration = formatSessionLoggerDuration(safeSession.plannedDurationSec);
  const actualDuration = formatSessionLoggerDuration(safeSession.actualDurationSec);
  const isCompleted = !!safeSession.completed;

  const templateTitle = code ? `Session ${code} — ${name}` : name;
  const displayBlockLabel = cleanText(blockLabel, "");
  const showBlockLabel =
    !!displayBlockLabel && displayBlockLabel.toLowerCase() !== templateTitle.toLowerCase();

  const emit = (nextSession, meta = {}) => {
    const previous = liveSessionRef.current;
    liveSessionRef.current = nextSession;
    if (typeof onChange === "function") {
      onChange(nextSession, { previous, ...meta });
    }
  };

  const handleMovementChange = (index, nextMovement, meta = {}) => {
    if (disabled) return;
    const current = liveSessionRef.current;
    const currentMovements = Array.isArray(current.movements)
      ? current.movements
      : [];
    const nextMovements = currentMovements.map((movement, movementIndex) =>
      movementIndex === index ? nextMovement : movement
    );

    emit(
      {
        ...current,
        movements: nextMovements,
      },
      {
        source: "movement",
        movementIndex: index,
        templateMovementId: nextMovement?.templateMovementId || "",
        movementId: nextMovement?.movementId || "",
        movementMeta: meta,
      }
    );
  };

  const handleComplete = () => {
    if (disabled) return;
    const current = liveSessionRef.current;
    if (current.completed) return;
    emit(completeSessionForLogging(current), { source: "session-complete" });
  };

  const handleReopen = () => {
    if (disabled) return;
    const current = liveSessionRef.current;
    if (!current.completed) return;
    emit(reopenSessionForLogging(current), { source: "session-reopen" });
  };

  const rootClass = [
    "session-logger",
    isCompleted ? "session-logger--completed" : "",
    disabled ? "session-logger--disabled" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section
      className={rootClass}
      data-testid="session-logger"
      data-session-completed={isCompleted ? "true" : "false"}
      aria-label={templateTitle}
    >
      <header className="session-logger__header">
        <div className="session-logger__identity">
          <div className="session-logger__eyebrow">
            {code ? `SESSION ${code}` : "SESSION"}
          </div>
          <h3 className="session-logger__title">{name}</h3>
          {showBlockLabel ? (
            <div className="session-logger__block-label">{displayBlockLabel}</div>
          ) : null}
        </div>

        <div
          className={`session-logger__status${
            isCompleted ? " session-logger__status--complete" : ""
          }`}
          role="status"
        >
          {isCompleted ? "Complete" : "In progress"}
        </div>
      </header>

      <div className="session-logger__meta" aria-label="Session details">
        {programmeName ? <span>{programmeName}</span> : null}
        {plannedDuration ? <span>Planned {plannedDuration}</span> : null}
        {actualDuration ? <span>Actual {actualDuration}</span> : null}
        <span>v{templateVersion}</span>
      </div>

      {description ? (
        <p className="session-logger__description">{description}</p>
      ) : null}

      <div className="session-logger__progress" aria-label="Session movement progress">
        <div>
          <strong>{progress.completed}</strong> of <strong>{progress.active}</strong> active drills done
        </div>
        {progress.skipped > 0 ? (
          <div>{progress.skipped} skipped</div>
        ) : null}
      </div>

      {movements.length ? (
        <div className="session-logger__movements">
          {movements.map((movement, index) => (
            <SessionMovementCard
              key={movementKey(movement, index)}
              movement={movement}
              disabled={disabled}
              showNotes={showMovementNotes}
              onChange={(nextMovement, meta) =>
                handleMovementChange(index, nextMovement, meta)
              }
            />
          ))}
        </div>
      ) : (
        <div className="session-logger__empty">
          No drills are defined in this frozen Session snapshot.
        </div>
      )}

      <footer className="session-logger__footer">
        <div className="session-logger__completion-copy">
          {isCompleted
            ? "Session completed. Results and notes can still be corrected."
            : "Detailed counts are optional. Complete the Session when the work is done."}
        </div>

        {isCompleted ? (
          <button
            type="button"
            className="session-logger__reopen"
            disabled={disabled}
            onClick={handleReopen}
          >
            Reopen Session
          </button>
        ) : (
          <button
            type="button"
            className="session-logger__complete"
            disabled={disabled}
            onClick={handleComplete}
          >
            Complete Session
          </button>
        )}
      </footer>
    </section>
  );
}
