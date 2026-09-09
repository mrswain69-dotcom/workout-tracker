import React, { useCallback, useEffect, useMemo, useState } from "react";
import * as assessmentDb from "../../assessmentDb.js";
import AssessmentTestEditor from "./AssessmentTestEditor.jsx";
import AssessmentTemplateEditor from "./AssessmentTemplateEditor.jsx";
import {
  activeAssessmentsUsingTest,
  emptyAssessmentLibrary,
  getAssessmentDefinition,
  getTestDevelopmentTagIds,
  normaliseAssessmentLibrary,
  persistAssessmentDefinition,
  persistCanonicalTest,
  toEditorTest,
} from "./assessmentLibraryController.js";

function cleanText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function resultError(result, fallback) {
  if (!result?.error) return null;
  const message = result.error?.message || String(result.error);
  return new Error(`${fallback}: ${message}`);
}

async function expectMutation(promise, fallback) {
  const result = await promise;
  const error = resultError(result, fallback);
  if (error) throw error;
  return result?.data || null;
}

function defaultConfirm(message) {
  if (typeof window === "undefined" || typeof window.confirm !== "function") return true;
  return window.confirm(message);
}

function metricSummary(test) {
  const editor = toEditorTest(test);
  const strategy =
    editor.resultStrategy === "best"
      ? "best"
      : editor.resultStrategy === "average"
      ? "average"
      : "single";
  const direction = editor.scoringDirection === "lower" ? "lower better" : "higher better";
  const sides = editor.sideMode === "separate" ? " · L/R" : "";
  const unit = editor.unit ? ` · ${editor.unit}` : "";
  return `${editor.metricType.replaceAll("_", " ")} · ${editor.attemptCount} attempt${editor.attemptCount === 1 ? "" : "s"} · ${strategy} · ${direction}${sides}${unit}`;
}

function TemplateCard({ template, rows, testsById, onEdit, onArchive, busy }) {
  return (
    <article className="assessment-library__card">
      <div className="assessment-library__card-top">
        <div>
          <div className="assessment-library__card-title">{template.name}</div>
          <div className="assessment-library__card-meta">
            {template.category ? `${template.category} · ` : ""}v{template.version || 1} · {rows.length} Test{rows.length === 1 ? "" : "s"}
          </div>
        </div>
        <div className="assessment-library__card-actions">
          <button type="button" disabled={busy} onClick={() => onEdit(template.id)}>Edit</button>
          <button type="button" disabled={busy} onClick={() => onArchive(template)}>Archive</button>
        </div>
      </div>
      {template.description ? <p>{template.description}</p> : null}
      {rows.length ? (
        <ol className="assessment-library__ordered-tests">
          {rows.map((row) => (
            <li key={row.id || `${template.id}-${row.position}`}>
              <span>{row.display_label || row.displayLabel || testsById.get(row.test_id || row.testId)?.name || "Test"}</span>
              {(row.section_label || row.sectionLabel) ? <small>{row.section_label || row.sectionLabel}</small> : null}
            </li>
          ))}
        </ol>
      ) : <div className="assessment-library__empty-inline">No Tests yet.</div>}
    </article>
  );
}

function TestCard({ test, tagNames, usageCount, onEdit, onArchive, busy }) {
  return (
    <article className="assessment-library__card">
      <div className="assessment-library__card-top">
        <div>
          <div className="assessment-library__card-title">{test.name}</div>
          <div className="assessment-library__card-meta">v{test.version || 1} · {metricSummary(test)}</div>
        </div>
        <div className="assessment-library__card-actions">
          <button type="button" disabled={busy} onClick={() => onEdit(test)}>Edit</button>
          <button type="button" disabled={busy} onClick={() => onArchive(test)}>Archive</button>
        </div>
      </div>
      {test.description ? <p>{test.description}</p> : null}
      <div className="assessment-library__test-footer">
        <div className="assessment-library__tags">
          {tagNames.length ? tagNames.map((name) => <span key={name}>{name}</span>) : <small>No Development Tags</small>}
        </div>
        <small>{usageCount ? `Used by ${usageCount} active Assessment${usageCount === 1 ? "" : "s"}` : "Not used by an active Assessment"}</small>
      </div>
    </article>
  );
}

