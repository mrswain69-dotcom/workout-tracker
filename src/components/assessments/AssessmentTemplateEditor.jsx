import React, { useMemo, useState } from "react";
import {
  toEditorAssessmentTemplate,
  toEditorTemplateTest,
  validatePersistableAssessmentDefinition,
} from "./assessmentLibraryController.js";

function cleanText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function renumber(rows) {
  return rows.map((row, index) => ({ ...row, position: index + 1 }));
}

function emptyRow(position = 1) {
  return {
    id: "",
    assessmentTemplateId: "",
    testId: "",
    position,
    sectionLabel: "",
    displayLabel: "",
    instructions: "",
    protocolText: "",
    configOverride: {},
  };
}

function Field({ label, children }) {
  return (
    <label className="assessment-editor__field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export default function AssessmentTemplateEditor({
  value,
  tests = [],
  onSave,
  onCancel,
  saving = false,
}) {
  const initialTemplate = toEditorAssessmentTemplate(value?.template || {});
  const [template, setTemplate] = useState(initialTemplate);
  const [rows, setRows] = useState(() =>
    renumber(
      (Array.isArray(value?.templateTests) ? value.templateTests : [])
        .map(toEditorTemplateTest)
        .sort((a, b) => a.position - b.position)
    )
  );

  const activeTests = useMemo(
    () => tests.filter((test) => !test.archived).slice().sort((a, b) => cleanText(a.name).localeCompare(cleanText(b.name))),
    [tests]
  );

  const definition = useMemo(
    () => ({ template, templateTests: rows }),
    [template, rows]
  );
  const validation = useMemo(
    () => validatePersistableAssessmentDefinition(definition),
    [definition]
  );

  const patchRow = (index, patch) => {
    setRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row
      )
    );
  };

  const moveRow = (index, delta) => {
    setRows((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.length) return current;
      const next = current.slice();
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return renumber(next);
    });
  };

  const removeRow = (index) => {
    setRows((current) => renumber(current.filter((_, rowIndex) => rowIndex !== index)));
  };

  return (
    <form
      className="assessment-editor assessment-template-editor"
      aria-label={template.id ? "Edit Assessment" : "New Assessment"}
      onSubmit={(event) => {
        event.preventDefault();
        if (!validation.valid || saving) return;
        onSave?.({
          template: {
            ...template,
            name: cleanText(template.name),
            category: cleanText(template.category),
            description: cleanText(template.description),
          },
          templateTests: renumber(rows).map((row) => ({
            ...row,
            sectionLabel: cleanText(row.sectionLabel),
            displayLabel: cleanText(row.displayLabel),
            instructions: cleanText(row.instructions),
            protocolText: cleanText(row.protocolText),
          })),
        });
      }}
    >
      <div className="assessment-editor__heading">
        <div>
          <h3>{template.id ? "Edit Assessment" : "New Assessment"}</h3>
          {template.id ? <span className="assessment-editor__version">v{template.version}</span> : null}
        </div>
        <p>Build an ordered benchmark from reusable Tests. Edits affect future runs only.</p>
      </div>

      <div className="assessment-editor__grid assessment-editor__grid--two">
        <Field label="Assessment name">
          <input
            aria-label="Assessment name"
            value={template.name}
            disabled={saving}
            onChange={(event) =>
              setTemplate((current) => ({ ...current, name: event.target.value }))
            }
            placeholder="e.g. Football Monthly Benchmark"
          />
        </Field>
        <Field label="Category">
          <input
            aria-label="Assessment category"
            value={template.category}
            disabled={saving}
            onChange={(event) =>
              setTemplate((current) => ({ ...current, category: event.target.value }))
            }
            placeholder="e.g. Football"
          />
        </Field>
      </div>

      <Field label="Description">
        <textarea
          aria-label="Assessment description"
          rows={2}
          value={template.description}
          disabled={saving}
          onChange={(event) =>
            setTemplate((current) => ({ ...current, description: event.target.value }))
          }
        />
      </Field>

      <div className="assessment-template-editor__tests-heading">
        <div>
          <h4>Tests</h4>
          <p>Order matters and is preserved in each future Assessment run snapshot.</p>
        </div>
        <button
          type="button"
          disabled={saving || !activeTests.length}
          onClick={() => setRows((current) => [...current, emptyRow(current.length + 1)])}
        >
          + Add Test
        </button>
      </div>

      {!activeTests.length ? (
        <div className="assessment-editor__notice">Create at least one canonical Test before building an Assessment.</div>
      ) : null}

      <div className="assessment-template-editor__rows">
        {rows.map((row, index) => {
          const selectedTest = activeTests.find((test) => test.id === row.testId);
          return (
            <section key={row.id || `new-${index}`} className="assessment-template-test-row">
              <div className="assessment-template-test-row__top">
                <strong>{index + 1}. {row.displayLabel || selectedTest?.name || "Choose Test"}</strong>
                <div className="assessment-template-test-row__actions">
                  <button type="button" aria-label={`Move Test ${index + 1} up`} disabled={saving || index === 0} onClick={() => moveRow(index, -1)}>↑</button>
                  <button type="button" aria-label={`Move Test ${index + 1} down`} disabled={saving || index === rows.length - 1} onClick={() => moveRow(index, 1)}>↓</button>
                  <button type="button" aria-label={`Remove Test ${index + 1}`} disabled={saving} onClick={() => removeRow(index)}>Remove</button>
                </div>
              </div>

              <div className="assessment-editor__grid assessment-editor__grid--two">
                <Field label="Library Test">
                  <select
                    aria-label={`Test ${index + 1} library Test`}
                    value={row.testId}
                    disabled={saving}
                    onChange={(event) => patchRow(index, { testId: event.target.value })}
                  >
                    <option value="">Choose Test…</option>
                    {activeTests.map((test) => (
                      <option key={test.id} value={test.id}>{test.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Section">
                  <input
                    aria-label={`Test ${index + 1} section`}
                    value={row.sectionLabel}
                    disabled={saving}
                    onChange={(event) => patchRow(index, { sectionLabel: event.target.value })}
                    placeholder="e.g. Athletic"
                  />
                </Field>
              </div>

              <Field label="Display label">
                <input
                  aria-label={`Test ${index + 1} display label`}
                  value={row.displayLabel}
                  disabled={saving}
                  onChange={(event) => patchRow(index, { displayLabel: event.target.value })}
                  placeholder={selectedTest?.name || "Optional label override"}
                />
              </Field>

              <div className="assessment-editor__grid assessment-editor__grid--two">
                <Field label="Instructions">
                  <textarea
                    aria-label={`Test ${index + 1} instructions`}
                    rows={2}
                    value={row.instructions}
                    disabled={saving}
                    onChange={(event) => patchRow(index, { instructions: event.target.value })}
                    placeholder="What the athlete should do"
                  />
                </Field>
                <Field label="Protocol">
                  <textarea
                    aria-label={`Test ${index + 1} protocol`}
                    rows={2}
                    value={row.protocolText}
                    disabled={saving}
                    onChange={(event) => patchRow(index, { protocolText: event.target.value })}
                    placeholder="e.g. 3 attempts, full recovery"
                  />
                </Field>
              </div>
            </section>
          );
        })}
      </div>

      {!validation.valid ? (
        <div className="assessment-editor__error" role="alert">
          {validation.errors.join(" ")}
        </div>
      ) : null}

      <div className="assessment-editor__actions">
        <button type="button" disabled={saving} onClick={onCancel}>Cancel</button>
        <button type="submit" disabled={saving || !validation.valid}>
          {saving ? "Saving…" : "Save Assessment"}
        </button>
      </div>
    </form>
  );
}
