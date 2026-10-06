import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listPlanTemplates } from "../db.js";
import { listGroupDirectory, listProfileGroups } from "../groups/groupDb.js";
import {
  ensurePlanProgram,
  extractShareablePlanContent,
  flattenProgramWeeks,
  normaliseProgramStartDate,
  prepareAssignedProgramAdoption,
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
  rescheduleTrainingProgramAssignment,
  offerTrainingProgramReplacement,
  saveTrainingProgram,
} from "./trainingProgramDb.js";
import "./TrainingProgramLibrary.css";
import ProgramManager from "./ProgramManager.jsx";
import { restoreArchivedProgram } from "./programManagementDb.js";
import ProgramRecipientControls from "./ProgramRecipientControls.jsx";
import ProgramCoachReports from "./ProgramCoachReports.jsx";
import { setProgramPermissions, listRecipientProgramControls } from "./programWorkflowDb.js";

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
  active: "Active",
  scheduled: "Scheduled",
  finished: "Finished",
  holding: "Holding final week",
  inactive: "No longer active",
  undone: "Undone",
  removed: "Add-on removed",
  unavailable: "No longer shared",
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

const BLOCK_TYPE_LABELS = {
  strength: "Strength / HIIT / Box",
  cardio: "Cardio",
  duration: "Duration",
  recovery: "Recovery",
  session: "Session",
  tasks: "Tasks",
};

const ADOPTION_CHOICES = [
  {
    id: "add",
    title: "Add alongside my plan",
    badge: "Recommended",
    description: "Keep your current Program and add these assigned sessions on their own schedule.",
  },
  {
    id: "replace",
    title: "Use as my whole plan",
    description: "Replace your current Program, including its sessions, strength, recovery and tasks.",
  },
  {
    id: "replace_keep_tasks",
    title: "Replace, but keep my tasks",
    description: "Use the assigned Program for training while retaining your current tick-box task blocks.",
  },
];

