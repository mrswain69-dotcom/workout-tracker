import React, { useCallback, useEffect, useMemo, useState } from "react";
import * as assessmentDefinitionDb from "../../assessmentDb.js";
import * as assessmentRunDb from "../../assessmentRunDb.js";
import AssessmentRunner from "./AssessmentRunner.jsx";
import {
  assessmentRunDraftFromRows,
  cancelAssessmentRun,
  completeAssessmentRun,
  getAssessmentRunSnapshot,
  loadAssessmentRunState,
  saveAssessmentRunProgress,
  startAssessmentRun,
} from "./assessmentRunController.js";
import {
  emptyAssessmentLibrary,
  normaliseAssessmentLibrary,
} from "./assessmentLibraryController.js";

const defaultDb = { ...assessmentDefinitionDb, ...assessmentRunDb };

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

function defaultConfirm(message) {
  if (typeof window === "undefined" || typeof window.confirm !== "function") return true;
  return window.confirm(message);
}

const styles = `
.assessment-hub{display:flex;flex-direction:column;gap:14px}
.assessment-hub__header,.assessment-hub__card-top,.assessment-hub__run{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.assessment-hub__header h2{margin:0}.assessment-hub__header p{margin:4px 0 0;color:#64748b;font-size:13px}
.assessment-hub__eyebrow{text-transform:uppercase;font-size:11px;font-weight:850;letter-spacing:.08em;color:#64748b}
.assessment-hub__grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}
.assessment-hub__card,.assessment-hub__resume{border:1px solid rgba(15,23,42,.12);border-radius:16px;padding:14px;background:#fff}
.assessment-hub__card h3,.assessment-hub__resume h3{margin:0;font-size:16px}.assessment-hub__card p{font-size:13px;color:#475569}.assessment-hub__meta{font-size:12px;color:#64748b;margin-top:4px}
.assessment-hub__section-title{font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:.05em;color:#475569}
.assessment-hub__runs{display:flex;flex-direction:column;gap:8px}.assessment-hub__run{align-items:center;border-top:1px solid #e2e8f0;padding-top:9px;margin-top:9px}.assessment-hub__run:first-child{border-top:0;padding-top:0;margin-top:0}
.assessment-hub__empty{padding:18px;border:1px dashed #cbd5e1;border-radius:14px;color:#64748b;background:rgba(255,255,255,.55)}
.assessment-hub__error{padding:10px 12px;border-radius:12px;background:#fee2e2;color:#991b1b}.assessment-hub__status{padding:10px 12px;border-radius:12px;background:#dcfce7;color:#166534}
@media(max-width:640px){.assessment-hub__header,.assessment-hub__card-top,.assessment-hub__run{flex-direction:column}.assessment-hub__run button,.assessment-hub__card button{width:100%}}
`;

function stateFromSaved(saved) {
  return {
    run: saved.run,
    results: saved.results,
    snapshot: getAssessmentRunSnapshot(saved.run),
    draft: assessmentRunDraftFromRows(saved.run, saved.results),
  };
}

