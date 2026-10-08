import React, { useCallback, useEffect, useRef, useState } from "react";
import { bookmarkCommunity, communityContext, copyCommunity, listCommunityReports, reportCommunity, reviewCommunityReport, voteCommunity } from "./communityDiscoveryDb.js";
import { emptyCommunityContext } from "./communityDiscovery.js";
import "./communityTools.css";
import { ProgramVersionPreview } from "./ProgramManager.jsx";

export function useCommunityContext(profileId) {
  const [context, setContext] = useState(emptyCommunityContext);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++generation.current;
    const r = await communityContext(profileId);
    if (current !== generation.current) return;
    if (r.error) { setError(r.error.message); throw r.error; }
    setContext(r.data || emptyCommunityContext()); setError("");
  }, [profileId]);
  useEffect(() => {
    setContext(emptyCommunityContext()); setError("");
    refresh().catch(() => {});
    return () => { generation.current += 1; };
  }, [profileId, refresh]);
  return { context, error, refresh };
}

export function CommunityReportForm({ profileId, target, authorize, onClose, onSubmitted }) {
  const [reason, setReason] = useState("safety"), [details, setDetails] = useState(""), [busy, setBusy] = useState(false), [notice, setNotice] = useState("");
  const alive = useRef(true);
  const ref = useRef(null);
  useEffect(() => { alive.current = true; ref.current?.focus(); return () => { alive.current = false; }; }, []);
  async function submit(e) {
    e.preventDefault();
    if (busy || (authorize && !(await authorize("report Community content")))) return;
    setBusy(true); setNotice("");
    try { const r = await reportCommunity(profileId, target, reason, details.trim()); if (r.error) throw r.error; if (alive.current) { setNotice("Report submitted privately for review. Thank you."); onSubmitted?.(); } }
    catch (e) { if (alive.current) setNotice(e.message); }
    finally { if (alive.current) setBusy(false); }
  }
  return <form className="communityReportForm" onSubmit={submit}><h4 tabIndex={-1} ref={ref}>Report {target.name}</h4><p>Your report and identity are private to authorised reviewers.</p>
    {notice ? <p role="status">{notice}</p> : null}
    {!notice.startsWith("Report submitted") ? <><label>Reason<select disabled={busy} value={reason} onChange={(e) => setReason(e.target.value)}><option value="safety">Safety concern</option><option value="misleading">Misleading claims or credentials</option><option value="ownership">Copied content / ownership</option><option value="inappropriate">Inappropriate content</option><option value="other">Other</option></select></label>
    <label>What should we review?<textarea required minLength={10} maxLength={2000} disabled={busy} value={details} onChange={(e) => setDetails(e.target.value)} /></label></> : null}
    <div className="communityToolActions"><button type="button" disabled={busy} onClick={onClose}>Close report</button>{!notice.startsWith("Report submitted") ? <button type="submit" className="primary" disabled={busy || details.trim().length < 10}>{busy ? "Submitting…" : "Submit report"}</button> : null}</div>
  </form>;
}

export function CommunityProgramTools({ profileId, program, authorize, onCopied }) {
  const { context, error, refresh } = useCommunityContext(profileId);
  const [busy, setBusy] = useState(""), [notice, setNotice] = useState(""), [copying, setCopying] = useState(false), [reporting, setReporting] = useState(false);
  const [title, setTitle] = useState(`${program.title} — my copy`);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const stats = context.programmes.find((p) => p.program_id === program.id);
  const saved = context.bookmarks.some((b) => b.program_id === program.id);
  async function run(action, operation, success) {
    if (busy || (authorize && !(await authorize(action)))) return;
    if (!alive.current) return;
    setBusy(action); setNotice("");
    try { const r = await operation(); if (r.error) throw r.error; if (!alive.current) return; setNotice(success); try { await refresh(); } catch { if (alive.current) setNotice(`${success} Reopen Community to refresh the displayed details.`); } return r.data; }
    catch (e) { if (alive.current) setNotice(e.message); }
    finally { if (alive.current) setBusy(""); }
  }
  return <section className="communityProgramTools"><h4>Save, adapt &amp; feedback</h4>{notice || error ? <p role="status">{notice || error}</p> : null}
    <div className="communityToolActions"><button type="button" disabled={!!busy || !stats} aria-pressed={saved} onClick={() => run("save a Community programme", () => bookmarkCommunity(profileId, program.id, !saved), saved ? "Removed from Saved programmes." : "Saved for later. Your active plan is unchanged.")}>{saved ? "Saved · remove" : "Save for later"}</button>
    <button type="button" disabled={!!busy || !stats?.allow_copy} onClick={() => setCopying(!copying)}>Copy and adapt</button><button type="button" disabled={!!busy} onClick={() => setReporting(!reporting)}>Report programme</button></div>
    {stats && !stats.allow_copy ? <p>The creator allows use in your plan, but has not allowed personal library copies.</p> : null}
    {copying ? <form onSubmit={async (e) => { e.preventDefault(); const id = await run("copy a Community programme", () => copyCommunity(profileId, program, title.trim()), "Personal copy saved to My Programs."); if (id && alive.current) onCopied(id); }}><label>Name your personal copy<input autoFocus required minLength={2} maxLength={160} disabled={!!busy} value={title} onChange={(e) => setTitle(e.target.value)} /></label><p>This creates a private programme in My Programs. Your active plan stays as it is. Use the copy in Build to adapt its sessions; personal copies cannot be republished as your own.</p><button type="submit" disabled={!!busy || title.trim().length < 2}>{busy ? "Copying…" : "Create personal copy"}</button></form> : null}
    <div className="communityVoting"><strong>Helpful for {program.purpose || "its stated training goals"}?</strong><small>{stats?.helpful || 0} helpful · {stats?.not_helpful || 0} not helpful · feedback on this version</small><div className="communityToolActions">
      <button type="button" aria-pressed={stats?.my_vote === true} disabled={!!busy || !stats?.can_vote} onClick={() => run("vote on a Community programme", () => voteCommunity(profileId, program, stats.my_vote === true ? null : true), stats.my_vote === true ? "Your vote was removed." : "Your helpful vote was saved.")}>Helpful</button>
      <button type="button" aria-pressed={stats?.my_vote === false} disabled={!!busy || !stats?.can_vote} onClick={() => run("vote on a Community programme", () => voteCommunity(profileId, program, stats.my_vote === false ? null : false), stats.my_vote === false ? "Your vote was removed." : "Your feedback was saved.")}>Not helpful</button></div>
      {stats && !stats.can_vote ? <small>You cannot vote on programmes created by your own account.</small> : <small>One vote per profile. Select your current vote again to remove it.</small>}
    </div>
    {reporting ? <CommunityReportForm profileId={profileId} target={{ programId: program.id, name: program.title }} authorize={authorize} onClose={() => setReporting(false)} /> : null}
  </section>;
}

