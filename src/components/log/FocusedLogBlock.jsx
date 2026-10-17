import React from "react";

// Keep the active editor mounted when its first result changes completion.
export default function FocusedLogBlock({
  label,
  programSource = null,
  extraLabel = "",
  onRemoveExtra,
  summary = "",
  open = false,
  complete = false,
  cancelled = false,
  suspended = false,
  onToggle,
  onInteract,
  children,
}) {
  const keepEditorOpen = (event) => {
    const target = event.target;
    if (target.matches('textarea, select, input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]), [contenteditable="true"]')) {
      onInteract?.();
    }
  };
  const stateClass = cancelled
    ? "isCancelled"
    : complete
    ? "isComplete"
    : suspended
    ? "isSuspended"
    : "";

  return (
    <div className={`focusedLogBlock ${open ? "isOpen" : "isCollapsed"} ${stateClass}${programSource ? " isProgramAdded" : ""}`}>
      <button
        type="button"
        className="focusedLogBlockSummary"
        onClick={onToggle}
        aria-expanded={open}
      >
        <div className="focusedLogBlockSummary__copy">
          {programSource ? (
            <div className="focusedLogBlockSource">Group Program · {programSource.title || "Assigned Program"}</div>
          ) : null}
          <div className="focusedLogBlockTitle">{label || "Activity"}</div>
          {summary ? <div className="focusedLogBlockMeta">{summary}</div> : null}
        </div>
        <span className="focusedLogBlockState" aria-hidden="true">
          {cancelled ? "C" : complete ? "✓" : suspended ? "Ⅱ" : open ? "−" : "+"}
        </span>
      </button>
      {open ? (
        <div className="focusedLogBlockBody" onFocusCapture={keepEditorOpen} onChangeCapture={keepEditorOpen}>
          {children}
          {onRemoveExtra ? (
            <div className="extraBlockRemove">
              <button type="button" className="btn btn-secondary btnSmall" onClick={onRemoveExtra}>Remove</button>
            </div>
          ) : null}
          {extraLabel ? <div className="oneDayExtraPill">{extraLabel}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

