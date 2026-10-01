import React, { useCallback, useEffect, useState } from "react";
import { listProfileGroups } from "../groups/groupDb.js";
import {
  extractShareablePlanContent,
  normaliseProgramStartDate,
} from "../engine/planCycleEngine.js";
import {
  acceptTrainingProgramAssignment,
  acceptTrainingProgramShare,
  applyOwnedTrainingProgram,
  archiveTrainingProgram,
  assignTrainingProgramToGroup,
  buildTrainingProgramShareLink,
  createTrainingProgramShare,
  declineTrainingProgramAssignment,
  listOwnedTrainingPrograms,
  listTrainingProgramAssignments,
  previewTrainingProgramShare,
  readTrainingProgramShareToken,
  saveTrainingProgram,
} from "./trainingProgramDb.js";
import "./TrainingProgramLibrary.css";

function todayMonday() {
  const now = new Date();
  const ymd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return normaliseProgramStartDate(ymd);
}

function message(error, fallback = "Something went wrong.") {
  return error?.message || String(error || fallback);
}

function ProgramCard({ program, children }) {
  return (
    <article className="trainingProgramCard">
      <div className="trainingProgramCardTop">
        <div>
          <h4>{program.title}</h4>
          <div className="trainingProgramMeta">
            <span>{program.phase_count || 1} phase{Number(program.phase_count) === 1 ? "" : "s"}</span>
            <span>{program.week_count || 1} week{Number(program.week_count) === 1 ? "" : "s"}</span>
            <span>Version {program.current_version_no || program.version_no || 1}</span>
          </div>
        </div>
        <span className="pill">Private</span>
      </div>
      {program.description ? <p>{program.description}</p> : null}
      {children ? <div className="trainingProgramActions">{children}</div> : null}
    </article>
  );
}

