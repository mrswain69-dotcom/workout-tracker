export const SETUP_WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export function cleanProfileName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 80);
}
export function needsFirstWorkoutSetup({ onboarding, ready, hasPlan, hasActivity }) {
  if (!ready || !onboarding || !["not_started", "in_progress"].includes(onboarding.status)) return false;
  return onboarding.guidedVersion === 2 || (!hasPlan && !hasActivity);
}
export function createFirstActivity(draft, idFactory = () => crypto.randomUUID()) {
  const name = String(draft.name || "").trim().slice(0, 100);
  if (!name) throw new Error("Give your activity a name.");
  const type = draft.type || "duration";
  if (!["duration", "cardio", "strength", "recovery"].includes(type)) throw new Error("Choose an activity format.");
  const days = [...new Set(draft.days || [])].filter(day => SETUP_WEEKDAYS.includes(day));
  if (!days.length) throw new Error("Choose at least one day.");
  const positive = (value, label, max) => {
    if (value === "" || value == null) return "";
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0 || n > max) throw new Error(`Enter a valid ${label}.`);
    return n;
  };
  const minutes = positive(draft.minutes, "duration", 1440);
  const block = { id: idFactory(), typeId: type, label: name, note: "" };
  if (type === "strength") {
    const sets = positive(draft.sets, "set count", 100) || 3;
    if (!Number.isInteger(sets)) throw new Error("Use a whole number of sets.");
    const reps = positive(draft.reps, "rep count", 10000);
    const weight = positive(draft.weight, "weight", 2000);
    block.restSec = 60;
    block.movements = [{ id: idFactory(), name, sets, reps: String(reps), trackWeight: !!weight,
      trackDuration: false, initialTarget: [reps ? `${reps} reps` : "", weight ? `at ${weight} kg` : ""].filter(Boolean).join(" "), coachNote: "" }];
  } else {
    block.plannedMinutes = minutes;
    if (type === "cardio") {
      block.cardioType = ["run", "walk", "cycle", "swim", "row", "indoor_rowing", "other"].includes(draft.sport) ? draft.sport : "other";
      block.activityName = name;
      const distance = positive(draft.distance, "distance", 10000);
      block.targetText = [distance ? `${distance} km` : "", minutes ? `${minutes} min` : ""].filter(Boolean).join(" · ");
    }
    if (type === "recovery") block.recoveryMode = "full";
  }
  return { block, days };
}
