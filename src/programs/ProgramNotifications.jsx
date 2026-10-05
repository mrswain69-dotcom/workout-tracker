import React, { useEffect, useState } from "react";
import { listProgramNotifications, readProgramNotification } from "./programWorkflowDb.js";
import "./programWorkflow.css";

const defaultDb = { listProgramNotifications, readProgramNotification };

export default function ProgramNotifications({ familyId, profileId, onOpen, db = defaultDb }) {
  const [inbox, setInbox] = useState({ scope: "", rows: [], error: "" });
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const scope = `${familyId}:${profileId}`;
  const rows = inbox.scope === scope ? inbox.rows : [];
  const error = inbox.scope === scope ? inbox.error : "";
  useEffect(() => {
    let cancelled = false;
    setOpen(false);
    const refresh = async () => {
      if (!familyId || !profileId || document.visibilityState === "hidden") return;
      try {
        const result = await db.listProgramNotifications(familyId, profileId);
        if (result.error) throw result.error;
        if (!cancelled) setInbox({ scope, rows: result.data || [], error: "" });
      } catch (e) {
        if (!cancelled) setInbox((prev) => ({ scope, rows: prev.scope === scope ? prev.rows : [], error: e.message || "Notifications could not load" }));
      }
    };
    refresh();
    const timer = setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { cancelled = true; clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [familyId, profileId, scope, db]);
  const unread = rows.filter((row) => !row.read_at).length;
  async function visit(row) {
    setBusy(row.id);
    try {
      const result = await db.readProgramNotification(row.id);
      if (result.error || !result.data) throw result.error || new Error("Notification is no longer available.");
      setInbox((prev) => prev.scope === scope ? { ...prev, rows: prev.rows.map((x) => x.id === row.id ? { ...x, read_at: new Date().toISOString() } : x) } : prev);
      setOpen(false);
      onOpen?.(row);
    } catch (e) { setInbox((prev) => ({ ...prev, error: e.message })); }
    finally { setBusy(""); }
  }
  return <div className="programInbox">
    <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>Notifications{unread ? ` (${unread})` : ""}</button>
    {open ? <section className="programInboxPanel" aria-label="Programme notifications">
      <div className="programWorkflowHeading"><h3>Notifications</h3><button type="button" onClick={() => setOpen(false)}>Close</button></div>
      {error ? <p role="alert">{error}</p> : null}
      {rows.length ? rows.map((row) => <button className={row.read_at ? "" : "unread"} type="button" key={row.id} disabled={!!busy} onClick={() => visit(row)}>
        <span>{row.title}</span><small>{new Date(row.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })} · {row.read_at ? "Read" : "New"}</small>
      </button>) : <p>No programme notifications yet.</p>}
    </section> : null}
  </div>;
}