export default function TrainingProgramLibrary({
  familyId,
  activeProfileId,
  activePlan,
  authorizeMutation,
  onProgramApplied,
}) {
  const [programs, setPrograms] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [groups, setGroups] = useState([]);
  const [title, setTitle] = useState(activePlan?.program?.name || "My training programme");
  const [description, setDescription] = useState("");
  const [targetGroupId, setTargetGroupId] = useState("");
  const [startDate, setStartDate] = useState(todayMonday());
  const [completionMode, setCompletionMode] = useState("repeat");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [sharedPreview, setSharedPreview] = useState(null);
  const [shareToken] = useState(readTrainingProgramShareToken);

  useEffect(() => {
    if (activePlan?.program?.name) setTitle(activePlan.program.name);
  }, [activePlan?.program?.name]);

  const refresh = useCallback(async () => {
    if (!familyId || !activeProfileId) return;
    const [owned, incoming, memberships] = await Promise.all([
      listOwnedTrainingPrograms(familyId),
      listTrainingProgramAssignments(activeProfileId),
      listProfileGroups(activeProfileId),
    ]);
    if (owned.error || incoming.error || memberships.error) {
      setNotice(message(owned.error || incoming.error || memberships.error));
      return;
    }
    setPrograms(owned.data || []);
    setAssignments(incoming.data || []);
    const administeredGroups = (memberships.data || []).filter((group) => group?.membership?.role === "admin");
    setGroups(administeredGroups);
    setTargetGroupId((current) => current || administeredGroups[0]?.id || "");
  }, [familyId, activeProfileId]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!shareToken) return;
    previewTrainingProgramShare(shareToken).then(({ data, error }) => {
      if (error) setNotice(message(error, "This programme link is unavailable."));
      else setSharedPreview(data);
    });
  }, [shareToken]);

  async function allowed(reason) {
    return authorizeMutation ? authorizeMutation(reason) : true;
  }

  async function saveNewProgram() {
    if (!activePlan || !title.trim() || !(await allowed("save a programme"))) return;
    setBusy("save");
    setNotice("");
    const { error } = await saveTrainingProgram({
      familyId,
      creatorProfileId: activeProfileId,
      title: title.trim(),
      description: description.trim(),
      content: extractShareablePlanContent(activePlan),
      changeNote: "Initial version",
    });
    setBusy("");
    if (error) return setNotice(message(error));
    setNotice("Programme saved as a reusable frozen version.");
    await refresh();
  }

  async function saveNewVersion(program) {
    if (!activePlan || !(await allowed("save a new programme version"))) return;
    setBusy(program.id);
    const { error } = await saveTrainingProgram({
      programId: program.id,
      familyId,
      creatorProfileId: activeProfileId,
      title: program.title,
      description: program.description,
      purpose: program.purpose,
      sport: program.sport,
      difficulty: program.difficulty,
      ageBand: program.age_band,
      equipment: program.equipment,
      tags: program.tags,
      creatorRole: program.creator_role,
      content: extractShareablePlanContent(activePlan),
      changeNote: "Updated from active programme",
    });
    setBusy("");
    if (error) return setNotice(message(error));
    setNotice(`Saved a new version of “${program.title}”. Existing recipients stay on their frozen version.`);
    await refresh();
  }

  async function useProgram(program) {
    if (!(await allowed("use a saved programme"))) return;
    setBusy(program.id);
    const { data, error } = await applyOwnedTrainingProgram({
      programId: program.id,
      profileId: activeProfileId,
      startDate,
      completionMode,
    });
    setBusy("");
    if (error) return setNotice(message(error));
    onProgramApplied?.(data);
    setNotice(`“${program.title}” is now the active programme.`);
  }

  async function shareProgram(program) {
    if (!(await allowed("create a private programme link"))) return;
    setBusy(program.id);
    const { data, error } = await createTrainingProgramShare(program.id);
    setBusy("");
    if (error) return setNotice(message(error));
    const link = buildTrainingProgramShareLink(data?.share_token);
    try { await navigator.clipboard.writeText(link); } catch { /* link remains available in the notice */ }
    setNotice(`Private link copied: ${link}`);
  }

  async function assignToTeam(program) {
    if (!groups.length) return setNotice("Create or administer a team before assigning a programme.");
    const group = groups.find((item) => item.id === targetGroupId) || groups[0];
    if (!group || !(await allowed("assign a programme to a team"))) return;
    const note = window.prompt("Optional message for the team:", "") || "";
    setBusy(program.id);
    const { data, error } = await assignTrainingProgramToGroup({
      programId: program.id,
      groupId: group.id,
      startDate,
      completionMode,
      message: note,
    });
    setBusy("");
    if (error) return setNotice(message(error));
    setNotice(`Assigned the frozen version to ${Number(data) || 0} member${Number(data) === 1 ? "" : "s"} of ${group.name}.`);
  }

  async function acceptAssignment(assignment) {
    if (!(await allowed("accept an assigned programme"))) return;
    setBusy(assignment.id);
    const { data, error } = await acceptTrainingProgramAssignment(assignment.id, activeProfileId);
    setBusy("");
    if (error) return setNotice(message(error));
    onProgramApplied?.(data);
    setNotice(`Accepted “${assignment.program?.title || "programme"}”.`);
    await refresh();
  }

  async function acceptShare() {
    if (!shareToken || !(await allowed("use a shared programme"))) return;
    setBusy("share");
    const { data, error } = await acceptTrainingProgramShare({
      shareToken,
      profileId: activeProfileId,
      startDate,
      completionMode,
    });
    setBusy("");
    if (error) return setNotice(message(error));
    onProgramApplied?.(data);
    setNotice("The shared frozen version is now active. Your personal rewards and history were preserved.");
  }

  return (
    <section className="trainingProgramLibrary">
      <div className="trainingProgramHeading">
        <div>
          <h2>Programme library & coaching</h2>
          <p>Save immutable versions, privately share them, or assign one version to a team.</p>
        </div>
        <span className="pill">Private foundation</span>
      </div>

      {notice ? <div className="trainingProgramNotice">{notice}</div> : null}

      {sharedPreview ? (
        <div className="trainingProgramShared">
          <div>
            <strong>Shared with you: {sharedPreview.title}</strong>
            <div className="muted">Version {sharedPreview.version_no} · {sharedPreview.week_count} weeks · frozen copy</div>
          </div>
          <button type="button" className="primary" disabled={busy === "share"} onClick={acceptShare}>Use programme</button>
        </div>
      ) : null}

      <div className="trainingProgramControls">
        <label>Starts Monday<input type="date" value={startDate} onChange={(event) => setStartDate(normaliseProgramStartDate(event.target.value))} /></label>
        <label>At the end<select value={completionMode} onChange={(event) => setCompletionMode(event.target.value)}><option value="repeat">Repeat</option><option value="once">Finish</option><option value="hold">Hold final week</option></select></label>
        {groups.length ? <label>Team for assignments<select value={targetGroupId} onChange={(event) => setTargetGroupId(event.target.value)}>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label> : null}
      </div>

      <div className="trainingProgramCreate">
        <label>Name<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} /></label>
        <label>Description<input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1200} placeholder="Who this is for and what it develops" /></label>
        <button type="button" className="primary" disabled={busy === "save" || !title.trim()} onClick={saveNewProgram}>Save active as new</button>
      </div>

      {assignments.length ? (
        <div className="trainingProgramSection">
          <h3>Assigned to this profile</h3>
          <div className="trainingProgramGrid">
            {assignments.map((assignment) => (
              <ProgramCard key={assignment.id} program={{ ...assignment.program, current_version_no: assignment.version?.version_no }}>
                <button type="button" className="primary" disabled={busy === assignment.id} onClick={() => acceptAssignment(assignment)}>Accept</button>
                <button type="button" disabled={busy === assignment.id} onClick={async () => { await declineTrainingProgramAssignment(assignment.id); await refresh(); }}>Decline</button>
              </ProgramCard>
            ))}
          </div>
        </div>
      ) : null}

      <div className="trainingProgramSection">
        <h3>Saved programmes</h3>
        {programs.length ? (
          <div className="trainingProgramGrid">
            {programs.map((program) => (
              <ProgramCard key={program.id} program={program}>
                <button type="button" className="primary" disabled={busy === program.id} onClick={() => useProgram(program)}>Use</button>
                <button type="button" disabled={busy === program.id} onClick={() => saveNewVersion(program)}>Save new version</button>
                <button type="button" disabled={busy === program.id} onClick={() => shareProgram(program)}>Copy private link</button>
                <button type="button" disabled={busy === program.id} onClick={() => assignToTeam(program)}>Assign to team</button>
                <button type="button" disabled={busy === program.id} onClick={async () => { if (window.confirm(`Archive “${program.title}”?`)) { await archiveTrainingProgram(program.id); await refresh(); } }}>Archive</button>
              </ProgramCard>
            ))}
          </div>
        ) : <p className="muted">No reusable programmes saved yet.</p>}
      </div>
    </section>
  );
}
