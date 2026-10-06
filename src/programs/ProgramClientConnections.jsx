import React, { useEffect, useRef, useState } from "react";
import { acceptCoachInvite, coachInviteUrl, disconnectCoachClient, inviteCoachClient, previewCoachInvite, readCoachInvite } from "./coachClientDb.js";
import "./programWorkflow.css";

export default function ProgramClientConnections({ familyId, profileId, profileName, connections = [], onChanged, authorize }) {
  const [toolsOpen, setToolsOpen] = useState(false);
  const [name, setName] = useState(profileName || "");
  const [days, setDays] = useState(14);
  const [input, setInput] = useState(() => readCoachInvite());
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const request = useRef(0);
  const mounted = useRef(true);
  const identity = useRef({ familyId, profileId });
  identity.current = { familyId, profileId };
  async function inspect(value) {
    const token = readCoachInvite(value);
    const id = ++request.current;
    setPreview(null); setNotice("");
    if (!token) { setNotice("Paste a valid coaching invitation link or code."); return; }
    setBusy("preview");
    try {
      const r = await previewCoachInvite(token);
      if (id !== request.current) return;
      if (r.error) throw r.error;
      if (!r.data) throw new Error("This invitation has expired, was used or was revoked. Ask your coach for a new link.");
      setPreview({ ...r.data, token });
    } catch (e) { if (id === request.current) setNotice(e.message || "Invitation could not load."); }
    finally { if (id === request.current) setBusy(""); }
  }
  useEffect(() => {
    mounted.current = true;
    if (input) inspect(input);
    return () => { request.current++; mounted.current = false; };
  }, []);
  async function mutate(key, reason, action, success) {
    if (authorize && !(await authorize(reason))) return;
    const current = () => mounted.current && identity.current.familyId === familyId && identity.current.profileId === profileId;
    setBusy(key); setNotice("");
    try {
      const r = await action();
      if (!current()) return;
      if (r.error || !r.data) throw r.error || new Error("This connection could not be changed.");
      if (key === "invite") setToolsOpen(true);
      if (key === "accept") {
        setPreview(null); setInput("");
        const url = new URL(window.location.href); url.searchParams.delete("coachInvite");
        window.history.replaceState(null, "", url);
      }
      await onChanged?.();
      if (current()) setNotice(success);
    } catch (e) { if (current()) setNotice(e.message || "Connection could not be changed."); }
    finally { if (current()) setBusy(""); }
  }
  const mine = connections.filter((c) => c.coach_family_id === familyId && c.status !== "revoked");
  const coaches = connections.filter((c) => c.client_profile_id === profileId && c.status === "active");
  function disconnect(c) {
    const pending = c.status === "pending";
    if (!window.confirm(pending ? "Revoke this unused invitation?" : "End this coaching connection? Pending assignments will be withdrawn and coach reporting will stop. Accepted plans and recorded history stay with the recipient.")) return;
    mutate(c.id, "end a coaching connection", () => disconnectCoachClient(c.id), pending ? "Invitation revoked." : "Connection ended. Accepted plans and recorded history were preserved.");
  }
  return <section className="programWorkflowSection" aria-labelledby="coaching-connections-title">
    <div className="programWorkflowHeading"><h3 id="coaching-connections-title">Coaching connections</h3><button type="button" disabled={!!busy} onClick={async () => { setBusy("refresh"); try { await onChanged?.(); } catch (e) { setNotice(e.message || "Connections could not refresh."); } finally { setBusy(""); } }}>Refresh connections</button></div>
    <p>Connect a coach and an individual profile without creating a team. Programmes still require separate acceptance, and reporting is only enabled when the recipient chooses to share it.</p>
    {notice ? <p className="trainingProgramNotice" role="status">{notice}</p> : null}
    <div className="programWorkflowCard">
      <h4>Have an invitation?</h4>
      <form className="programWorkflowHeading" onSubmit={(e) => { e.preventDefault(); inspect(input); }}>
        <label>Coaching invitation link or code<input value={input} disabled={!!busy && busy !== "preview"} onChange={(e) => { setInput(e.target.value); setPreview(null); request.current++; setBusy(""); }} placeholder="Paste your coach’s invitation" /></label>
        <button type="submit" disabled={!!busy || !input.trim()}>{busy === "preview" ? "Checking…" : "Preview invitation"}</button>
      </form>
      {preview ? <div className="programClientConsent">
        <strong>Connect with {preview.coach_name}</strong>
        <p>This single-use invitation expires {new Date(preview.expires_at).toLocaleDateString()}.</p>
        <p>Connect the selected profile: <strong>{profileName || "Current profile"}</strong>. This shares the profile’s name with this coach and lets them send programme offers. Your workouts, private notes and Assessment results stay private unless you choose programme reporting later.</p>
        <button type="button" className="primary" disabled={!!busy} onClick={() => mutate("accept", "accept a coaching connection", () => acceptCoachInvite(preview.token, profileId), "Connected. Your coach can now send programme offers to this profile.")}>{busy === "accept" ? "Connecting…" : `Connect ${profileName || "this profile"}`}</button>
      </div> : null}
    </div>
    <div className="programWorkflowCard">
      <h4>My coaches</h4>
      {coaches.length ? coaches.map((c) => <div className="programClientRow" key={c.id}><strong>{c.coach_name}</strong><button type="button" disabled={!!busy} onClick={() => disconnect(c)}>Disconnect coach</button></div>) : <p>No coach is connected to this profile yet.</p>}
    </div>
    <details className="programWorkflowCard" open={toolsOpen} onToggle={(e) => setToolsOpen(e.currentTarget.open)}>
      <summary>Coach tools · My clients and invitations</summary>
      <p>Create one invitation per client. Send the link yourself; it expires after the selected period and can be used once. The client signs in and chooses which profile to connect.</p>
      <form className="programWorkflowHeading" onSubmit={(e) => { e.preventDefault(); mutate("invite", "create a coaching invitation", () => inviteCoachClient(profileId, name, days), "Invitation created. Copy its link below and share it with your client."); }}>
        <label>Your coach display name<input value={name} minLength={2} maxLength={100} required onChange={(e) => setName(e.target.value)} /></label>
        <label>Invitation expires<select value={days} onChange={(e) => setDays(Number(e.target.value))}><option value={7}>7 days</option><option value={14}>14 days</option><option value={30}>30 days</option></select></label>
        <button type="submit" disabled={!!busy || name.trim().length < 2}>{busy === "invite" ? "Creating…" : "Create client invitation"}</button>
      </form>
      <p>To assign a programme, open My Programs → View details → Assign programme and select Direct clients.</p>
      {mine.map((c) => {
        const expired = c.status === "pending" && new Date(c.expires_at) <= new Date();
        return <div className="programClientItem" key={c.id}>
          <div className="programClientRow"><div><strong>{c.client_name || "Client invitation"}</strong><span className="muted"> · {c.status === "active" ? "Connected" : expired ? "Expired" : "Awaiting acceptance"} · {c.coach_name}</span></div><button type="button" disabled={!!busy} onClick={() => disconnect(c)}>{c.status === "pending" ? "Revoke invitation" : "Disconnect client"}</button></div>
          {c.status === "pending" && !expired ? <div className="programClientLink"><label>Invitation link<input readOnly value={coachInviteUrl(c.invite_token)} onFocus={(e) => e.target.select()} /></label><button type="button" disabled={!!busy} onClick={async () => { try { await navigator.clipboard.writeText(coachInviteUrl(c.invite_token)); setNotice("Invitation link copied."); } catch { setNotice("Select and copy the invitation link above."); } }}>Copy link</button></div> : null}
        </div>;
      })}
      {!mine.length ? <p>No connected clients or pending invitations. Once a client accepts, open a saved programme’s details and choose Assign programme.</p> : null}
    </details>
  </section>;
}
