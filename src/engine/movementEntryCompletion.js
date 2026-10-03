export function movementEntriesComplete(movement, sets = [], plannedSets = 1) {
  const count = Math.max(plannedSets, sets.length);
  const positive = (value) => String(value ?? "").trim() !== "" && Number.isFinite(Number(value)) && Number(value) > 0;
  const weightEntered = (value) => String(value ?? "").trim() !== "" && Number.isFinite(Number(value)) && Number(value) >= 0;
  return count > 0 && Array.from({ length: count }, (_, index) => sets[index]).every((set) =>
    set && positive(set.reps) &&
    (!movement.trackWeight || weightEntered(set.weight)) &&
    (!movement.trackDuration || positive(set.timeSeconds))
  );
}
