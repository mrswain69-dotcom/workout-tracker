import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { creatorFileUrl, creatorVerified, getCreator, listCreatorRequests, reviewerAccess, reviewCreatorRequest, saveCreator, submitCreatorRequest, uploadCreatorFile } from "./creatorDb.js";
import "./creatorProfile.css";
const categories = ["Strength & conditioning", "Sport skills", "Endurance", "Mobility & recovery", "Rehabilitation", "Yoga & wellbeing", "Youth training", "General fitness"];
export function VerifiedCreatorMark({ creator, verified = creatorVerified(creator) }) {
  return verified ? <span className="creatorVerified" title="Creator identity and listed qualifications reviewed. Experience is self-declared; individual programmes are not certified."><span aria-hidden="true">✓</span> Verified creator</span> : null;
}
function CreatorPhoto({ path, name }) {
  const [url, setUrl] = useState("");
  useEffect(() => { let cancelled = false; setUrl(""); if (path) creatorFileUrl(path).then((r) => { if (!cancelled) setUrl(r.data?.signedUrl || ""); }).catch(() => {}); return () => { cancelled = true; }; }, [path]);
  return url ? <img className="creatorPhoto" src={url} alt={`${name} profile`} /> : <span className="creatorPhoto creatorInitial" aria-hidden="true">{(name || "C").slice(0, 1).toUpperCase()}</span>;
}
export function CreatorBiography({ creator }) {
  return <div className="creatorBiography">
    <div className="creatorIdentity"><CreatorPhoto path={creator.photo_path} name={creator.display_name} /><div><h3>{creator.display_name}</h3><p>{creator.headline}</p><VerifiedCreatorMark creator={creator} /></div></div>
    <div className="creatorTags"><span>{creator.role === "pt" ? "Personal trainer" : creator.role}</span>{[...(creator.categories || []), ...(creator.tags || [])].map((tag, i) => <span key={`${tag}-${i}`}>{tag}</span>)}</div>
    {creator.bio ? <section><h4>About</h4><p className="creatorText">{creator.bio}</p></section> : null}
    {creator.experience || creator.years_experience != null ? <section><h4>Experience</h4>{creator.years_experience != null ? <p>{creator.years_experience} years of experience</p> : null}<p className="creatorText">{creator.experience}</p><small>Experience described by the creator.</small></section> : null}
    <section><h4>Qualifications &amp; certifications</h4>
      {(creator.qualifications || []).length ? <ul>{creator.qualifications.map((q, i) => <li key={i}><strong>{q.name}</strong>{q.issuer ? ` · ${q.issuer}` : ""}{q.reference_url ? <> · <a href={q.reference_url} target="_blank" rel="noopener noreferrer">Credential reference</a></> : null}</li>)}</ul> : <p>No qualifications listed.</p>}
      {creatorVerified(creator) ? <div className="creatorVerificationNote"><strong>Identity and listed qualifications reviewed {new Date(creator.verified_at).toLocaleDateString()}</strong><p>{creator.verified_summary}</p><small>The mark applies to the creator’s reviewed credentials. It does not certify every programme or its suitability for an individual.</small></div> : <p className="muted">Qualifications are self-declared and have not been verified by Workout Tracker.</p>}
    </section>
    {creator.website ? <a href={creator.website} target="_blank" rel="noopener noreferrer">Visit creator website</a> : null}
  </div>;
}
export function CreatorProfileDialog({ id, programmes = [], onClose, onProgram }) {
  const ref = useRef(null);
  const [creator, setCreator] = useState(null), [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    getCreator(id).then((r) => { if (alive) { if (r.error || !r.data) setError(r.error?.message || "This creator profile is unavailable."); else setCreator(r.data); } }).catch((e) => { if (alive) setError(e.message); });
    const previous = document.activeElement, overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (ref.current?.showModal) ref.current.showModal(); else ref.current?.setAttribute("open", "");
    ref.current?.querySelector("button")?.focus();
    return () => { alive = false; document.body.style.overflow = overflow; previous?.focus?.(); };
  }, [id]);
  return createPortal(<dialog ref={ref} className="creatorDialog" aria-label="Creator biography" onCancel={(e) => { e.preventDefault(); onClose(); }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}><div className="creatorDialogInner"><button type="button" className="creatorClose" onClick={onClose}>Close</button>{error ? <p role="alert">{error}</p> : creator ? <><CreatorBiography creator={creator} /><h4>Programmes by {creator.display_name}</h4>{programmes.filter((p) => p.creator_id === id).map((p) => <button type="button" className="creatorProgramme" key={p.id} onClick={() => onProgram(p)}><strong>{p.title}</strong><span>{p.week_count} weeks · {p.sport || p.purpose || "Training"}</span></button>)}</> : <p role="status">Loading creator profile…</p>}</div></dialog>, document.body);
}
const csv = (value) => value.split(",").map((v) => v.trim()).filter(Boolean);
const empty = (name) => ({ display_name: name || "", headline: "", bio: "", experience: "", years_experience: "", role: "community", categories: [], tags: [], qualifications: [], website: "", photo_path: "", published: false });
export default function CreatorProfileEditor({ profileId, profileName, authorize, onChanged }) {
  const [draft, setDraft] = useState(empty(profileName)), [saved, setSaved] = useState(null);
  const [requests, setRequests] = useState([]), [reviewer, setReviewer] = useState(false);
  const [busy, setBusy] = useState("loading"), [notice, setNotice] = useState("");
  const [statement, setStatement] = useState(""), [evidence, setEvidence] = useState([]), [preview, setPreview] = useState(false);
  const alive = useRef(true);
  const change = (key, value) => setDraft((old) => ({ ...old, [key]: value }));
  async function load() {
    const [c, r, access] = await Promise.all([getCreator(profileId), listCreatorRequests(profileId), reviewerAccess()]);
    if (!alive.current) return;
    if (c.error || r.error || access.error) throw c.error || r.error || access.error;
    setSaved(c.data); setDraft(c.data || empty(profileName)); setRequests(r.data || []); setReviewer(!!access.data);
  }
  useEffect(() => { alive.current = true; load().catch((e) => { if (alive.current) setNotice(e.message); }).finally(() => { if (alive.current) setBusy(""); }); return () => { alive.current = false; }; }, [profileId]);
  async function run(key, action, success) {
    if (authorize && !(await authorize("manage a creator profile"))) return;
    if (!alive.current) return;
    setBusy(key); setNotice("");
    try { const r = await action(); if (r.error) throw r.error; if (!alive.current) return; await load(); await onChanged?.(); if (alive.current) setNotice(success); }
    catch (e) { if (alive.current) setNotice(e.message || "The change could not be saved."); }
    finally { if (alive.current) setBusy(""); }
  }
  async function upload(file, kind) {
    if (!file || (authorize && !(await authorize("upload a creator file")))) return;
    setBusy("upload"); setNotice("");
    try { const r = await uploadCreatorFile(profileId, kind, file); if (r.error) throw r.error; if (!alive.current) return; if (kind === "photos") { change("photo_path", r.data.path); setNotice("Photo uploaded. Save your profile to use it."); } else { setEvidence((old) => [...old, r.data.path]); setNotice("Evidence uploaded privately. Submit your request when ready."); } }
    catch (e) { if (alive.current) setNotice(e.message); } finally { if (alive.current) setBusy(""); }
  }
  const pending = requests.some((r) => r.status === "pending");
  const credentialsChanged = saved && (draft.display_name !== saved.display_name || draft.role !== saved.role || JSON.stringify(draft.qualifications) !== JSON.stringify(saved.qualifications));
  const unsaved = !saved || JSON.stringify(draft) !== JSON.stringify(saved);
  return <section className="creatorEditor programWorkflowSection"><h3>My creator profile</h3><p>Help people understand your background and the programmes you create. Publishing your bio makes it visible to signed-in Community members.</p>
    {notice ? <p role="status" className="trainingProgramNotice">{notice}</p> : null}
    <form onSubmit={(e) => { e.preventDefault(); run("save", () => saveCreator(profileId, draft), "Creator profile saved."); }}>
      <fieldset className="creatorFields" disabled={!!busy}>
      <div className="creatorFormGrid"><label>Display name<input required minLength={2} maxLength={100} value={draft.display_name} onChange={(e) => change("display_name", e.target.value)} /></label>
      <label>Creator category<select value={draft.role} onChange={(e) => change("role", e.target.value)}><option value="community">Community creator</option><option value="coach">Coach</option><option value="pt">Personal trainer</option><option value="physio">Physiotherapist</option><option value="athlete">Athlete</option><option value="club">Club / organisation</option></select></label>
      <label>Headline<input maxLength={160} value={draft.headline} onChange={(e) => change("headline", e.target.value)} placeholder="Your specialism or approach" /></label>
      <label>Years of experience<input type="number" min={0} max={80} value={draft.years_experience ?? ""} onChange={(e) => change("years_experience", e.target.value)} /></label></div>
      <label>About you<textarea maxLength={3000} value={draft.bio} onChange={(e) => change("bio", e.target.value)} /></label>
      <label>Experience description<textarea maxLength={3000} value={draft.experience} onChange={(e) => change("experience", e.target.value)} placeholder="Who you work with, relevant roles and your coaching background" /></label>
      <div className="creatorFormGrid"><label>Specialisms / categories (comma separated)<input list="creator-categories" value={draft.categories.join(",")} onChange={(e) => change("categories", e.target.value.split(","))} onBlur={() => change("categories", csv(draft.categories.join(",")))} /><datalist id="creator-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist></label>
      <label>Tags (comma separated)<input value={draft.tags.join(",")} onChange={(e) => change("tags", e.target.value.split(","))} onBlur={() => change("tags", csv(draft.tags.join(",")))} /></label>
      <label>Website<input type="url" pattern="https://.*" value={draft.website} onChange={(e) => change("website", e.target.value)} placeholder="https://" /></label>
      <label>Profile picture<input type="file" accept="image/jpeg,image/png,image/webp" disabled={!!busy} onChange={(e) => upload(e.target.files?.[0], "photos")} /></label></div>
      {draft.photo_path ? <div className="creatorIdentity"><CreatorPhoto path={draft.photo_path} name={draft.display_name} /><button type="button" disabled={!!busy} onClick={() => change("photo_path", "")}>Remove photo from profile</button></div> : null}
      <fieldset><legend>Qualifications &amp; certification statements</legend><p>List the qualification and awarding body. Add an official register or credential reference when available.</p>
      {draft.qualifications.map((q, i) => <div className="creatorQualification" key={i}><label>Qualification {i + 1}<input required minLength={2} maxLength={160} value={q.name} onChange={(e) => change("qualifications", draft.qualifications.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} /></label><label>Awarding body<input maxLength={160} value={q.issuer || ""} onChange={(e) => change("qualifications", draft.qualifications.map((x, j) => j === i ? { ...x, issuer: e.target.value } : x))} /></label><label>Public credential reference<input type="url" pattern="https://.*" value={q.reference_url || ""} onChange={(e) => change("qualifications", draft.qualifications.map((x, j) => j === i ? { ...x, reference_url: e.target.value } : x))} /></label><button type="button" disabled={!!busy} onClick={() => change("qualifications", draft.qualifications.filter((_, j) => j !== i))}>Remove qualification {i + 1}</button></div>)}
      <button type="button" disabled={!!busy || draft.qualifications.length >= 20} onClick={() => change("qualifications", [...draft.qualifications, { name: "", issuer: "", reference_url: "" }])}>Add qualification</button></fieldset>
      {credentialsChanged && creatorVerified(saved) ? <p className="creatorVerificationNote">Changing your name, creator category or qualifications removes the verified mark until the new details are reviewed.</p> : null}
      <label className="programWorkflowCheck"><input type="checkbox" checked={draft.published} onChange={(e) => change("published", e.target.checked)} />Publish my creator bio in Community</label>
      <div className="creatorActions">{saved?.published ? <button type="button" disabled={!!busy} onClick={async () => { const url = new URL(window.location.href); url.searchParams.delete("coachInvite"); url.searchParams.delete("programShare"); url.searchParams.set("creator", profileId); try { await navigator.clipboard.writeText(url.href); setNotice("Creator bio link copied."); } catch { setNotice(`Copy this creator bio link: ${url.href}`); } }}>Copy creator bio link</button> : null}<button type="submit" className="primary" disabled={!!busy}>{busy === "save" ? "Saving…" : "Save creator profile"}</button><button type="button" disabled={!saved || !!busy} onClick={() => setPreview(!preview)}>{preview ? "Hide preview" : "Preview saved bio"}</button></div>
      </fieldset>
    </form>
    {preview && saved ? <CreatorBiography creator={saved} /> : null}
    <section className="creatorVerificationSection"><h4>Creator verification</h4><VerifiedCreatorMark creator={saved} /><p>Submit evidence of your identity and listed qualifications for review. Files and decision messages are visible only to your account and authorised reviewers. Experience remains self-declared.</p>
      {requests.length ? <details><summary>Verification requests ({requests.length})</summary>{requests.map((r) => <article key={r.id}><strong>{r.status.replaceAll("_", " ")}</strong> · {new Date(r.created_at).toLocaleDateString()}{r.review_note ? <p>{r.review_note}</p> : null}</article>)}</details> : null}
      {!creatorVerified(saved) ? <><label>Evidence / verification statement<textarea maxLength={3000} minLength={10} value={statement} onChange={(e) => setStatement(e.target.value)} placeholder="Explain how the reviewer can check your identity, qualifications and professional registration." /></label><label>Private evidence files (PDF, JPG or PNG; up to 5 MB each)<input type="file" accept="application/pdf,image/jpeg,image/png" disabled={!!busy || evidence.length >= 10} onChange={(e) => upload(e.target.files?.[0], "evidence")} /></label>{evidence.length ? <p>{evidence.length} private file{evidence.length === 1 ? "" : "s"} attached.</p> : null}
      {unsaved ? <p>Save your profile changes before requesting verification.</p> : null}<button type="button" disabled={!!busy || pending || unsaved || statement.trim().length < 10} onClick={() => run("submit", () => submitCreatorRequest(profileId, statement, evidence), "Verification request submitted for review.")}>{pending ? "Review pending" : busy === "submit" ? "Submitting…" : "Submit verification request"}</button></> : null}
    </section>
    {reviewer ? <CreatorVerificationReview authorize={authorize} onChanged={onChanged} /> : null}
  </section>;
}
function CreatorVerificationReview({ authorize, onChanged }) {
  const [rows, setRows] = useState([]), [notice, setNotice] = useState(""), [busy, setBusy] = useState("");
  const [notes, setNotes] = useState({}), [decisions, setDecisions] = useState({});
  const alive = useRef(true);
  const load = async () => { const r = await listCreatorRequests(); if (r.error) throw r.error; if (alive.current) setRows(r.data || []); };
  useEffect(() => { alive.current = true; load().catch((e) => { if (alive.current) setNotice(e.message); }); return () => { alive.current = false; }; }, []);
  async function decide(r) {
    if (authorize && !(await authorize("review creator verification"))) return;
    setBusy(r.id); setNotice("");
    try { const result = await reviewCreatorRequest(r.id, decisions[r.id] || (r.status === "approved" ? "revoked" : "changes_requested"), notes[r.id] || ""); if (result.error) throw result.error; await load(); await onChanged?.(); if (alive.current) setNotice("Review decision saved."); }
    catch (e) { if (alive.current) setNotice(e.message); } finally { if (alive.current) setBusy(""); }
  }
  return <details className="creatorReview"><summary>Creator verification review</summary><p>Check identity and each listed qualification against the evidence and issuing body. Approval summaries are public: describe the checks without including private document numbers. You cannot verify your own account.</p><button type="button" disabled={!!busy} onClick={() => load().catch((e) => setNotice(e.message))}>Refresh review queue</button>{notice ? <p role="status">{notice}</p> : null}
    {rows.map((r) => <article key={r.id}><h4>{r.snapshot.display_name} · {r.status.replaceAll("_", " ")}</h4><p>{r.snapshot.role}</p><ul>{r.snapshot.qualifications.map((q, i) => <li key={i}>{q.name} · {q.issuer}{q.reference_url ? <> · <a href={q.reference_url} target="_blank" rel="noopener noreferrer">Official reference</a></> : null}</li>)}</ul><p className="creatorText">{r.statement}</p>
      {r.evidence_paths.map((path, i) => <button type="button" key={path} disabled={!!busy} onClick={async () => { const tab = window.open("about:blank", "_blank"); if (tab) tab.opener = null; try { const result = await creatorFileUrl(path, "evidence"); if (result.error || !result.data?.signedUrl) throw result.error || new Error("Evidence could not open."); if (tab) tab.location.href = result.data.signedUrl; else setNotice("Allow a new tab to open evidence, then try again."); } catch (e) { tab?.close(); setNotice(e.message); } }}>Open private evidence {i + 1}</button>)}
      {r.review_note ? <p>{r.review_note}</p> : null}
      {["pending", "approved"].includes(r.status) ? <><label>Decision<select value={decisions[r.id] || (r.status === "approved" ? "revoked" : "changes_requested")} onChange={(e) => setDecisions({ ...decisions, [r.id]: e.target.value })}>{r.status === "approved" ? <option value="revoked">Revoke verification</option> : <><option value="changes_requested">Request more evidence</option><option value="approved">Approve identity and qualifications</option><option value="rejected">Reject request</option></>}</select></label><label>Decision explanation / public approval summary<textarea minLength={10} maxLength={1500} value={notes[r.id] || ""} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} /></label><button type="button" disabled={!!busy || (notes[r.id] || "").trim().length < 10} onClick={() => decide(r)}>{busy === r.id ? "Saving…" : "Save review decision"}</button></> : null}</article>)}{!rows.length ? <p>No verification requests yet.</p> : null}
  </details>;
}