export function CommunityModeration({ authorize, onChanged }) {
  const [rows, setRows] = useState([]), [notice, setNotice] = useState(""), [busy, setBusy] = useState(""), [notes, setNotes] = useState({}), [actions, setActions] = useState({});
  const alive = useRef(true);
  async function load() { const r = await listCommunityReports(); if (r.error) throw r.error; if (alive.current) setRows(r.data || []); }
  useEffect(() => { alive.current = true; load().catch((e) => { if (alive.current) setNotice(e.message); }); return () => { alive.current = false; }; }, []);
  async function review(row) {
    if (busy || (authorize && !(await authorize("review a Community report")))) return;
    const action = actions[row.id] || "reviewing";
    if ((action === "hide" || action === "restore") && !window.confirm(action === "hide" ? "Hide this content from Community until review is complete? Previously adopted plans remain available." : "Allow the owner to publish this content again? It stays private until they publish it.")) return;
    setBusy(row.id); setNotice("");
    try { const r = await reviewCommunityReport(row.id, action, notes[row.id]); if (r.error) throw r.error; await load(); await onChanged?.(); if (alive.current) setNotice("Review decision saved."); }
    catch (e) { if (alive.current) setNotice(e.message); } finally { if (alive.current) setBusy(""); }
  }
  return <section className="communityModeration"><h3>Community reports</h3><p>Reports and decision notes are private. Hiding a creator also removes their programmes and verified mark. Restoring permits publishing again; it does not restore a verified mark.</p>{notice ? <p role="status">{notice}</p> : null}{!rows.length ? <p>No reports to review.</p> : null}
    {rows.map((row) => <details key={row.id}><summary>{row.target_name} · {row.reason} · {row.status}{row.suspended ? " · publishing paused" : ""}</summary><p className="creatorText">{row.details}</p><small>Reported {new Date(row.created_at).toLocaleDateString()}</small>
      {row.snapshot ? <details><summary>View content as reported</summary>{row.snapshot.content_json ? <><p>{row.snapshot.description}</p><p>{row.snapshot.purpose}</p><ProgramVersionPreview version={row.snapshot} /></> : <><p>{row.snapshot.headline}</p><p className="creatorText">{row.snapshot.bio}</p><p className="creatorText">{row.snapshot.experience}</p><ul>{row.snapshot.qualifications?.map((q, i) => <li key={i}>{q.name} · {q.issuer}</li>)}</ul></>}</details> : null}
      {row.actions?.map((a, i) => <p key={i}>{a.action} · {a.note} · {new Date(a.created_at).toLocaleDateString()}</p>)}
      <label>Review action<select disabled={!!busy} value={actions[row.id] || "reviewing"} onChange={(e) => setActions((old) => ({ ...old, [row.id]: e.target.value }))}><option value="reviewing">Mark as reviewing</option><option value="resolve">Resolve without hiding</option><option value="dismiss">Dismiss report</option><option value="hide">Hide from Community</option><option value="restore">Allow publishing again</option></select></label>
      <label>Private decision note<textarea minLength={10} maxLength={1500} disabled={!!busy} value={notes[row.id] || ""} onChange={(e) => setNotes((old) => ({ ...old, [row.id]: e.target.value }))} /></label><button type="button" disabled={!!busy || (notes[row.id] || "").trim().length < 10} onClick={() => review(row)}>{busy === row.id ? "Saving…" : "Save review decision"}</button>
    </details>)}
  </section>;
}
