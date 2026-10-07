import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ProgramVersionPreview } from "./ProgramManager.jsx";

const choices = [
  {
    id: "add",
    title: "Add alongside my current plan",
    description: "Keep your current base plan and run this as your one additional Program.",
  },
  {
    id: "replace",
    title: "Make this my current plan",
    description: "Replace your current base training and Tasks. Logs, XP and any separate add-on stay.",
  },
  {
    id: "replace_keep_tasks",
    title: "Make this my current plan, but keep my Tasks",
    description: "Replace the training structure while retaining your personal Task blocks.",
  },
];

function label(value) {
  return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (x) => x.toUpperCase());
}

export default function CommunityProgramDialog({
  program,
  activePlan,
  startDate,
  completionMode,
  onStartDateChange,
  onCompletionModeChange,
  onClose,
  onApply,
  busy = false,
}) {
  const dialog = useRef(null);
  const addOns = Array.isArray(activePlan?.meta?.programAddOns) ? activePlan.meta.programAddOns : [];
  const alreadyAdded = addOns.some((entry) => entry?.programId === program.id);
  const canAdd = addOns.length < 1 && !alreadyAdded;
  const isCurrent = activePlan?.meta?.activeProgramSource?.programId === program.id
    && (!activePlan?.meta?.activeProgramSource?.versionId
      || activePlan.meta.activeProgramSource.versionId === program.current_version_id);
  const [mode, setMode] = useState(canAdd && !isCurrent ? "add" : "replace");

  const version = useMemo(() => ({
    id: program.current_version_id,
    version_no: program.current_version_no,
    content_json: program.content_json,
  }), [program]);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (dialog.current?.showModal) dialog.current.showModal();
    else dialog.current?.setAttribute("open", "");
    dialog.current?.querySelector("button")?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, []);

  return createPortal(
    <dialog
      ref={dialog}
      className="trainingProgramLibrary communityProgramDialog"
      aria-label={"Community Program: " + program.title}
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}
    >
      <section className="communityProgramDialogInner">
        <div className="communityProgramDialogHeading">
          <div>
            <span className="communityEyebrow">FREE COMMUNITY PROGRAM</span>
            <h3>{program.title}</h3>
            <div className="communityProgramMeta">
              {program.sport ? <span>{program.sport}</span> : null}
              <span>{label(program.difficulty || "all_levels")}</span>
              <span>{program.week_count || 1} week{Number(program.week_count) === 1 ? "" : "s"}</span>
              <span>{program.phase_count || 1} phase{Number(program.phase_count) === 1 ? "" : "s"}</span>
            </div>
          </div>
          <button type="button" disabled={busy} onClick={onClose}>Close</button>
        </div>

        {program.description ? <p className="communityProgramDescription">{program.description}</p> : null}
        {program.purpose ? <div className="communityProgramPurpose">{program.purpose}</div> : null}

        <ProgramVersionPreview version={version} />

        <div className="trainingProgramControls communityProgramSchedule">
          <label>Starts Monday<input type="date" value={startDate} onChange={(event) => onStartDateChange(event.target.value)} /></label>
          <label>At the end<select value={completionMode} onChange={(event) => onCompletionModeChange(event.target.value)}>
            <option value="repeat">Repeat</option>
            <option value="once">Finish</option>
            <option value="hold">Hold final week</option>
          </select></label>
        </div>

        <fieldset className="communityUseChoices">
          <legend>How should this fit with your current plan?</legend>
          {choices.map((choice) => {
            const disabled = choice.id === "add" ? !canAdd : isCurrent;
            const note = choice.id === "add" && alreadyAdded
              ? "This Program is already added alongside your plan."
              : choice.id === "add" && !canAdd
                ? "You already have one Program running alongside your base plan."
                : isCurrent && choice.id !== "add"
                  ? "This version is already your current Program."
                  : choice.description;
            return <label key={choice.id} className={"communityUseChoice" + (mode === choice.id ? " selected" : "") + (disabled ? " disabled" : "")}>
              <input
                type="radio"
                name={"community-use-" + program.id}
                value={choice.id}
                checked={mode === choice.id}
                disabled={disabled}
                onChange={() => setMode(choice.id)}
              />
              <span><strong>{choice.title}</strong><small>{note}</small></span>
            </label>;
          })}
        </fieldset>

        <div className="communityProgramDialogFooter">
          <p>Using a Community Program does not change XP values, badges or competitive rankings.</p>
          <div>
            <button type="button" disabled={busy} onClick={onClose}>Cancel</button>
            <button type="button" className="primary" disabled={busy || (mode === "add" && !canAdd) || (mode !== "add" && isCurrent)} onClick={() => onApply(mode)}>
              {busy ? "Applying…" : "Apply this choice"}
            </button>
          </div>
        </div>
      </section>
    </dialog>,
    document.body
  );
}
