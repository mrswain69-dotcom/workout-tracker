import {
  getSessionTrainingLoad,
  getSessionTrainingMinutes,
  sessionHasActivity,
  sessionIsCompleted,
} from "./sessionEngine.js";
import { calculateAgeOnDate, isValidHistoricalDate } from "./historicalAgeEngine.js";

function text(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const result = String(value).trim();
  return result || fallback;
}

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function positive(value) {
  const result = finite(value);
  return result !== null && result > 0 ? result : null;
}

function rowPayload(row) {
  return row?.log_json && typeof row.log_json === "object" ? row.log_json : row || {};
}

function rowDate(row) {
  const payload = rowPayload(row);
  const value = text(row?.date_ymd || payload?.date_ymd || payload?.date || payload?.ymd, "");
  return isValidHistoricalDate(value) ? value : "";
}

function rowProfileId(row) {
  const payload = rowPayload(row);
  return text(row?.profile_id || row?.profileId || payload?.profile_id || payload?.profileId, "");
}

function setHasActivity(set) {
  if (!set || typeof set !== "object") return false;
  return [set.reps, set.weight, set.timeSeconds].some((value) => positive(value) !== null);
}

function normaliseSets(rawSets) {
  return (Array.isArray(rawSets) ? rawSets : [])
    .filter(setHasActivity)
    .map((set) => ({
      ...(finite(set.reps) !== null ? { reps: finite(set.reps) } : {}),
      ...(finite(set.weight) !== null ? { weight: finite(set.weight) } : {}),
      ...(finite(set.timeSeconds) !== null ? { timeSeconds: finite(set.timeSeconds) } : {}),
    }));
}

function movementNameFor(block, movementId) {
  const movement = (Array.isArray(block?.movements) ? block.movements : []).find(
    (candidate) => text(candidate?.id) === movementId
  );
  return movement ? text(movement.name, "") : "";
}

function strengthEntries(payload) {
  const entries = [];

  // Legacy entries are genuine recorded history, but they do not contain a
  // frozen movement name. Never project today's Plan backwards to name them.
  for (const [movementId, rawSets] of Object.entries(
    payload?.entries && typeof payload.entries === "object" ? payload.entries : {}
  )) {
    const sets = normaliseSets(rawSets);
    if (!sets.length) continue;
    entries.push({
      source: "legacy",
      blockId: "",
      movementId,
      name: "",
      sets,
    });
  }

  for (const block of Array.isArray(payload?.blocks) ? payload.blocks : []) {
    if (!block || block.cancelled) continue;
    const type = text(block.typeId).toLowerCase();
    if (!["strength", "hiit", "box"].includes(type)) continue;
    const setsByMovement = block.sets && typeof block.sets === "object" ? block.sets : {};
    for (const [movementId, rawSets] of Object.entries(setsByMovement)) {
      const sets = normaliseSets(rawSets);
      if (!sets.length) continue;
      entries.push({
        source: "block",
        blockId: text(block.id),
        movementId,
        name: movementNameFor(block, movementId),
        sets,
      });
    }
  }

  return entries;
}

function cardioEntries(payload) {
  const entries = [];
  const add = (cardio, meta = {}) => {
    if (!cardio || typeof cardio !== "object") return;
    const distanceKm = positive(cardio.distanceKm);
    const durationMin = positive(cardio.durationMin);
    const avgSpeedKmh = positive(cardio.avgSpeedKmh);
    if (distanceKm === null && durationMin === null && avgSpeedKmh === null) return;
    entries.push({
      ...meta,
      ...(distanceKm !== null ? { distanceKm } : {}),
      ...(durationMin !== null ? { durationMin } : {}),
      ...(avgSpeedKmh !== null ? { avgSpeedKmh } : {}),
    });
  };

  add(payload?.cardio, { source: "legacy", blockId: "", label: "", cardioType: "" });

  for (const block of Array.isArray(payload?.blocks) ? payload.blocks : []) {
    if (!block || block.cancelled || text(block.typeId).toLowerCase() !== "cardio") continue;
    add(block.cardio, {
      source: "block",
      blockId: text(block.id),
      label: text(block.label),
      cardioType: text(block.cardioType),
    });
  }

  // Avoid duplicating the legacy mirror when an equivalent block-level cardio
  // record exists on the same log.
  if (entries.length > 1 && entries[0]?.source === "legacy") {
    const legacy = entries[0];
    const duplicate = entries.slice(1).some(
      (entry) =>
        entry.distanceKm === legacy.distanceKm &&
        entry.durationMin === legacy.durationMin &&
        entry.avgSpeedKmh === legacy.avgSpeedKmh
    );
    if (duplicate) entries.shift();
  }

  return entries;
}