const styles = `
.assessment-library{display:flex;flex-direction:column;gap:14px}
.assessment-library__header,.assessment-library__toolbar,.assessment-library__card-top,.assessment-library__test-footer,.assessment-template-editor__tests-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.assessment-library__header h2,.assessment-editor h3,.assessment-editor h4{margin:0}
.assessment-library__header p,.assessment-editor__heading p,.assessment-template-editor__tests-heading p{margin:4px 0 0;color:#64748b;font-size:13px}
.assessment-library__eyebrow{text-transform:uppercase;font-size:11px;font-weight:800;letter-spacing:.08em;color:#64748b}
.assessment-library__tabs{display:flex;gap:8px;flex-wrap:wrap}
.assessment-library__tabs button[aria-pressed="true"]{font-weight:800;box-shadow:inset 0 0 0 2px rgba(14,165,233,.35)}
.assessment-library__toolbar{align-items:center}
.assessment-library__grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}
.assessment-library__card{border:1px solid rgba(15,23,42,.12);border-radius:16px;padding:14px;background:rgba(255,255,255,.72)}
.assessment-library__card-title{font-size:16px;font-weight:850}
.assessment-library__card-meta{font-size:12px;color:#64748b;margin-top:3px}
.assessment-library__card-actions{display:flex;gap:6px;flex-wrap:wrap}
.assessment-library__card p{font-size:13px;color:#475569;margin:10px 0}
.assessment-library__ordered-tests{margin:10px 0 0;padding-left:20px;display:grid;gap:5px}
.assessment-library__ordered-tests li{font-size:13px}.assessment-library__ordered-tests small{display:block;color:#64748b}
.assessment-library__tags{display:flex;gap:5px;flex-wrap:wrap}.assessment-library__tags span{font-size:11px;padding:3px 7px;border-radius:999px;background:#e2e8f0}
.assessment-library__error{padding:10px 12px;border-radius:12px;background:#fee2e2;color:#991b1b}.assessment-library__status{padding:10px 12px;border-radius:12px;background:#dcfce7;color:#166534}
.assessment-library__empty,.assessment-library__empty-inline,.assessment-editor__notice{padding:16px;border:1px dashed #cbd5e1;border-radius:14px;color:#64748b}
.assessment-editor{display:flex;flex-direction:column;gap:14px;border:1px solid rgba(15,23,42,.12);border-radius:18px;padding:16px;background:#fff}
.assessment-editor__heading>div{display:flex;align-items:center;gap:8px}.assessment-editor__version{font-size:11px;font-weight:800;background:#e2e8f0;padding:3px 7px;border-radius:999px}
.assessment-editor__grid{display:grid;gap:12px}.assessment-editor__grid--two{grid-template-columns:repeat(2,minmax(0,1fr))}.assessment-editor__grid--three{grid-template-columns:repeat(3,minmax(0,1fr))}
.assessment-editor__field{display:flex;flex-direction:column;gap:5px}.assessment-editor__field>span,.assessment-editor__tags legend{font-size:12px;font-weight:800}.assessment-editor__field small,.assessment-editor__tags p{font-size:11px;color:#64748b;margin:0}
.assessment-editor input,.assessment-editor select,.assessment-editor textarea{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:10px;padding:8px;background:#fff;color:inherit}
.assessment-editor__checks,.assessment-editor__tag-grid{display:flex;gap:12px;flex-wrap:wrap}.assessment-editor__checks label,.assessment-editor__tag-grid label,.assessment-editor__inline-check{display:flex;align-items:center;gap:6px;font-size:13px}.assessment-editor__checks input,.assessment-editor__tag-grid input,.assessment-editor__inline-check input{width:auto}
.assessment-editor__tags{border:1px solid #e2e8f0;border-radius:12px;padding:10px}.assessment-editor__tag-grid{margin-top:8px}
.assessment-editor__advanced-toggle{align-self:flex-start}.assessment-editor__advanced{padding:12px;border-radius:12px;background:#f8fafc;display:flex;flex-direction:column;gap:10px}
.assessment-editor__inline-check--bottom{align-self:end;padding-bottom:9px}.assessment-editor__error{padding:9px 11px;border-radius:10px;background:#fee2e2;color:#991b1b;font-size:13px}
.assessment-editor__actions{display:flex;justify-content:flex-end;gap:8px}.assessment-editor__actions button:last-child{font-weight:800}
.assessment-template-editor__rows{display:flex;flex-direction:column;gap:10px}.assessment-template-test-row{border:1px solid #e2e8f0;border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:10px}.assessment-template-test-row__top{display:flex;justify-content:space-between;gap:8px;align-items:center}.assessment-template-test-row__actions{display:flex;gap:5px;flex-wrap:wrap}
@media(max-width:720px){.assessment-editor__grid--two,.assessment-editor__grid--three{grid-template-columns:1fr}.assessment-library__header,.assessment-library__toolbar,.assessment-library__test-footer{flex-direction:column}.assessment-library__card-top{flex-direction:column}.assessment-template-test-row__top{align-items:flex-start;flex-direction:column}}
`;

