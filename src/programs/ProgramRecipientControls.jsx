import React, { useEffect, useState } from "react";
import { listRecipientProgramControls, setProgramReporting } from "./programWorkflowDb.js";
import "./programWorkflow.css";
const defaultDb = { listRecipientProgramControls, setProgramReporting };

export default function ProgramRecipientControls({ profileId, db = defaultDb }) {
  const [state, setState] = useState({ profileId: "", rows: [], error: "" });
  const [busy, setBusy] = useState("");
  useEffect(() => {
    let cancelled = false;
    db.listRecipientProgramControls(profileId).then((r) => {
      if (!cancelled) setState({ profileId, rows: r.data || [], error: r.error?.message || "" });
    }).catch((e) => { if (!cancelled) setState({ profileId, rows: [], error: e.message }); });
    return () => { cancelled = true; };
  }, [profileId, db]);
  if (state.profileId !== profileId) return <p role="status">Loading programme controls…</p>;
  async function toggle(row, field, checked) {
    const next = { ...row, [field]: checked };
    setBusy(row.assignment_id);
    const result = await db.setProgramReporting(row.assignment_id, next.share_adherence, next.share_assessments).catch((error) => ({ error }));
    if (result.error || !result.data) setState((prev) => ({ ...prev, error: result.error?.message || "Sharing could not be updated." }));
    else setState((prev) => ({ ...prev, error: "", rows: prev.rows.map((x) => x.assignment_id === row.assignment_id ? next : x) }));
    setBusy("");
  }
  return <section className="programWorkflowSection" aria-label="Active assigned programme controls">
    <h3>Your assigned programmes</h3>
    <p>Sharing is optional. You can switch it off at any time. Your private notes and unrelated workouts are never included.</p>
    {state.error ? <p role="alert">{state.error}</p> : null}
    {state.rows.length ? state.rows.map((row) => <article className="programWorkflowCard" key={row.assignment_id}>
      <strong>{row.title}</strong><p>{row.can_edit ? "You can edit your active copy." : "Follow as supplied. You can still leave or undo it."} {row.can_copy ? "Saving a personal copy is allowed." : "Saving a reusable copy is not allowed."}</p>
      <label className="programWorkflowCheck"><input type="checkbox" checked={row.share_adherence} disabled={!!busy} onChange={(e) => toggle(row, "share_adherence", e.target.checked)} />Share this programme’s adherence with my coach</label>
      <label className="programWorkflowCheck"><input type="checkbox" checked={row.share_assessments} disabled={!!busy} onChange={(e) => toggle(row, "share_assessments", e.target.checked)} />Share this programme’s checkpoint results with my coach</label>
    </article>) : <p>No assigned programme is currently attached to your plan.</p>}
  </section>;
}
