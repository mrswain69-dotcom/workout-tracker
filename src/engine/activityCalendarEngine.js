const PHYSICAL_TYPES = new Set([
  "strength",
  "hiit",
  "box",
  "cardio",
  "dynamic-cardio",
  "run",
  "swim",
  "walk",
  "row",
  "cycle",
  "bike",
  "duration",
  "session",
  "recovery",
]);

function text(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function physicalBlocks(blocks = []) {
  return (Array.isArray(blocks) ? blocks : []).filter((block) =>
    block &&
    !block.suspendedByRecoveryMode &&
    PHYSICAL_TYPES.has(text(block.typeId).toLowerCase())
  );
}

/**
 * One shared status contract for the Log calendar and Dashboard history strip.
 * Priority matters: a streak saver and illness day must retain their own colour
 * even when the underlying plan was cancelled or completed.
 */
export function buildActivityCalendarDay({
  dateYmd = "",
  todayYmd = "",
  log = null,
  plannedBlocks = [],
  hasPlanSchedule = false,
  recoveryMode = "",
  completed = false,
} = {}) {
  const blocks = physicalBlocks(log?.blocks);
  const planned = physicalBlocks(plannedBlocks).filter((block) => !block.cancelled);
  const mode = text(recoveryMode || log?.meta?.profileRecoveryMode).toLowerCase();
  const streakSaved = !!log?.meta?.streakSaved;
  const allCancelled = blocks.length > 0 && blocks.every((block) => !!block.cancelled);
  const hasActiveLoggedBlock = blocks.some((block) => !block.cancelled);

  if (streakSaved) {
    return {
      dateYmd,
      kind: "streak-saver",
      label: "Streak saver used",
      icon: "S",
      completed: true,
      isToday: dateYmd === todayYmd,
    };
  }

  if (mode === "illness") {
    return {
      dateYmd,
      kind: "illness",
      label: completed ? "Illness recovery respected" : "Illness recovery day",
      icon: completed ? "✓" : "+",
      completed: !!completed,
      isToday: dateYmd === todayYmd,
    };
  }

  if (allCancelled) {
    return {
      dateYmd,
      kind: "cancelled",
      label: "All planned activity cancelled",
      icon: "×",
      completed: false,
      isToday: dateYmd === todayYmd,
    };
  }

  if (completed) {
    return {
      dateYmd,
      kind: "complete",
      label: mode === "injury" ? "Physio completed" : "Plan completed",
      icon: "✓",
      completed: true,
      isToday: dateYmd === todayYmd,
    };
  }

  if (hasPlanSchedule && !planned.length && !hasActiveLoggedBlock) {
    return {
      dateYmd,
      kind: "rest",
      label: "Planned rest day",
      icon: "–",
      completed: true,
      isToday: dateYmd === todayYmd,
    };
  }

  return {
    dateYmd,
    kind: "none",
    label: dateYmd === todayYmd ? "Today" : "No completed activity",
    icon: "",
    completed: false,
    isToday: dateYmd === todayYmd,
  };
}

export function shiftActivityCalendarDate(value, days) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text(value))) return "";
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return "";
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

export function buildRecentActivityCalendarDays(todayYmd, count = 14, getDayState = null) {
  const size = Math.max(1, Math.min(31, Number(count) || 14));
  return Array.from({ length: size }, (_, index) => {
    const dateYmd = shiftActivityCalendarDate(todayYmd, index - size + 1);
    return typeof getDayState === "function"
      ? getDayState(dateYmd)
      : buildActivityCalendarDay({ dateYmd, todayYmd });
  });
}
