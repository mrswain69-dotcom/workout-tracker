import React, { useEffect, useMemo, useRef, useState } from "react";
import SessionMovementEditor, {
  formatDurationClock,
  normaliseSessionMovementDraft,
  parseDurationClock,
} from "./SessionMovementEditor.jsx";

let localMovementCounter = 0;

function nextLocalMovementId() {
  localMovementCounter += 1;
  return `session-movement-draft-${localMovementCounter}`;
}

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

export function normaliseSessionTemplateDraft(raw = {}, fallbackProgrammeId = "") {
  const durationRaw = raw.plannedDurationSec ?? raw.planned_duration_sec;
  return {
    id: cleanText(raw.id, ""),
    familyId: cleanText(raw.familyId ?? raw.family_id, ""),
    programmeId: cleanText(
      raw.programmeId ?? raw.programme_id,
      fallbackProgrammeId
    ),
    displayCode: cleanText(raw.displayCode ?? raw.display_code, ""),
    name: cleanText(raw.name, ""),
    description: cleanText(raw.description, ""),
    plannedDurationSec:
      durationRaw === null || durationRaw === undefined || durationRaw === ""
        ? null
        : finiteNonNegativeInt(durationRaw, 0),
    version: Math.max(1, finiteNonNegativeInt(raw.version, 1) || 1),
    sortOrder: finiteNonNegativeInt(raw.sortOrder ?? raw.sort_order, 0),
    archived: !!raw.archived,
  };
}

export function normaliseSessionTemplateMovementDrafts(rows = []) {
  return (Array.isArray(rows) ? rows : []).map((row, index) => {
    const normalised = normaliseSessionMovementDraft(row, index + 1);
    return {
      ...normalised,
      localId: normalised.localId || normalised.id || nextLocalMovementId(),
      position: index + 1,
    };
  });
}

export function validateSessionTemplateDraft(template, templateMovements = []) {
  const errors = [];
  const safeTemplate = normaliseSessionTemplateDraft(template);
  const rows = normaliseSessionTemplateMovementDrafts(templateMovements);

  if (!safeTemplate.programmeId) errors.push("Choose a programme.");
  if (!safeTemplate.name) errors.push("Session name is required.");
  if (!rows.length) errors.push("Add at least one movement.");

  rows.forEach((row, index) => {
    if (!row.movementId) errors.push(`Movement ${index + 1} must select a library movement.`);
  });

  return {
    valid: errors.length === 0,
    errors,
    template: safeTemplate,
    templateMovements: rows,
  };
}

function Field({ label, children, className = "" }) {
  return (
    <label className={`session-template-editor__field${className ? ` ${className}` : ""}`}>
      <span className="session-template-editor__field-label">{label}</span>
      {children}
    </label>
  );
}

