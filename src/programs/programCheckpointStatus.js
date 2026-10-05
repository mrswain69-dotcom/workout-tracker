export function programCheckpointStatus(cp, runs, today) {
  const linked = runs.filter((r) => r.program_checkpoint_id === cp.id);
  const completed = linked.find((r) => r.status === "completed");
  if (completed) return { state: "completed", run: completed };
  const inProgress = linked.find((r) => r.status === "in_progress");
  if (inProgress) return { state: "in_progress", run: inProgress };
  const end = new Date(`${cp.due_date}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 6);
  return { state: today < cp.due_date ? "upcoming" : today > end.toISOString().slice(0, 10) ? "overdue" : "due", run: null };
}