function durationEntries(payload) {
  const entries = [];
  const legacyMinutes = positive(payload?.custom?.durationMin);
  if (legacyMinutes !== null) {
    entries.push({ source: "legacy", blockId: "", label: "", minutes: legacyMinutes });
  }

  for (const block of Array.isArray(payload?.blocks) ? payload.blocks : []) {
    if (!block || block.cancelled || text(block.typeId).toLowerCase() !== "duration") continue;
    const minutes = positive(block?.duration?.minutes);
    if (minutes === null) continue;
    entries.push({ source: "block", blockId: text(block.id), label: text(block.label), minutes });
  }
  return entries;
}

function recoveryEntries(payload) {
  return (Array.isArray(payload?.blocks) ? payload.blocks : [])
    .filter(
      (block) =>
        block &&
        !block.cancelled &&
        text(block.typeId).toLowerCase() === "recovery" &&
        block.recoveryDone === true
    )
    .map((block) => ({
      blockId: text(block.id),
      label: text(block.label, "Recovery"),
      recoveryMode: text(block.recoveryMode, ""),
      minutes: positive(block?.duration?.minutes),
    }));
}

function structuredSessionEntries(payload) {
  const result = [];
  for (const block of Array.isArray(payload?.blocks) ? payload.blocks : []) {
    if (!block || block.cancelled || text(block.typeId).toLowerCase() !== "session") continue;
    const session = block.session && typeof block.session === "object" ? block.session : null;
    if (!session || !sessionHasActivity(session)) continue;
    const load = getSessionTrainingLoad(session);
    result.push({
      blockId: text(block.id),
      templateId: text(session.templateId || block.sessionTemplateId),
      displayCode: text(session.displayCode),
      name: text(session.name || block.sessionTemplateNameSnapshot, "Session"),
      version: Math.max(1, Number(session.version) || 1),
      completed: sessionIsCompleted(session),
      trainingMinutes: getSessionTrainingMinutes(session),
      load: Number.isFinite(Number(load?.load)) ? Number(load.load) : 0,
      movementCount: Array.isArray(session.movements) ? session.movements.length : 0,
    });
  }
  return result;
}

function eventBase({ profileId, birthDate, date, sourceType, sourceId, eventType, title, evidence, suffix = "" }) {
  const source = text(sourceId, "unknown");
  const id = [sourceType, source, eventType, date, suffix].filter(Boolean).join(":");
  return {
    id,
    profileId: text(profileId),
    date,
    age: calculateAgeOnDate(birthDate, date),
    sourceType,
    sourceId: source,
    eventType,
    title,
    evidence: evidence && typeof evidence === "object" ? evidence : {},
    evidenceState: "recorded",
  };
}

export function buildWorkoutHistoryEvents(logs = [], { profileId = "", birthDate = null } = {}) {
  const events = [];

  for (const row of Array.isArray(logs) ? logs : []) {
    const date = rowDate(row);
    if (!date) continue;
    const ownerProfileId = rowProfileId(row);
    if (profileId && ownerProfileId && ownerProfileId !== profileId) continue;

    const payload = rowPayload(row);
    const strength = strengthEntries(payload);
    const cardio = cardioEntries(payload);
    const duration = durationEntries(payload);
    const recovery = recoveryEntries(payload);
    const sessions = structuredSessionEntries(payload);
    const hasTraining = strength.length || cardio.length || duration.length || sessions.length;
    const hasRecovery = recovery.length > 0;
    if (!hasTraining && !hasRecovery) continue;

    const sourceId = text(row?.id, `${ownerProfileId || profileId || "profile"}-${date}`);
    const recordingModel = sessions.length
      ? "structured_session"
      : Array.isArray(payload?.blocks) && payload.blocks.length
      ? "block_log"
      : "legacy";

    events.push(
      eventBase({
        profileId: ownerProfileId || profileId,
        birthDate,
        date,
        sourceType: "workout",
        sourceId,
        eventType: hasTraining ? "training_day" : "recovery_day",
        title: hasTraining ? "Training recorded" : "Recovery recorded",
        evidence: {
          recordingModel,
          strength,
          cardio,
          duration,
          recovery,
          structuredSessionCount: sessions.length,
        },
      })
    );

    for (const session of sessions) {
      events.push(
        eventBase({
          profileId: ownerProfileId || profileId,
          birthDate,
          date,
          sourceType: "session",
          sourceId,
          suffix: session.blockId || session.templateId,
          eventType: session.completed ? "session_completed" : "session_partial",
          title: session.name,
          evidence: session,
        })
      );
    }
  }

  return sortHistoricalTimelineEvents(events);
}

