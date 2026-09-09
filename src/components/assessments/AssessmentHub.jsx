import React, { useCallback, useEffect, useMemo, useState } from "react";
import * as assessmentDefinitionDb from "../../assessmentDb.js";
import * as assessmentRunDb from "../../assessmentRunDb.js";
import * as assessmentScheduleDb from "../../assessmentScheduleDb.js";
import { buildAssessmentScheduleStatuses } from "../../engine/assessmentScheduleEngine.js";
import AssessmentRunner from "./AssessmentRunner.jsx";
import AssessmentHistory from "./AssessmentHistory.jsx";
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

const defaultDb = {
  ...assessmentDefinitionDb,
  ...assessmentRunDb,
  ...assessmentScheduleDb,
};

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

function formatScheduleDate(ymd) {
  const text = cleanText(ymd);
  if (!text) return "";
  const date = new Date(`${text}T00:00:00`);
  if (!Number.isFinite(date.getTime())) return text;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function scheduleStateLabel(state) {
  if (state === "due") return "Due this week";
  if (state === "overdue") return "Overdue";
  if (state === "completed") return "Completed this cycle";
  if (state === "in_progress") return "In progress";
  if (state === "upcoming") return "Upcoming";
  return "Schedule";
}

function scheduleTimingText(status) {
  const start = formatScheduleDate(status.cycleStartYmd);
  const end = formatScheduleDate(status.cycleEndYmd);
  if (status.state === "completed") {
    const completed = formatScheduleDate(status.completedRun?.date_ymd || status.completedRun?.dateYmd);
    return `Completed ${completed}. Next benchmark week starts ${formatScheduleDate(status.nextCycleStartYmd)}.`;
  }
  if (status.state === "in_progress") {
    return "Assessment in progress — saved results can be resumed without changing the frozen test definition.";
  }
  if (status.state === "overdue") {
    return `Recommended window was ${start}–${end}; complete it before the next cycle when practical.`;
  }
  if (status.state === "upcoming") {
    return `First benchmark week: ${start}–${end}.`;
  }
  return `Benchmark week: ${start}–${end}.`;
}

const styles = `
.assessment-hub{display:flex;flex-direction:column;gap:14px}
.assessment-hub__header,.assessment-hub__card-top,.assessment-hub__run{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.assessment-hub__header h2{margin:0}.assessment-hub__header p{margin:4px 0 0;color:#64748b;font-size:13px}
.assessment-hub__eyebrow{text-transform:uppercase;font-size:11px;font-weight:850;letter-spacing:.08em;color:#64748b}
.assessment-hub__modes{display:flex;gap:8px;flex-wrap:wrap}.assessment-hub__modes button[aria-pressed="true"]{font-weight:850;box-shadow:inset 0 0 0 2px rgba(255,122,24,.38)}
.assessment-hub__grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}
.assessment-hub__card,.assessment-hub__resume,.assessment-hub__schedule{border:1px solid rgba(15,23,42,.12);border-radius:16px;padding:14px;background:#fff}
.assessment-hub__card h3,.assessment-hub__resume h3,.assessment-hub__schedule h3{margin:0;font-size:16px}.assessment-hub__card p,.assessment-hub__schedule p{font-size:13px;color:#475569}.assessment-hub__meta{font-size:12px;color:#64748b;margin-top:4px}
.assessment-hub__schedule{border-width:2px}.assessment-hub__schedule--due{border-color:rgba(255,122,24,.55);background:#fffaf5}.assessment-hub__schedule--overdue{border-color:#f59e0b;background:#fffbeb}.assessment-hub__schedule--completed{border-color:#86efac;background:#f0fdf4}.assessment-hub__schedule--in_progress{border-color:#93c5fd;background:#eff6ff}
.assessment-hub__schedule-state{display:inline-flex;padding:4px 8px;border-radius:999px;background:#f1f5f9;color:#334155;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.04em}.assessment-hub__schedule ul{margin:8px 0 0;padding-left:18px;color:#475569;font-size:12px}.assessment-hub__schedule li+li{margin-top:4px}
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
  const [completedRuns, setCompletedRuns] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [mode, setMode] = useState("run");
  const [runState, setRunState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const refresh = useCallback(async () => {
    if (!familyId || !profileId) {
      setLibrary(emptyAssessmentLibrary());
      setRuns([]);
      setCompletedRuns([]);
      setSchedules([]);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const [libraryResult, runsResult, completedRunsResult, schedulesResult] = await Promise.all([
        dbApi.loadAssessmentLibrary(familyId),
        dbApi.listAssessmentRuns(familyId, {
          profileId,
          status: "in_progress",
          limit: 50,
        }),
        dbApi.listAssessmentRuns(familyId, {
          profileId,
          status: "completed",
          limit: 500,
        }),
        dbApi.listAssessmentSchedules(familyId, {
          profileId,
          activeOnly: true,
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
      const completedRunsError = resultError(
        completedRunsResult,
        "Could not load completed Assessment schedule history"
      );
      if (completedRunsError) throw completedRunsError;
      const schedulesError = resultError(
        schedulesResult,
        "Could not load Assessment schedules"
      );
      if (schedulesError) throw schedulesError;

      setLibrary(normaliseAssessmentLibrary(libraryResult?.data || {}));
      setRuns(runsResult?.data || []);
      setCompletedRuns(completedRunsResult?.data || []);
      setSchedules(schedulesResult?.data || []);
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
  const templatesById = useMemo(
    () => new Map(library.templates.map((template) => [cleanText(template.id), template])),
    [library.templates]
  );
  const scheduleStatuses = useMemo(
    () =>
      buildAssessmentScheduleStatuses({
        schedules,
        runs: [...completedRuns, ...runs],
        todayYmd,
      }),
    [schedules, completedRuns, runs, todayYmd]
  );

  // Start/resume actions own their visible error state and can safely swallow
  // an error because they are direct click handlers. Runner save/complete/cancel
  // actions must rethrow so AssessmentRunner never displays a false success.
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

  const performRunnerAction = async (work) => {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      return await work();
    } catch (workError) {
      setError(workError?.message || String(workError));
      throw workError;
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
    setMode("progress");
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

  const modeControls = (
    <div className="assessment-hub__modes" role="tablist" aria-label="Assessment modes">
      <button type="button" aria-pressed={mode === "run"} onClick={() => setMode("run")}>Run</button>
      <button type="button" aria-pressed={mode === "progress"} onClick={() => setMode("progress")}>Progress</button>
    </div>
  );

  if (runState) {
    return (
      <AssessmentRunner
        runState={runState}
        athleteName={athleteName}
        busy={busy}
        onSaveProgress={(payload) =>
          performRunnerAction(() => saveProgress(payload))
        }
        onComplete={(payload) =>
          performRunnerAction(() => complete(payload))
        }
        onCancel={() => performRunnerAction(cancel)}
        onClose={() => setRunState(null)}
      />
    );
  }

  if (mode === "progress") {
    return (
      <section className="assessment-hub">
        <style>{styles}</style>
        {modeControls}
        <AssessmentHistory
          familyId={familyId}
          profileId={profileId}
          athleteName={athleteName}
          dbApi={dbApi}
        />
      </section>
    );
  }

  return (
    <section className="assessment-hub">
      <style>{styles}</style>
      {modeControls}
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

      {scheduleStatuses.length ? (
        <>
          <div className="assessment-hub__section-title">Scheduled benchmarks</div>
          <div className="assessment-hub__grid">
            {scheduleStatuses.map((scheduleStatus) => {
              const template = templatesById.get(
                scheduleStatus.schedule.assessmentTemplateId
              );
              if (!template) return null;
              const guidance = Array.isArray(
                scheduleStatus.schedule.workflowConfig?.guidance
              )
                ? scheduleStatus.schedule.workflowConfig.guidance.filter(Boolean)
                : [];
              return (
                <article
                  className={`assessment-hub__schedule assessment-hub__schedule--${scheduleStatus.state}`}
                  key={scheduleStatus.schedule.id}
                >
                  <div className="assessment-hub__card-top">
                    <div>
                      <div className="assessment-hub__schedule-state">
                        {scheduleStateLabel(scheduleStatus.state)}
                      </div>
                      <h3 style={{ marginTop: 8 }}>{template.name}</h3>
                      <div className="assessment-hub__meta">
                        Every {scheduleStatus.schedule.cadenceDays} days · {scheduleStatus.schedule.windowDays}-day benchmark window
                      </div>
                    </div>
                    {scheduleStatus.state === "in_progress" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => resume(scheduleStatus.inProgressRun.id)}
                      >
                        Resume
                      </button>
                    ) : scheduleStatus.state === "due" ||
                      scheduleStatus.state === "overdue" ? (
                      <button
                        type="button"
                        disabled={busy || !todayYmd}
                        onClick={() => start(template.id)}
                      >
                        Start scheduled benchmark
                      </button>
                    ) : null}
                  </div>
                  <p>{scheduleTimingText(scheduleStatus)}</p>
                  {guidance.length ||
                  scheduleStatus.schedule.workflowConfig?.allowSplitAcrossDays ? (
                    <ul>
                      {guidance.map((item, index) => (
                        <li key={`${scheduleStatus.schedule.id}-guidance-${index}`}>
                          {item}
                        </li>
                      ))}
                      {scheduleStatus.schedule.workflowConfig?.allowSplitAcrossDays ? (
                        <li>Save progress and resume later if splitting the benchmark gives a cleaner test.</li>
                      ) : null}
                    </ul>
                  ) : null}
                </article>
              );
            })}
          </div>
        </>
      ) : null}

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
          No active Assessment Templates are available for this family.
        </div>
      )}
    </section>
  );
}
