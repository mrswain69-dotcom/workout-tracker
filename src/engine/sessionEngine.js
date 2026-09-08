import {
  SESSION_SIDE_MODES,
  normaliseSessionTrackingConfig,
  normaliseSessionTrackingMethod,
} from "../config/sessionTracking.js";

export const SESSION_SNAPSHOT_SCHEMA_VERSION = 1;

function valueOf(obj, camelKey, snakeKey, fallback = undefined) {
  if (!obj || typeof obj !== "object") return fallback;
  if (obj[camelKey] !== undefined) return obj[camelKey];
  if (snakeKey && obj[snakeKey] !== undefined) return obj[snakeKey];
  return fallback;
}

function cleanText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function hasOwn(obj, key) {
  return !!obj && Object.prototype.hasOwnProperty.call(obj, key);
}

function roundTo(value, decimalPlaces = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const places = Math.max(0, Math.min(3, Number(decimalPlaces) || 0));
  const factor = 10 ** places;
  return Math.round(n * factor) / factor;
}

function normaliseNumber(
  value,
  { allowNegative = false, decimalPlaces = 0, integer = false } = {}
) {
  if (value === "" || value === null || value === undefined) return null;
  let n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (!allowNegative) n = Math.max(0, n);
  if (integer) return Math.round(n);
  return roundTo(n, decimalPlaces);
}

function getLogPayload(logOrRow) {
  if (!logOrRow || typeof logOrRow !== "object") return null;
  if (logOrRow.log_json && typeof logOrRow.log_json === "object") {
    return logOrRow.log_json;
  }
  return logOrRow;
}

function getLogDate(logOrRow) {
  const payload = getLogPayload(logOrRow);
  return cleanText(
    logOrRow?.date_ymd || payload?.date_ymd || payload?.date || payload?.ymd,
    ""
  );
}

function getSessionObject(sessionOrBlock) {
  if (!sessionOrBlock || typeof sessionOrBlock !== "object") return null;
  if (sessionOrBlock.session && typeof sessionOrBlock.session === "object") {
    return sessionOrBlock.session;
  }
  return sessionOrBlock;
}

