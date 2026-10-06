import React, { useMemo, useState } from "react";
import { getProgramCoachReport } from "./programWorkflowDb.js";
import "./programWorkflow.css";

export function checkpointComparisons(checkpoints = []) {
  const groups = [...new Set(checkpoints.map((cp) => JSON.stringify([cp.phase, cp.title || ""])))];
  return groups.flatMap((key) => {
    const [phase, title] = JSON.parse(key);
    const before = checkpoints.find((cp) => cp.phase === phase && (cp.title || "") === title && cp.timing === "before" && cp.completedDate);
    const after = checkpoints.find((cp) => cp.phase === phase && (cp.title || "") === title && cp.timing === "after" && cp.completedDate);
    return (before?.results || []).flatMap((b) => {
      const a = (after?.results || []).find((x) => x.position === b.position && x.name === b.name
        && JSON.stringify(x.metric) === JSON.stringify(b.metric) && (x.protocol || "") === (b.protocol || ""));
      const dimensions = b.metric?.sideMode === "separate" ? ["left", "right"] : ["overall"];
      return dimensions.map((dimension) => {
        const beforeValue = dimension === "overall" ? b.value ?? b.dimensions?.overall : b.dimensions?.[dimension];
        const afterValue = dimension === "overall" ? a?.value ?? a?.dimensions?.overall : a?.dimensions?.[dimension];
        return { phase, name: b.name + (dimension === "overall" ? "" : ` · ${dimension}`), unit: b.metric?.unit || "",
          before: beforeValue ?? null, after: afterValue ?? null,
          change: typeof afterValue === "number" && typeof beforeValue === "number" ? afterValue - beforeValue : null };
      });
    });
  });
}
export default function ProgramCoachReports({ assignments, groups = [], db = getProgramCoachReport }) {
  const [programId, setProgramId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [days, setDays] = useState(28);
  const [reports, setReports] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const eligible = assignments.filter((a) => a.status === "accepted" && a.active_state !== "unavailable");
  const programmes = useMemo(() => [...new Map(eligible.map((a) => [a.program_id, a.program?.title || "Programme"])).entries()], [assignments]);
  const teams = [...new Set(eligible.map((a) => a.recipient?.group_id).filter(Boolean))];
  async function load() {
    setBusy(true); setError(""); setReports([]);
    try {
      const selected = eligible.filter((a) => (!programId || a.program_id === programId) && (!teamId || (teamId === "direct" ? !!a.client_connection_id : a.recipient?.group_id === teamId))).slice(0, 50);
      const rows = await Promise.all(selected.map(async (a) => { const result = await db(a.id, days); if (result.error) throw result.error; return { assignment: a, report: result.data }; }));
      setReports(rows);
    } catch (e) { setError(e.message || "Reports could not load."); }
    finally { setBusy(false); }
  }
  return <section className="programWorkflowSection">
    <h3>Coach reports</h3><p>Recipients choose what to share. Reports cover programme blocks and linked Assessments only. Completion comes from saved logs and is not proof of device verification.</p>
    <div className="programWorkflowHeading">
      <label>Programme<select value={programId} disabled={busy} onChange={(e) => { setProgramId(e.target.value); setReports([]); }}><option value="">All programmes</option>{programmes.map(([id, title]) => <option key={id} value={id}>{title}</option>)}</select></label>
      <label>Recipients<select value={teamId} disabled={busy} onChange={(e) => { setTeamId(e.target.value); setReports([]); }}><option value="">All recipients</option><option value="direct">Direct clients</option>{teams.map((id, index) => <option value={id} key={id}>{groups.find((g) => g.id === id)?.name || `Team ${index + 1}`}</option>)}</select></label>
      <label>Period<select value={days} disabled={busy} onChange={(e) => { setDays(Number(e.target.value)); setReports([]); }}><option value={28}>Last 4 weeks</option><option value={56}>Last 8 weeks</option><option value={90}>Last 90 days</option></select></label>
      <button type="button" disabled={busy} onClick={load}>{busy ? "Loading reports…" : "Load / refresh reports"}</button>
    </div>
    {error ? <p role="alert">{error}</p> : null}
    {reports.length ? <div className="programWorkflowTable"><table><caption>Programme adherence comparison</caption><thead><tr><th>Athlete</th><th>Programme / version</th><th>Completed / due blocks</th><th>Partial blocks</th><th>Checkpoints completed</th></tr></thead><tbody>
      {reports.map(({ assignment: a, report: r }) => <tr key={a.id}><td>{a.recipient?.nickname || "Athlete"}</td><td>{a.program?.title} · v{a.version?.version_no}</td><td>{!r.adherenceShared ? "Not shared" : !r.attached ? "No longer attached" : `${r.completed} / ${r.planned}${r.excused ? ` · ${r.excused} excused` : ""}`}</td><td>{r.adherenceShared && r.attached ? r.recorded - r.completed : "—"}</td><td>{r.assessmentsShared ? `${r.checkpoints.filter((x) => x.completedDate).length} / ${r.checkpoints.length}` : "Not shared"}</td></tr>)}
    </tbody></table></div> : <p>Choose a programme or recipient group and load reports. Up to 50 accepted assignments are compared at a time.</p>}
    {reports.filter((x) => x.report.assessmentsShared).map(({ assignment: a, report: r }) => <details className="programWorkflowCard" key={a.id}>
      <summary>{a.recipient?.nickname || "Athlete"} · {a.program?.title} · Assessment outcomes</summary>
      <div className="programWorkflowTable"><table><caption>Before and after comparable results</caption><thead><tr><th>Phase / Test</th><th>Before</th><th>After</th><th>Change</th></tr></thead><tbody>{checkpointComparisons(r.checkpoints).map((x, i) => <tr key={i}><td>{x.phase} · {x.name}</td><td>{x.before ?? "—"} {x.unit}</td><td>{x.after ?? "—"} {x.unit}</td><td>{x.change === null ? "Not comparable / awaiting result" : `${x.change > 0 ? "+" : ""}${Number(x.change.toFixed(3))} ${x.unit}`}</td></tr>)}</tbody></table></div>
      <ul>{r.checkpoints.map((cp) => <li key={cp.id}>{cp.phase} · {cp.timing} · {cp.title} · {cp.completedDate ? `Completed ${cp.completedDate}` : `Due ${cp.dueDate}`}<ul>{cp.results.map((result, index) => <li key={index}>{result.name}: {result.value ?? (Object.entries(result.dimensions || {}).map(([key, value]) => `${key} ${value}`).join(", ") || "—")} {result.metric?.unit || ""}</li>)}</ul></li>)}</ul>
    </details>)}
  </section>;
}
