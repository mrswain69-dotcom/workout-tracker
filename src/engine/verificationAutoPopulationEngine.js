export const VERIFICATION_AUTO_POPULATION_VERSION = "verification_auto_population_v1";

const SUPPORTED_FAMILIES = new Set([
  "run",
  "cycle",
  "swim",
  "walk_hike",
  "row",
  "team_sport",
]);

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function text(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const result = String(value).trim();
  return result || fallback;
}

function positive(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function empty(value) {
  return value === "" || value === null || value === undefined;
}

function stableEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function fieldKey(blockId, path) {
  return `${blockId}|${path}`;
}

function splitFieldKey(key) {
  const index = String(key || "").indexOf("|");
  if (index < 0) return { blockId: "", path: "" };
  return { blockId: key.slice(0, index), path: key.slice(index + 1) };
}

function getPath(object, path) {
  return String(path || "").split(".").filter(Boolean).reduce((value, key) => value?.[key], object);
}

function setPath(object, path, value) {
  const keys = String(path || "").split(".").filter(Boolean);
  if (!keys.length) return;
  let cursor = object;
  for (let index = 0; index < keys.length - 1; index += 1) {
    const key = keys[index];
    if (!cursor[key] || typeof cursor[key] !== "object" || Array.isArray(cursor[key])) cursor[key] = {};
    cursor = cursor[key];
  }
  cursor[keys[keys.length - 1]] = value;
}

function metricCompatible(existingValue, evidenceValue, relativeLimit, absoluteLimit) {
  const current = positive(existingValue);
  const evidence = positive(evidenceValue);
  if (current === null || evidence === null) return true;
  const delta = Math.abs(current - evidence);
  return delta / Math.max(current, evidence) <= relativeLimit || delta <= absoluteLimit;
}

export function canonicalVerificationActivityFamily(value) {
  const token = text(value, "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!token || ["unknown", "other", "workout", "activity"].includes(token)) return "unknown";
  if (/(^|_)trail_?run|(^|_)run(ning)?($|_)|jog/.test(token)) return "run";
  if (/(ride|cycling|cycle|bike|biking|mountain_bike|ebike)/.test(token)) return "cycle";
  if (/swim/.test(token)) return "swim";
  if (/(walk|hike|hiking)/.test(token)) return "walk_hike";
  if (/(soccer|football|rugby|basketball|netball|hockey|lacrosse)/.test(token)) return "team_sport";
  if (/(row|rowing|kayak|canoe|paddle)/.test(token)) return "row";
  if (/(strength|weight_?training|weights|weightlifting|resistance)/.test(token)) return "strength";
  if (/(yoga|pilates|mobility|stretch)/.test(token)) return "mobility";
  if (token === "cardio") return "cardio";
  return token;
}

export function isSupportedAutoPopulationActivity(value) {
  return SUPPORTED_FAMILIES.has(canonicalVerificationActivityFamily(value));
}

export function isDateInsideAutoPopulationWindow(dateYmd, todayYmd, windowDays) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text(dateYmd)) || !/^\d{4}-\d{2}-\d{2}$/.test(text(todayYmd))) return false;
  const days = Math.max(0, Math.min(3, Math.trunc(Number(windowDays) || 0)));
  const target = Date.parse(`${dateYmd}T00:00:00Z`);
  const today = Date.parse(`${todayYmd}T00:00:00Z`);
  if (!Number.isFinite(target) || !Number.isFinite(today)) return false;
  const age = Math.round((today - target) / 86400000);
  return age >= 0 && age <= days;
}

export function buildSafePlanLogShell(planBlocks = []) {
  return {
    cardio: { distanceKm: "", durationMin: "", avgSpeedKmh: "" },
    custom: { durationMin: "" },
    gamify: { comboMax: 0 },
    blocks: (Array.isArray(planBlocks) ? planBlocks : []).map((source) => {
      const block = clone(source || {});
      const typeId = text(block.typeId).toLowerCase();
      if (typeId === "session") {
        return {
          ...block,
          cardio: { distanceKm: "", durationMin: "", avgSpeedKmh: "" },
          duration: { minutes: "" },
        };
      }
      return {
        ...block,
        id: text(block.id),
        typeId: text(block.typeId),
        label: text(block.label),
        note: text(block.note),
        cancelled: false,
        sets: {},
        recoveryDone: false,
        cardio: { distanceKm: "", durationMin: "", avgSpeedKmh: "" },
        duration: { minutes: "" },
      };
    }),
    meta: {},
  };
}