export default function SessionTemplateEditor({
  template = {},
  templateMovements = [],
  programmes = [],
  canonicalMovements = [],
  onChange,
  onSave,
  onCancel,
  disabled = false,
  saving = false,
}) {
  const firstProgrammeId = cleanText(
    (Array.isArray(programmes) ? programmes : []).find((item) => item && !item.archived)?.id,
    ""
  );

  const initialTemplate = normaliseSessionTemplateDraft(template, firstProgrammeId);
  const initialRows = normaliseSessionTemplateMovementDrafts(templateMovements);
  const [draft, setDraft] = useState(initialTemplate);
  const [rows, setRows] = useState(initialRows);
  const [durationDraft, setDurationDraft] = useState(
    formatDurationClock(initialTemplate.plannedDurationSec)
  );
  const draftRef = useRef(initialTemplate);
  const rowsRef = useRef(initialRows);

  useEffect(() => {
    const nextTemplate = normaliseSessionTemplateDraft(template, firstProgrammeId);
    const nextRows = normaliseSessionTemplateMovementDrafts(templateMovements);
    draftRef.current = nextTemplate;
    rowsRef.current = nextRows;
    setDraft(nextTemplate);
    setRows(nextRows);
    setDurationDraft(formatDurationClock(nextTemplate.plannedDurationSec));
  }, [template, templateMovements, firstProgrammeId]);

  const activeProgrammes = useMemo(
    () =>
      (Array.isArray(programmes) ? programmes : [])
        .filter((item) => item && !item.archived)
        .slice()
        .sort((a, b) => {
          const sortDiff = Number(a.sort_order ?? a.sortOrder ?? 0) - Number(b.sort_order ?? b.sortOrder ?? 0);
          if (sortDiff) return sortDiff;
          return String(a.name || "").localeCompare(String(b.name || ""));
        }),
    [programmes]
  );

  const movementTotalSec = rows.reduce(
    (sum, row) => sum + (Number(row.plannedDurationSec) || 0),
    0
  );

  const emit = (nextTemplate, nextRows, meta = {}) => {
    const safeTemplate = normaliseSessionTemplateDraft(nextTemplate, firstProgrammeId);
    const safeRows = normaliseSessionTemplateMovementDrafts(nextRows);
    draftRef.current = safeTemplate;
    rowsRef.current = safeRows;
    setDraft(safeTemplate);
    setRows(safeRows);
    if (typeof onChange === "function") {
      onChange(
        { template: safeTemplate, templateMovements: safeRows },
        meta
      );
    }
  };

  const updateTemplate = (patch, meta = {}) => {
    emit({ ...draftRef.current, ...patch }, rowsRef.current, {
      source: "template",
      ...meta,
    });
  };

  const updateRow = (index, nextRow, meta = {}) => {
    const nextRows = rowsRef.current.map((row, rowIndex) =>
      rowIndex === index ? { ...nextRow, localId: row.localId || nextRow.localId } : row
    );
    emit(draftRef.current, nextRows, {
      source: "movement",
      movementIndex: index,
      ...meta,
    });
  };

  const moveRow = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= rowsRef.current.length) return;
    const nextRows = rowsRef.current.slice();
    [nextRows[index], nextRows[target]] = [nextRows[target], nextRows[index]];
    emit(draftRef.current, nextRows, {
      source: "movement-reorder",
      from: index,
      to: target,
    });
  };

  const removeRow = (index) => {
    const nextRows = rowsRef.current.filter((_, rowIndex) => rowIndex !== index);
    emit(draftRef.current, nextRows, {
      source: "movement-remove",
      movementIndex: index,
    });
  };

  const addRow = () => {
    const nextRows = [
      ...rowsRef.current,
      normaliseSessionMovementDraft(
        {
          localId: nextLocalMovementId(),
          movementId: "",
          displayLabel: "",
          instructions: "",
          plannedDurationSec: null,
          trackingMethod: "completion",
          trackingConfig: {},
        },
        rowsRef.current.length + 1
      ),
    ];
    emit(draftRef.current, nextRows, { source: "movement-add" });
  };

  const commitDuration = () => {
    if (disabled || saving) return;
    const text = String(durationDraft || "").trim();
    if (!text) {
      updateTemplate({ plannedDurationSec: null }, { field: "plannedDurationSec" });
      return;
    }
    const parsed = parseDurationClock(text);
    if (parsed === null) {
      setDurationDraft(formatDurationClock(draftRef.current.plannedDurationSec));
      return;
    }
    setDurationDraft(formatDurationClock(parsed));
    updateTemplate({ plannedDurationSec: parsed }, { field: "plannedDurationSec" });
  };

  const validation = validateSessionTemplateDraft(draft, rows);
  const isBusy = disabled || saving;
  const totalMismatch =
    movementTotalSec > 0 && Number(draft.plannedDurationSec || 0) !== movementTotalSec;

  return (
    <form
      className="session-template-editor"
      onSubmit={(event) => {
        event.preventDefault();
        if (isBusy || !validation.valid || typeof onSave !== "function") return;
        onSave({
          template: validation.template,
          templateMovements: validation.templateMovements,
        });
      }}
    >
      <header className="session-template-editor__header">
        <div>
          <span className="session-template-editor__eyebrow">Session template</span>
          <h3>{draft.name || "New Session"}</h3>
          {draft.id ? <small>Version {draft.version}</small> : null}
        </div>
      </header>

      <div className="session-template-editor__grid">
        <Field label="Programme">
          <select
            value={draft.programmeId}
            disabled={isBusy}
            aria-label="Session programme"
            onChange={(event) =>
              updateTemplate({ programmeId: event.target.value }, { field: "programmeId" })
            }
          >
            <option value="">Select programme…</option>
            {activeProgrammes.map((programme) => (
              <option key={programme.id} value={programme.id}>
                {programme.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Code">
          <input
            type="text"
            value={draft.displayCode}
            disabled={isBusy}
            placeholder="A"
            aria-label="Session code"
            onChange={(event) =>
              updateTemplate({ displayCode: event.target.value }, { field: "displayCode" })
            }
          />
        </Field>

        <Field label="Session name">
          <input
            type="text"
            value={draft.name}
            disabled={isBusy}
            placeholder="Close Control"
            aria-label="Session name"
            onChange={(event) =>
              updateTemplate({ name: event.target.value }, { field: "name" })
            }
          />
        </Field>

        <Field label="Planned duration">
          <input
            type="text"
            inputMode="numeric"
            value={durationDraft}
            disabled={isBusy}
            placeholder="15:00"
            aria-label="Session planned duration"
            onChange={(event) => setDurationDraft(event.target.value)}
            onBlur={commitDuration}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.blur();
              } else if (event.key === "Escape") {
                event.preventDefault();
                setDurationDraft(formatDurationClock(draftRef.current.plannedDurationSec));
                event.currentTarget.blur();
              }
            }}
          />
          <small>mm:ss</small>
        </Field>
      </div>

      <Field label="Description" className="session-template-editor__field--wide">
        <textarea
          rows={3}
          value={draft.description}
          disabled={isBusy}
          aria-label="Session description"
          onChange={(event) =>
            updateTemplate({ description: event.target.value }, { field: "description" })
          }
        />
      </Field>

      <section className="session-template-editor__movements" aria-label="Session movements">
        <div className="session-template-editor__movements-header">
          <div>
            <h4>Movements</h4>
            <span>{rows.length} movement{rows.length === 1 ? "" : "s"}</span>
          </div>
          <div className="session-template-editor__duration-summary">
            <span>Movement total: {formatDurationClock(movementTotalSec || 0)}</span>
            {totalMismatch ? (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => {
                  setDurationDraft(formatDurationClock(movementTotalSec));
                  updateTemplate(
                    { plannedDurationSec: movementTotalSec },
                    { field: "plannedDurationSec", source: "movement-total" }
                  );
                }}
              >
                Use movement total
              </button>
            ) : null}
          </div>
        </div>

        {rows.map((row, index) => (
          <SessionMovementEditor
            key={row.localId || row.id || `${row.movementId}-${index}`}
            movement={row}
            canonicalMovements={canonicalMovements}
            disabled={isBusy}
            canMoveUp={index > 0}
            canMoveDown={index < rows.length - 1}
            onChange={(next, meta) => updateRow(index, next, meta)}
            onMoveUp={() => moveRow(index, -1)}
            onMoveDown={() => moveRow(index, 1)}
            onRemove={() => removeRow(index)}
          />
        ))}

        <button
          type="button"
          className="session-template-editor__add-movement"
          disabled={isBusy}
          onClick={addRow}
        >
          + Add movement
        </button>
      </section>

      {!validation.valid ? (
        <div className="session-template-editor__validation" role="status">
          {validation.errors.map((error) => (
            <div key={error}>{error}</div>
          ))}
        </div>
      ) : null}

      <footer className="session-template-editor__actions">
        {typeof onCancel === "function" ? (
          <button type="button" disabled={isBusy} onClick={onCancel}>
            Cancel
          </button>
        ) : null}
        {typeof onSave === "function" ? (
          <button type="submit" disabled={isBusy || !validation.valid}>
            {saving ? "Saving…" : "Save Session"}
          </button>
        ) : null}
      </footer>
    </form>
  );
}