export default function AssessmentHub({
  familyId,
  profileId,
  athleteName = "Athlete",
  todayYmd,
  dbApi = defaultDb,
  confirmCancel = defaultConfirm,
}) {
  const [library, setLibrary] = useState(() => emptyAssessmentLibrary());
  const [runs, setRuns] = useState([]);
  const [runState, setRunState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const refresh = useCallback(async () => {
    if (!familyId || !profileId) {
      setLibrary(emptyAssessmentLibrary());
      setRuns([]);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const [libraryResult, runsResult] = await Promise.all([
        dbApi.loadAssessmentLibrary(familyId),
        dbApi.listAssessmentRuns(familyId, {
          profileId,
          status: "in_progress",
          limit: 50,
        }),
      ]);
      const libraryError = resultError(
        libraryResult,
        "Could not load Assessments"
      );
      if (libraryError) throw libraryError;
      const runsError = resultError(
        runsResult,
        "Could not load in-progress Assessments"
      );
      if (runsError) throw runsError;

      setLibrary(normaliseAssessmentLibrary(libraryResult?.data || {}));
      setRuns(runsResult?.data || []);
    } catch (loadError) {
      setError(loadError?.message || String(loadError));
    } finally {
      setLoading(false);
    }
  }, [familyId, profileId, dbApi]);

  useEffect(() => {
    setRunState(null);
    setStatus("");
    refresh();
  }, [refresh]);

  const activeTemplates = useMemo(
    () => library.templates.filter((template) => !template.archived),
    [library.templates]
  );
  const templateRows = useMemo(() => {
    const counts = new Map();
    for (const row of library.templateTests) {
      const id = cleanText(row.assessment_template_id || row.assessmentTemplateId);
      counts.set(id, (counts.get(id) || 0) + 1);
    }
    return counts;
  }, [library.templateTests]);

  const perform = async (work) => {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      return await work();
    } catch (workError) {
      setError(workError?.message || String(workError));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const start = (templateId) =>
    perform(async () => {
      const started = await startAssessmentRun({
        familyId,
        profileId,
        templateId,
        dateYmd: todayYmd,
        library,
        db: dbApi,
      });
      const next = {
        ...started,
        draft: assessmentRunDraftFromRows(started.run, started.results),
      };
      setRunState(next);
      await refresh();
      return next;
    });

  const resume = (runId) =>
    perform(async () => {
      const next = await loadAssessmentRunState({ familyId, runId, db: dbApi });
      if (cleanText(next.run?.status, "") !== "in_progress") {
        throw new Error("That Assessment is no longer in progress.");
      }
      setRunState(next);
      return next;
    });

  const saveProgress = async ({ answers, runNotes }) => {
    const saved = await saveAssessmentRunProgress({
      familyId,
      run: runState.run,
      results: runState.results,
      answers,
      runNotes,
      db: dbApi,
    });
    const next = stateFromSaved(saved);
    setRunState(next);
    setStatus("Progress saved.");
    return next;
  };

  const complete = async ({ answers, runNotes }) => {
    const completed = await completeAssessmentRun({
      familyId,
      run: runState.run,
      results: runState.results,
      answers,
      runNotes,
      db: dbApi,
    });
    setRunState(null);
    setStatus("Assessment completed and added to history.");
    await refresh();
    return completed;
  };

  const cancel = async () => {
    if (!confirmCancel("Cancel this Assessment? Entered progress will remain in history as cancelled.")) {
      return null;
    }
    const cancelled = await cancelAssessmentRun({ run: runState.run, db: dbApi });
    setRunState(null);
    setStatus("Assessment cancelled. Its record was preserved.");
    await refresh();
    return cancelled;
  };

  if (runState) {
    return (
      <AssessmentRunner
        runState={runState}
        athleteName={athleteName}
        busy={busy}
        onSaveProgress={(payload) => perform(() => saveProgress(payload))}
        onComplete={(payload) => perform(() => complete(payload))}
        onCancel={() => perform(cancel)}
        onClose={() => setRunState(null)}
      />
    );
  }

  return (
    <section className="assessment-hub">
      <style>{styles}</style>
      <div className="assessment-hub__header">
        <div>
          <div className="assessment-hub__eyebrow">Performance benchmark</div>
          <h2>Assessments</h2>
          <p>Run structured Tests for {athleteName}. Results are stored separately from workout logs.</p>
        </div>
        <button type="button" disabled={loading || busy} onClick={refresh}>Refresh</button>
      </div>

      {error ? <div role="alert" className="assessment-hub__error">{error}</div> : null}
      {status ? <div role="status" className="assessment-hub__status">{status}</div> : null}

      {runs.length ? (
        <div className="assessment-hub__resume">
          <div className="assessment-hub__section-title">Resume in-progress</div>
          <div className="assessment-hub__runs">
            {runs.map((run) => {
              const snapshot = getAssessmentRunSnapshot(run);
              return (
                <div className="assessment-hub__run" key={run.id}>
                  <div>
                    <h3>{snapshot?.template?.name || "Assessment"}</h3>
                    <div className="assessment-hub__meta">{run.date_ymd || ""} · started {run.started_at ? new Date(run.started_at).toLocaleString() : ""}</div>
                  </div>
                  <button type="button" disabled={busy} onClick={() => resume(run.id)}>Resume</button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="assessment-hub__section-title">Start an Assessment</div>
      {loading ? (
        <div className="assessment-hub__empty">Loading Assessments…</div>
      ) : activeTemplates.length ? (
        <div className="assessment-hub__grid">
          {activeTemplates.map((template) => (
            <article className="assessment-hub__card" key={template.id}>
              <div className="assessment-hub__card-top">
                <div>
                  <h3>{template.name}</h3>
                  <div className="assessment-hub__meta">
                    {template.category ? `${template.category} · ` : ""}v{template.version || 1} · {templateRows.get(template.id) || 0} Tests
                  </div>
                </div>
                <button type="button" disabled={busy || !todayYmd} onClick={() => start(template.id)}>Start</button>
              </div>
              {template.description ? <p>{template.description}</p> : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="assessment-hub__empty">
          No active Assessment Templates yet. Stage 7 will seed the shared Football Monthly Benchmark after the generic runner/history path is verified.
        </div>
      )}
    </section>
  );
}