export function buildAssessmentHistoryEvents(
  runs = [],
  results = [],
  { profileId = "", birthDate = null } = {}
) {
  const resultRows = Array.isArray(results) ? results : [];
  const events = [];

  for (const run of Array.isArray(runs) ? runs : []) {
    const ownerProfileId = text(run?.profile_id || run?.profileId);
    if (profileId && ownerProfileId && ownerProfileId !== profileId) continue;
    if (text(run?.status).toLowerCase() !== "completed") continue;
    const date = text(run?.date_ymd || run?.dateYmd);
    if (!isValidHistoricalDate(date)) continue;
    const runId = text(run?.id);
    if (!runId) continue;

    const ownResults = resultRows.filter(
      (row) => text(row?.assessment_run_id || row?.assessmentRunId) === runId
    );
    const validResults = ownResults.filter((row) => row?.is_valid !== false);
    const snapshot = run?.template_snapshot && typeof run.template_snapshot === "object"
      ? run.template_snapshot
      : {};

    events.push(
      eventBase({
        profileId: ownerProfileId || profileId,
        birthDate,
        date,
        sourceType: "assessment",
        sourceId: runId,
        eventType: "assessment_completed",
        title: text(snapshot.name, "Assessment completed"),
        evidence: {
          templateId: text(run?.assessment_template_id || run?.assessmentTemplateId),
          templateVersion: Number(run?.template_version || run?.templateVersion) || null,
          resultCount: ownResults.length,
          validResultCount: validResults.length,
          validResultIds: validResults.map((row) => text(row?.id)).filter(Boolean),
        },
      })
    );
  }

  return sortHistoricalTimelineEvents(events);
}

export function buildGroupAwardHistoryEvents(
  awards = [],
  { profileId = "", membershipIds = [], birthDate = null } = {}
) {
  const allowedMemberships = new Set((Array.isArray(membershipIds) ? membershipIds : []).map(text).filter(Boolean));
  const events = [];

  for (const award of Array.isArray(awards) ? awards : []) {
    const membershipId = text(award?.membership_id || award?.membershipId);
    if (allowedMemberships.size && !allowedMemberships.has(membershipId)) continue;
    const date = text(award?.period_end || award?.periodEnd);
    if (!isValidHistoricalDate(date)) continue;
    const sourceId = text(award?.id);
    if (!sourceId) continue;

    const periodType = text(award?.period_type || award?.periodType);
    const awardType = text(award?.award_type || award?.awardType, "progress_award");
    events.push(
      eventBase({
        profileId,
        birthDate,
        date,
        sourceType: "group_award",
        sourceId,
        eventType: periodType === "season" ? "season_award" : "group_progress_award",
        title: "Group progress award",
        evidence: {
          groupId: text(award?.group_id || award?.groupId),
          membershipId,
          periodType,
          periodStart: text(award?.period_start || award?.periodStart),
          periodEnd: date,
          seasonNumber: finite(award?.season_number ?? award?.seasonNumber),
          awardType,
          rank: finite(award?.rank),
          scoreValue: finite(award?.score_value ?? award?.scoreValue),
          scoreUnit: text(award?.score_unit || award?.scoreUnit),
        },
      })
    );
  }

  return sortHistoricalTimelineEvents(events);
}

const SOURCE_ORDER = {
  workout: 10,
  session: 20,
  assessment: 30,
  group_award: 40,
  consistency: 50,
  knowledge: 60,
};

export function sortHistoricalTimelineEvents(events = []) {
  return (Array.isArray(events) ? events : [])
    .slice()
    .sort((a, b) => {
      const dateCompare = text(a?.date).localeCompare(text(b?.date));
      if (dateCompare) return dateCompare;
      const sourceCompare = (SOURCE_ORDER[a?.sourceType] || 99) - (SOURCE_ORDER[b?.sourceType] || 99);
      if (sourceCompare) return sourceCompare;
      return text(a?.id).localeCompare(text(b?.id));
    });
}

export function buildHistoricalTimelineEvents({
  logs = [],
  assessmentRuns = [],
  assessmentResults = [],
  groupAwards = [],
  profileId = "",
  membershipIds = [],
  birthDate = null,
} = {}) {
  return sortHistoricalTimelineEvents([
    ...buildWorkoutHistoryEvents(logs, { profileId, birthDate }),
    ...buildAssessmentHistoryEvents(assessmentRuns, assessmentResults, { profileId, birthDate }),
    ...buildGroupAwardHistoryEvents(groupAwards, { profileId, membershipIds, birthDate }),
  ]);
}
