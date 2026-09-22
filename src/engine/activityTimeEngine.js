import { getSessionBlockTrainingMinutes } from "./sessionCore.js";

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function setDidSomething(set) {
  if (!set || typeof set !== "object") return false;
  return (
    safeNumber(set.reps) > 0 ||
    safeNumber(set.timeSeconds) > 0 ||
    safeNumber(set.count) > 0 ||
    safeNumber(set.distanceKm) > 0 ||
    safeNumber(set.durationMin) > 0
  );
}

export function formatActivityMinutes(minutes) {
  if (minutes === null || minutes === undefined || minutes === "") return "—";

  const numeric = Number(minutes);
  if (!Number.isFinite(numeric) || numeric <= 0) return "—";

  const totalSeconds = Math.max(1, Math.round(numeric * 60));
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hours > 0) {
    return secs > 0
      ? `${hours}h ${mins}m ${secs}s`
      : `${hours}h ${mins}m`;
  }

  if (mins > 0) {
    return secs > 0 ? `${mins}m ${secs}s` : `${mins} min`;
  }

  return `${secs}s`;
}

export function estimateStrengthMinutes(setCount, restSeconds = 60) {
  const sets = Math.max(0, Math.round(Number(setCount) || 0));
  if (!sets) return 0;

  const rest = Math.max(0, Number(restSeconds) || 0);
  const workSecondsPerSet = 30;
  const totalSeconds =
    sets * workSecondsPerSet +
    Math.max(0, sets - 1) * rest;

  return totalSeconds / 60;
}

export function countCompletedSetsInBlock(block) {
  if (!block || !block.sets || typeof block.sets !== "object") return 0;

  let count = 0;
  for (const sets of Object.values(block.sets)) {
    const rows = Array.isArray(sets) ? sets : [];
    count += rows.filter(setDidSomething).length;
  }
  return count;
}

function countLegacySets(log) {
  const entries =
    log?.entries && typeof log.entries === "object"
      ? Object.values(log.entries)
      : [];

  return entries.reduce((sum, sets) => {
    const rows = Array.isArray(sets) ? sets : [];
    return sum + rows.filter(setDidSomething).length;
  }, 0);
}

export function computeActivityMinutesForDay(log) {
  if (!log) return null;

  const manualDay = safeNumber(log?.meta?.dayManualMin);
  if (manualDay > 0) return manualDay;

  const blocks = Array.isArray(log.blocks) ? log.blocks : [];
  let totalMinutes = 0;
  let hasActivityMinutes = false;

  if (blocks.length) {
    for (const block of blocks) {
      if (!block || block.cancelled || block.suspendedByRecoveryMode) continue;

      const typeId = String(block.typeId || "").toLowerCase();

      if (typeId === "strength" || typeId === "hiit" || typeId === "box") {
        const actualMinutes = safeNumber(block?.duration?.minutes);

        if (actualMinutes > 0) {
          totalMinutes += actualMinutes;
          hasActivityMinutes = true;
          continue;
        }

        const setCount = countCompletedSetsInBlock(block);
        if (setCount > 0) {
          const restSec =
            safeNumber(block?.restSec) ||
            safeNumber(log?.meta?.restSec) ||
            60;
          totalMinutes += estimateStrengthMinutes(setCount, restSec);
          hasActivityMinutes = true;
        }
        continue;
      }

      if (
        typeId === "cardio" ||
        typeId === "run" ||
        typeId === "swim" ||
        typeId === "walk" ||
        typeId === "row" ||
        typeId === "cycle" ||
        typeId === "bike"
      ) {
        const minutes = safeNumber(block?.cardio?.durationMin);
        if (minutes > 0) {
          totalMinutes += minutes;
          hasActivityMinutes = true;
        }
        continue;
      }

      if (typeId === "duration") {
        const minutes = safeNumber(block?.duration?.minutes);
        if (minutes > 0) {
          totalMinutes += minutes;
          hasActivityMinutes = true;
        }
        continue;
      }

      if (typeId === "session") {
        const minutes = getSessionBlockTrainingMinutes(block);
        if (minutes > 0) {
          totalMinutes += minutes;
          hasActivityMinutes = true;
        }
        continue;
      }

      if (typeId === "recovery") {
        const minutes = safeNumber(block?.duration?.minutes);
        if (minutes > 0) {
          totalMinutes += minutes;
          hasActivityMinutes = true;
        }
      }
    }

    return hasActivityMinutes
      ? Math.round(totalMinutes * 60) / 60
      : null;
  }

  const cardioMin = safeNumber(log?.cardio?.durationMin);
  const customMin = safeNumber(log?.custom?.durationMin);
  const legacyStrength = countLegacySets(log) > 0
    ? estimateStrengthMinutes(
        countLegacySets(log),
        safeNumber(log?.meta?.restSec) || 60
      )
    : 0;

  const legacyTotal = cardioMin + customMin + legacyStrength;
  return legacyTotal > 0
    ? Math.round(legacyTotal * 60) / 60
    : null;
}