function toUtcDate(ymd) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(ymd || ""))) return null;
  const date = new Date(`${ymd}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function shiftYmd(ymd, days) {
  const date = toUtcDate(ymd);
  if (!date) return "";
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function isDateInRange(date, startDate, endDate) {
  if (!date) return !startDate && !endDate;
  if (startDate && date < startDate) return false;
  if (endDate && date > endDate) return false;
  return true;
}

function sessionEntries(logs = [], { startDate = "", endDate = "" } = {}) {
  const entries = [];

  for (const row of Array.isArray(logs) ? logs : []) {
    const payload = getLogPayload(row);
    if (!payload) continue;

    const date = getLogDate(row);
    if (!isDateInRange(date, startDate, endDate)) continue;

    const blocks = Array.isArray(payload.blocks) ? payload.blocks : [];
    for (const block of blocks) {
      if (!block || block.typeId !== "session" || !block.session) continue;
      entries.push({ date, block, session: block.session });
    }
  }

  return entries;
}

function templateIdOf(template) {
  return cleanText(valueOf(template, "id", "id"), "");
}

function movementIdOf(definition) {
  return cleanText(valueOf(definition, "movementId", "movement_id"), "");
}

/**
 * Build the immutable Session definition copied into a daily workout log.
 * The returned object shares no nested config/result references with the live
 * Session Library definition, so later template edits cannot rewrite history.
 */
export function buildSessionSnapshot(templateOrId, library = {}) {
  const templates = Array.isArray(library.templates)
    ? library.templates
    : Array.isArray(library.sessionTemplates)
    ? library.sessionTemplates
    : [];

  const template =
    typeof templateOrId === "string"
      ? templates.find((item) => templateIdOf(item) === templateOrId)
      : templateOrId;

  if (!template || typeof template !== "object") return null;

  const templateId = templateIdOf(template);
  if (!templateId) return null;

  const programmeId = cleanText(
    valueOf(template, "programmeId", "programme_id"),
    ""
  );

  const programmes = Array.isArray(library.programmes) ? library.programmes : [];
  const programme = programmes.find((item) => templateIdOf(item) === programmeId);

  const canonicalMovements = Array.isArray(library.movements) ? library.movements : [];
  const allDefinitions = Array.isArray(library.templateMovements)
    ? library.templateMovements
    : Array.isArray(library.sessionTemplateMovements)
    ? library.sessionTemplateMovements
    : [];

  const definitions = allDefinitions
    .filter(
      (definition) =>
        cleanText(
          valueOf(definition, "sessionTemplateId", "session_template_id"),
          ""
        ) === templateId
    )
    .slice()
    .sort(
      (a, b) =>
        Number(valueOf(a, "position", "position", 0)) -
        Number(valueOf(b, "position", "position", 0))
    );

  const movements = definitions.map((definition, index) => {
    const movementId = movementIdOf(definition);
    const movement = canonicalMovements.find((item) => templateIdOf(item) === movementId);
    const trackingMethod = normaliseSessionTrackingMethod(
      valueOf(definition, "trackingMethod", "tracking_method", "completion")
    );
    const trackingConfig = normaliseSessionTrackingConfig(
      trackingMethod,
      valueOf(definition, "trackingConfig", "tracking_config", {})
    );

    const canonicalName = cleanText(valueOf(movement, "name", "name"), "");
    const displayLabel = cleanText(
      valueOf(definition, "displayLabel", "display_label"),
      canonicalName || "Movement"
    );

    return {
      templateMovementId: cleanText(valueOf(definition, "id", "id"), ""),
      movementId,
      position: Math.max(1, Number(valueOf(definition, "position", "position", index + 1)) || index + 1),
      name: canonicalName || displayLabel,
      displayLabel,
      instructions: cleanText(
        valueOf(definition, "instructions", "instructions"),
        ""
      ),
      plannedDurationSec:
        valueOf(definition, "plannedDurationSec", "planned_duration_sec") === null ||
        valueOf(definition, "plannedDurationSec", "planned_duration_sec") === undefined
          ? null
          : Math.max(
              0,
              Number(
                valueOf(definition, "plannedDurationSec", "planned_duration_sec", 0)
              ) || 0
            ),
      trackingMethod,
      trackingConfig: { ...trackingConfig, quickSteps: [...trackingConfig.quickSteps] },
      completed: false,
      skipped: false,
      result: null,
      note: "",
    };
  });

  return {
    schemaVersion: SESSION_SNAPSHOT_SCHEMA_VERSION,
    programmeId,
    programmeName: cleanText(valueOf(programme, "name", "name"), ""),
    templateId,
    templateVersion: Math.max(
      1,
      Number(valueOf(template, "version", "version", 1)) || 1
    ),
    displayCode: cleanText(valueOf(template, "displayCode", "display_code"), ""),
    name: cleanText(valueOf(template, "name", "name"), "Session"),
    description: cleanText(
      valueOf(template, "description", "description"),
      ""
    ),
    plannedDurationSec:
      valueOf(template, "plannedDurationSec", "planned_duration_sec") === null ||
      valueOf(template, "plannedDurationSec", "planned_duration_sec") === undefined
        ? null
        : Math.max(
            0,
            Number(valueOf(template, "plannedDurationSec", "planned_duration_sec", 0)) || 0
          ),
    actualDurationSec: null,
    completed: false,
    movements,
  };
}

function normaliseNullableDurationSec(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.round(n));
}

function getPlanBlockTemplateId(block) {
  return cleanText(
    valueOf(block, "sessionTemplateId", "session_template_id"),
    ""
  );
}

function getPlanBlockTemplateNameSnapshot(block) {
  return cleanText(
    valueOf(
      block,
      "sessionTemplateNameSnapshot",
      "session_template_name_snapshot"
    ),
    ""
  );
}

function getPlanBlockDurationOverride(block) {
  return normaliseNullableDurationSec(
    valueOf(
      block,
      "plannedDurationSecOverride",
      "planned_duration_sec_override",
      null
    )
  );
}

function formatSessionSnapshotName(session) {
  if (!session || typeof session !== "object") return "";
  const name = cleanText(session.name, "Session");
  const code = cleanText(session.displayCode, "");
  return code ? `Session ${code} — ${name}` : name;
}

/**
 * Convert the lightweight weekly Plan reference into the Session-shaped log
 * block contract. If the definition library is not available yet, the stable
 * template reference and display snapshots are still retained and session is
 * left null so it can be hydrated before persistence.
 */
export function buildSessionLogBlockSnapshot(planBlock = {}, library = {}) {
  const templateId = getPlanBlockTemplateId(planBlock);
  const durationOverride = getPlanBlockDurationOverride(planBlock);
  const session = templateId ? buildSessionSnapshot(templateId, library) : null;

  if (session && durationOverride !== null) {
    session.plannedDurationSec = durationOverride;
  }

  const rawNote = valueOf(planBlock, "note", "note", "");
  const nameSnapshot =
    getPlanBlockTemplateNameSnapshot(planBlock) ||
    formatSessionSnapshotName(session);

  return {
    id: cleanText(valueOf(planBlock, "id", "id"), ""),
    typeId: "session",
    label: cleanText(valueOf(planBlock, "label", "label"), ""),
    note: typeof rawNote === "string" ? rawNote : "",
    sessionTemplateId: templateId,
    sessionTemplateNameSnapshot: nameSnapshot,
    plannedDurationSecOverride: durationOverride,
    session,
  };
}

/**
 * Reconcile a planned Session block into an existing daily log. Once a real
 * Session snapshot exists it is authoritative and is never refreshed from the
 * current Plan or Session Library. An unresolved historical block also keeps
 * its original template/name/duration anchors while waiting for hydration.
 */
export function reconcileSessionLogBlockSnapshot(
  plannedBlock = {},
  existingBlock = null,
  library = {}
) {
  const existing =
    existingBlock && typeof existingBlock === "object" ? existingBlock : null;

  if (existing?.session && typeof existing.session === "object") {
    return {
      ...existing,
      id: cleanText(existing.id, cleanText(plannedBlock?.id, "")),
      typeId: "session",
      session: existing.session,
    };
  }

  const existingTemplateId = getPlanBlockTemplateId(existing);
  const anchored = !!existingTemplateId;

  const source = {
    ...(plannedBlock || {}),
    ...(anchored && hasOwn(existing, "label")
      ? { label: existing.label }
      : {}),
    ...(anchored && hasOwn(existing, "note")
      ? { note: existing.note }
      : {}),
    ...(anchored
      ? { sessionTemplateId: existingTemplateId }
      : {}),
    ...(anchored && hasOwn(existing, "sessionTemplateNameSnapshot")
      ? {
          sessionTemplateNameSnapshot:
            existing.sessionTemplateNameSnapshot,
        }
      : {}),
    ...(anchored && hasOwn(existing, "plannedDurationSecOverride")
      ? {
          plannedDurationSecOverride:
            existing.plannedDurationSecOverride,
        }
      : {}),
  };

  const built = buildSessionLogBlockSnapshot(source, library);

  return {
    ...(existing || {}),
    ...built,
    id:
      cleanText(existing?.id, "") ||
      cleanText(plannedBlock?.id, "") ||
      built.id,
    typeId: "session",
    session: built.session || null,
  };
}

/**
 * Hydrate only Session blocks that do not yet have a frozen definition. This
 * is deliberately idempotent: existing snapshots/results are returned intact.
 */
export function hydrateSessionSnapshotsInLog(log, library = {}) {
  if (!log || !Array.isArray(log.blocks)) return log;

  let changed = false;
  const blocks = log.blocks.map((block) => {
    if (!block || block.typeId !== "session") return block;
    if (block.session && typeof block.session === "object") return block;

    const next = reconcileSessionLogBlockSnapshot(block, block, library);
    if (next.session && typeof next.session === "object") changed = true;
    return next;
  });

  return changed ? { ...log, blocks } : log;
}

function normaliseResultBucket(method, rawBucket = {}, config = {}) {
  const raw = rawBucket && typeof rawBucket === "object" && !Array.isArray(rawBucket)
    ? rawBucket
    : {};
  const decimalPlaces = Number(config.decimalPlaces) || 0;
  const allowNegative = !!config.allowNegative;

  if (method === "completion") return {};

  if (method === "repetitions" || method === "successful_executions") {
    const count = normaliseNumber(raw.count, {
      allowNegative,
      decimalPlaces: 0,
      integer: true,
    });
    return count === null ? null : { count };
  }

  if (method === "attempts_successes") {
    const attempts = normaliseNumber(raw.attempts, {
      allowNegative: false,
      integer: true,
    });
    const successes = normaliseNumber(raw.successes, {
      allowNegative: false,
      integer: true,
    });
    if (attempts === null && successes === null) return null;
    return {
      ...(attempts !== null ? { attempts } : {}),
      ...(successes !== null ? { successes } : {}),
    };
  }

  if (method === "best_score") {
    const best = normaliseNumber(raw.best, {
      allowNegative,
      decimalPlaces,
    });
    return best === null ? null : { best };
  }

  if (method === "duration") {
    const durationSec = normaliseNumber(
      raw.durationSec !== undefined ? raw.durationSec : raw.value,
      { allowNegative: false, decimalPlaces: 1 }
    );
    return durationSec === null ? null : { durationSec };
  }

  if (method === "sets_reps") {
    const sets = [];
    for (const rawSet of Array.isArray(raw.sets) ? raw.sets : []) {
      if (!rawSet || typeof rawSet !== "object") continue;
      const reps = normaliseNumber(rawSet.reps, {
        allowNegative: false,
        integer: true,
      });
      const weight = normaliseNumber(rawSet.weight, {
        allowNegative: false,
        decimalPlaces: 2,
      });
      const timeSeconds = normaliseNumber(rawSet.timeSeconds, {
        allowNegative: false,
        decimalPlaces: 1,
      });
      if (reps === null && weight === null && timeSeconds === null) continue;
      sets.push({
        ...(reps !== null ? { reps } : {}),
        ...(config.allowWeight && weight !== null ? { weight } : {}),
        ...(timeSeconds !== null ? { timeSeconds } : {}),
      });
    }
    return sets.length ? { sets } : null;
  }

  // distance, weight and generic numeric values all use a value payload.
  if (method === "distance" || method === "weight" || method === "numeric") {
    const value = normaliseNumber(raw.value, {
      allowNegative,
      decimalPlaces,
    });
    if (value === null) return null;
    return {
      value,
      unit: cleanText(raw.unit, config.unit || config.weightUnit || ""),
    };
  }

  return null;
}

/**
 * Canonicalise movement result JSON. A null return means there is no recorded
 * numeric/structured result; that does not mean the movement was not practised.
 */
export function normaliseMovementResult(method, rawResult, rawConfig = {}) {
  const safeMethod = normaliseSessionTrackingMethod(method);
  const config = normaliseSessionTrackingConfig(safeMethod, rawConfig);

  if (!rawResult || typeof rawResult !== "object" || Array.isArray(rawResult)) {
    return null;
  }

  if (safeMethod === "completion") return null;

  if (config.sideMode === SESSION_SIDE_MODES.SEPARATE) {
    const left = normaliseResultBucket(safeMethod, rawResult.left, config);
    const right = normaliseResultBucket(safeMethod, rawResult.right, config);
    if (!left && !right) return null;
    return {
      ...(left ? { left } : {}),
      ...(right ? { right } : {}),
    };
  }

  const source =
    rawResult.overall && typeof rawResult.overall === "object"
      ? rawResult.overall
      : rawResult;
  const overall = normaliseResultBucket(safeMethod, source, config);
  return overall ? { overall } : null;
}

function bucketHasData(bucket) {
  if (!bucket || typeof bucket !== "object") return false;
  if (Array.isArray(bucket.sets)) return bucket.sets.length > 0;
  return Object.keys(bucket).some((key) => {
    const value = bucket[key];
    return typeof value === "number" && Number.isFinite(value);
  });
}

export function movementHasRecordedResult(movement) {
  if (!movement || typeof movement !== "object") return false;
  const result = normaliseMovementResult(
    movement.trackingMethod,
    movement.result,
    movement.trackingConfig
  );
  if (!result) return false;
  return [result.overall, result.left, result.right].some(bucketHasData);
}

export function movementWasPerformed(movement) {
  if (!movement || typeof movement !== "object" || movement.skipped) return false;
  return !!movement.completed || movementHasRecordedResult(movement);
}

export function sessionIsCompleted(sessionOrBlock) {
  return !!getSessionObject(sessionOrBlock)?.completed;
}

export function sessionHasActivity(sessionOrBlock) {
  const session = getSessionObject(sessionOrBlock);
  if (!session) return false;
  if (session.completed) return true;
  if (Number(session.actualDurationSec) > 0) return true;
  return (Array.isArray(session.movements) ? session.movements : []).some(
    movementWasPerformed
  );
}

function resultBuckets(movement) {
  const result = normaliseMovementResult(
    movement?.trackingMethod,
    movement?.result,
    movement?.trackingConfig
  );
  if (!result) return [];
  return [result.overall, result.left, result.right].filter(Boolean);
}

export function getRecordedExecutionTotal(movementOrSession) {
  const session = getSessionObject(movementOrSession);
  if (Array.isArray(session?.movements)) {
    return session.movements.reduce(
      (sum, movement) => sum + getRecordedExecutionTotal(movement),
      0
    );
  }

  const movement = movementOrSession;
  if (!movement || typeof movement !== "object") return 0;
  const method = normaliseSessionTrackingMethod(movement.trackingMethod);
  let total = 0;

  for (const bucket of resultBuckets(movement)) {
    if (method === "repetitions" || method === "successful_executions") {
      total += Number(bucket.count) || 0;
    } else if (method === "attempts_successes") {
      total += Number(bucket.successes) || 0;
    } else if (method === "sets_reps") {
      total += (Array.isArray(bucket.sets) ? bucket.sets : []).reduce(
        (sum, set) => sum + (Number(set.reps) || 0),
        0
      );
    }
  }

  return total;
}

export function getAttemptSuccessTotals(movementOrSession) {
  const session = getSessionObject(movementOrSession);
  if (Array.isArray(session?.movements)) {
    return session.movements.reduce(
      (totals, movement) => {
        const current = getAttemptSuccessTotals(movement);
        totals.attempts += current.attempts;
        totals.successes += current.successes;
        return totals;
      },
      { attempts: 0, successes: 0 }
    );
  }

  const movement = movementOrSession;
  if (
    !movement ||
    normaliseSessionTrackingMethod(movement.trackingMethod) !== "attempts_successes"
  ) {
    return { attempts: 0, successes: 0 };
  }

  return resultBuckets(movement).reduce(
    (totals, bucket) => {
      totals.attempts += Number(bucket.attempts) || 0;
      totals.successes += Number(bucket.successes) || 0;
      return totals;
    },
    { attempts: 0, successes: 0 }
  );
}

export function getBestScore(movementOrSession) {
  const session = getSessionObject(movementOrSession);
  if (Array.isArray(session?.movements)) {
    const scores = session.movements
      .map(getBestScore)
      .filter((value) => value !== null);
    return scores.length ? Math.max(...scores) : null;
  }

  const movement = movementOrSession;
  if (
    !movement ||
    normaliseSessionTrackingMethod(movement.trackingMethod) !== "best_score"
  ) {
    return null;
  }

  const scores = resultBuckets(movement)
    .map((bucket) => Number(bucket.best))
    .filter(Number.isFinite);
  return scores.length ? Math.max(...scores) : null;
}

export function getSessionActualDuration(sessionOrBlock, { fallbackToPlanned = true } = {}) {
  const session = getSessionObject(sessionOrBlock);
  if (!session) return 0;

  const actual = Number(session.actualDurationSec);
  if (Number.isFinite(actual) && actual > 0) return actual;

  if (fallbackToPlanned && session.completed) {
    const planned = Number(session.plannedDurationSec);
    if (Number.isFinite(planned) && planned > 0) return planned;
  }

  return 0;
}

export function getSessionTrainingMinutes(sessionOrBlock, options = {}) {
  return getSessionActualDuration(sessionOrBlock, options) / 60;
}

export function getSessionTrainingLoad(sessionOrBlock) {
  const minutes = getSessionTrainingMinutes(sessionOrBlock);
  return {
    training: sessionHasActivity(sessionOrBlock),
    intensity: "moderate",
    minutes,
    load: Math.round(minutes * 10) / 10,
  };
}

export function aggregateSessionHistory(logs = [], options = {}) {
  const entries = sessionEntries(logs, options);
  const byTemplate = new Map();
  let completedSessions = 0;
  let partialSessions = 0;
  let totalMinutes = 0;
  let recordedExecutions = 0;
  let attempts = 0;
  let successes = 0;

  for (const { date, session } of entries) {
    const completed = sessionIsCompleted(session);
    const active = sessionHasActivity(session);
    if (completed) completedSessions += 1;
    else if (active) partialSessions += 1;
    if (active) totalMinutes += getSessionTrainingMinutes(session);
    recordedExecutions += getRecordedExecutionTotal(session);
    const attemptTotals = getAttemptSuccessTotals(session);
    attempts += attemptTotals.attempts;
    successes += attemptTotals.successes;

    const templateId = cleanText(session.templateId, "unknown");
    if (!byTemplate.has(templateId)) {
      byTemplate.set(templateId, {
        templateId,
        displayCode: cleanText(session.displayCode, ""),
        name: cleanText(session.name, "Session"),
        completed: 0,
        partial: 0,
        minutes: 0,
        recordedExecutions: 0,
        lastActivityDate: "",
      });
    }
    const row = byTemplate.get(templateId);
    if (completed) row.completed += 1;
    else if (active) row.partial += 1;
    if (active) row.minutes += getSessionTrainingMinutes(session);
    row.recordedExecutions += getRecordedExecutionTotal(session);
    if (active && (!row.lastActivityDate || date > row.lastActivityDate)) {
      row.lastActivityDate = date;
    }
  }

  return {
    completedSessions,
    partialSessions,
    totalMinutes: Math.round(totalMinutes * 10) / 10,
    recordedExecutions,
    attempts,
    successes,
    accuracyPct: attempts > 0 ? Math.round((successes / attempts) * 1000) / 10 : null,
    byTemplate: Array.from(byTemplate.values()).sort((a, b) =>
      `${a.displayCode}|${a.name}`.localeCompare(`${b.displayCode}|${b.name}`)
    ),
  };
}

export function aggregateMovementHistory(logs = [], options = {}) {
  const entries = sessionEntries(logs, options);
  const byMovement = new Map();

  for (const { date, session } of entries) {
    for (const movement of Array.isArray(session.movements) ? session.movements : []) {
      if (!movementWasPerformed(movement)) continue;
      const movementId = cleanText(movement.movementId, movement.name || movement.displayLabel || "unknown");
      if (!byMovement.has(movementId)) {
        byMovement.set(movementId, {
          movementId,
          name: cleanText(movement.name || movement.displayLabel, "Movement"),
          timesPerformed: 0,
          recordedExecutions: 0,
          attempts: 0,
          successes: 0,
          bestScore: null,
          lastPerformedDate: "",
        });
      }

      const row = byMovement.get(movementId);
      row.timesPerformed += 1;
      row.recordedExecutions += getRecordedExecutionTotal(movement);
      const totals = getAttemptSuccessTotals(movement);
      row.attempts += totals.attempts;
      row.successes += totals.successes;
      const best = getBestScore(movement);
      if (best !== null && (row.bestScore === null || best > row.bestScore)) {
        row.bestScore = best;
      }
      if (!row.lastPerformedDate || date > row.lastPerformedDate) {
        row.lastPerformedDate = date;
      }
    }
  }

  return Array.from(byMovement.values())
    .map((row) => ({
      ...row,
      accuracyPct:
        row.attempts > 0
          ? Math.round((row.successes / row.attempts) * 1000) / 10
          : null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getSessionDistribution(logs = [], options = {}) {
  const map = new Map();
  for (const { date, session } of sessionEntries(logs, options)) {
    if (!sessionIsCompleted(session)) continue;
    const templateId = cleanText(session.templateId, "unknown");
    if (!map.has(templateId)) {
      map.set(templateId, {
        templateId,
        displayCode: cleanText(session.displayCode, ""),
        name: cleanText(session.name, "Session"),
        count: 0,
        lastCompletedDate: "",
      });
    }
    const row = map.get(templateId);
    row.count += 1;
    if (!row.lastCompletedDate || date > row.lastCompletedDate) {
      row.lastCompletedDate = date;
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    `${a.displayCode}|${a.name}`.localeCompare(`${b.displayCode}|${b.name}`)
  );
}

export function getRecommendedNextSession({
  templates = [],
  logs = [],
  days = 28,
  endDate = todayYmd(),
} = {}) {
  const windowDays = Math.max(1, Math.round(Number(days) || 28));
  const startDate = shiftYmd(endDate, -(windowDays - 1));
  const distribution = getSessionDistribution(logs, { startDate, endDate });
  const counts = new Map(distribution.map((item) => [item.templateId, item.count]));

  const candidates = (Array.isArray(templates) ? templates : [])
    .filter((template) => !valueOf(template, "archived", "archived", false))
    .map((template) => ({
      template,
      templateId: templateIdOf(template),
      displayCode: cleanText(valueOf(template, "displayCode", "display_code"), ""),
      name: cleanText(valueOf(template, "name", "name"), "Session"),
      sortOrder: Number(valueOf(template, "sortOrder", "sort_order", 0)) || 0,
    }))
    .filter((item) => !!item.templateId)
    .sort((a, b) =>
      a.sortOrder - b.sortOrder ||
      `${a.displayCode}|${a.name}`.localeCompare(`${b.displayCode}|${b.name}`)
    );

  if (!candidates.length) return null;

  let selected = candidates[0];
  let selectedCount = counts.get(selected.templateId) || 0;
  for (const candidate of candidates.slice(1)) {
    const count = counts.get(candidate.templateId) || 0;
    if (count < selectedCount) {
      selected = candidate;
      selectedCount = count;
    }
  }

  return {
    templateId: selected.templateId,
    displayCode: selected.displayCode,
    name: selected.name,
    completedInWindow: selectedCount,
    windowDays,
    startDate,
    endDate,
    reason: "You have completed this session least often recently.",
  };
}
