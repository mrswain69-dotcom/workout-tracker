import React, { useEffect, useRef, useState } from "react";
import { ensurePlanProgram, flattenProgramWeeks } from "../engine/planCycleEngine.js";
import { buildTrainingProgramShareLink, createTrainingProgramShare } from "./trainingProgramDb.js";
import { commaList, copyProgramVersion, listProgramHistory, listProgramLinks, updateProgramDetails, updateProgramLink } from "./programManagementDb.js";
import "./programManagement.css";

export function ProgramVersionPreview({ version }) {
  const [weekIndex, setWeekIndex] = useState(0);
  const weeks = flattenProgramWeeks(ensurePlanProgram(version?.content_json || {}));
  const week = weeks[Math.min(weekIndex, Math.max(0, weeks.length - 1))]?.week;
  return <div className="programVersionPreview">
    <label>Preview week<select value={weekIndex} onChange={(e) => setWeekIndex(Number(e.target.value))}>
      {weeks.map((entry, index) => <option key={index} value={index}>{entry.phase.name} · {entry.week.name}</option>)}
    </select></label>
    <div className="assignedProgramDays">{Object.entries(week?.blocksByWeekday || {}).map(([day, blocks]) =>
      <article className="assignedProgramDay" key={day}><h4>{day}</h4>
        {blocks.length ? blocks.map((block, index) => <div className="assignedProgramBlock" key={block.id || index}>
          <strong>{block.label || block.typeId || "Activity"}</strong>
          {block.plannedMinutes ? <span>{block.plannedMinutes} minutes</span> : null}
          {block.movements?.length ? <span>{block.movements.map((m) => m.name || m.label).filter(Boolean).join(", ")}</span> : null}
        </div>) : <span className="muted">No planned blocks</span>}
      </article>)}</div>
  </div>;
}

const dateLabel = (value) => value ? new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "No expiry";

