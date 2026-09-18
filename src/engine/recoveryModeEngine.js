export const PROFILE_RECOVERY_MODES = Object.freeze({
  NORMAL: "normal",
  INJURY: "injury",
  ILLNESS: "illness",
});

function text(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function ymd(value) {
  const raw = text(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
}

function periodTimestamp(period) {
  const raw = period?.started_at || period?.created_at || "";
  const ms = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(ms) ? ms : 0;
}

export function normaliseProfileRecoveryMode(value) {
  const mode = text(value).toLowerCase();
  return mode === PROFILE_RECOVERY_MODES.INJURY ||
    mode === PROFILE_RECOVERY_MODES.ILLNESS
    ? mode
    : "";
}

export function getProfileRecoveryModeForDate(
  periods = [],
  profileId = "",
  dateYmd = "",
  todayYmd = ""
) {
  const target = ymd(dateYmd);
  if (!target || !profileId) return null;
  const today = ymd(todayYmd);

  const candidates = (Array.isArray(periods) ? periods : [])
    .filter((period) => {
      if (!period || text(period.profile_id) !== text(profileId)) return false;
      if (!normaliseProfileRecoveryMode(period.mode)) return false;
      const start = ymd(period.started_on);
      const end = ymd(period.ended_on);
      if (!start || start > target) return false;
      if (today && target === today && period.ended_at) return false;
      return !end || end >= target;
    })
    .sort((a, b) => periodTimestamp(b) - periodTimestamp(a));

  return candidates[0] || null;
}

export function profileRecoveryBlockId(profileId, dateYmd) {
  return `profile-recovery::${text(profileId)}::${ymd(dateYmd)}`;
}

export function isProfileRecoveryLogBlock(block) {
  return !!block?.isProfileRecoveryBlock &&
    !!normaliseProfileRecoveryMode(block?.profileRecoveryMode);
}

export function profileRecoveryBlockComplete(block) {
  if (!isProfileRecoveryLogBlock(block)) return !!block?.recoveryDone;
  const mode = normaliseProfileRecoveryMode(block.profileRecoveryMode);
  if (mode === PROFILE_RECOVERY_MODES.INJURY) {
    return Number(block?.duration?.minutes) > 0;
  }
  return !!block?.recoveryDone;
}

export function isProfileRecoveryModeLog(log) {
  const mode = normaliseProfileRecoveryMode(log?.meta?.profileRecoveryMode);
  return !!mode || (Array.isArray(log?.blocks) && log.blocks.some(isProfileRecoveryLogBlock));
}

export function buildProfileRecoveryPlanBlock({ profileId, dateYmd, mode } = {}) {
  const recoveryMode = normaliseProfileRecoveryMode(mode);
  if (!recoveryMode) return null;
  const injury = recoveryMode === PROFILE_RECOVERY_MODES.INJURY;
  return {
    id: profileRecoveryBlockId(profileId, dateYmd),
    typeId: "recovery",
    label: injury ? "Today’s Physio" : "Illness recovery",
    note: injury
      ? "Record the total time spent on today’s physio or rehabilitation work. If it was split across several sessions, enter one combined total."
      : "Rest and recovery are the plan while illness recovery is active. Confirm the day when recovery was genuinely respected.",
    recoveryMode: injury ? "injury_rehab" : "illness_rest",
    profileRecoveryMode: recoveryMode,
    isProfileRecoveryBlock: true,
    recoveryDone: false,
    plannedMinutes: "",
    duration: { minutes: "" },
  };
}

export function applyProfileRecoveryModeToPlannedBlocks(
  blocks = [],
  { profileId = "", dateYmd = "", mode = "" } = {}
) {
  const recoveryMode = normaliseProfileRecoveryMode(mode);
  const source = Array.isArray(blocks) ? blocks : [];
  if (!recoveryMode) {
    return source.map((block) => ({
      ...block,
      suspendedByRecoveryMode: false,
      suspendedByRecoveryReason: "",
    }));
  }

  const paused = source.map((block) => {
    const isTask = String(block?.typeId || "").toLowerCase() === "tasks";
    return {
      ...block,
      suspendedByRecoveryMode: !isTask,
      suspendedByRecoveryReason: isTask ? "" : recoveryMode,
    };
  });

  const recoveryBlock = buildProfileRecoveryPlanBlock({
    profileId,
    dateYmd,
    mode: recoveryMode,
  });

  return recoveryBlock ? [...paused, recoveryBlock] : paused;
}
