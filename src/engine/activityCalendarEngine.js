import { sessionBlockHasActivity } from "./sessionCore.js";

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

function positive(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}

// Classify recorded physical effort, never templates, reward XP or tasks alone.
function blockHasRecordedActivity(block) {
  if (block.cancelled) return false;
  const type = text(block.typeId).toLowerCase();
  if (["strength", "hiit", "box"].includes(type)) {
    return Object.values(block.sets || {}).some((sets) =>
      Array.isArray(sets) && sets.some((set) =>
        ["reps", "timeSeconds", "count", "distanceKm", "durationMin"]
          .some((field) => positive(set?.[field]))
      )
    );
  }
  if (type === "session") return sessionBlockHasActivity(block);
  if (type === "duration") return positive(block.duration?.minutes);
  if (type === "recovery") return !!block.recoveryDone || (
    block.isProfileRecoveryBlock && block.profileRecoveryMode === "injury" &&
    positive(block.duration?.minutes)
  );
  return positive(block.cardio?.distanceKm) || positive(block.cardio?.durationMin);
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
  recoveryMode = "",
  completed = false,
} = {}) {
  const blocks = physicalBlocks(log?.blocks);
  const mode = text(recoveryMode || log?.meta?.profileRecoveryMode).toLowerCase();
  const streakSaved = !!log?.meta?.streakSaved;
  const allCancelled = blocks.length > 0 && blocks.every((block) => !!block.cancelled);

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

  const recoveryDay = blocks.some((block) =>
    block.typeId === "recovery" && !block.cancelled && !block.isProfileRecoveryBlock
  ) && blocks.every((block) => block.cancelled || block.typeId === "recovery");
  if (recoveryDay) {
    // Recovery is a recorded day type even if streak/XP eligibility does not
    // award a completed day. Do not turn that into an empty grey day.
    const respected = completed && blocks.some((block) => block.typeId === "recovery" && block.recoveryDone && !block.cancelled);
    return { dateYmd, kind: "rest", label: respected ? "Rest respected" : "Recovery day", icon: "○", completed: !!respected, isToday: dateYmd === todayYmd };
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

  if (blocks.some(blockHasRecordedActivity)) {
    return {
      dateYmd,
      kind: "partial",
      label: "Plan partially completed",
      icon: "◐",
      completed: false,
      isToday: dateYmd === todayYmd,
    };
  }

  return {
    dateYmd,
    kind: "none",
    label: dateYmd === todayYmd ? "Today" : "No completed activity",
    icon: "–",
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
  const size = Math.max(1, Math.min(366, Number(count) || 14));
  return Array.from({ length: size }, (_, index) => {
    const dateYmd = shiftActivityCalendarDate(todayYmd, index - size + 1);
    return typeof getDayState === "function"
      ? getDayState(dateYmd)
      : buildActivityCalendarDay({ dateYmd, todayYmd });
  });
}