export default function ProgramManager({ program, authorize, onChanged, onClose }) {
  const [tab, setTab] = useState("details");
  const [details, setDetails] = useState({ ...program, description: program.description || "", purpose: program.purpose || "", sport: program.sport || "", difficulty: program.difficulty || "all_levels", age_band: program.age_band || "all_ages", equipment: (program.equipment || []).join(", "), tags: (program.tags || []).join(", ") });
  const [versions, setVersions] = useState([]);
  const [links, setLinks] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [copyAction, setCopyAction] = useState(null);
  const [copyTitle, setCopyTitle] = useState("");
  const [note, setNote] = useState("");
  const [days, setDays] = useState("30");
  const [permission, setPermission] = useState("copy");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  useEffect(() => {
    if (tab === "details") return;
    let cancelled = false;
    setLoading(true); setNotice("");
    (tab === "history" ? listProgramHistory(program.id) : listProgramLinks(program.id))
      .then((result) => { if (cancelled) return; if (result.error) throw result.error;
        if (tab === "history") setVersions(result.data || []); else setLinks(result.data || []);
      }).catch((error) => { if (!cancelled) setNotice(error.message || "Could not load programme details."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tab, program.id, program.current_version_id]);

  async function mutate(action, success) {
    if (busy || !(await authorize("manage a saved programme"))) return;
    setBusy(true); setNotice("");
    try {
      const result = await action();
      if (result.error || !result.data) throw result.error || new Error("No change was made. Refresh and try again.");
      if (!mounted.current) return;
      setNotice(typeof success === "function" ? success(result.data) : success);
      setCopyAction(null);
      await onChanged();
      if (tab === "history") { const r = await listProgramHistory(program.id); if (r.error) throw r.error; if (mounted.current) setVersions(r.data || []); }
      if (tab === "links") { const r = await listProgramLinks(program.id); if (r.error) throw r.error; if (mounted.current) setLinks(r.data || []); }
    } catch (error) { if (mounted.current) setNotice(error.message || "The change could not be saved."); }
    finally { if (mounted.current) setBusy(false); }
  }
  const set = (key, value) => setDetails((old) => ({ ...old, [key]: value }));
  function beginCopy(version, duplicate) {
    setCopyAction({ version, duplicate });
    setCopyTitle(duplicate ? (program.title.slice(0, 95) + " copy") : program.title);
    setNote(duplicate ? "Copied from version " + version.version_no : "Restored from version " + version.version_no);
  }
  return <section className="programManager" aria-label={"Manage " + program.title} aria-busy={busy}>
    <div className="programManagerHeading"><h3>{program.title}</h3><button type="button" disabled={busy} onClick={onClose}>Close</button></div>
    <div className="programManagerTabs" aria-label="Programme management">
      {[["details", "Details"], ["history", "Version history"], ["links", "Sharing links"]].map(([id, label]) =>
        <button type="button" key={id} aria-pressed={tab === id} disabled={busy} onClick={() => { setTab(id); setCopyAction(null); }}>{label}</button>)}
    </div>
    {notice ? <p role="status" className="trainingProgramNotice">{notice}</p> : null}
    {loading ? <p role="status">Loading…</p> : null}
    {tab === "details" ? <form className="programDetailsForm" onSubmit={(e) => { e.preventDefault(); mutate(() => updateProgramDetails(program, { ...details, equipment: commaList(details.equipment), tags: commaList(details.tags) }), "Programme details saved. Existing versions and assignments were preserved."); }}>
      <label>Name<input required minLength={2} maxLength={100} value={details.title} onChange={(e) => set("title", e.target.value)} /></label>
      <label>Description<textarea maxLength={1200} value={details.description} onChange={(e) => set("description", e.target.value)} /></label>
      <label>Purpose<input maxLength={80} value={details.purpose} onChange={(e) => set("purpose", e.target.value)} placeholder="e.g. Match preparation" /></label>
      <label>Sport<input maxLength={80} value={details.sport} onChange={(e) => set("sport", e.target.value)} /></label>
      <label>Difficulty<select value={details.difficulty} onChange={(e) => set("difficulty", e.target.value)}>{["all_levels", "beginner", "intermediate", "advanced"].map((x) => <option key={x} value={x}>{x.replaceAll("_", " ")}</option>)}</select></label>
      <label>Age range<select value={details.age_band} onChange={(e) => set("age_band", e.target.value)}>{[["all_ages", "All ages"], ["child", "Children"], ["teen", "Teens"], ["adult", "Adults"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      <label>Equipment<input value={details.equipment} onChange={(e) => set("equipment", e.target.value)} placeholder="Comma-separated, e.g. Dumbbells, mat" /></label>
      <label>Tags<input value={details.tags} onChange={(e) => set("tags", e.target.value)} placeholder="Comma-separated, up to 20" /></label>
      <button className="primary" type="submit" disabled={busy || details.title.trim().length < 2 || commaList(details.equipment).length > 20 || commaList(details.tags).length > 20}>{busy ? "Saving…" : "Save details"}</button>
    </form> : null}
    {tab === "history" && !loading ? <div className="programHistory">
      <p className="muted">Versions stay frozen. Restoring creates a new latest version; recipients keep their issued version until they accept an update.</p>
      {versions.map((version) => <article key={version.id}>
        <div className="programManagerHeading"><strong>Version {version.version_no}{version.id === program.current_version_id ? " · Current" : ""}</strong><small>{dateLabel(version.created_at)}</small></div>
        <p>{version.change_note || "No change note"}</p>
        <div className="programManagerActions"><button type="button" disabled={busy} onClick={() => setSelectedVersion(selectedVersion?.id === version.id ? null : version)}>Preview</button>
          <button type="button" disabled={busy} onClick={() => beginCopy(version, true)}>Duplicate</button>
          <button type="button" disabled={busy || program.status === "archived" || version.id === program.current_version_id} onClick={() => beginCopy(version, false)}>Restore as new version</button></div>
        {selectedVersion?.id === version.id ? <ProgramVersionPreview key={version.id} version={version} /> : null}
      </article>)}
      {!versions.length ? <p>No saved versions.</p> : null}
      {copyAction ? <form className="programCopyForm" onSubmit={(e) => { e.preventDefault(); mutate(() => copyProgramVersion({ program, versionId: copyAction.version.id, duplicate: copyAction.duplicate, title: copyTitle.trim(), changeNote: note.trim() }), copyAction.duplicate ? "A separate programme was created in My Programs." : "Older content restored as a new version. Active plans and issued assignments were preserved."); }}>
        <h4>{copyAction.duplicate ? "Duplicate" : "Restore"} version {copyAction.version.version_no}</h4>
        {copyAction.duplicate ? <label>New programme name<input required minLength={2} maxLength={100} value={copyTitle} onChange={(e) => setCopyTitle(e.target.value)} /></label> : null}
        <label>Change note<textarea required maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} /></label>
        <div className="programManagerActions"><button type="button" disabled={busy} onClick={() => setCopyAction(null)}>Cancel</button><button type="submit" className="primary" disabled={busy || !note.trim() || copyTitle.trim().length < 2}>{busy ? "Saving…" : copyAction.duplicate ? "Create duplicate" : "Create restored version"}</button></div>
      </form> : null}
    </div> : null}
    {tab === "links" && !loading ? <div className="programLinks">
      <p className="muted">Each link shares its saved version. Revoking or expiring a link prevents future use; plans already adopted remain available.</p>
      <div className="programManagerActions"><label>Link access<select value={permission} onChange={(e) => setPermission(e.target.value)}><option value="copy">Use and adapt</option><option value="view">Preview only</option></select></label>
        <label>Valid for (days)<input type="number" min={1} max={365} value={days} onChange={(e) => setDays(e.target.value)} /></label>
        <button type="button" disabled={busy || program.status === "archived" || !Number.isInteger(Number(days)) || Number(days) < 1 || Number(days) > 365} onClick={() => mutate(() => createTrainingProgramShare(program.id, permission, Number(days)), "New private link created below.")}>Create link</button></div>
      {links.map((link) => {
        const status = link.revoked_at ? "Revoked" : link.expires_at && new Date(link.expires_at) <= new Date() ? "Expired" : program.status === "archived" ? "Paused (archived)" : "Active";
        return <article key={link.id}><div className="programManagerHeading"><strong>{status} · {link.permission === "view" ? "Preview only" : link.permission === "follow" ? "Follow" : "Use and adapt"}</strong><small>Expires {dateLabel(link.expires_at)}</small></div>
          <small>Version {link.version?.version_no || versions.find((v) => v.id === link.version_id)?.version_no || (link.version_id === program.current_version_id ? program.current_version_no : "ID " + link.version_id.slice(0, 8))}</small>
          <input aria-label="Private sharing link" readOnly value={buildTrainingProgramShareLink(link.share_token)} onFocus={(e) => e.target.select()} />
          {!link.revoked_at ? <div className="programManagerActions"><button type="button" disabled={busy || status !== "Active" || program.status === "archived"} onClick={async () => { try { await navigator.clipboard.writeText(buildTrainingProgramShareLink(link.share_token)); setNotice("Private link copied."); } catch { setNotice("Select the link above and copy it."); } }}>Copy link</button>
            <button type="button" disabled={busy || !Number.isInteger(Number(days)) || Number(days) < 1 || Number(days) > 365} onClick={() => mutate(() => updateProgramLink(link.id, false, days), "Link expiry updated from today.")}>Set expiry</button>
            <button type="button" disabled={busy} onClick={() => { if (window.confirm("Revoke this link? New recipients will no longer be able to use it. Existing adopted plans are retained.")) mutate(() => updateProgramLink(link.id, true), "Sharing link revoked."); }}>Revoke</button></div> : null}
        </article>;
      })}
      {!links.length ? <p>No sharing links yet.</p> : null}
    </div> : null}
  </section>;
}
