function parseYmd(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return Number.isNaN(date.getTime()) ? null : date;
}

function shiftYmd(value, days) {
  const date = parseYmd(value);
  if (!date) return "";
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function sumRange(valuesByDate, startYmd, endYmd) {
  let total = 0;
  for (const [dateYmd, rawValue] of valuesByDate || []) {
    if (dateYmd < startYmd || dateYmd > endYmd) continue;
    const value = Number(rawValue);
    if (Number.isFinite(value) && value > 0) total += value;
  }
  return total;
}

export function buildStrengthActivityTrend(valuesByDate, referenceYmd, windowDays = 28) {
  const safeWindowDays = Number.isInteger(windowDays) && windowDays > 0 ? windowDays : 28;
  const currentEnd = parseYmd(referenceYmd) ? referenceYmd : new Date().toISOString().slice(0, 10);
  const currentStart = shiftYmd(currentEnd, -(safeWindowDays - 1));
  const previousEnd = shiftYmd(currentStart, -1);
  const previousStart = shiftYmd(previousEnd, -(safeWindowDays - 1));
  const currentSets = sumRange(valuesByDate, currentStart, currentEnd);
  const previousSets = sumRange(valuesByDate, previousStart, previousEnd);

  let state = "comparable";
  if (!currentSets && !previousSets) state = "no_activity";
  else if (!currentSets) state = "no_current";
  else if (!previousSets) state = "no_baseline";

  return {
    state,
    windowDays: safeWindowDays,
    currentStart,
    currentEnd,
    previousStart,
    previousEnd,
    currentSets,
    previousSets,
    percentageChange:
      state === "comparable"
        ? Math.round(((currentSets - previousSets) / previousSets) * 100)
        : null,
  };
}
