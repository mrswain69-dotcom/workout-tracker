import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ensurePlanProgram, flattenProgramWeeks } from "../engine/planCycleEngine.js";
import { buildTrainingProgramShareLink, createTrainingProgramShare } from "./trainingProgramDb.js";
import { commaList, copyProgramVersion, listProgramHistory, listProgramLinks, updateProgramDetails, updateProgramLink } from "./programManagementDb.js";
import "./programManagement.css";
import { setCommunityCopyPermission } from "./communityDiscoveryDb.js";

export function ProgramVersionPreview({ version }) {
  const [weekIndex, setWeekIndex] = useState(0);
  const weeks = flattenProgramWeeks(ensurePlanProgram(version?.content_json || {}));
  const week = weeks[Math.min(weekIndex, Math.max(0, weeks.length - 1))]?.week;
  return <div className="programVersionPreview">
    <label>Preview week<select value={weekIndex} onChange={(e) => setWeekIndex(Number(e.target.value))}>
      {weeks.map((entry, index) => <option key={index} value={index}>{entry.phase.name} · {entry.week.name}</option>)}
    </select></label>
    <div className="assignedProgramDays" tabIndex={0} role="region" aria-label="Week preview, scroll horizontally">{Object.entries(week?.blocksByWeekday || {}).map(([day, blocks]) =>
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

export default function ProgramManager({ program, authorize, onChanged, onClose, externalBusy = false, externalNotice = "", noCopy = false, startDate, completionMode, onStartDateChange, onCompletionModeChange, onUse, onSaveVersion, onAssign, onArchive, isCurrentVersionActive = false, isCurrentVersionAdded = false, addAlongsideAvailable = false, keepTasksAvailable = false, onPublishFree, onUnpublish }) {
  const [tab, setTab] = useState("details");
  const [details, setDetails] = useState({ ...program, description: program.description || "", purpose: program.purpose || "", sport: program.sport || "", difficulty: program.difficulty || "all_levels", age_band: program.age_band || "all_ages", equipment: (program.equipment || []).join(", "), tags: (program.tags || []).join(", ") });
  const [versions, setVersions] = useState([]);
  const [links, setLinks] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [copyAction, setCopyAction] = useState(null);
  const [copyTitle, setCopyTitle] = useState("");
  const [note, setNote] = useState("");
  const [days, setDays] = useState("30");
  const [linkDays, setLinkDays] = useState({});
  const [permission, setPermission] = useState("copy");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const dialog = useRef(null);
  const copyForm = useRef(null);
  const [versionNote, setVersionNote] = useState("");
  const [allowCommunityCopy, setAllowCommunityCopy] = useState(program.community_allow_copy !== false);
  const working = busy || externalBusy;
  const currentVersion = program.current_version;
  const mounted = useRef(true);
  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (dialog.current?.showModal) dialog.current.showModal();
    else dialog.current?.setAttribute("open", "");
    dialog.current?.querySelector("button")?.focus();
    return () => { document.body.style.overflow = previousOverflow; previousFocus?.focus?.(); };
  }, []);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!copyAction) return;
    copyForm.current?.scrollIntoView?.({ block: "nearest" });
    const field = copyForm.current?.querySelector("input,textarea");
    field?.focus();
    field?.select();
  }, [copyAction]);

  useEffect(() => {
    if (tab === "details") { setLoading(false); return; }
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
    if (working || !(await authorize("manage a saved programme"))) return;
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
  return createPortal(<dialog ref={dialog} className="trainingProgramLibrary programDetailsDialog" aria-label={"Programme details: " + program.title}
    onCancel={(e) => { e.preventDefault(); if (!working) onClose(); }}
    onClick={(e) => { if (e.target === e.currentTarget && !working) onClose(); }}
    onKeyDown={(e) => {
      if (e.key === "Escape") { e.preventDefault(); if (!working) onClose(); }
      if (e.key === "Tab") {
        const controls = Array.from(dialog.current.querySelectorAll("button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,[tabindex='0']")).filter((el) => el.getClientRects().length);
        const first = controls[0], last = controls[controls.length - 1];
        if (first && e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (last && !e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }}><section className="programManager" aria-label={"Manage " + program.title} aria-busy={working}>
    <div className="programManagerHeading"><h3>{program.title}</h3><button type="button" disabled={working} onClick={onClose}>Close</button></div>
    <div className="programManagerTabs" aria-label="Programme management">
      {[["details", "Details"], ["history", "Version history"], ["links", "Sharing links"]].map(([id, label]) =>
        <button type="button" key={id} aria-pressed={tab === id} disabled={working} onClick={() => { setTab(id); setCopyAction(null); }}>{label}</button>)}
    </div>
    {notice || externalNotice ? <p role="status" className="trainingProgramNotice">{notice || externalNotice}</p> : null}
    {loading ? <p role="status">Loading…</p> : null}
    <details className="programActionHelp"><summary>What do these options do?</summary><dl>
      <dt>Use this Program</dt><dd>Choose how this saved version should fit with your active plan. Making it current replaces your base training and tasks while keeping logs, XP and any separate add-on.</dd>
      <dt>Duplicate</dt><dd>Create a separate programme from the selected saved version. Your active plan stays as it is.</dd>
      <dt>Save new version</dt><dd>Save your currently active base plan as a new version of this programme. Existing recipients keep their issued version until they accept an update.</dd>
      <dt>Version history / restore</dt><dd>Preview previous versions or restore an older one as a new latest version. This does not change anyone’s active plan.</dd>
      <dt>Assign</dt><dd>Invite selected team members to follow this programme, with the permissions you choose.</dd>
      <dt>Sharing links</dt><dd>Share a saved version for preview or use and adaptation. Link expiry and revocation prevent future access; adopted plans stay available.</dd>
      <dt>Archive / restore programme</dt><dd>Move a programme out of the main library or bring it back. Its active plans and assignments are retained.</dd>
      <dt>Save details</dt><dd>Update the name and catalogue information without rewriting saved training versions.</dd>
    </dl></details>
    {tab === "details" ? <div className="programCurrentVersion">
      <div className="programManagerHeading"><h4>Current version · {program.current_version_no || currentVersion?.version_no || "—"}</h4><span className="pill">{program.status === "archived" ? "Archived" : "Private"}</span></div>
      {currentVersion?.change_note ? <p className="muted">{currentVersion.change_note}</p> : null}
      {currentVersion?.content_json ? <ProgramVersionPreview key={currentVersion.id} version={currentVersion} /> : <p className="muted">The saved preview is unavailable. Close and reopen the programme to retry.</p>}
      {onStartDateChange && program.status !== "archived" ? <div className="trainingProgramControls"><label>Starts Monday<input type="date" value={startDate} onChange={(e) => onStartDateChange(e.target.value)} /></label><label>At the end<select value={completionMode} onChange={(e) => onCompletionModeChange(e.target.value)}><option value="repeat">Repeat</option><option value="once">Finish</option><option value="hold">Hold final week</option></select></label></div> : null}
      {onUse && program.status !== "archived" ? <section className="programUsePanel" aria-label="Use this Program">
        <div className="programUseHeading">
          <strong>Use this Program</strong>
          <p>Choose what should happen to your active plan.</p>
        </div>
        <div className="programUseChoices">
          <button type="button" className="programUseChoice" disabled={working || !addAlongsideAvailable || isCurrentVersionAdded} onClick={() => { setNotice(""); onUse("add"); }}>
            <span><strong>Add alongside my current plan</strong><small>{isCurrentVersionAdded ? "This Program is already running alongside your base plan." : addAlongsideAvailable ? "Keep your current base plan and run this as your one additional Program." : "You already have one Program running alongside your base plan."}</small></span>
            <span className="pill">{isCurrentVersionAdded ? "Already added" : addAlongsideAvailable ? "Add" : "Unavailable"}</span>
          </button>
          <button type="button" className="programUseChoice programUseChoicePrimary" disabled={working || isCurrentVersionActive} onClick={() => { setNotice(""); onUse("replace"); }}>
            <span><strong>Make this my current plan</strong><small>Replace your current base training and Tasks. Logs, XP and any separate add-on stay.</small></span>
            <span className="pill">{isCurrentVersionActive ? "Already active" : "Use"}</span>
          </button>
          <button type="button" className="programUseChoice" disabled={working || !keepTasksAvailable || isCurrentVersionActive} onClick={() => { setNotice(""); onUse("replace_keep_tasks"); }}>
            <span><strong>Make this my current plan, but keep my Tasks</strong><small>{isCurrentVersionActive ? "This Program is already your current base plan." : "Replace the training structure while retaining your personal Task blocks."}</small></span>
            <span className="pill">{isCurrentVersionActive ? "Already active" : keepTasksAvailable ? "Use + keep Tasks" : "Unavailable"}</span>
          </button>
        </div>
      </section> : null}
      <div className="programManagerActions">
        <button type="button" disabled={working || !currentVersion?.id} onClick={() => beginCopy(currentVersion, true)}>Duplicate current version</button>
        <button type="button" disabled={working} onClick={() => { setNotice(""); setTab("links"); }}>Share programme</button>
      </div>
      {startDate && program.status !== "archived" ? <p className="muted">Using this programme starts it on {dateLabel(startDate)} · {completionMode === "once" ? "Finish after the final week" : completionMode === "hold" ? "Hold the final week" : "Repeat after the final week"}. These options apply when you use the programme.</p> : null}
      {program.status !== "archived" && (onPublishFree || onUnpublish) ? <details className="programCommunityPublish">
        <summary>Community publishing</summary>
        <div className="programCommunityPublishBody">
          <div>
            <span className="pill">{program.marketplace_status === "published" ? "Live in Community" : "Private"}</span>
            <strong>{program.marketplace_status === "published" ? "This Program is discoverable for free." : "Publish this saved Program to Community."}</strong>
            <p>{program.marketplace_status === "published" ? "People can preview and use the current saved version. Removing it from Community stops new discovery but does not remove Programs people already adopted." : "Share this programme for people to preview, use and adapt. Your published creator bio will appear alongside it."}</p>
            {program.community_suspended ? <p>Community publishing is paused while this programme is reviewed.</p> : null}
            {program.community_origin_program_id ? <p>This is a personal Community adaptation. It can be used privately but cannot be republished as your own.</p> : null}
            <label className="programWorkflowCheck"><input type="checkbox" disabled={working} checked={allowCommunityCopy} onChange={(e) => setAllowCommunityCopy(e.target.checked)} />Allow personal library copies from Community</label>
            <p>This controls new reusable copies. Existing copies stay available, and people can still use and adjust the programme in their active plan.</p>
            <button type="button" disabled={working} onClick={() => mutate(() => setCommunityCopyPermission(program.id, allowCommunityCopy), "Community copy permission saved.")}>Save copy permission</button>
          </div>
          {program.marketplace_status === "published"
            ? <button type="button" disabled={working} onClick={onUnpublish}>Remove from Community</button>
            : <button type="button" className="primary" disabled={working || !currentVersion?.id || program.community_suspended || !!program.community_origin_program_id} onClick={onPublishFree}>Publish free</button>}
        </div>
      </details> : null}
      {onSaveVersion && program.status !== "archived" ? <details className="programSaveVersion"><summary>Save active plan as a new version</summary><p className="muted">This saves your currently active base plan, which may differ from the preview above.</p><label>Version change note<input maxLength={300} value={versionNote} onChange={(e) => setVersionNote(e.target.value)} placeholder="What has changed?" /></label><button type="button" disabled={working || noCopy} onClick={() => { setNotice(""); onSaveVersion(versionNote); }}>Save new version</button>{noCopy ? <p>The coach has not allowed saving your active assigned programme as a copy.</p> : null}</details> : null}
      <div className="programManagerActions">
        {onAssign && program.status !== "archived" ? <button type="button" disabled={working} onClick={onAssign}>Assign programme</button> : null}
        {onArchive ? <button type="button" disabled={working} onClick={() => { setNotice(""); onArchive(); }}>{program.status === "archived" ? "Restore programme" : "Archive programme"}</button> : null}
      </div>
    </div> : null}
    {tab === "details" ? <details className="programMetadata"><summary>Edit programme details</summary><form className="programDetailsForm" onSubmit={(e) => { e.preventDefault(); mutate(() => updateProgramDetails(program, { ...details, equipment: commaList(details.equipment), tags: commaList(details.tags) }), "Programme details saved. Existing versions and assignments were preserved."); }}>
      <label>Name<input required minLength={2} maxLength={100} value={details.title} onChange={(e) => set("title", e.target.value)} /></label>
      <label>Description<textarea maxLength={1200} value={details.description} onChange={(e) => set("description", e.target.value)} /></label>
      <label>Purpose<input maxLength={80} value={details.purpose} onChange={(e) => set("purpose", e.target.value)} placeholder="e.g. Match preparation" /></label>
      <label>Sport<input maxLength={80} value={details.sport} onChange={(e) => set("sport", e.target.value)} /></label>
      <label>Difficulty<select value={details.difficulty} onChange={(e) => set("difficulty", e.target.value)}>{["all_levels", "beginner", "intermediate", "advanced"].map((x) => <option key={x} value={x}>{x.replaceAll("_", " ")}</option>)}</select></label>
      <label>Age range<select value={details.age_band} onChange={(e) => set("age_band", e.target.value)}>{[["all_ages", "All ages"], ["child", "Children"], ["teen", "Teens"], ["adult", "Adults"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      <label>Equipment<input value={details.equipment} onChange={(e) => set("equipment", e.target.value)} placeholder="Comma-separated, e.g. Dumbbells, mat" /></label>
      <label>Tags<input value={details.tags} onChange={(e) => set("tags", e.target.value)} placeholder="Comma-separated, up to 20" /></label>
      <button className="primary" type="submit" disabled={working || details.title.trim().length < 2 || commaList(details.equipment).length > 20 || commaList(details.tags).length > 20}>{busy ? "Saving…" : "Save details"}</button>
    </form></details> : null}
    {tab === "history" && !loading ? <div className="programHistory">
      <p className="muted">Saved versions stay unchanged. Restoring creates a new latest version; recipients keep their issued version until they accept an update.</p>
      {versions.map((version) => <article key={version.id}>
        <div className="programManagerHeading"><strong>Version {version.version_no}{version.id === program.current_version_id ? " · Current" : ""}</strong><small>{dateLabel(version.created_at)}</small></div>
        <p>{version.change_note || "No change note"}</p>
        <div className="programManagerActions"><button type="button" disabled={working} onClick={() => setSelectedVersion(selectedVersion?.id === version.id ? null : version)}>Preview</button>
          <button type="button" disabled={working} onClick={() => beginCopy(version, true)}>Duplicate</button>
          <button type="button" disabled={working || program.status === "archived" || version.id === program.current_version_id} onClick={() => beginCopy(version, false)}>Restore as new version</button></div>
        {selectedVersion?.id === version.id ? <ProgramVersionPreview key={version.id} version={version} /> : null}
      </article>)}
      {!versions.length ? <p>No saved versions.</p> : null}

    </div> : null}
      {copyAction ? <form ref={copyForm} className="programCopyForm" onSubmit={(e) => { e.preventDefault(); mutate(() => copyProgramVersion({ program, versionId: copyAction.version.id, duplicate: copyAction.duplicate, title: copyTitle.trim(), changeNote: note.trim() }), copyAction.duplicate ? "A separate programme was created in My Programs." : "Older content restored as a new version. Active plans and issued assignments were preserved."); }}>
        <h4>{copyAction.duplicate ? "Duplicate" : "Restore"} version {copyAction.version.version_no}</h4>
        {copyAction.duplicate ? <label>New programme name<input required minLength={2} maxLength={100} value={copyTitle} onChange={(e) => setCopyTitle(e.target.value)} /></label> : null}
        <label>Change note<textarea required maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} /></label>
        <div className="programManagerActions"><button type="button" disabled={working} onClick={() => setCopyAction(null)}>Cancel</button><button type="submit" className="primary" disabled={working || !note.trim() || copyTitle.trim().length < 2}>{busy ? "Saving…" : copyAction.duplicate ? "Create duplicate" : "Create restored version"}</button></div>
      </form> : null}
    {tab === "links" && !loading ? <div className="programLinks">
      <p className="muted">Each link shares its saved version. Revoking or expiring a link prevents future use; plans already adopted remain available.</p>
      <div className="programLinkCreate"><h4>Create a sharing link</h4><label>Link access<select value={permission} onChange={(e) => setPermission(e.target.value)}><option value="copy">Use and adapt</option><option value="view">Preview only</option></select></label>
        <label>Valid for (days)<input type="number" min={1} max={365} value={days} onChange={(e) => setDays(e.target.value)} /></label>
        <button type="button" disabled={working || program.status === "archived" || !Number.isInteger(Number(days)) || Number(days) < 1 || Number(days) > 365} onClick={() => mutate(() => createTrainingProgramShare(program.id, permission, Number(days)), "New private link created below.")}>Create link</button></div>
      {links.map((link) => {
        const status = link.revoked_at ? "Revoked" : link.expires_at && new Date(link.expires_at) <= new Date() ? "Expired" : program.status === "archived" ? "Paused (archived)" : "Active";
        return <article key={link.id}><div className="programManagerHeading"><strong>{status} · {link.permission === "view" ? "Preview only" : link.permission === "follow" ? "Follow" : "Use and adapt"}</strong><small>Expires {dateLabel(link.expires_at)}</small></div>
          <small>Version {link.version?.version_no || versions.find((v) => v.id === link.version_id)?.version_no || (link.version_id === program.current_version_id ? program.current_version_no : "ID " + link.version_id.slice(0, 8))}</small>
          <input aria-label="Private sharing link" readOnly value={buildTrainingProgramShareLink(link.share_token)} onFocus={(e) => e.target.select()} />
          {!link.revoked_at ? <div className="programManagerActions"><button type="button" disabled={working || status !== "Active" || program.status === "archived"} onClick={async () => { try { await navigator.clipboard.writeText(buildTrainingProgramShareLink(link.share_token)); setNotice("Private link copied."); } catch { setNotice("Select the link above and copy it."); } }}>Copy link</button>
            <details className="programLinkExpiry"><summary>Change expiry</summary><form onSubmit={(e) => { e.preventDefault(); mutate(() => updateProgramLink(link.id, false, linkDays[link.id] || "30"), "Link expiry updated from today."); }}><label>Days from today<input type="number" min={1} max={365} required value={linkDays[link.id] ?? "30"} onChange={(e) => setLinkDays((old) => ({ ...old, [link.id]: e.target.value }))} /></label><button type="submit" disabled={working || !Number.isInteger(Number(linkDays[link.id] ?? 30)) || Number(linkDays[link.id] ?? 30) < 1 || Number(linkDays[link.id] ?? 30) > 365}>Set expiry</button></form></details>
            <button type="button" disabled={working} onClick={() => { if (window.confirm("Revoke this link? New recipients will no longer be able to use it. Existing adopted plans are retained.")) mutate(() => updateProgramLink(link.id, true), "Sharing link revoked."); }}>Revoke</button></div> : null}
        </article>;
      })}
      {!links.length ? <p>No sharing links yet.</p> : null}
    </div> : null}
  </section></dialog>, document.body);
}
