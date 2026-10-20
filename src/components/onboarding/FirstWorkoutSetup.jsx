import React, { useEffect, useState } from "react";
import { SETUP_WEEKDAYS } from "../../engine/firstWorkoutEngine.js";
import "./FirstWorkoutSetup.css";

export default function FirstWorkoutSetup({ profileName, todayWeekday = "Mon", hasPlan = false, initialDate = "", draftStorageKey = "", onSave, onLog, onPrograms, onFullEditor, onDismiss, onRename }) {
  const [retained] = useState(() => { try { return draftStorageKey ? JSON.parse(localStorage.getItem(draftStorageKey) || "null") : null; } catch { return null; } });
  const [stage, setStage] = useState(retained?.version === 1 && retained.stage === "build" ? "build" : hasPlan && initialDate ? "saved" : "choice");
  const [draft, setDraft] = useState(() => ({ type: "duration", name: "", minutes: "", days: [todayWeekday], sets: "3", reps: "", weight: "", distance: "", sport: "run", ...(retained?.version === 1 && Array.isArray(retained.draft?.days) ? retained.draft : {}) }));
  const [name, setName] = useState(profileName === "Athlete" ? "" : profileName || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [savedDate, setSavedDate] = useState(initialDate);
  useEffect(() => {
    if (!draftStorageKey) return;
    try {
      if (stage === "saved") localStorage.removeItem(draftStorageKey);
      else localStorage.setItem(draftStorageKey,JSON.stringify({version:1,stage,draft}));
    } catch { /* Setup also works when browser storage is unavailable. */ }
  }, [draftStorageKey,stage,draft]);
  const update = (key, value) => setDraft(current => ({ ...current, [key]: value }));
  async function save(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      if (!name.trim()) throw new Error("Enter your name or nickname.");
      if (name.trim() !== profileName) await onRename?.(name.trim());
      const result = await onSave(draft);
      if (!result) throw new Error("Your activity wasn’t saved. Please try again.");
      setSavedDate(result.date); setStage("saved");
    } catch (error) { setError(error.message || "Your activity could not be saved."); }
    finally { setBusy(false); }
  }
  return <section className="firstWorkoutSetup" aria-labelledby="first-workout-heading">
    <div className="firstWorkoutSetup__top"><span>YOUR FIRST WORKOUT</span><button type="button" onClick={onDismiss}>Set up later</button></div>
    <h2 id="first-workout-heading">{stage === "saved" ? "Your plan is ready to use" : stage === "build" ? "Add your first activity" : "Let’s make this your plan"}</h2>
    {stage === "choice" ? <>
      <p>Start with one activity. You can build the rest of your week later.</p>
      <div className="firstWorkoutSetup__choices">
        <button type="button" className="is-primary" onClick={() => setStage("build")}><strong>Build my own</strong><span>Add the training or exercise you already do.</span></button>
        <button type="button" onClick={onPrograms}><strong>Use a programme</strong><span>Browse starter, shared and community programmes.</span></button>
        <button type="button" onClick={() => onLog()}><strong>Log something today</strong><span>Record an activity without building a weekly plan.</span></button>
      </div>
      <details><summary>Profile name</summary><p>Your profile is the person exercising. The plan can have its own name.</p><label>Your name or nickname<input maxLength={80} value={name} onChange={event => setName(event.target.value)} /></label></details>
    </> : stage === "build" ? <form onSubmit={save}>
      {(!profileName || profileName === "Athlete" || name !== profileName) ? <label>Your name or nickname<input required maxLength={80} value={name} onChange={event => setName(event.target.value)} autoComplete="given-name" /></label> : <p>Building a plan for <strong>{profileName}</strong>.</p>}
      <fieldset disabled={busy}><legend>1. Choose your day</legend><div className="firstWorkoutSetup__days">{SETUP_WEEKDAYS.map(day => <label key={day}><input type="checkbox" checked={draft.days.includes(day)} onChange={() => update("days", draft.days.includes(day) ? draft.days.filter(value => value !== day) : [...draft.days, day])} /><span>{day}</span></label>)}</div><small>Choose more than one day to repeat the same activity.</small></fieldset>
      <fieldset disabled={busy}><legend>2. Add your activity</legend>
        <label>How do you want to record it?<select value={draft.type} onChange={event => update("type", event.target.value)}><option value="duration">Minutes — yoga, mobility, exercise</option><option value="strength">Sets and reps — strength or circuits</option><option value="cardio">Distance and time — cardio</option><option value="recovery">Recovery day</option></select></label>
        <label>Activity name<input required maxLength={100} value={draft.name} onChange={event => update("name", event.target.value)} placeholder={draft.type === "strength" ? "e.g. Squats" : draft.type === "cardio" ? "e.g. Morning walk" : "e.g. Yoga"} /></label>
        {draft.type === "cardio" ? <label>Activity<select value={draft.sport} onChange={event => update("sport", event.target.value)}>{[["run","Run"],["walk","Walk"],["cycle","Cycle"],["swim","Swim"],["row","Row"],["indoor_rowing","Indoor rowing"],["other","Other"]].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label> : null}
      </fieldset>
      <fieldset disabled={busy}><legend>3. Set your target</legend><small>Targets are optional. Your results stay blank until you record them.</small>
        <div className="firstWorkoutSetup__fields">{(draft.type === "strength" ? [["sets","Sets",1,100],["reps","Reps",1,10000],["weight","Weight (kg)",0.5,2000]] : [...(draft.type === "cardio" ? [["distance","Distance (km)",0.01,10000]] : []),["minutes","Minutes",0.5,1440]]).map(([key,label,step,max]) => <label key={key}>{label}<input type="number" min={step} max={max} step={step} value={draft[key]} onChange={event => update(key,event.target.value)} /></label>)}</div>
      </fieldset>
      {error ? <p role="alert">{error}</p> : null}
      <div className="firstWorkoutSetup__actions"><button type="button" disabled={busy} onClick={() => setStage("choice")}>Back</button><button type="submit" className="is-primary" disabled={busy}>{busy ? "Saving…" : "Save activity"}</button></div>
    </form> : <>
      <p>{savedDate ? `Your activity is saved. Open your log for ${savedDate}, or keep building your plan.` : "You can start logging now, add another activity or edit your full plan."}</p>
      <div className="firstWorkoutSetup__actions"><button type="button" className="is-primary" onClick={() => onLog(savedDate)}>Start logging</button><button type="button" onClick={() => { setDraft(current => ({...current,name:""})); setStage("build"); }}>Add another activity</button><button type="button" onClick={onFullEditor}>Open my full plan</button></div>
    </>}
    {stage !== "saved" ? <button type="button" className="firstWorkoutSetup__full" onClick={onFullEditor}>Open full editor for sessions, tasks and multi-week plans</button> : null}
  </section>;
}
