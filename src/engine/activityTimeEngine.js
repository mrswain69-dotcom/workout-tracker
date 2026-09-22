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
