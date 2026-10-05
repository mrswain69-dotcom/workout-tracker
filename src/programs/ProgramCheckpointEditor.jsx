import React, { useEffect, useState } from "react";
import { listAssessmentTemplates } from "../assessmentDb.js";
import "./programWorkflow.css";

export default function ProgramCheckpointEditor({ familyId, phase, onAdd, onRemove, disabled = false }) {
  const [state, setState] = useState({ familyId: "", templates: [], error: "" });
  const [templateId, setTemplateId] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setTemplateId("");
    listAssessmentTemplates(familyId).then((r) => {
      if (!cancelled) setState({ familyId, templates: r.data || [], error: r.error?.message || "" });
    }).catch((e) => { if (!cancelled) setState({ familyId, templates: [], error: e.message }); });
    return () => { cancelled = true; };
  }, [familyId]);
  const templates = state.familyId === familyId ? state.templates : [];
  async function add(timing) {
    const template = templates.find((x) => x.id === templateId);
    if (!template) return;
    setBusy(true);
    try { await onAdd({ title: template.name, timing, assessmentTemplateId: template.id }); }
    catch (e) { setState((prev) => ({ ...prev, error: e.message })); }
    finally { setBusy(false); }
  }
  return <section className="programWorkflowSection">
    <h3>Assessment checkpoints</h3>
    <p>Choose an Assessment from your Library. Before is scheduled for the phase’s first day; after for its final day.</p>
    {state.error ? <p role="alert">{state.error}</p> : null}
    <div className="programWorkflowHeading">
      <label>Assessment<select value={templateId} disabled={disabled || busy} onChange={(e) => setTemplateId(e.target.value)}><option value="">Choose an Assessment</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      <div className="planCheckpointActions"><button type="button" disabled={disabled || busy || !templateId} onClick={() => add("before")}>Add before</button><button type="button" disabled={disabled || busy || !templateId} onClick={() => add("after")}>Add after</button></div>
    </div>
    {!templates.length ? <p>Create an Assessment with Tests in the Assessment Library first.</p> : null}
    {(phase?.assessments || []).map((cp) => <div className="programWorkflowHeading" key={cp.id}><span><span className="pill">{cp.timing}</span> {cp.title}{!cp.assessmentTemplateId ? " · Choose a linked Assessment to replace this placeholder" : ""}</span><button type="button" disabled={disabled || busy} onClick={() => onRemove(cp.id)}>Remove</button></div>)}
  </section>;
}
