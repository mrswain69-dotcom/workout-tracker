import {
  normaliseSessionTrackingConfig,
  normaliseSessionTrackingMethod,
} from "../../config/sessionTracking.js";

function cleanText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function finiteNonNegativeInt(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.round(n));
}

function valueOf(obj, camelKey, snakeKey, fallback = undefined) {
  if (!obj || typeof obj !== "object") return fallback;
  if (obj[camelKey] !== undefined) return obj[camelKey];
  if (snakeKey && obj[snakeKey] !== undefined) return obj[snakeKey];
  return fallback;
}

function sortByNumberThenText(items, numberKey, textKey) {
  return items.slice().sort((a, b) => {
    const n = Number(valueOf(a, numberKey, numberKey.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`), 0)) -
      Number(valueOf(b, numberKey, numberKey.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`), 0));
    if (n) return n;
    return cleanText(valueOf(a, textKey, textKey.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`))).localeCompare(
      cleanText(valueOf(b, textKey, textKey.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)))
    );
  });
}

export function emptySessionLibrary() {
  return {
    programmes: [],
    movements: [],
    templates: [],
    templateMovements: [],
    developmentTags: [],
    movementDevelopmentTags: [],
  };
}

export function normaliseSessionLibrary(raw = {}) {
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    programmes: sortByNumberThenText(
      Array.isArray(source.programmes) ? source.programmes : [],
      "sortOrder",
      "name"
    ),
    movements: (Array.isArray(source.movements) ? source.movements : [])
      .slice()
      .sort((a, b) => cleanText(a?.name).localeCompare(cleanText(b?.name))),
    templates: sortByNumberThenText(
      Array.isArray(source.templates) ? source.templates : [],
      "sortOrder",
      "name"
    ),
    templateMovements: (Array.isArray(source.templateMovements)
      ? source.templateMovements
      : []
    )
      .slice()
      .sort((a, b) => {
        const templateCompare = cleanText(
          valueOf(a, "sessionTemplateId", "session_template_id")
        ).localeCompare(
          cleanText(valueOf(b, "sessionTemplateId", "session_template_id"))
        );
        if (templateCompare) return templateCompare;
        return Number(a?.position || 0) - Number(b?.position || 0);
      }),
    developmentTags: Array.isArray(source.developmentTags)
      ? source.developmentTags.slice()
      : [],
    movementDevelopmentTags: Array.isArray(source.movementDevelopmentTags)
      ? source.movementDevelopmentTags.slice()
      : [],
  };
}

export function toEditorTemplate(row = {}) {
  const duration = valueOf(row, "plannedDurationSec", "planned_duration_sec");
  return {
    id: cleanText(row.id, ""),
    familyId: cleanText(valueOf(row, "familyId", "family_id"), ""),
    programmeId: cleanText(valueOf(row, "programmeId", "programme_id"), ""),
    displayCode: cleanText(valueOf(row, "displayCode", "display_code"), ""),
    name: cleanText(row.name, ""),
    description: cleanText(row.description, ""),
    plannedDurationSec:
      duration === null || duration === undefined || duration === ""
        ? null
        : finiteNonNegativeInt(duration, 0),
    version: Math.max(1, finiteNonNegativeInt(row.version, 1) || 1),
    sortOrder: Number(valueOf(row, "sortOrder", "sort_order", 0)) || 0,
  };
}

export function toEditorTemplateMovement(row = {}) {
  const method = normaliseSessionTrackingMethod(
    valueOf(row, "trackingMethod", "tracking_method", "completion")
  );
  const duration = valueOf(row, "plannedDurationSec", "planned_duration_sec");
  return {
    id: cleanText(row.id, ""),
    sessionTemplateId: cleanText(
      valueOf(row, "sessionTemplateId", "session_template_id"),
      ""
    ),
    movementId: cleanText(valueOf(row, "movementId", "movement_id"), ""),
    position: Math.max(1, finiteNonNegativeInt(row.position, 1) || 1),
    displayLabel: cleanText(valueOf(row, "displayLabel", "display_label"), ""),
    instructions: cleanText(row.instructions, ""),
    plannedDurationSec:
      duration === null || duration === undefined || duration === ""
        ? null
        : finiteNonNegativeInt(duration, 0),
    trackingMethod: method,
    trackingConfig: normaliseSessionTrackingConfig(
      method,
      valueOf(row, "trackingConfig", "tracking_config", {})
    ),
  };
}

export function getProgrammeSessions(library, programmeId) {
  const safe = normaliseSessionLibrary(library);
  return safe.templates
    .filter(
      (template) =>
        cleanText(valueOf(template, "programmeId", "programme_id")) ===
          cleanText(programmeId) && !template.archived
    )
    .slice()
    .sort((a, b) => {
      const order = Number(valueOf(a, "sortOrder", "sort_order", 0)) -
        Number(valueOf(b, "sortOrder", "sort_order", 0));
      if (order) return order;
      const code = cleanText(valueOf(a, "displayCode", "display_code")).localeCompare(
        cleanText(valueOf(b, "displayCode", "display_code"))
      );
      if (code) return code;
      return cleanText(a.name).localeCompare(cleanText(b.name));
    });
}

export function getTemplateDefinition(library, templateId) {
  const safe = normaliseSessionLibrary(library);
  const template = safe.templates.find((item) => cleanText(item.id) === cleanText(templateId));
  if (!template) return null;
  const id = cleanText(template.id);
  return {
    template: toEditorTemplate(template),
    templateMovements: safe.templateMovements
      .filter(
        (row) =>
          cleanText(valueOf(row, "sessionTemplateId", "session_template_id")) === id
      )
      .map(toEditorTemplateMovement)
      .sort((a, b) => a.position - b.position),
  };
}

function stableObject(value) {
  if (Array.isArray(value)) return value.map(stableObject);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value)
    .sort()
    .reduce((out, key) => {
      out[key] = stableObject(value[key]);
      return out;
    }, {});
}

function definitionComparable(definition = {}) {
  const template = toEditorTemplate(definition.template || {});
  const rows = (Array.isArray(definition.templateMovements)
    ? definition.templateMovements
    : []
  )
    .map(toEditorTemplateMovement)
    .sort((a, b) => a.position - b.position)
    .map((row, index) => ({
      movementId: row.movementId,
      position: index + 1,
      displayLabel: row.displayLabel,
      instructions: row.instructions,
      plannedDurationSec: row.plannedDurationSec,
      trackingMethod: row.trackingMethod,
      trackingConfig: row.trackingConfig,
    }));

  return {
    template: {
      programmeId: template.programmeId,
      displayCode: template.displayCode,
      name: template.name,
      description: template.description,
      plannedDurationSec: template.plannedDurationSec,
    },
    templateMovements: rows,
  };
}

export function sessionDefinitionFingerprint(definition = {}) {
  return JSON.stringify(stableObject(definitionComparable(definition)));
}

export function sessionDefinitionChanged(nextDefinition, originalDefinition) {
  if (!originalDefinition) return true;
  return (
    sessionDefinitionFingerprint(nextDefinition) !==
    sessionDefinitionFingerprint(originalDefinition)
  );
}

export function validatePersistableSessionDefinition(definition = {}) {
  const comparable = definitionComparable(definition);
  const errors = [];
  if (!comparable.template.programmeId) errors.push("Choose a programme.");
  if (!comparable.template.name) errors.push("Session name is required.");
  if (!comparable.templateMovements.length) errors.push("Add at least one movement.");
  comparable.templateMovements.forEach((row, index) => {
    if (!row.movementId) errors.push(`Movement ${index + 1} must select a library movement.`);
  });
  return { valid: errors.length === 0, errors };
}

function errorFromResult(result, fallback) {
  if (result?.error) {
    const error = result.error instanceof Error
      ? result.error
      : new Error(result.error.message || String(result.error));
    error.message = `${fallback}: ${error.message}`;
    return error;
  }
  return null;
}

async function expectData(promise, fallback) {
  const result = await promise;
  const error = errorFromResult(result, fallback);
  if (error) throw error;
  if (!result?.data) throw new Error(`${fallback}: no row returned`);
  return result.data;
}

async function expectSuccess(promise, fallback) {
  const result = await promise;
  const error = errorFromResult(result, fallback);
  if (error) throw error;
  return result;
}

/**
 * Persist a complete Session definition using the Stage 2 DB API.
 *
 * Existing retained movement rows are first moved to temporary positions so
 * reordering cannot violate unique(session_template_id, position).
 */
export async function persistSessionDefinition({
  familyId,
  definition,
  originalDefinition = null,
  db,
}) {
  if (!familyId) throw new Error("A family ID is required to save a Session.");
  if (!db) throw new Error("A Session Library DB API is required.");

  const validation = validatePersistableSessionDefinition(definition);
  if (!validation.valid) throw new Error(validation.errors.join(" "));

  const template = toEditorTemplate(definition.template);
  const rows = (definition.templateMovements || [])
    .map(toEditorTemplateMovement)
    .sort((a, b) => a.position - b.position)
    .map((row, index) => ({ ...row, position: index + 1 }));

  const isExisting = !!template.id;
  const changed = sessionDefinitionChanged(
    { template, templateMovements: rows },
    originalDefinition
  );

  if (isExisting && !changed) {
    return {
      changed: false,
      template,
      templateMovements: rows,
    };
  }

  if (!isExisting) {
    const createdTemplate = await expectData(
      db.createSessionTemplate(familyId, {
        ...template,
        version: 1,
      }),
      "Could not create Session"
    );
    const templateId = cleanText(createdTemplate.id);
    const createdRows = [];

    for (const row of rows) {
      const created = await expectData(
        db.createSessionTemplateMovement(familyId, {
          ...row,
          sessionTemplateId: templateId,
        }),
        `Could not create movement ${row.position}`
      );
      createdRows.push(created);
    }

    return {
      changed: true,
      created: true,
      template: createdTemplate,
      templateMovements: createdRows,
    };
  }

  const original = originalDefinition || { template, templateMovements: [] };
  const originalRows = (original.templateMovements || [])
    .map(toEditorTemplateMovement)
    .sort((a, b) => a.position - b.position);
  const originalById = new Map(originalRows.filter((row) => row.id).map((row) => [row.id, row]));
  const desiredExistingIds = new Set(rows.filter((row) => row.id).map((row) => row.id));

  for (const row of rows) {
    if (row.id && !originalById.has(row.id)) {
      throw new Error(`Movement row ${row.id} does not belong to this Session definition.`);
    }
  }

  // Move retained rows away from their live positions before any final order is applied.
  let stagedIndex = 0;
  for (const row of rows.filter((item) => item.id)) {
    stagedIndex += 1;
    await expectData(
      db.updateSessionTemplateMovement(row.id, { position: 100000 + stagedIndex }),
      `Could not stage movement ${row.position}`
    );
  }

  // Delete rows removed in the editor so their old position cannot block a retained/new row.
  for (const oldRow of originalRows) {
    if (oldRow.id && !desiredExistingIds.has(oldRow.id)) {
      await expectSuccess(
        db.deleteSessionTemplateMovement(oldRow.id),
        `Could not remove movement ${oldRow.position}`
      );
    }
  }

  const savedRows = [];
  for (const row of rows) {
    if (row.id) {
      const saved = await expectData(
        db.updateSessionTemplateMovement(row.id, {
          sessionTemplateId: template.id,
          movementId: row.movementId,
          position: row.position,
          displayLabel: row.displayLabel,
          instructions: row.instructions,
          plannedDurationSec: row.plannedDurationSec,
          trackingMethod: row.trackingMethod,
          trackingConfig: row.trackingConfig,
        }),
        `Could not save movement ${row.position}`
      );
      savedRows.push(saved);
    } else {
      const saved = await expectData(
        db.createSessionTemplateMovement(familyId, {
          ...row,
          sessionTemplateId: template.id,
        }),
        `Could not create movement ${row.position}`
      );
      savedRows.push(saved);
    }
  }

  const nextVersion = Math.max(1, Number(template.version) || 1) + 1;
  const savedTemplate = await expectData(
    db.updateSessionTemplate(template.id, {
      programmeId: template.programmeId,
      displayCode: template.displayCode,
      name: template.name,
      description: template.description,
      plannedDurationSec: template.plannedDurationSec,
      version: nextVersion,
    }),
    "Could not update Session"
  );

  return {
    changed: true,
    created: false,
    template: savedTemplate,
    templateMovements: savedRows,
  };
}

export function activeSessionsUsingMovement(library, movementId) {
  const safe = normaliseSessionLibrary(library);
  const activeTemplateIds = new Set(
    safe.templates.filter((item) => !item.archived).map((item) => cleanText(item.id))
  );
  const usedTemplateIds = new Set(
    safe.templateMovements
      .filter(
        (row) =>
          cleanText(valueOf(row, "movementId", "movement_id")) === cleanText(movementId) &&
          activeTemplateIds.has(
            cleanText(valueOf(row, "sessionTemplateId", "session_template_id"))
          )
      )
      .map((row) => cleanText(valueOf(row, "sessionTemplateId", "session_template_id")))
  );

  return safe.templates.filter((template) => usedTemplateIds.has(cleanText(template.id)));
}

export function activeSessionsInProgramme(library, programmeId) {
  return getProgrammeSessions(library, programmeId);
}