function ensureProvenance(log) {
  if (!log.meta || typeof log.meta !== "object" || Array.isArray(log.meta)) log.meta = {};
  const existing = log.meta.verificationPopulation;
  if (!existing || typeof existing !== "object" || Array.isArray(existing)) {
    log.meta.verificationPopulation = {
      version: VERIFICATION_AUTO_POPULATION_VERSION,
      fields: {},
      extraBlocks: {},
    };
  }
  const provenance = log.meta.verificationPopulation;
  provenance.version = VERIFICATION_AUTO_POPULATION_VERSION;
  if (!provenance.fields || typeof provenance.fields !== "object" || Array.isArray(provenance.fields)) provenance.fields = {};
  if (!provenance.extraBlocks || typeof provenance.extraBlocks !== "object" || Array.isArray(provenance.extraBlocks)) provenance.extraBlocks = {};
  return provenance;
}

function blockFamily(block) {
  const typeId = text(block?.typeId).toLowerCase();
  if (typeId === "session" || typeId === "strength" || typeId === "recovery" || typeId === "tasks") return "unsupported";
  if (typeId === "cardio" || typeId === "dynamic-cardio" || block?.cardioType) {
    const family = canonicalVerificationActivityFamily(block?.cardioType || block?.activityName || block?.label || "cardio");
    return family === "unknown" ? "cardio" : family;
  }
  return canonicalVerificationActivityFamily(block?.label || typeId);
}

function familiesCompatible(block, evidenceFamily) {
  const target = blockFamily(block);
  if (target === evidenceFamily) return true;
  if (target === "cardio" && SUPPORTED_FAMILIES.has(evidenceFamily)) return true;
  return false;
}

function metricsCompatible(block, evidence) {
  const distanceM = positive(evidence.distanceM);
  const durationSec = positive(evidence.durationSec);
  const currentDistanceKm = positive(block?.cardio?.distanceKm);
  const currentDurationMin = positive(block?.cardio?.durationMin);
  if (distanceM !== null && !metricCompatible(currentDistanceKm === null ? null : currentDistanceKm * 1000, distanceM, 0.2, 500)) return false;
  if (durationSec !== null && !metricCompatible(currentDurationMin === null ? null : currentDurationMin * 60, durationSec, 0.3, 600)) return false;
  return true;
}

function importedMetricValues(evidence) {
  const values = {};
  const distanceM = positive(evidence.distanceM);
  const durationSec = positive(evidence.durationSec);
  if (distanceM !== null) values["cardio.distanceKm"] = String(Math.round((distanceM / 1000) * 1000) / 1000);
  if (durationSec !== null) values["cardio.durationMin"] = String(Math.round((durationSec / 60) * 10) / 10);
  return values;
}

function humanFamilyLabel(family) {
  const labels = {
    run: "Run",
    cycle: "Cycle",
    swim: "Swim",
    walk_hike: "Walk / Hike",
    row: "Row",
    team_sport: "Team Sport",
  };
  return labels[family] || "Cardio";
}

function cardioTypeForFamily(family) {
  if (family === "walk_hike") return "walk";
  if (family === "team_sport") return "team_sport";
  return family;
}

