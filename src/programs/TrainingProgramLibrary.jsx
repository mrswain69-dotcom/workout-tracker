import React, { useCallback, useEffect, useMemo, useState } from "react";
import { listPlanTemplates } from "../db.js";
import { listGroupDirectory, listProfileGroups } from "../groups/groupDb.js";
import {
  extractShareablePlanContent,
  normaliseProgramStartDate,
} from "../engine/planCycleEngine.js";
import { buildStarterPrograms } from "./starterPrograms.js";
import {
  findUnmigratedLegacyTemplates,
  legacyTemplateToProgramContent,
} from "./trainingProgramMigration.js";
import {
  acceptTrainingProgramAssignment,
  acceptTrainingProgramShare,
  applyOwnedTrainingProgram,
  archiveTrainingProgram,
  assignTrainingProgramToMembers,
  buildTrainingProgramShareLink,
  createTrainingProgramShare,
  declineTrainingProgramAssignment,
  importLegacyTrainingProgramTemplate,
  listManagedTrainingProgramAssignments,
  listOwnedTrainingPrograms,
  listTrainingProgramAssignments,
  previewTrainingProgramShare,
  readTrainingProgramShareToken,
  revokeTrainingProgramAssignment,
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

const ASSIGNMENT_STATUS = {
  pending: "Awaiting response",
  accepted: "Accepted",
  declined: "Declined",
  revoked: "Revoked",
};

function displayDate(value) {
  if (!value) return "No date";
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${String(value).slice(0, 10)}T12:00:00Z`));
}

function ProgramCard({ program, badge = "Private", children }) {
  return (
    <article className="trainingProgramCard">
      <div className="trainingProgramCardTop">
        <div>
          <h4>{program.title}</h4>
          <div className="trainingProgramMeta">
            <span>{program.phase_count || 1} phase{Number(program.phase_count) === 1 ? "" : "s"}</span>
            <span>{program.week_count || 1} week{Number(program.week_count) === 1 ? "" : "s"}</span>
            {program.current_version_no || program.version_no ? (
              <span>Version {program.current_version_no || program.version_no}</span>
            ) : null}
          </div>
        </div>
        <span className="pill">{badge}</span>
      </div>
      {program.description ? <p>{program.description}</p> : null}
      {program.purpose ? <div className="trainingProgramPurpose">{program.purpose}</div> : null}
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
  onStarterApplied,
}) {
  const [section, setSection] = useState("mine");
  const [programs, setPrograms] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [managedAssignments, setManagedAssignments] = useState([]);
  const [groups, setGroups] = useState([]);
  const [directory, setDirectory] = useState([]);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [title, setTitle] = useState(activePlan?.program?.name || "My training programme");
  const [description, setDescription] = useState("");
  const [targetGroupId, setTargetGroupId] = useState("");
  const [assignmentProgramId, setAssignmentProgramId] = useState("");
  const [selectedMembershipIds, setSelectedMembershipIds] = useState([]);
  const [assignmentMessage, setAssignmentMessage] = useState("");
  const [assignmentStatus, setAssignmentStatus] = useState("all");
  const [startDate, setStartDate] = useState(todayMonday());
  const [completionMode, setCompletionMode] = useState("repeat");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [sharedPreview, setSharedPreview] = useState(null);
  const [shareToken] = useState(readTrainingProgramShareToken);
  const starterPrograms = useMemo(() => buildStarterPrograms(startDate), [startDate]);
  const targetGroup = useMemo(
    () => groups.find((group) => group.id === targetGroupId) || null,
    [groups, targetGroupId]
  );
  const assignmentProgram = useMemo(
    () => programs.find((program) => program.id === assignmentProgramId) || null,
    [programs, assignmentProgramId]
  );
  const assignableMembers = useMemo(
    () => directory.filter((member) => member.membership_id !== targetGroup?.membership?.id),
    [directory, targetGroup?.membership?.id]
  );
  const visibleManagedAssignments = useMemo(
    () => assignmentStatus === "all"
      ? managedAssignments
      : managedAssignments.filter((assignment) => assignment.status === assignmentStatus),
    [assignmentStatus, managedAssignments]
  );

  useEffect(() => {
    if (activePlan?.program?.name) setTitle(activePlan.program.name);
  }, [activePlan?.program?.name]);

  const refresh = useCallback(async () => {
    if (!familyId || !activeProfileId) return;
    const [owned, incoming, managed, memberships, legacyTemplates] = await Promise.all([
      listOwnedTrainingPrograms(familyId),
      listTrainingProgramAssignments(activeProfileId),
      listManagedTrainingProgramAssignments(familyId),
      listProfileGroups(activeProfileId),
      listPlanTemplates(familyId),
    ]);
    if (owned.error || incoming.error || managed.error || memberships.error || legacyTemplates.error) {
      setNotice(message(owned.error || incoming.error || managed.error || memberships.error || legacyTemplates.error));
      return;
    }

    let nextPrograms = owned.data || [];
    const templatesToMigrate = findUnmigratedLegacyTemplates(
      legacyTemplates.data || [],
      nextPrograms
    );
    if (templatesToMigrate.length) {
      const results = await Promise.all(
        templatesToMigrate.map((template) => importLegacyTrainingProgramTemplate({
          templateId: template.id,
          creatorProfileId: activeProfileId,
          content: legacyTemplateToProgramContent(template, todayMonday()),
        }))
      );
      const migrationError = results.find((result) => result.error)?.error;
      if (migrationError) {
        setNotice(message(migrationError, "Saved weekly plans could not be moved into My Programs."));
      } else {
        const reloaded = await listOwnedTrainingPrograms(familyId);
        if (reloaded.error) setNotice(message(reloaded.error));
        else nextPrograms = reloaded.data || [];
        setNotice(
          `${templatesToMigrate.length} saved weekly plan${templatesToMigrate.length === 1 ? " was" : "s were"} moved safely into My Programs.`
        );
      }
    }

    setPrograms(nextPrograms);
    setAssignments(incoming.data || []);
    setManagedAssignments(managed.data || []);
    const administeredGroups = (memberships.data || []).filter(
      (group) => group?.membership?.role === "admin"
    );
    setGroups(administeredGroups);
    setTargetGroupId((current) => (
      administeredGroups.some((group) => group.id === current)
        ? current
        : administeredGroups[0]?.id || ""
    ));
  }, [familyId, activeProfileId]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    setSelectedMembershipIds([]);
    if (!targetGroupId) {
      setDirectory([]);
      setDirectoryLoading(false);
      return () => { cancelled = true; };
    }
    setDirectoryLoading(true);
    listGroupDirectory(targetGroupId).then(({ data, error }) => {
      if (cancelled) return;
      setDirectoryLoading(false);
      if (error) {
        setDirectory([]);
        setNotice(message(error, "Team members could not be loaded."));
      } else {
        setDirectory(data || []);
      }
    });
    return () => { cancelled = true; };
  }, [targetGroupId]);

  useEffect(() => {
    if (!shareToken) return;
    previewTrainingProgramShare(shareToken).then(({ data, error }) => {
      if (error) setNotice(message(error, "This programme link is unavailable."));
      else {
        setSharedPreview(data);
        setSection("shared");
      }
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
    setNotice("Active programme saved to My Programs as a reusable frozen version.");
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
    onProgramApplied?.(data, `“${program.title}” is now active.`);
    setNotice(`“${program.title}” is now the active programme.`);
  }

  async function useStarterProgram(program) {
    if (!(await allowed("use a starter programme"))) return;
    setBusy(program.id);
    try {
      await onStarterApplied?.(program, { startDate, completionMode });
      setNotice(`“${program.title}” is now active. You can adapt it in Build and save your version to My Programs.`);
    } catch (error) {
      setNotice(message(error));
    } finally {
      setBusy("");
    }
  }

  async function shareProgram(program) {
    if (!(await allowed("create a private programme link"))) return;
    setBusy(program.id);
    const { data, error } = await createTrainingProgramShare(program.id);
    setBusy("");
    if (error) return setNotice(message(error));
    const link = buildTrainingProgramShareLink(data?.share_token);
    try { await navigator.clipboard.writeText(link); } catch { /* link remains in the notice */ }
    setNotice(`Private link copied: ${link}`);
  }

  function openAssignmentComposer(program) {
    if (!groups.length) {
      setNotice("Create or administer a team before assigning a Program.");
      return;
    }
    setAssignmentProgramId(program.id);
    setAssignmentMessage("");
    setSelectedMembershipIds([]);
    setNotice("");
  }

  function toggleMembership(membershipId) {
    setSelectedMembershipIds((current) => current.includes(membershipId)
      ? current.filter((id) => id !== membershipId)
      : [...current, membershipId]);
  }

  async function assignSelectedMembers() {
    if (!assignmentProgram || !targetGroup) return;
    if (!selectedMembershipIds.length) {
      setNotice("Select at least one team member.");
      return;
    }
    if (!(await allowed("assign a Program to selected team members"))) return;
    setBusy("assign-members");
    setNotice("");
    const { data, error } = await assignTrainingProgramToMembers({
      programId: assignmentProgram.id,
      membershipIds: selectedMembershipIds,
      startDate,
      completionMode,
      recipientCanEdit: true,
      message: assignmentMessage.trim(),
    });
    setBusy("");
    if (error) return setNotice(message(error));
    const count = Number(data) || 0;
    setNotice(count
      ? `Assigned “${assignmentProgram.title}” to ${count} member${count === 1 ? "" : "s"} of ${targetGroup.name}.`
      : "No new assignments were created. Those members may already have this version pending for that date.");
    setAssignmentProgramId("");
    setSelectedMembershipIds([]);
    setAssignmentMessage("");
    await refresh();
  }

  async function revokeAssignment(assignment) {
    if (!(await allowed("revoke a pending Program assignment"))) return;
    setBusy(assignment.id);
    const { data, error } = await revokeTrainingProgramAssignment(assignment.id);
    setBusy("");
    if (error) return setNotice(message(error));
    setNotice(data ? "The pending assignment was revoked." : "That assignment is no longer pending and was not changed.");
    await refresh();
  }

  async function acceptAssignment(assignment) {
    if (!(await allowed("accept an assigned programme"))) return;
    setBusy(assignment.id);
    const { data, error } = await acceptTrainingProgramAssignment(assignment.id, activeProfileId);
    setBusy("");
    if (error) return setNotice(message(error));
    onProgramApplied?.(data, `Accepted “${assignment.program?.title || "programme"}”.`);
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
    onProgramApplied?.(data, "Shared programme applied");
    setNotice("The shared frozen version is now active. Personal rewards and history were preserved.");
  }

  return (
    <section className="trainingProgramLibrary">
      <div className="trainingProgramHeading">
        <div>
          <h2>Program Library</h2>
          <p>Create, reuse and privately share complete Programs without mixing them into the active builder.</p>
        </div>
        <span className="pill">Private foundation</span>
      </div>

      <div className="trainingProgramTabs" role="tablist" aria-label="Program Library sections">
        <button type="button" role="tab" aria-selected={section === "mine"} className={section === "mine" ? "active" : ""} onClick={() => setSection("mine")}>My Programs</button>
        <button type="button" role="tab" aria-selected={section === "shared"} className={section === "shared" ? "active" : ""} onClick={() => setSection("shared")}>Shared &amp; assigned{assignments.length ? ` (${assignments.length})` : ""}</button>
        <button type="button" role="tab" aria-selected={section === "starters"} className={section === "starters" ? "active" : ""} onClick={() => setSection("starters")}>Starter Programs</button>
        <button type="button" role="tab" aria-selected={section === "discover"} className={section === "discover" ? "active" : ""} onClick={() => setSection("discover")}>Discover</button>
      </div>

      {notice ? <div className="trainingProgramNotice" role="status">{notice}</div> : null}

      {section !== "discover" ? (
        <div className="trainingProgramControls">
          <label>Starts Monday<input type="date" value={startDate} onChange={(event) => setStartDate(normaliseProgramStartDate(event.target.value))} /></label>
          <label>At the end<select value={completionMode} onChange={(event) => setCompletionMode(event.target.value)}><option value="repeat">Repeat</option><option value="once">Finish</option><option value="hold">Hold final week</option></select></label>
        </div>
      ) : null}

      {section === "mine" ? (
        <>
          <div className="trainingProgramCreate">
            <label>Name<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} /></label>
            <label>Description<input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1200} placeholder="Who this is for and what it develops" /></label>
            <button type="button" className="primary" disabled={busy === "save" || !title.trim()} onClick={saveNewProgram}>Save active Program</button>
          </div>

          <div className="trainingProgramSection">
            <h3>My Programs</h3>
            {programs.length ? (
              <div className="trainingProgramGrid">
                {programs.map((program) => (
                  <ProgramCard key={program.id} program={program} badge={program.legacy_plan_template_id ? "Moved from saved plans" : "Private"}>
                    <button type="button" className="primary" disabled={busy === program.id} onClick={() => useProgram(program)}>Use</button>
                    <button type="button" disabled={busy === program.id} onClick={() => saveNewVersion(program)}>Save new version</button>
                    <button type="button" disabled={busy === program.id} onClick={() => shareProgram(program)}>Copy private link</button>
                    <button type="button" disabled={busy === program.id} onClick={() => openAssignmentComposer(program)}>Assign</button>
                    <button type="button" disabled={busy === program.id} onClick={async () => { if (window.confirm(`Archive “${program.title}”?`)) { await archiveTrainingProgram(program.id); await refresh(); } }}>Archive</button>
                  </ProgramCard>
                ))}
              </div>
            ) : <p className="muted">No reusable Programs saved yet. Save the active Program above or start from a Starter Program.</p>}
          </div>

          {assignmentProgram ? (
            <section className="trainingProgramAssignmentComposer" aria-labelledby="assignment-composer-title">
              <div className="trainingProgramAssignmentHeading">
                <div>
                  <span className="pill">Frozen version {assignmentProgram.current_version_no}</span>
                  <h3 id="assignment-composer-title">Assign “{assignmentProgram.title}”</h3>
                  <p>Choose who should receive this Program. Nothing is added to their active plan until they accept it.</p>
                </div>
                <button type="button" onClick={() => setAssignmentProgramId("")}>Cancel</button>
              </div>

              <div className="trainingProgramAssignmentFields">
                <label>Team<select value={targetGroupId} onChange={(event) => setTargetGroupId(event.target.value)}>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
                <label>Message (optional)<textarea value={assignmentMessage} onChange={(event) => setAssignmentMessage(event.target.value)} maxLength={500} placeholder="Add context, targets or a welcome note" /></label>
              </div>

              <div className="trainingProgramRecipientToolbar">
                <strong>{selectedMembershipIds.length} selected</strong>
                <div>
                  <button type="button" disabled={!assignableMembers.length} onClick={() => setSelectedMembershipIds(assignableMembers.map((member) => member.membership_id))}>Select all</button>
                  <button type="button" disabled={!selectedMembershipIds.length} onClick={() => setSelectedMembershipIds([])}>Clear</button>
                </div>
              </div>

              {directoryLoading ? <p className="muted">Loading team members…</p> : null}
              {!directoryLoading && assignableMembers.length ? (
                <div className="trainingProgramRecipients">
                  {assignableMembers.map((member) => (
                    <label key={member.membership_id} className={`trainingProgramRecipient${selectedMembershipIds.includes(member.membership_id) ? " selected" : ""}`}>
                      <input type="checkbox" checked={selectedMembershipIds.includes(member.membership_id)} onChange={() => toggleMembership(member.membership_id)} />
                      <span><strong>{member.nickname || "Team member"}</strong><small>{member.role === "admin" ? "Team admin" : "Team member"}</small></span>
                    </label>
                  ))}
                </div>
              ) : null}
              {!directoryLoading && !assignableMembers.length ? <p className="muted">There are no other active members in this team yet.</p> : null}

              <div className="trainingProgramAssignmentFooter">
                <p>Recipients get this frozen version and may adapt their own active copy. Your later edits will not overwrite their plan.</p>
                <button type="button" className="primary" disabled={busy === "assign-members" || !selectedMembershipIds.length} onClick={assignSelectedMembers}>Assign to {selectedMembershipIds.length || 0}</button>
              </div>
            </section>
          ) : null}

          <section className="trainingProgramSection trainingProgramAssignmentHistory" aria-labelledby="assignment-history-title">
            <div className="trainingProgramAssignmentHistoryHeading">
              <div>
                <h3 id="assignment-history-title">Assignments sent</h3>
                <p className="muted">Track responses and withdraw invitations that have not been accepted.</p>
              </div>
              <label>Status<select value={assignmentStatus} onChange={(event) => setAssignmentStatus(event.target.value)}><option value="all">All</option><option value="pending">Awaiting response</option><option value="accepted">Accepted</option><option value="declined">Declined</option><option value="revoked">Revoked</option></select></label>
            </div>
            {visibleManagedAssignments.length ? (
              <div className="trainingProgramAssignmentList">
                {visibleManagedAssignments.map((assignment) => (
                  <article key={assignment.id} className="trainingProgramAssignmentRow">
                    <div className="trainingProgramAssignmentMain">
                      <strong>{assignment.program?.title || "Archived Program"}</strong>
                      <span>for {assignment.recipient?.nickname || "Former team member"}</span>
                    </div>
                    <div className="trainingProgramAssignmentDetails">
                      <span>Version {assignment.version?.version_no || "—"}</span>
                      <span>Starts {displayDate(assignment.start_date)}</span>
                      <span>{assignment.completion_mode === "once" ? "Finishes" : assignment.completion_mode === "hold" ? "Holds final week" : "Repeats"}</span>
                    </div>
                    <div className="trainingProgramAssignmentState">
                      <span className={`trainingProgramStatus ${assignment.status}`}>{ASSIGNMENT_STATUS[assignment.status] || assignment.status}</span>
                      {assignment.status === "pending" ? <button type="button" disabled={busy === assignment.id} onClick={() => revokeAssignment(assignment)}>Revoke</button> : null}
                    </div>
                    {assignment.message ? <p className="trainingProgramAssignmentMessage">“{assignment.message}”</p> : null}
                  </article>
                ))}
              </div>
            ) : <p className="muted">{managedAssignments.length ? "No assignments match this status." : "Programs you assign will appear here."}</p>}
          </section>
        </>
      ) : null}

      {section === "shared" ? (
        <div className="trainingProgramSection">
          <h3>Shared &amp; assigned</h3>
          {sharedPreview ? (
            <div className="trainingProgramShared">
              <div>
                <strong>Shared with you: {sharedPreview.title}</strong>
                <div className="muted">Version {sharedPreview.version_no} · {sharedPreview.week_count} weeks · frozen copy</div>
              </div>
              <button type="button" className="primary" disabled={busy === "share"} onClick={acceptShare}>Use Program</button>
            </div>
          ) : null}
          {assignments.length ? (
            <div className="trainingProgramGrid">
              {assignments.map((assignment) => (
                <ProgramCard key={assignment.id} badge="Assigned" program={{ ...assignment.program, current_version_no: assignment.version?.version_no }}>
                  <button type="button" className="primary" disabled={busy === assignment.id} onClick={() => acceptAssignment(assignment)}>Accept</button>
                  <button type="button" disabled={busy === assignment.id} onClick={async () => { await declineTrainingProgramAssignment(assignment.id); await refresh(); }}>Decline</button>
                </ProgramCard>
              ))}
            </div>
          ) : null}
          {!sharedPreview && !assignments.length ? <p className="muted">No Programs have been shared or assigned to this profile.</p> : null}
        </div>
      ) : null}

      {section === "starters" ? (
        <div className="trainingProgramSection">
          <h3>Starter Programs</h3>
          <p className="muted">Curated foundations you can use immediately, adapt in Build and save as your own version.</p>
          <div className="trainingProgramGrid">
            {starterPrograms.map((program) => (
              <ProgramCard key={program.id} badge="Included" program={{ ...program, phase_count: 1, week_count: 1 }}>
                <button type="button" className="primary" disabled={busy === program.id} onClick={() => useStarterProgram(program)}>Use starter</button>
              </ProgramCard>
            ))}
          </div>
        </div>
      ) : null}

      {section === "discover" ? (
        <div className="trainingProgramComingSoon">
          <span className="pill">Later phase</span>
          <h3>Discover public Programs</h3>
          <p>Free community Programs, verified creator Programs, purchases and creator subscriptions will live here once the private library and coaching workflow are stable.</p>
          <p className="muted">Access method will never change XP, badges or competitive rankings.</p>
        </div>
      ) : null}
    </section>
  );
}
