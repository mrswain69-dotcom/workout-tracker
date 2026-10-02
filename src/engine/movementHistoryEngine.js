function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function setHasActivity(set) {
  if (!set || typeof set !== "object") return false;
  return [
    set.reps,
    set.weight,
    set.timeSeconds,
    set.count,
    set.distanceKm,
    set.durationMin,
  ].some((value) => safeNumber(value) > 0);
}

export function normaliseMovementHistoryName(name) {
  return String(name || "")
    .normalize("NFKD")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function movementIdentity(movement) {
  if (movement && typeof movement === "object") {
    return {
      id: String(movement.id || ""),
      nameKey: normaliseMovementHistoryName(movement.name),
    };
  }
  return { id: String(movement || ""), nameKey: "" };
}

export function extractComparableMovementSets(log, movement) {
  if (!log) return null;

  const { id, nameKey } = movementIdentity(movement);
  const matches = [];
  const seen = new Set();
  const addSets = (key, sets) => {
    if (seen.has(key) || !Array.isArray(sets) || !sets.some(setHasActivity)) return;
    seen.add(key);
    matches.push(...sets);
  };

  const legacy = id ? log?.entries?.[id] : null;
  addSets(`legacy:${id}`, legacy);

  for (const [blockIndex, block] of (Array.isArray(log.blocks) ? log.blocks : []).entries()) {
    const setsByMovement =
      block?.sets && typeof block.sets === "object" ? block.sets : null;
    if (!setsByMovement) continue;

    if (id) addSets(`${blockIndex}:${id}`, setsByMovement[id]);

    if (!nameKey) continue;
    for (const candidate of Array.isArray(block.movements) ? block.movements : []) {
      const candidateId = String(candidate?.id || "");
      if (!candidateId || normaliseMovementHistoryName(candidate?.name) !== nameKey) continue;
      addSets(`${blockIndex}:${candidateId}`, setsByMovement[candidateId]);
    }
  }

  return matches.length ? matches : null;
}

export function findLastComparableMovementSets(allLogs, movement, beforeYmd = "9999-12-31") {
  const rows = (Array.isArray(allLogs) ? allLogs : [])
    .filter((row) => {
      const date = row?.date_ymd || row?.date;
      return date && date < beforeYmd;
    })
    .sort((a, b) => {
      const aDate = a?.date_ymd || a?.date || "";
      const bDate = b?.date_ymd || b?.date || "";
      return bDate.localeCompare(aDate);
    });

  for (const row of rows) {
    const sets = extractComparableMovementSets(row?.log || row?.log_json || row, movement);
    if (sets) return sets;
  }
  return null;
}

export function movementHistoryPoint(sets) {
  let weight = 0;
  let reps = 0;
  let timeSec = 0;

  for (const set of Array.isArray(sets) ? sets : []) {
    weight = Math.max(weight, safeNumber(set?.weight));
    reps = Math.max(reps, safeNumber(set?.reps));
    timeSec = Math.max(timeSec, safeNumber(set?.timeSeconds));
  }

  return { weight, reps, timeSec };
}