function deterministicExtraBlockId(verifiedActivityId) {
  return `verified_${text(verifiedActivityId).replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

function provenanceBase(evidence, nowIso) {
  return {
    verifiedActivityId: text(evidence.verifiedActivityId),
    providers: [...new Set((Array.isArray(evidence.providers) ? evidence.providers : []).map((value) => text(value)).filter(Boolean))].sort(),
    observationIds: [...new Set((Array.isArray(evidence.observationIds) ? evidence.observationIds : []).map((value) => text(value)).filter(Boolean))].sort(),
    populatedAt: text(nowIso) || new Date().toISOString(),
  };
}

function refreshManualOverrideStates(log, provenance) {
  let changed = false;
  for (const [key, record] of Object.entries(provenance.fields)) {
    if (!record || record.state !== "imported") continue;
    const { blockId, path } = splitFieldKey(key);
    const block = (log.blocks || []).find((item) => text(item?.id) === blockId);
    if (!block || !stableEqual(getPath(block, path), record.importedValue)) {
      record.state = "manual_override";
      record.manualOverrideAt = new Date().toISOString();
      changed = true;
    }
  }
  for (const [blockId, record] of Object.entries(provenance.extraBlocks)) {
    if (!record || record.state !== "imported") continue;
    const block = (log.blocks || []).find((item) => text(item?.id) === blockId);
    if (!block || !stableEqual(block, record.generatedSnapshot)) {
      record.state = block ? "manual_override" : "removed";
      record.manualOverrideAt = new Date().toISOString();
      changed = true;
    }
  }
  return changed;
}

export function applyVerifiedActivityPopulation({
  logJson = null,
  planBlocks = [],
  evidence,
  nowIso = "",
} = {}) {
  const activity = evidence && typeof evidence === "object" ? evidence : {};
  const verifiedActivityId = text(activity.verifiedActivityId);
  const family = canonicalVerificationActivityFamily(activity.activityType);
  if (!verifiedActivityId || !SUPPORTED_FAMILIES.has(family)) {
    return { changed: false, logJson: clone(logJson), fieldsFilled: 0, extraBlocksCreated: 0, manualOverridesPreserved: 0, targetBlockId: null, skippedReason: "unsupported" };
  }
  const metricValues = importedMetricValues(activity);
  if (!Object.keys(metricValues).length) {
    return { changed: false, logJson: clone(logJson), fieldsFilled: 0, extraBlocksCreated: 0, manualOverridesPreserved: 0, targetBlockId: null, skippedReason: "no_objective_metrics" };
  }

  const log = clone(logJson && typeof logJson === "object" ? logJson : buildSafePlanLogShell(planBlocks));
  if (!Array.isArray(log.blocks)) log.blocks = [];
  const provenance = ensureProvenance(log);
  let changed = refreshManualOverrideStates(log, provenance);

  const existingFieldRecords = Object.values(provenance.fields).filter((record) => record?.verifiedActivityId === verifiedActivityId);
  const existingExtra = Object.entries(provenance.extraBlocks).find(([, record]) => record?.verifiedActivityId === verifiedActivityId);
  if (existingExtra) {
    const block = log.blocks.find((item) => text(item?.id) === existingExtra[0]);
    return {
      changed,
      logJson: log,
      fieldsFilled: 0,
      extraBlocksCreated: 0,
      manualOverridesPreserved: existingExtra[1]?.state === "manual_override" ? 1 : 0,
      targetBlockId: block?.id || existingExtra[0],
      skippedReason: existingExtra[1]?.state === "imported" ? "already_populated" : "manual_override",
    };
  }

  const blockedByPriorOverride = existingFieldRecords.some((record) => ["manual_override", "undone"].includes(record?.state));
  if (blockedByPriorOverride) {
    return { changed, logJson: log, fieldsFilled: 0, extraBlocksCreated: 0, manualOverridesPreserved: 1, targetBlockId: null, skippedReason: "manual_override" };
  }

  const candidates = log.blocks
    .filter((block) => block && !block.cancelled && familiesCompatible(block, family) && metricsCompatible(block, activity))
    .map((block, index) => {
      let emptyCount = 0;
      for (const path of Object.keys(metricValues)) if (empty(getPath(block, path))) emptyCount += 1;
      return { block, index, emptyCount, exact: blockFamily(block) === family };
    })
    .filter((candidate) => candidate.emptyCount > 0)
    .sort((a, b) => Number(b.exact) - Number(a.exact) || b.emptyCount - a.emptyCount || a.index - b.index);

  const base = provenanceBase(activity, nowIso);
  if (candidates.length) {
    const target = candidates[0].block;
    let fieldsFilled = 0;
    for (const [path, importedValue] of Object.entries(metricValues)) {
      if (!empty(getPath(target, path))) continue;
      const key = fieldKey(text(target.id), path);
      const oldRecord = provenance.fields[key];
      if (oldRecord && ["manual_override", "undone"].includes(oldRecord.state)) continue;
      const previousValue = getPath(target, path);
      setPath(target, path, importedValue);
      provenance.fields[key] = {
        ...base,
        fieldPath: path,
        importedValue,
        previousValue: previousValue ?? "",
        state: "imported",
      };
      fieldsFilled += 1;
      changed = true;
    }
    return {
      changed,
      logJson: log,
      fieldsFilled,
      extraBlocksCreated: 0,
      manualOverridesPreserved: 0,
      targetBlockId: text(target.id),
      skippedReason: fieldsFilled ? null : "no_empty_fields",
    };
  }

  const id = deterministicExtraBlockId(verifiedActivityId);
  if (log.blocks.some((block) => text(block?.id) === id)) {
    return { changed, logJson: log, fieldsFilled: 0, extraBlocksCreated: 0, manualOverridesPreserved: 0, targetBlockId: id, skippedReason: "already_populated" };
  }
  const generated = {
    id,
    typeId: "cardio",
    isExtra: true,
    label: humanFamilyLabel(family),
    note: "Auto-filled from connected activity evidence.",
    cardioType: cardioTypeForFamily(family),
    cardioTypeOtherLabel: "",
    activityName: "",
    targetText: "",
    cancelled: false,
    cardio: {
      distanceKm: metricValues["cardio.distanceKm"] || "",
      durationMin: metricValues["cardio.durationMin"] || "",
      avgSpeedKmh: "",
    },
    duration: { minutes: "" },
  };
  log.blocks.push(generated);
  provenance.extraBlocks[id] = {
    ...base,
    generatedSnapshot: clone(generated),
    state: "imported",
  };
  return {
    changed: true,
    logJson: log,
    fieldsFilled: Object.keys(metricValues).length,
    extraBlocksCreated: 1,
    manualOverridesPreserved: 0,
    targetBlockId: id,
    skippedReason: null,
  };
}

export function undoVerifiedActivityPopulation({ logJson, verifiedActivityId, nowIso = "" } = {}) {
  if (!logJson || typeof logJson !== "object" || !text(verifiedActivityId)) {
    return { changed: false, logJson: clone(logJson), fieldsRestored: 0, extraBlocksRemoved: 0, manualOverridesPreserved: 0 };
  }
  const log = clone(logJson);
  if (!Array.isArray(log.blocks)) log.blocks = [];
  const provenance = ensureProvenance(log);
  let changed = false;
  let fieldsRestored = 0;
  let extraBlocksRemoved = 0;
  let manualOverridesPreserved = 0;
  const undoneAt = text(nowIso) || new Date().toISOString();

  for (const [key, record] of Object.entries(provenance.fields)) {
    if (!record || record.verifiedActivityId !== verifiedActivityId || !["imported", "manual_override"].includes(record.state)) continue;
    const { blockId, path } = splitFieldKey(key);
    const block = log.blocks.find((item) => text(item?.id) === blockId);
    if (record.state === "imported" && block && stableEqual(getPath(block, path), record.importedValue)) {
      setPath(block, path, record.previousValue ?? "");
      record.state = "undone";
      record.undoneAt = undoneAt;
      fieldsRestored += 1;
      changed = true;
    } else {
      if (record.state !== "manual_override") changed = true;
      record.state = "manual_override";
      record.manualOverrideAt = record.manualOverrideAt || undoneAt;
      manualOverridesPreserved += 1;
    }
  }

  for (const [blockId, record] of Object.entries(provenance.extraBlocks)) {
    if (!record || record.verifiedActivityId !== verifiedActivityId || !["imported", "manual_override"].includes(record.state)) continue;
    const index = log.blocks.findIndex((item) => text(item?.id) === blockId);
    const block = index >= 0 ? log.blocks[index] : null;
    if (record.state === "imported" && block && stableEqual(block, record.generatedSnapshot)) {
      log.blocks.splice(index, 1);
      record.state = "undone";
      record.undoneAt = undoneAt;
      extraBlocksRemoved += 1;
      changed = true;
    } else {
      if (record.state !== "manual_override") changed = true;
      record.state = "manual_override";
      record.manualOverrideAt = record.manualOverrideAt || undoneAt;
      manualOverridesPreserved += 1;
    }
  }

  return { changed, logJson: log, fieldsRestored, extraBlocksRemoved, manualOverridesPreserved };
}

export function getAutoPopulationForVerifiedActivity(logJson, verifiedActivityId) {
  const provenance = logJson?.meta?.verificationPopulation;
  if (!provenance || typeof provenance !== "object") return null;
  const fields = Object.entries(provenance.fields || {})
    .filter(([, record]) => record?.verifiedActivityId === verifiedActivityId)
    .map(([key, record]) => ({ key, ...record }));
  const extraBlocks = Object.entries(provenance.extraBlocks || {})
    .filter(([, record]) => record?.verifiedActivityId === verifiedActivityId)
    .map(([blockId, record]) => ({ blockId, ...record }));
  return fields.length || extraBlocks.length ? { version: provenance.version, fields, extraBlocks } : null;
}