function AssignedProgramPreview({
  assignment,
  activePlan,
  busy,
  onClose,
  onAdopt,
}) {
  const activeAddOnCount = Array.isArray(activePlan?.meta?.programAddOns)
    ? activePlan.meta.programAddOns.length
    : 0;
  const replacesAddOn = assignment.replacement_adoption_mode === "add";
  const replacesBase = !!assignment.replacement_adoption_mode && !replacesAddOn;
  const canAddAnotherProgram = activeAddOnCount < 1 || replacesAddOn;
  const choices = ADOPTION_CHOICES.filter((choice) => replacesAddOn ? choice.id === "add" : !replacesBase || choice.id !== "add");
  const [shareAdherence, setShareAdherence] = useState(false);
  const [shareAssessments, setShareAssessments] = useState(false);
  const [weekIndex, setWeekIndex] = useState(0);
  const [adoptionMode, setAdoptionMode] = useState(() => (
    assignment.replacement_adoption_mode || (canAddAnotherProgram ? "add" : "replace")
  ));
  const content = useMemo(
    () => ensurePlanProgram(assignment.version?.content_json || {}),
    [assignment.version?.content_json]
  );
  const weeks = useMemo(() => flattenProgramWeeks(content), [content]);
  const selectedWeek = weeks[Math.min(weekIndex, Math.max(weeks.length - 1, 0))];
  const hasExistingPlan = !!activePlan?.program?.phases?.length;

  return (
    <section className="assignedProgramPreview" aria-labelledby="assigned-program-preview-title">
      <div className="assignedProgramPreviewHeading">
        <div>
          <span className="pill">Assigned frozen version {assignment.version?.version_no || "—"}</span>
          <h3 id="assigned-program-preview-title">Preview “{assignment.program?.title || "Assigned Program"}”</h3>
          <p>
            Starts {displayDate(assignment.start_date)} · {assignment.completion_mode === "once" ? "finishes after its final week" : assignment.completion_mode === "hold" ? "holds its final week" : "repeats after its final week"}
          </p>
        </div>
        <button type="button" onClick={onClose}>Close preview</button>
      </div>

      {assignment.message ? (
        <div className="assignedProgramCoachMessage"><strong>Coach note</strong><span>“{assignment.message}”</span></div>
      ) : null}
      {assignment.replaces_assignment_id ? (
        <div className="assignedProgramInfo">This is an update or replacement offer. Your current programme stays in place until you apply it. {replacesAddOn ? "Only the assigned add-on is replaced; your personal plan stays." : "You can undo after applying it."}</div>
      ) : null}

      <div className="assignedProgramInfo">{assignment.recipient_can_edit === false ? "Follow as supplied: assigned content cannot be edited while attached." : "You may edit your active copy."} {assignment.recipient_can_copy === false ? "Saving a reusable copy is not allowed." : "Saving a personal copy is allowed."}</div>
      <div className="programWorkflowCard">
        <strong>Optional coach reporting</strong>
        <p>Your private notes and unrelated workouts stay private. Change sharing later in Shared &amp; assigned.</p>
        <label className="programWorkflowCheck"><input type="checkbox" checked={shareAdherence} onChange={(e) => setShareAdherence(e.target.checked)} />Share programme adherence with my coach</label>
        <label className="programWorkflowCheck"><input type="checkbox" checked={shareAssessments} onChange={(e) => setShareAssessments(e.target.checked)} />Share programme checkpoint results with my coach</label>
      </div>
      <div className="assignedProgramWeekNav">
        <label>
          Preview week
          <select value={weekIndex} onChange={(event) => setWeekIndex(Number(event.target.value))}>
            {weeks.map((entry) => (
              <option key={entry.week.id} value={entry.globalWeekIndex}>
                {entry.phase.name} · {entry.week.name}
              </option>
            ))}
          </select>
        </label>
        <div>
          <strong>{selectedWeek?.week?.name || "Week 1"}</strong>
          {selectedWeek?.week?.focus ? <span>{selectedWeek.week.focus}</span> : null}
        </div>
      </div>

      <div className="assignedProgramDays">
        {Object.entries(selectedWeek?.week?.blocksByWeekday || {}).map(([weekday, blocks]) => (
          <article key={weekday} className="assignedProgramDay">
            <h4>{weekday}</h4>
            {blocks.length ? blocks.map((block, index) => (
              <div key={block.id || `${weekday}-${index}`} className="assignedProgramBlock">
                <strong>{block.label || BLOCK_TYPE_LABELS[block.typeId] || "Activity"}</strong>
                <span>{BLOCK_TYPE_LABELS[block.typeId] || block.typeId || "Activity"}</span>
              </div>
            )) : <span className="muted">Rest / no planned blocks</span>}
          </article>
        ))}
      </div>

      <fieldset className="assignedProgramChoices">
        <legend>How should this fit with your current plan?</legend>
        {!canAddAnotherProgram ? (
          <div className="assignedProgramLimitNote">
            You already have one Program running alongside your base plan. Remove it from Build before adding a different one alongside.
          </div>
        ) : null}
        {choices.map((choice) => (
          <label
            key={choice.id}
            className={`assignedProgramChoice${adoptionMode === choice.id ? " selected" : ""}${choice.id === "add" && !canAddAnotherProgram ? " disabled" : ""}`}
          >
            <input
              type="radio"
              name={`assignment-adoption-${assignment.id}`}
              value={choice.id}
              checked={adoptionMode === choice.id}
              disabled={choice.id === "add" && !canAddAnotherProgram}
              onChange={() => setAdoptionMode(choice.id)}
            />
            <span>
              <strong>{replacesAddOn ? "Replace my assigned add-on" : choice.title}{choice.badge && !replacesAddOn ? <em>{choice.badge}</em> : null}</strong>
              <small>{replacesAddOn ? "Replace the earlier assigned add-on. Your personal programme stays in place." : choice.description}</small>
            </span>
          </label>
        ))}
      </fieldset>

      {adoptionMode === "replace" ? (
        <div className="assignedProgramWarning">{replacesBase ? "This replaces your assigned main programme. Any additional programme stays in place. You can undo afterwards." : "This replaces your whole current Program. You can undo afterwards to restore it exactly."}</div>
      ) : adoptionMode === "replace_keep_tasks" ? (
        <div className="assignedProgramWarning">Your current task blocks stay; all other current Program blocks are replaced. You can undo afterwards.</div>
      ) : (
        <div className="assignedProgramInfo">Assigned blocks will be marked as group Program work and remain separate from your personal Program cycle.</div>
      )}

      <div className="assignedProgramPreviewFooter">
        <p>{hasExistingPlan ? "Your current plan is backed up before this change." : "This becomes your first active Program."}</p>
        <div>
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="button" className="primary" disabled={busy} onClick={() => onAdopt(adoptionMode, { shareAdherence, shareAssessments })}>
            {busy ? "Applying…" : "Apply this choice"}
          </button>
        </div>
      </div>
    </section>
  );
}

