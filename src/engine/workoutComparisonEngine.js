import { sessionBlockIsComplete } from "./sessionCore.js";
const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const clean = value => String(value || "").trim().toLowerCase();
const dateOf = row => row?.date_ymd || row?.date || "";
const payload = row => row?.log || row?.log_json || {};
const active = set => set && (num(set.reps) > 0 || num(set.timeSeconds) > 0 || num(set.weight) > 0);
function sameMovement(candidate, movement) {
  return ((candidate.id && candidate.id === movement.id) || (clean(candidate.name) && clean(candidate.name) === clean(movement.name))) &&
    clean(candidate.protocol || candidate.protocolId) === clean(movement.protocol || movement.protocolId) &&
    clean(candidate.weightUnit || "kg") === clean(movement.weightUnit || "kg") &&
    !!candidate.trackDuration === !!movement.trackDuration;
}
export function summariseRecordedSets(sets, movement = {}) {
  const results = (sets || []).filter(active).map(set => [
    num(set.reps) > 0 ? `${num(set.reps)} reps` : "",
    num(set.weight) > 0 ? `at ${num(set.weight)} ${movement.weightUnit || "kg"}` : "",
    num(set.timeSeconds) > 0 ? `${num(set.timeSeconds)} sec` : "",
  ].filter(Boolean).join(" "));
  if (!results.length) return "";
  if (results.every(value => value === results[0])) return `${results.length} × ${results[0]}`;
  return results.slice(0, 3).join(" · ") + (results.length > 3 ? ` · +${results.length - 3} sets` : "");
}
export function lastWorkoutComparison({ logs = [], before, block, movement }) {
  const rows = [...logs].filter(row => dateOf(row) && dateOf(row) < before).sort((a,b) => dateOf(b).localeCompare(dateOf(a)));
  for (const row of rows) {
    for (const candidate of payload(row).blocks || []) {
      if (!candidate || candidate.cancelled || candidate.suspendedByRecoveryMode) continue;
      if (movement) {
        const match = (candidate.movements || []).find(item => sameMovement(item, movement));
        const text = match && summariseRecordedSets(candidate.sets?.[match.id], movement);
        if (text) return { text, date: dateOf(row) };
      } else if (candidate.typeId === block?.typeId &&
        (candidate.id === block.id || (clean(candidate.label || candidate.activityName) && clean(candidate.label || candidate.activityName) === clean(block.label || block.activityName)))) {
        if (block.typeId === "duration" && num(candidate.duration?.minutes) > 0) return { text: `${num(candidate.duration.minutes)} min`, date: dateOf(row) };
        if (block.typeId === "cardio" && clean(candidate.cardioType || "run") === clean(block.cardioType || "run")) {
          const text = [num(candidate.cardio?.distanceKm) > 0 ? `${num(candidate.cardio.distanceKm)} km` : "",num(candidate.cardio?.durationMin) > 0 ? `${num(candidate.cardio.durationMin)} min` : ""].filter(Boolean).join(" in ");
          if (text) return { text, date: dateOf(row) };
        }
      }
    }
    if (movement && payload(row).entries?.[movement.id]) {
      const text = summariseRecordedSets(payload(row).entries[movement.id], movement);
      if (text) return {text,date:dateOf(row)};
    }
  }
  return null;
}
// Whitelist planning fields so completed sets, timestamps, verification evidence,
// recovery completion and provider identifiers can never be copied into a new day.
export function repeatableWorkoutBlocks(log) {
  return (log?.blocks || []).filter(block => block && !block.cancelled && !block.suspendedByRecoveryMode && (
    ["strength","hiit","box"].includes(block.typeId) && Object.values(block.sets || {}).some(sets => Array.isArray(sets) && sets.some(active)) ||
    block.typeId === "cardio" && (num(block.cardio?.distanceKm) > 0 || num(block.cardio?.durationMin) > 0) ||
    block.typeId === "duration" && num(block.duration?.minutes) > 0 ||
    block.typeId === "session" && block.sessionTemplateId && sessionBlockIsComplete(block)
  )).map(block => {
    const base = {};
    for (const key of ["id","typeId","label","note","restSec","cardioType","cardioTypeOtherLabel","activityName","targetText","plannedMinutes","sessionTemplateId","sessionTemplateNameSnapshot","plannedDurationSecOverride"]) {
      if (block[key] !== undefined) base[key] = block[key];
    }
    if (Array.isArray(block.movements)) base.movements = block.movements.map(movement => {
      const next = {};
      for (const key of ["id","name","sets","reps","trackWeight","trackDuration","initialTarget","coachNote","protocol","protocolId","weightUnit"]) if (movement[key] !== undefined) next[key] = movement[key];
      return next;
    });
    return base;
  });
}
export function lastRepeatableWorkout(logs, before) {
  for (const row of [...(logs || [])].filter(row => dateOf(row) < before).sort((a,b) => dateOf(b).localeCompare(dateOf(a)))) {
    const blocks = repeatableWorkoutBlocks(payload(row));
    if (blocks.length) return {date:dateOf(row),blocks};
  }
  return null;
}
export function workoutTargetText(block, movement) {
  if (movement) return [`${num(movement.sets) || 3} sets`, String(movement.initialTarget || movement.reps || "").trim()].filter(Boolean).join(" · ");
  if (block?.typeId === "strength" || block?.typeId === "hiit" || block?.typeId === "box") {
    const first = block.movements?.[0];
    return first ? `${first.name || "Movement"}: ${workoutTargetText(block,first)}${block.movements.length > 1 ? ` · +${block.movements.length-1} movements` : ""}` : "";
  }
  return [String(block?.targetText || "").trim(), !block?.targetText && num(block?.plannedMinutes) > 0 ? `${num(block.plannedMinutes)} min` : ""].filter(Boolean).join(" · ");
}