export default function AssessmentTemplateLibrary({
  familyId,
  dbApi = assessmentDb,
  confirmArchive = defaultConfirm,
  onLibraryChange,
  authorizeMutation = async () => true,
}) {
  const [library, setLibrary] = useState(() => emptyAssessmentLibrary());
  const [view, setView] = useState("assessments");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [testEditor, setTestEditor] = useState(null);
  const [assessmentEditor, setAssessmentEditor] = useState(null);

  const refreshLibrary = useCallback(async ({ preserveStatus = true } = {}) => {
    if (!familyId) {
      setLibrary(emptyAssessmentLibrary());
      return emptyAssessmentLibrary();
    }
    setLoading(true);
    setError("");
    if (!preserveStatus) setStatus("");
    try {
      const result = await dbApi.loadAssessmentLibrary(familyId);
      const loadError = resultError(result, "Could not load Assessment Library");
      if (loadError) throw loadError;
      const next = normaliseAssessmentLibrary(result?.data || {});
      setLibrary(next);
      onLibraryChange?.(next);
      return next;
    } catch (loadError) {
      setError(loadError.message || String(loadError));
      return null;
    } finally {
      setLoading(false);
    }
  }, [familyId, dbApi, onLibraryChange]);

  useEffect(() => {
    refreshLibrary({ preserveStatus: false });
  }, [refreshLibrary]);

  const activeTemplates = useMemo(
    () => library.templates.filter((template) => !template.archived),
    [library.templates]
  );
  const activeTests = useMemo(
    () => library.tests.filter((test) => !test.archived),
    [library.tests]
  );
  const testsById = useMemo(
    () => new Map(activeTests.map((test) => [test.id, test])),
    [activeTests]
  );
  const tagsById = useMemo(
    () => new Map(library.developmentTags.map((tag) => [tag.id, tag])),
    [library.developmentTags]
  );

  const perform = async (work, successMessage) => {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const value = await work();
      if (successMessage) setStatus(successMessage);
      return value;
    } catch (workError) {
      setError(workError.message || String(workError));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const openNewTest = () => {
    setTestEditor({
      originalTest: null,
      originalDevelopmentTagIds: [],
      test: {
        id: "",
        name: "",
        description: "",
        version: 1,
        metricType: "numeric",
        unit: "",
        scoringDirection: "higher",
        attemptCount: 1,
        resultStrategy: "single",
        sideMode: "none",
        allowNegative: false,
        pbEligible: true,
        metricConfig: { decimalPlaces: 0, percentageDecimalPlaces: 1 },
      },
    });
  };

  const openEditTest = (test) => {
    setError("");
    setTestEditor({
      originalTest: toEditorTest(test),
      originalDevelopmentTagIds: getTestDevelopmentTagIds(library, test.id),
      test: toEditorTest(test),
    });
  };

  const saveTest = async ({ test, developmentTagIds }) => {
    if (!(await authorizeMutation("change Assessment Test definitions"))) return;
    const editorState = testEditor;
    await perform(async () => {
      const saved = await persistCanonicalTest({
        familyId,
        test,
        originalTest: editorState?.originalTest || null,
        developmentTagIds,
        originalDevelopmentTagIds: editorState?.originalDevelopmentTagIds || [],
        db: dbApi,
      });
      setTestEditor(null);
      await refreshLibrary();
      return saved;
    }, test.id ? "Test updated." : "Test created.");
  };

  const archiveTest = async (test) => {
    const usage = activeAssessmentsUsingTest(library, test.id);
    if (usage.length) {
      setError(`Remove this Test from ${usage.length} active Assessment${usage.length === 1 ? "" : "s"} before archiving it.`);
      return;
    }
    if (!confirmArchive(`Archive Test “${test.name}”?`)) return;
    if (!(await authorizeMutation("archive an Assessment Test"))) return;
    await perform(async () => {
      await expectMutation(dbApi.archiveTest(test.id, true), "Could not archive Test");
      if (testEditor?.test?.id === test.id) setTestEditor(null);
      await refreshLibrary();
    }, "Test archived.");
  };

  const openNewAssessment = () => {
    if (!activeTests.length) {
      setError("Create at least one canonical Test before creating an Assessment.");
      setView("tests");
      return;
    }
    setAssessmentEditor({
      originalDefinition: null,
      definition: {
        template: {
          id: "",
          name: "",
          category: "",
          description: "",
          version: 1,
          sortOrder: activeTemplates.length,
        },
        templateTests: [],
      },
    });
  };

  const openEditAssessment = (templateId) => {
    const definition = getAssessmentDefinition(library, templateId);
    if (!definition) {
      setError("That Assessment could not be found in the current library.");
      return;
    }
    setError("");
    setAssessmentEditor({ originalDefinition: definition, definition });
  };

  const saveAssessment = async (definition) => {
    if (!(await authorizeMutation("change Assessment definitions"))) return;
    const editorState = assessmentEditor;
    await perform(async () => {
      const saved = await persistAssessmentDefinition({
        familyId,
        definition,
        originalDefinition: editorState?.originalDefinition || null,
        db: dbApi,
      });
      setAssessmentEditor(null);
      await refreshLibrary();
      return saved;
    }, definition?.template?.id ? "Assessment updated." : "Assessment created.");
  };

  const archiveAssessment = async (template) => {
    if (!confirmArchive(`Archive Assessment “${template.name}”?`)) return;
    if (!(await authorizeMutation("archive an Assessment"))) return;
    await perform(async () => {
      await expectMutation(
        dbApi.archiveAssessmentTemplate(template.id, true),
        "Could not archive Assessment"
      );
      if (assessmentEditor?.definition?.template?.id === template.id) setAssessmentEditor(null);
      await refreshLibrary();
    }, "Assessment archived.");
  };

  if (!familyId) {
    return <section className="assessment-library" aria-label="Assessment Library"><p>No family selected.</p></section>;
  }

  return (
    <section className="assessment-library" aria-label="Assessment Library">
      <style>{styles}</style>
      <header className="assessment-library__header">
        <div>
          <span className="assessment-library__eyebrow">Progress definitions</span>
          <h2>Assessment Library</h2>
          <p>Reusable Tests and editable benchmark templates. Historical results remain separate.</p>
        </div>
        <button type="button" disabled={loading || busy} onClick={() => refreshLibrary({ preserveStatus: false })}>Refresh</button>
      </header>

      <nav className="assessment-library__tabs" aria-label="Assessment Library sections">
        <button type="button" aria-pressed={view === "assessments"} onClick={() => setView("assessments")}>Assessments</button>
        <button type="button" aria-pressed={view === "tests"} onClick={() => setView("tests")}>Tests</button>
      </nav>

      {loading ? <p role="status">Loading Assessment Library…</p> : null}
      {error ? <div className="assessment-library__error" role="alert">{error}</div> : null}
      {status ? <div className="assessment-library__status" role="status">{status}</div> : null}

      {view === "assessments" ? (
        <>
          {assessmentEditor ? (
            <AssessmentTemplateEditor
              value={assessmentEditor.definition}
              tests={activeTests}
              saving={busy}
              onCancel={() => setAssessmentEditor(null)}
              onSave={saveAssessment}
            />
          ) : (
            <>
              <div className="assessment-library__toolbar">
                <div><strong>{activeTemplates.length} Assessment{activeTemplates.length === 1 ? "" : "s"}</strong></div>
                <button type="button" disabled={busy} onClick={openNewAssessment}>+ Assessment</button>
              </div>
              {activeTemplates.length ? (
                <div className="assessment-library__grid">
                  {activeTemplates.map((template) => {
                    const rows = library.templateTests
                      .filter((row) => (row.assessment_template_id || row.assessmentTemplateId) === template.id)
                      .slice()
                      .sort((a, b) => Number(a.position || 0) - Number(b.position || 0));
                    return (
                      <TemplateCard
                        key={template.id}
                        template={template}
                        rows={rows}
                        testsById={testsById}
                        busy={busy}
                        onEdit={openEditAssessment}
                        onArchive={archiveAssessment}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="assessment-library__empty">No Assessment Templates yet. Create canonical Tests first, then build your benchmark.</div>
              )}
            </>
          )}
        </>
      ) : (
        <>
          {testEditor ? (
            <AssessmentTestEditor
              value={testEditor.test}
              developmentTags={library.developmentTags}
              selectedDevelopmentTagIds={testEditor.originalDevelopmentTagIds}
              saving={busy}
              onCancel={() => setTestEditor(null)}
              onSave={saveTest}
            />
          ) : (
            <>
              <div className="assessment-library__toolbar">
                <div><strong>{activeTests.length} reusable Test{activeTests.length === 1 ? "" : "s"}</strong></div>
                <button type="button" disabled={busy} onClick={openNewTest}>+ Test</button>
              </div>
              {activeTests.length ? (
                <div className="assessment-library__grid">
                  {activeTests.map((test) => {
                    const tagNames = getTestDevelopmentTagIds(library, test.id)
                      .map((id) => tagsById.get(id)?.name)
                      .filter(Boolean);
                    const usageCount = activeAssessmentsUsingTest(library, test.id).length;
                    return (
                      <TestCard
                        key={test.id}
                        test={test}
                        tagNames={tagNames}
                        usageCount={usageCount}
                        busy={busy}
                        onEdit={openEditTest}
                        onArchive={archiveTest}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="assessment-library__empty">No Tests yet. Create the reusable measurement definitions that future Assessments will use.</div>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