export default function TrainingProgramLibrary({
  familyId,
  activeProfileId,
  activePlan,
  initialSection = "mine",
  authorizeMutation,
  onProgramApplied,
  onStarterApplied,
}) {
  const [section, setSection] = useState(initialSection);
  const identity = useRef({ familyId, activeProfileId });
  identity.current = { familyId, activeProfileId };
  const refreshRequest = useRef(0);
  const [programs, setPrograms] = useState([]);
  const [archivedPrograms, setArchivedPrograms] = useState([]);
  const [manageProgramId, setManageProgramId] = useState("");
  const [versionNote, setVersionNote] = useState("");
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
  const [permission, setPermission] = useState("adapt_copy");
  const [recipientControls, setRecipientControls] = useState([]);
  const [assignmentMessage, setAssignmentMessage] = useState("");
  const [assignmentStatus, setAssignmentStatus] = useState("all");
  const [assignmentEdit, setAssignmentEdit] = useState(null);
  const [startDate, setStartDate] = useState(todayMonday());
  const [completionMode, setCompletionMode] = useState("repeat");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [previewAssignmentId, setPreviewAssignmentId] = useState("");
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
      : managedAssignments.filter((assignment) => ["active", "scheduled", "finished", "holding", "inactive", "removed", "undone", "unavailable"].includes(assignmentStatus)
        ? assignment.active_state === assignmentStatus
        : assignment.status === assignmentStatus),
    [assignmentStatus, managedAssignments]
  );
  const previewAssignment = useMemo(
    () => assignments.find((assignment) => assignment.id === previewAssignmentId) || null,
    [assignments, previewAssignmentId]
  );

  useEffect(() => {
    if (activePlan?.program?.name) setTitle(activePlan.program.name);
  }, [activePlan?.program?.name]);

  const refresh = useCallback(async () => {
    if (!familyId || !activeProfileId) return;
    const request = ++refreshRequest.current;
    const current = () => request === refreshRequest.current && identity.current.familyId === familyId && identity.current.activeProfileId === activeProfileId;
    const [owned, incoming, managed, memberships, legacyTemplates, controls] = await Promise.all([
      listOwnedTrainingPrograms(familyId, true),
      listTrainingProgramAssignments(activeProfileId),
      listManagedTrainingProgramAssignments(familyId),
      listProfileGroups(activeProfileId),
      listPlanTemplates(familyId),
      listRecipientProgramControls(activeProfileId),
    ]);
    if (!current()) return;
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
      if (!current()) return;
      const migrationError = results.find((result) => result.error)?.error;
      if (migrationError) {
        setNotice(message(migrationError, "Saved weekly plans could not be moved into My Programs."));
      } else {
        const reloaded = await listOwnedTrainingPrograms(familyId, true);
        if (!current()) return;
        if (reloaded.error) setNotice(message(reloaded.error));
        else nextPrograms = reloaded.data || [];
        setNotice(
          `${templatesToMigrate.length} saved weekly plan${templatesToMigrate.length === 1 ? " was" : "s were"} moved safely into My Programs.`
        );
      }
    }

    if (!current()) return;
    setRecipientControls(controls.data || []);
    setPrograms(nextPrograms.filter((p) => p.status !== "archived"));
    setArchivedPrograms(nextPrograms.filter((p) => p.status === "archived"));
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

  useEffect(() => {
    setPrograms([]); setArchivedPrograms([]); setAssignments([]); setManagedAssignments([]);
    setManageProgramId(""); setNotice(""); setAssignmentProgramId("");
  }, [familyId, activeProfileId]);
  useEffect(() => { refresh().catch((error) => setNotice(message(error))); }, [refresh]);

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

  const source = activePlan?.meta?.activeProgramSource;
  const noCopy = source?.kind === "assignment" && (source.recipientCanCopy === false || recipientControls.find((c) => c.assignment_id === source.assignmentId)?.can_copy === false);

  async function saveNewProgram() {
    if (noCopy) return setNotice("The coach has not allowed saving this assigned programme as a reusable copy.");
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
    if (noCopy) return setNotice("The coach has not allowed copying this programme.");
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
      changeNote: versionNote.trim() || "Updated from active programme",
    });
    setBusy("");
    if (error) return setNotice(message(error));
    setNotice(`Saved a new version of “${program.title}”. Existing recipients stay on their frozen version until you offer it using Replace / update in Assignments sent.`);
    await refresh();
  }

  async function useProgram(program) {
    if (!window.confirm(`Replace your current base plan with “${program.title}”, version ${program.current_version_no}? Your base training and task blocks will be replaced. Any programme added alongside stays in place. Recorded logs, XP and rewards are retained. This action has no automatic undo; save your current plan to My Programs first if you want to return to it.`)) return;
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
      recipientCanEdit: permission !== "follow",
      recipientCanCopy: permission === "adapt_copy",
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

  function editAssignment(assignment, action) {
    setAssignmentEdit({ id: assignment.id, action, status: assignment.status, startDate: assignment.start_date,
      completionMode: assignment.completion_mode, message: assignment.message || "",
      programId: programs.some((program) => program.id === assignment.program_id) ? assignment.program_id : programs[0]?.id || "" });
    setNotice("");
  }

  async function saveAssignmentEdit(event) {
    event.preventDefault();
    const edit = assignmentEdit;
    if (!edit || !(await allowed("manage a Program assignment"))) return;
    setBusy(edit.id);
    try {
      const options = { assignmentId: edit.id, startDate: normaliseProgramStartDate(edit.startDate), completionMode: edit.completionMode, message: edit.message.trim() };
      const result = edit.action === "reschedule" && edit.status === "pending"
        ? await rescheduleTrainingProgramAssignment(options)
        : await offerTrainingProgramReplacement({ ...options, programId: edit.action === "replace" ? edit.programId : null });
      if (result.error) throw result.error;
      if (!result.data) throw new Error("That assignment has changed. Refresh and try again.");
      setAssignmentEdit(null);
      setNotice(edit.action === "reschedule" && edit.status === "pending" ? "Pending assignment rescheduled." : "Offer sent. The athlete’s current programme stays active until they accept.");
      await refresh();
    } catch (error) { setNotice(message(error)); }
    finally { setBusy(""); }
  }

  async function acceptAssignment(assignment, adoptionMode, sharing = {}) {
    if (!(await allowed("accept an assigned programme"))) return;
    setBusy(assignment.id);
    const preparedPlan = adoptionMode === "replace_keep_tasks"
      ? prepareAssignedProgramAdoption(activePlan, assignment, adoptionMode)
      : null;
    const { data, error } = await acceptTrainingProgramAssignment(
      assignment.id,
      activeProfileId,
      { adoptionMode, preparedPlan, ...sharing }
    );
    setBusy("");
    if (error) return setNotice(message(error));
    const title = assignment.program?.title || "programme";
    onProgramApplied?.(data, `Accepted “${title}”. You can undo this from Build.`);
    setNotice(`Accepted “${title}”. You can undo this from Build.`);
    setPreviewAssignmentId("");
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
        <button type="button" role="tab" aria-selected={section === "reports"} className={section === "reports" ? "active" : ""} onClick={() => setSection("reports")}>Coach reports</button>
        <button type="button" role="tab" aria-selected={section === "discover"} className={section === "discover" ? "active" : ""} onClick={() => setSection("discover")}>Discover</button>
      </div>

      {notice ? <div className="trainingProgramNotice" role="status">{notice}</div> : null}

      {section !== "discover" && section !== "reports" ? (
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
            <label>Version change note<input maxLength={300} value={versionNote} onChange={(e) => setVersionNote(e.target.value)} placeholder="Optional note when saving a new version" /></label>
            <button type="button" className="primary" disabled={busy === "save" || !title.trim() || noCopy} onClick={saveNewProgram}>Save active Program</button>
          </div>

          <div className="trainingProgramSection">
            <h3>My Programs</h3>
            {programs.length ? (
              <div className="trainingProgramGrid">
                {programs.map((program) => (
                  <ProgramCard key={program.id} program={program} badge={program.legacy_plan_template_id ? "Moved from saved plans" : "Private"}>
                    <button type="button" className="primary" disabled={busy === program.id} onClick={() => useProgram(program)}>Use</button>
                    <button type="button" disabled={busy === program.id || noCopy} onClick={() => saveNewVersion(program)}>Save new version</button>
                    <button type="button" disabled={busy === program.id} onClick={() => shareProgram(program)}>Copy private link</button>
                    <button type="button" disabled={busy === program.id} onClick={() => openAssignmentComposer(program)}>Assign</button>
                    <button type="button" disabled={!!busy} onClick={() => setManageProgramId(manageProgramId === program.id ? "" : program.id)}>Manage</button>
                    <button type="button" disabled={!!busy} onClick={async () => { if (!(await allowed("archive a programme")) || !window.confirm(`Archive “${program.title}”? Active plans and assignments are retained. You can restore it from Archived Programs.`)) return; setBusy(program.id); try { const r = await archiveTrainingProgram(program.id); if (r.error || !r.data) throw r.error || new Error("Programme could not be archived."); await refresh(); setNotice("Programme archived. Active plans and assignments are retained."); } catch (error) { setNotice(message(error)); } finally { setBusy(""); } }}>Archive</button>
                  </ProgramCard>
                ))}
              </div>
            ) : <p className="muted">No reusable Programs saved yet. Save the active Program above or start from a Starter Program.</p>}
          </div>

          {manageProgramId && [...programs, ...archivedPrograms].find((p) => p.id === manageProgramId) ? <ProgramManager key={`${familyId}:${activeProfileId}:${manageProgramId}`} program={[...programs, ...archivedPrograms].find((p) => p.id === manageProgramId)} authorize={allowed} onChanged={refresh} onClose={() => setManageProgramId("")} /> : null}
          <details className="programArchive"><summary>Archived Programs ({archivedPrograms.length})</summary>
            <div className="trainingProgramGrid">{archivedPrograms.map((program) => <ProgramCard key={program.id} program={program} badge="Archived">
              <button type="button" disabled={!!busy} onClick={async () => { if (!(await allowed("restore an archived programme"))) return; setBusy(program.id); try { const r = await restoreArchivedProgram(program.id); if (r.error || !r.data) throw r.error || new Error("Programme could not be restored."); await refresh(); setNotice("Programme restored to My Programs. No active plan was changed."); } catch (error) { setNotice(message(error)); } finally { setBusy(""); } }}>Restore programme</button>
              <button type="button" disabled={!!busy} onClick={() => setManageProgramId(program.id)}>Manage</button>
            </ProgramCard>)}</div>
            {!archivedPrograms.length ? <p className="muted">No archived programmes.</p> : null}
          </details>

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
                <label>Recipient permissions<select value={permission} onChange={(e) => setPermission(e.target.value)}><option value="adapt_copy">Edit and save a personal copy</option><option value="adapt">Edit active copy only</option><option value="follow">Follow as supplied</option></select></label>
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
                <p>Recipients see the permissions before accepting. Reporting is optional and private until they choose to share.</p>
                <button type="button" className="primary" disabled={busy === "assign-members" || !selectedMembershipIds.length} onClick={assignSelectedMembers}>Assign to {selectedMembershipIds.length || 0}</button>
              </div>
            </section>
          ) : null}

          <section className="trainingProgramSection trainingProgramAssignmentHistory" aria-labelledby="assignment-history-title">
            <div className="trainingProgramAssignmentHistoryHeading">
              <div>
                <h3 id="assignment-history-title">Assignments sent</h3>
                <p className="muted">Track responses, check active programmes and offer changes without overwriting an athlete’s plan.</p>
              </div>
              <button type="button" disabled={!!busy} onClick={async () => { setBusy("refresh-status"); try { await refresh(); } catch (error) { setNotice(message(error)); } finally { setBusy(""); } }}>Refresh status</button>
              <label>Status<select value={assignmentStatus} onChange={(event) => setAssignmentStatus(event.target.value)}><option value="all">All</option><option value="pending">Awaiting response</option><option value="accepted">All accepted</option><option value="active">Active</option><option value="scheduled">Scheduled</option><option value="finished">Finished</option><option value="holding">Holding final week</option><option value="inactive">No longer active</option><option value="undone">Undone</option><option value="removed">Add-on removed</option><option value="unavailable">No longer shared</option><option value="declined">Declined</option><option value="revoked">Revoked</option></select></label>
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
                      <span className={`trainingProgramStatus ${assignment.active_state || assignment.status}`}>{ASSIGNMENT_STATUS[assignment.active_state] || (assignment.removed_at ? "Add-on removed" : assignment.undone_at ? "Undone" : ASSIGNMENT_STATUS[assignment.status])}{assignment.replaces_assignment_id && assignment.status === "pending" ? " · update offer" : ""}</span>
                      {assignment.status === "pending" ? <><button type="button" disabled={!!busy} onClick={() => revokeAssignment(assignment)}>Revoke</button><label>Permissions<select disabled={!!busy} value={assignment.recipient_can_edit === false ? "follow" : assignment.recipient_can_copy === false ? "adapt" : "adapt_copy"} onChange={async (e) => { if (!(await allowed("change pending assignment permissions"))) return; setBusy(assignment.id); try { const r = await setProgramPermissions(assignment.id, e.target.value !== "follow", e.target.value === "adapt_copy"); if (r.error || !r.data) throw r.error || new Error("Assignment is no longer pending."); await refresh(); setNotice("Invitation permissions updated. The recipient was notified."); } catch (error) { setNotice(message(error)); } finally { setBusy(""); } }}><option value="adapt_copy">Edit and copy</option><option value="adapt">Edit only</option><option value="follow">Follow as supplied</option></select></label></> : null}
                      {assignment.status === "pending" || ["active", "scheduled", "holding", "finished"].includes(assignment.active_state) ? (
                        <>
                          <button type="button" disabled={!!busy} onClick={() => editAssignment(assignment, "reschedule")}>Reschedule</button>
                          <button type="button" disabled={!!busy || !programs.length} onClick={() => editAssignment(assignment, "replace")}>Replace / update</button>
                        </>
                      ) : null}
                    </div>
                    {assignmentEdit?.id === assignment.id ? (
                      <form className="trainingProgramAssignmentEdit" onSubmit={saveAssignmentEdit}>
                        <h4>{assignmentEdit.action === "replace" ? "Offer a replacement or latest version" : "Reschedule assignment"}</h4>
                        <p>{assignment.status === "accepted" ? "The athlete must accept this offer before their current programme changes." : "Pending invitations can be changed before acceptance."}</p>
                        {assignmentEdit.action === "replace" ? <label>Programme / latest version<select value={assignmentEdit.programId} onChange={(event) => setAssignmentEdit({ ...assignmentEdit, programId: event.target.value })}>{programs.map((program) => <option key={program.id} value={program.id}>{program.title} · Version {program.current_version_no}</option>)}</select></label> : null}
                        <label>New start date<input type="date" required value={assignmentEdit.startDate} onChange={(event) => setAssignmentEdit({ ...assignmentEdit, startDate: event.target.value })} /></label>
                        <label>After the final week<select value={assignmentEdit.completionMode} onChange={(event) => setAssignmentEdit({ ...assignmentEdit, completionMode: event.target.value })}><option value="repeat">Repeat</option><option value="once">Finish</option><option value="hold">Hold final week</option></select></label>
                        <label>Coach note<textarea maxLength={500} value={assignmentEdit.message} onChange={(event) => setAssignmentEdit({ ...assignmentEdit, message: event.target.value })} /></label>
                        <div><button type="button" disabled={!!busy} onClick={() => setAssignmentEdit(null)}>Cancel</button><button type="submit" className="primary" disabled={!!busy || !assignmentEdit.startDate}>{busy === assignment.id ? "Saving…" : assignmentEdit.action === "reschedule" && assignment.status === "pending" ? "Save schedule" : "Send offer"}</button></div>
                      </form>
                    ) : null}
                    {assignment.message ? <p className="trainingProgramAssignmentMessage">“{assignment.message}”</p> : null}
                  </article>
                ))}
              </div>
            ) : <p className="muted">{managedAssignments.length ? "No assignments match this status." : "Programs you assign will appear here."}</p>}
          </section>
        </>
      ) : null}

      {section === "reports" ? <ProgramCoachReports key={activeProfileId} assignments={managedAssignments} groups={groups} /> : null}

      {section === "shared" ? (
        <div className="trainingProgramSection">
          <h3>Shared &amp; assigned</h3>
          <ProgramRecipientControls key={activeProfileId + assignments.length} profileId={activeProfileId} />
          {sharedPreview ? (
            <div className="trainingProgramShared">
              <div>
                <strong>Shared with you: {sharedPreview.title}</strong>
                <div className="muted">Version {sharedPreview.version_no} · {sharedPreview.week_count} weeks · frozen copy</div>
              </div>
              <button type="button" className="primary" disabled={busy === "share"} onClick={acceptShare}>Use Program</button>
            </div>
          ) : null}
          {previewAssignment ? (
            <AssignedProgramPreview
              key={previewAssignment.id}
              assignment={previewAssignment}
              activePlan={activePlan}
              busy={busy === previewAssignment.id}
              onClose={() => setPreviewAssignmentId("")}
              onAdopt={(adoptionMode, sharing) => acceptAssignment(previewAssignment, adoptionMode, sharing)}
            />
          ) : null}
          {assignments.length ? (
            <div className="trainingProgramGrid">
              {assignments.map((assignment) => (
                <ProgramCard key={assignment.id} badge={assignment.replaces_assignment_id ? "Update offer" : "Assigned"} program={{ ...assignment.program, current_version_no: assignment.version?.version_no }}>
                  <button type="button" className="primary" disabled={busy === assignment.id} onClick={() => setPreviewAssignmentId(assignment.id)}>Preview &amp; choose</button>
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
