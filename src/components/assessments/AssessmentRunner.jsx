import React, { useEffect, useMemo, useState } from "react";
import AssessmentResultInput from "./AssessmentResultInput.jsx";
import { evaluateAssessmentTestResult } from "./assessmentRunController.js";

function jsonObject(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function cleanText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

const styles = `
.assessment-runner{display:flex;flex-direction:column;gap:14px}
.assessment-runner__header,.assessment-runner__actions,.assessment-runner__progress{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
.assessment-runner__eyebrow{text-transform:uppercase;font-size:11px;font-weight:850;letter-spacing:.08em;color:#64748b}
.assessment-runner__header h2{margin:2px 0 0}.assessment-runner__header p{margin:4px 0 0;color:#64748b;font-size:13px}
.assessment-runner__progress{padding:10px 12px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0;font-size:13px}
.assessment-runner__section{font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.06em;color:#475569;margin:4px 0 -4px}
.assessment-runner__test{border:1px solid rgba(15,23,42,.12);border-radius:16px;padding:14px;background:rgba(255,255,255,.82);display:flex;flex-direction:column;gap:10px}
.assessment-runner__test-top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.assessment-runner__test h3{margin:0;font-size:16px}.assessment-runner__test small{color:#64748b}
.assessment-runner__protocol{padding:9px 11px;border-radius:10px;background:#f8fafc;font-size:12px;color:#475569}.assessment-runner__protocol strong{color:#0f172a}
.assessment-runner__notes{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:800;color:#475569}.assessment-runner__notes textarea{min-height:68px;border:1px solid #cbd5e1;border-radius:10px;padding:9px;resize:vertical}
.assessment-runner__valid{font-size:12px;font-weight:800;color:#166534}.assessment-runner__invalid{font-size:12px;font-weight:800;color:#991b1b}
.assessment-runner__status{padding:10px 12px;border-radius:12px;background:#dcfce7;color:#166534}.assessment-runner__error{padding:10px 12px;border-radius:12px;background:#fee2e2;color:#991b1b}
.assessment-runner__run-notes{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:800;color:#475569}.assessment-runner__run-notes textarea{min-height:74px;border:1px solid #cbd5e1;border-radius:10px;padding:9px;resize:vertical}
.assessment-runner__actions{justify-content:flex-end}.assessment-runner__actions button{min-height:40px}.assessment-runner__actions button:last-child{font-weight:900}
@media(max-width:640px){.assessment-runner__test-top{flex-direction:column}.assessment-runner__actions{justify-content:stretch}.assessment-runner__actions button{flex:1 1 100%}}
`;

export default function AssessmentRunner({
  runState,
  athleteName = "Athlete",
  busy = false,
  onSaveProgress,
  onComplete,
  onCancel,
  onClose,
}) {
  const run = runState?.run || null;
  const snapshot = runState?.snapshot || {};
  const initialDraft = runState?.draft || { runNotes: "", answers: {} };
  const [answers, setAnswers] = useState(() => jsonObject(initialDraft.answers));
  const [runNotes, setRunNotes] = useState(() => cleanText(initialDraft.runNotes, ""));
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setAnswers(jsonObject(runState?.draft?.answers));
    setRunNotes(cleanText(runState?.draft?.runNotes, ""));
    setStatus("");
    setError("");
  }, [run?.id, runState?.draft]);

  const tests = Array.isArray(snapshot.tests) ? snapshot.tests : [];
  const evaluations = useMemo(
    () =>
      tests.map((test) => {
        const answer = jsonObject(answers?.[String(test.position)]);
        return {
          position: test.position,
          ...evaluateAssessmentTestResult(
            test,
            jsonObject(answer.resultData),
            answer.notes || ""
          ),
        };
      }),
    [tests, answers]
  );
  const validCount = evaluations.filter((item) => item.valid).length;
  const allValid = tests.length > 0 && validCount === tests.length;

  const updateAnswer = (position, patch) => {
    const key = String(position);
    setAnswers((current) => ({
      ...jsonObject(current),
      [key]: {
        ...jsonObject(current?.[key]),
        ...patch,
      },
    }));
    setStatus("");
    setError("");
  };

  const perform = async (action, successMessage) => {
    setError("");
    setStatus("");
    try {
      await action?.({ answers, runNotes });
      if (successMessage) setStatus(successMessage);
    } catch (actionError) {
      setError(actionError?.message || String(actionError));
    }
  };

  if (!run || !snapshot?.template) {
    return <div className="assessment-runner__error">Assessment run could not be loaded.</div>;
  }

  let lastSection = null;

  return (
    <section className="assessment-runner">
      <style>{styles}</style>
      <div className="assessment-runner__header">
        <div>
          <div className="assessment-runner__eyebrow">Assessment in progress</div>
          <h2>{snapshot.template.name || "Assessment"}</h2>
          <p>
            {athleteName} · {run.date_ymd || run.dateYmd || ""} · definition v{run.template_version || run.templateVersion || snapshot.template.version || 1}
          </p>
        </div>
        {onClose ? (
          <button type="button" onClick={onClose} disabled={busy}>Back</button>
        ) : null}
      </div>

      <div className="assessment-runner__progress">
        <strong>{validCount}/{tests.length} Tests valid</strong>
        <span>{allValid ? "Ready to complete" : "Enter every required result"}</span>
      </div>

      {error ? <div role="alert" className="assessment-runner__error">{error}</div> : null}
      {status ? <div role="status" className="assessment-runner__status">{status}</div> : null}

      {tests.map((test, index) => {
        const answer = jsonObject(answers?.[String(test.position)]);
        const evaluation = evaluations[index];
        const section = cleanText(test.sectionLabel, "");
        const showSection = section && section !== lastSection;
        if (section) lastSection = section;

        return (
          <React.Fragment key={`${test.testId}-${test.position}`}>
            {showSection ? <div className="assessment-runner__section">{section}</div> : null}
            <article className="assessment-runner__test">
              <div className="assessment-runner__test-top">
                <div>
                  <h3>{test.displayLabel || test.test?.name || `Test ${test.position}`}</h3>
                  {test.test?.description ? <small>{test.test.description}</small> : null}
                </div>
                <small>Test {test.position} of {tests.length}</small>
              </div>

              {test.instructions || test.protocolText ? (
                <div className="assessment-runner__protocol">
                  {test.instructions ? <div><strong>Instructions:</strong> {test.instructions}</div> : null}
                  {test.protocolText ? <div><strong>Protocol:</strong> {test.protocolText}</div> : null}
                </div>
              ) : null}

              <AssessmentResultInput
                metric={test.metric}
                value={jsonObject(answer.resultData)}
                disabled={busy}
                onChange={(resultData) => updateAnswer(test.position, { resultData })}
              />

              <label className="assessment-runner__notes">
                <span>Test notes (optional)</span>
                <textarea
                  aria-label={`Test ${test.position} notes`}
                  disabled={busy}
                  value={answer.notes || ""}
                  onChange={(event) => updateAnswer(test.position, { notes: event.target.value })}
                  placeholder="Technique, conditions or anything worth remembering"
                />
              </label>

              <div className={evaluation.valid ? "assessment-runner__valid" : "assessment-runner__invalid"}>
                {evaluation.valid ? `✓ Retained: ${evaluation.displayValue}` : "Result not valid yet"}
              </div>
            </article>
          </React.Fragment>
        );
      })}

      <label className="assessment-runner__run-notes">
        <span>Assessment notes (optional)</span>
        <textarea
          aria-label="Assessment notes"
          disabled={busy}
          value={runNotes}
          onChange={(event) => setRunNotes(event.target.value)}
          placeholder="Surface, fatigue, weather or general context"
        />
      </label>

      <div className="assessment-runner__actions">
        <button
          type="button"
          disabled={busy}
          onClick={() => perform(onSaveProgress, "Progress saved.")}
        >
          Save progress
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => perform(onCancel, "")}
        >
          Cancel Assessment
        </button>
        <button
          type="button"
          disabled={busy || !allValid}
          onClick={() => perform(onComplete, "Assessment completed.")}
        >
          Complete Assessment
        </button>
      </div>
    </section>
  );
}
