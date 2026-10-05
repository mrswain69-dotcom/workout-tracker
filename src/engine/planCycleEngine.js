export const PLAN_PROGRAM_VERSION = 1;
export const PLAN_DOCUMENT_VERSION = 5;
export const PLAN_COMPLETION_MODES = Object.freeze(["repeat", "once", "hold"]);
export const MAX_PROGRAM_WEEKS = 52;
export const MAX_PROGRAM_PHASES = 12;
export const PLAN_WEEKDAYS = Object.freeze(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);

// Temporary compatibility exports for callers that have not yet adopted Program naming.
export const PLAN_CYCLE_VERSION = PLAN_PROGRAM_VERSION;
export const PLAN_CYCLE_REPEAT_MODES = PLAN_COMPLETION_MODES;
export const MAX_PLAN_CYCLE_WEEKS = MAX_PROGRAM_WEEKS;

function cleanText(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function parseYmd(value) {
  const text = cleanText(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toYmd(date) {
  return date.toISOString().slice(0, 10);
}

export function normaliseProgramStartDate(value, fallbackYmd = "") {
  const date = parseYmd(value) || parseYmd(fallbackYmd) || new Date();
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const daysFromMonday = (utcDate.getUTCDay() + 6) % 7;
  utcDate.setUTCDate(utcDate.getUTCDate() - daysFromMonday);
  return toYmd(utcDate);
}

export const normaliseCycleStartDate = normaliseProgramStartDate;

export function emptyBlocksByWeekday() {
  return Object.fromEntries(PLAN_WEEKDAYS.map((weekday) => [weekday, []]));
}

function normaliseBlocksByWeekday(value) {
  const source = value && typeof value === "object" ? value : {};
  return Object.fromEntries(
    PLAN_WEEKDAYS.map((weekday) => [
      weekday,
      Array.isArray(source[weekday]) ? source[weekday] : [],
    ])
  );
}

function generatedId(prefix = "item") {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `${prefix}_${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function normalisePlanWeek(week, index = 0) {
  return {
    id: cleanText(week?.id) || generatedId("week"),
    name: cleanText(week?.name) || `Week ${index + 1}`,
    focus: cleanText(week?.focus),
    blocksByWeekday: normaliseBlocksByWeekday(week?.blocksByWeekday),
  };
}

export function normaliseProgramAssessment(assessment, index = 0) {
  return {
    id: cleanText(assessment?.id) || generatedId("assessment"),
    timing: assessment?.timing === "after" ? "after" : "before",
    title: cleanText(assessment?.title) || `Assessment ${index + 1}`,
    assessmentTemplateId: cleanText(assessment?.assessmentTemplateId),
    required: assessment?.required === true,
    ...(assessment?.assessmentDefinition ? { assessmentDefinition: assessment.assessmentDefinition } : {}),
  };
}

export function normaliseProgramPhase(phase, index = 0) {
  const weeks = (Array.isArray(phase?.weeks) && phase.weeks.length
    ? phase.weeks
    : [{ name: "Week 1", blocksByWeekday: emptyBlocksByWeekday() }]
  ).map(normalisePlanWeek);
  return {
    id: cleanText(phase?.id) || generatedId("phase"),
    name: cleanText(phase?.name) || `Phase ${index + 1}`,
    focus: cleanText(phase?.focus),
    weeks,
    assessments: (Array.isArray(phase?.assessments) ? phase.assessments : [])
      .map(normaliseProgramAssessment),
  };
}

function capProgramPhases(phases) {
  const capped = [];
  let remainingWeeks = MAX_PROGRAM_WEEKS;
  for (const phase of phases.slice(0, MAX_PROGRAM_PHASES)) {
    if (remainingWeeks <= 0) break;
    const weeks = phase.weeks.slice(0, remainingWeeks);
    if (!weeks.length) continue;
    capped.push({ ...phase, weeks });
    remainingWeeks -= weeks.length;
  }
  return capped;
}

function legacyCycleToPhases(cycle) {
  if (!Array.isArray(cycle?.weeks) || !cycle.weeks.length) return [];
  return [{
    id: cleanText(cycle?.phaseId) || generatedId("phase"),
    name: cleanText(cycle?.phaseName) || "Main phase",
    focus: "",
    weeks: cycle.weeks,
    assessments: [],
  }];
}

export function hasPlanProgram(plan) {
  return !!(
    plan?.program &&
    Array.isArray(plan.program.phases) &&
    plan.program.phases.some((phase) => Array.isArray(phase?.weeks) && phase.weeks.length > 0)
  );
}

export function hasPlanCycle(plan) {
  return hasPlanProgram(plan) || !!(
    plan?.cycle && Array.isArray(plan.cycle.weeks) && plan.cycle.weeks.length > 0
  );
}

export function ensurePlanProgram(plan = {}, options = {}) {
  const fallbackStart = options.startDate || options.todayYmd || "";
  const sourcePhases = Array.isArray(plan?.program?.phases)
    ? plan.program.phases
    : legacyCycleToPhases(plan?.cycle);
  const normalisedPhases = sourcePhases.length
    ? sourcePhases.map(normaliseProgramPhase)
    : [normaliseProgramPhase({
        name: "Main phase",
        weeks: [{ name: "Week 1", blocksByWeekday: plan?.blocksByWeekday }],
      })];
  const phases = capProgramPhases(normalisedPhases);
  const firstWeek = phases[0].weeks[0];
  const legacyCompletionMode = PLAN_COMPLETION_MODES.includes(plan?.cycle?.repeatMode)
    ? plan.cycle.repeatMode
    : "repeat";
  const completionMode = PLAN_COMPLETION_MODES.includes(plan?.program?.completionMode)
    ? plan.program.completionMode
    : legacyCompletionMode;
  // Weekly plans predate programme scheduling: migrating one must not hide its
  // historical days behind the date on which the user first opens the new UI.
  const legacyWeeklySchedule = !options.startDate && (
    plan?.program?.legacyWeeklySchedule === true ||
    (!plan?.program && !plan?.cycle && Object.values(plan?.blocksByWeekday || {})
      .some((blocks) => Array.isArray(blocks) && blocks.length > 0))
  );
  const program = {
    schemaVersion: PLAN_PROGRAM_VERSION,
    name: cleanText(plan?.program?.name) || cleanText(plan?.cycle?.name) || cleanText(options.name) || "My training programme",
    description: cleanText(plan?.program?.description),
    startDate: normaliseProgramStartDate(
      plan?.program?.startDate || plan?.cycle?.startDate,
      fallbackStart
    ),
    completionMode,
    ...(legacyWeeklySchedule ? { legacyWeeklySchedule: true } : {}),
    phases,
  };

  const { cycle: _legacyCycle, ...withoutLegacyCycle } = plan;
  return {
    ...withoutLegacyCycle,
    version: Math.max(Number(plan?.version) || 0, PLAN_DOCUMENT_VERSION),
    program,
    // The first week remains mirrored for rollback safety. Date-aware code uses program.
    blocksByWeekday: firstWeek.blocksByWeekday,
  };
}

export const ensurePlanCycle = ensurePlanProgram;

export function flattenProgramWeeks(plan) {
  const normalised = ensurePlanProgram(plan);
  const flattened = [];
  normalised.program.phases.forEach((phase, phaseIndex) => {
    phase.weeks.forEach((week, weekIndex) => {
      flattened.push({
        phase,
        phaseIndex,
        week,
        weekIndex,
        globalWeekIndex: flattened.length,
      });
    });
  });
  return flattened;
}

export function getProgramWeekPosition(plan, globalWeekIndex = 0) {
  const flattened = flattenProgramWeeks(plan);
  const safeIndex = Math.max(0, Math.min(flattened.length - 1, Number(globalWeekIndex) || 0));
  return flattened[safeIndex];
}

export function getPlanProgramWeekIndex(plan, targetYmd) {
  const normalised = ensurePlanProgram(plan, { todayYmd: targetYmd });
  const target = parseYmd(targetYmd);
  const start = parseYmd(normalised.program.startDate);
  const weekCount = flattenProgramWeeks(normalised).length;
  if (!target || !start) return { index: 0, status: "active", cycleNumber: 1 };

  const dayOffset = Math.floor((target.getTime() - start.getTime()) / 86400000);
  if (dayOffset < 0) {
    if (normalised.program.legacyWeeklySchedule && weekCount === 1 && normalised.program.completionMode === "repeat") {
      return { index: 0, status: "active", cycleNumber: 1 };
    }
    return { index: -1, status: "before_start", cycleNumber: 0 };
  }

  const absoluteWeek = Math.floor(dayOffset / 7);
  if (absoluteWeek < weekCount) {
    return { index: absoluteWeek, status: "active", cycleNumber: 1 };
  }
  if (normalised.program.completionMode === "repeat") {
    return {
      index: absoluteWeek % weekCount,
      status: "active",
      cycleNumber: Math.floor(absoluteWeek / weekCount) + 1,
    };
  }
  if (normalised.program.completionMode === "hold") {
    return { index: weekCount - 1, status: "holding", cycleNumber: 1 };
  }
  return { index: -1, status: "finished", cycleNumber: 1 };
}

export const getPlanCycleWeekIndex = getPlanProgramWeekIndex;

function resolveBasePlanForDate(plan, targetYmd) {
  if (!plan) return plan;
  const normalised = ensurePlanProgram(plan, { todayYmd: targetYmd });
  const resolution = getPlanProgramWeekIndex(normalised, targetYmd);
  const position = resolution.index >= 0
    ? getProgramWeekPosition(normalised, resolution.index)
    : null;
  return {
    ...normalised,
    blocksByWeekday: position?.week?.blocksByWeekday || emptyBlocksByWeekday(),
    programResolution: {
      weekIndex: resolution.index,
      weekNumber: resolution.index >= 0 ? resolution.index + 1 : 0,
      weekId: position?.week?.id || "",
      weekName: position?.week?.name || "",
      phaseIndex: position?.phaseIndex ?? -1,
      phaseId: position?.phase?.id || "",
      phaseName: position?.phase?.name || "",
      status: resolution.status,
      cycleNumber: resolution.cycleNumber,
    },
    // Compatibility for dashboard code while it adopts Program naming.
    cycleResolution: {
      weekIndex: resolution.index,
      weekNumber: resolution.index >= 0 ? resolution.index + 1 : 0,
      weekId: position?.week?.id || "",
      weekName: position?.week?.name || "",
      status: resolution.status,
      cycleNumber: resolution.cycleNumber,
    },
  };
}

function cleanProgramAddOns(plan) {
  return (Array.isArray(plan?.meta?.programAddOns) ? plan.meta.programAddOns : [])
    .filter((addOn) => addOn && typeof addOn === "object" && addOn.content);
}

function programSourceForAddOn(addOn) {
  return {
    kind: addOn.sourceKind || "assignment",
    assignmentId: cleanText(addOn.id),
    programId: cleanText(addOn.programId),
    versionId: cleanText(addOn.versionId),
    version: Number(addOn.version) || 0,
    title: cleanText(addOn.title) || "Group Program",
  };
}

function sourceBlockId(addOn, block, weekday, index) {
  const assignmentId = cleanText(addOn?.id) || "program";
  const originalId = cleanText(block?.id) || `${weekday}_${index}`;
  return `assigned_${assignmentId}_${originalId}`;
}

export function resolvePlanForDate(plan, targetYmd) {
  const resolved = resolveBasePlanForDate(plan, targetYmd);
  if (!resolved) return resolved;

  const addOns = cleanProgramAddOns(plan);
  if (!addOns.length) return resolved;

  const combinedBlocks = normaliseBlocksByWeekday(resolved.blocksByWeekday);
  const combinedTypes = Array.isArray(resolved.activityTypes)
    ? [...resolved.activityTypes]
    : [];
  const typeIds = new Set(combinedTypes.map((type) => type?.id).filter(Boolean));
  const addOnResolutions = [];

  for (const addOn of addOns) {
    const addOnPlan = resolveBasePlanForDate(addOn.content, targetYmd);
    if (!addOnPlan) continue;
    const source = programSourceForAddOn(addOn);
    const active = addOnPlan.programResolution?.weekIndex >= 0;
    addOnResolutions.push({
      ...source,
      status: addOnPlan.programResolution?.status || "finished",
      weekNumber: addOnPlan.programResolution?.weekNumber || 0,
    });
    if (!active) continue;

    for (const weekday of PLAN_WEEKDAYS) {
      const blocks = Array.isArray(addOnPlan.blocksByWeekday?.[weekday])
        ? addOnPlan.blocksByWeekday[weekday]
        : [];
      combinedBlocks[weekday] = [
        ...(combinedBlocks[weekday] || []),
        ...blocks.map((block, index) => ({
          ...block,
          id: sourceBlockId(addOn, block, weekday, index),
          sourceBlockId: cleanText(block?.id),
          programSource: source,
        })),
      ];
    }

    for (const type of addOnPlan.activityTypes || []) {
      if (!type?.id || typeIds.has(type.id)) continue;
      typeIds.add(type.id);
      combinedTypes.push(type);
    }
  }

  return {
    ...resolved,
    activityTypes: combinedTypes,
    blocksByWeekday: combinedBlocks,
    programResolution: {
      ...resolved.programResolution,
      addOns: addOnResolutions,
    },
  };
}

export function getPlanEditorWeek(plan, index = 0) {
  const normalised = ensurePlanProgram(plan);
  const position = getProgramWeekPosition(normalised, index);
  return {
    ...normalised,
    blocksByWeekday: position.week.blocksByWeekday,
    programResolution: {
      weekIndex: position.globalWeekIndex,
      weekNumber: position.globalWeekIndex + 1,
      weekId: position.week.id,
      weekName: position.week.name,
      phaseIndex: position.phaseIndex,
      phaseId: position.phase.id,
      phaseName: position.phase.name,
      status: "editing",
      cycleNumber: 1,
    },
  };
}

export function setPlanProgramWeek(plan, index, nextWeekLike = {}) {
  const normalised = ensurePlanProgram(plan);
  const position = getProgramWeekPosition(normalised, index);
  const current = position.week;
  const nextWeek = normalisePlanWeek({
    ...current,
    ...(nextWeekLike || {}),
    id: current.id,
    blocksByWeekday: nextWeekLike?.blocksByWeekday || current.blocksByWeekday,
  }, position.weekIndex);
  const phases = normalised.program.phases.map((phase, phaseIndex) => phaseIndex !== position.phaseIndex
    ? phase
    : {
        ...phase,
        weeks: phase.weeks.map((week, weekIndex) => weekIndex === position.weekIndex ? nextWeek : week),
      });
  return {
    ...normalised,
    program: { ...normalised.program, phases },
    blocksByWeekday: phases[0].weeks[0].blocksByWeekday,
  };
}

export const setPlanCycleWeek = setPlanProgramWeek;

function cloneEntityWithFreshIds(value, idFactory = generatedId) {
  const block = { ...value, id: idFactory("block") };
  if (Array.isArray(value?.movements)) {
    block.movements = value.movements.map((movement) => ({ ...movement, id: idFactory("movement") }));
  }
  if (Array.isArray(value?.tasks)) {
    block.tasks = value.tasks.map((task) => ({ ...task, id: idFactory("task") }));
  }
  return block;
}

export function duplicateProgramWeek(plan, sourceIndex = 0, idFactory = generatedId) {
  const normalised = ensurePlanProgram(plan);
  if (flattenProgramWeeks(normalised).length >= MAX_PROGRAM_WEEKS) return normalised;
  const position = getProgramWeekPosition(normalised, sourceIndex);
  const blocksByWeekday = Object.fromEntries(
    PLAN_WEEKDAYS.map((weekday) => [
      weekday,
      position.week.blocksByWeekday[weekday].map((block) => cloneEntityWithFreshIds(block, idFactory)),
    ])
  );
  const phases = normalised.program.phases.map((phase, phaseIndex) => {
    if (phaseIndex !== position.phaseIndex) return phase;
    const weeks = [...phase.weeks];
    weeks.splice(position.weekIndex + 1, 0, {
      id: idFactory("week"),
      name: `Week ${position.weekIndex + 2}`,
      focus: position.week.focus || "",
      blocksByWeekday,
    });
    return {
      ...phase,
      weeks: weeks.map((week, weekIndex) => ({
        ...week,
        name: /^Week \d+$/.test(week.name) ? `Week ${weekIndex + 1}` : week.name,
      })),
    };
  });
  return {
    ...normalised,
    program: { ...normalised.program, phases },
    blocksByWeekday: phases[0].weeks[0].blocksByWeekday,
  };
}

export const duplicatePlanCycleWeek = duplicateProgramWeek;

export function removeProgramWeek(plan, index) {
  const normalised = ensurePlanProgram(plan);
  if (flattenProgramWeeks(normalised).length <= 1) return normalised;
  const position = getProgramWeekPosition(normalised, index);
  const phases = normalised.program.phases.map((phase, phaseIndex) => {
    if (phaseIndex !== position.phaseIndex) return phase;
    const weeks = phase.weeks
      .filter((_, weekIndex) => weekIndex !== position.weekIndex)
      .map((week, weekIndex) => ({
        ...week,
        name: /^Week \d+$/.test(week.name) ? `Week ${weekIndex + 1}` : week.name,
      }));
    return { ...phase, weeks };
  }).filter((phase) => phase.weeks.length > 0);
  return {
    ...normalised,
    program: { ...normalised.program, phases },
    blocksByWeekday: phases[0].weeks[0].blocksByWeekday,
  };
}

export const removePlanCycleWeek = removeProgramWeek;

export function updatePlanProgramSettings(plan, patch = {}) {
  const normalised = ensurePlanProgram(plan);
  const completionMode = PLAN_COMPLETION_MODES.includes(patch.completionMode || patch.repeatMode)
    ? (patch.completionMode || patch.repeatMode)
    : normalised.program.completionMode;
  return {
    ...normalised,
    program: {
      ...normalised.program,
      name: patch.name === undefined ? normalised.program.name : cleanText(patch.name) || "My training programme",
      description: patch.description === undefined
        ? normalised.program.description
        : cleanText(patch.description),
      startDate: patch.startDate === undefined
        ? normalised.program.startDate
        : normaliseProgramStartDate(patch.startDate, normalised.program.startDate),
      completionMode,
      legacyWeeklySchedule: patch.startDate === undefined && normalised.program.legacyWeeklySchedule === true,
    },
  };
}

export const updatePlanCycleSettings = updatePlanProgramSettings;

export function updateProgramPhase(plan, phaseIndex, patch = {}) {
  const normalised = ensurePlanProgram(plan);
  const safeIndex = Math.max(0, Math.min(normalised.program.phases.length - 1, Number(phaseIndex) || 0));
  const phases = normalised.program.phases.map((phase, index) => index !== safeIndex ? phase : {
    ...phase,
    name: patch.name === undefined ? phase.name : cleanText(patch.name) || `Phase ${index + 1}`,
    focus: patch.focus === undefined ? phase.focus : cleanText(patch.focus),
  });
  return { ...normalised, program: { ...normalised.program, phases } };
}

export function addProgramPhase(plan, idFactory = generatedId) {
  const normalised = ensurePlanProgram(plan);
  if (
    normalised.program.phases.length >= MAX_PROGRAM_PHASES ||
    flattenProgramWeeks(normalised).length >= MAX_PROGRAM_WEEKS
  ) return normalised;
  const phaseNumber = normalised.program.phases.length + 1;
  const phase = normaliseProgramPhase({
    id: idFactory("phase"),
    name: `Phase ${phaseNumber}`,
    weeks: [{ id: idFactory("week"), name: "Week 1", blocksByWeekday: emptyBlocksByWeekday() }],
  }, phaseNumber - 1);
  return {
    ...normalised,
    program: { ...normalised.program, phases: [...normalised.program.phases, phase] },
  };
}

export function removeProgramPhase(plan, phaseIndex) {
  const normalised = ensurePlanProgram(plan);
  if (normalised.program.phases.length <= 1) return normalised;
  const safeIndex = Math.max(0, Math.min(normalised.program.phases.length - 1, Number(phaseIndex) || 0));
  const phases = normalised.program.phases.filter((_, index) => index !== safeIndex);
  return {
    ...normalised,
    program: { ...normalised.program, phases },
    blocksByWeekday: phases[0].weeks[0].blocksByWeekday,
  };
}

export function addProgramAssessment(plan, phaseIndex, assessment = {}, idFactory = generatedId) {
  const normalised = ensurePlanProgram(plan);
  const safeIndex = Math.max(0, Math.min(normalised.program.phases.length - 1, Number(phaseIndex) || 0));
  const phases = normalised.program.phases.map((phase, index) => index !== safeIndex ? phase : {
    ...phase,
    assessments: [
      ...phase.assessments,
      normaliseProgramAssessment({ ...assessment, id: idFactory("assessment") }, phase.assessments.length),
    ],
  });
  return { ...normalised, program: { ...normalised.program, phases } };
}

export function removeProgramAssessment(plan, phaseIndex, assessmentId) {
  const normalised = ensurePlanProgram(plan);
  const safeIndex = Math.max(0, Math.min(normalised.program.phases.length - 1, Number(phaseIndex) || 0));
  const phases = normalised.program.phases.map((phase, index) => index !== safeIndex ? phase : {
    ...phase,
    assessments: phase.assessments.filter((assessment) => assessment.id !== assessmentId),
  });
  return { ...normalised, program: { ...normalised.program, phases } };
}

export function planHasAnyCycleBlocks(plan) {
  return flattenProgramWeeks(plan).some(({ week }) =>
    PLAN_WEEKDAYS.some((weekday) => week.blocksByWeekday[weekday].length > 0)
  );
}

export function extractShareablePlanContent(plan) {
  const normalised = ensurePlanProgram(plan);
  return {
    version: PLAN_DOCUMENT_VERSION,
    activityTypes: Array.isArray(normalised.activityTypes) ? normalised.activityTypes : [],
    program: normalised.program,
    blocksByWeekday: normalised.program.phases[0].weeks[0].blocksByWeekday,
  };
}

export function prepareImportedPlanContent(content, {
  startDate = "",
  completionMode = "",
  repeatMode = "",
  existingMeta = {},
  source = null,
} = {}) {
  const normalised = ensurePlanProgram(content, { startDate });
  const next = updatePlanProgramSettings(normalised, {
    ...(startDate ? { startDate } : {}),
    ...((completionMode || repeatMode) ? { completionMode: completionMode || repeatMode } : {}),
  });
  return {
    ...next,
    meta: {
      ...(existingMeta && typeof existingMeta === "object" ? existingMeta : {}),
      ...(source ? { activeProgramSource: source } : {}),
      planSetupPrompt: false,
    },
  };
}

function metadataForReplacement(meta) {
  if (!meta || typeof meta !== "object") return {};
  const {
    programAddOns: _programAddOns,
    activeProgramSource: _activeProgramSource,
    programAdoptionUndo: _programAdoptionUndo,
    ...retained
  } = meta;
  return retained;
}

function cloneTaskBlocks(blocks) {
  return (Array.isArray(blocks) ? blocks : [])
    .filter((block) => block?.typeId === "tasks")
    .map((block) => ({
      ...block,
      tasks: Array.isArray(block.tasks)
        ? block.tasks.map((task) => ({ ...task }))
        : [],
    }));
}

export function prepareAssignedProgramAdoption(currentPlan, assignment, adoptionMode = "replace") {
  const content = assignment?.version?.content_json;
  if (!content) return null;
  const source = {
    kind: "assignment",
    assignmentId: assignment.id,
    programId: assignment.program_id,
    versionId: assignment.version_id,
    version: assignment.version?.version_no || 0,
    title: assignment.program?.title || "Assigned Program",
    adoptionMode,
  };
  const imported = prepareImportedPlanContent(content, {
    startDate: assignment.start_date,
    completionMode: assignment.completion_mode,
    existingMeta: metadataForReplacement(currentPlan?.meta),
    source,
  });
  if (adoptionMode !== "replace_keep_tasks") return imported;

  const currentWeeks = flattenProgramWeeks(currentPlan || {});
  if (!currentWeeks.length) return imported;
  let globalWeekIndex = 0;
  const phases = imported.program.phases.map((phase) => ({
    ...phase,
    weeks: phase.weeks.map((week) => {
      const currentWeek = currentWeeks[globalWeekIndex % currentWeeks.length]?.week;
      globalWeekIndex += 1;
      const blocksByWeekday = Object.fromEntries(PLAN_WEEKDAYS.map((weekday) => [
        weekday,
        [
          ...(week.blocksByWeekday?.[weekday] || []),
          ...cloneTaskBlocks(currentWeek?.blocksByWeekday?.[weekday]),
        ],
      ]));
      return { ...week, blocksByWeekday };
    }),
  }));
  return {
    ...imported,
    program: { ...imported.program, phases },
    blocksByWeekday: phases[0].weeks[0].blocksByWeekday,
  };
}


export function updateEditableProgramAddOn(plan, addOnId, content) {
  const addons = Array.isArray(plan?.meta?.programAddOns) ? plan.meta.programAddOns : [];
  const addon = addons.find((row) => row.id === addOnId);
  if (!addon) throw new Error("That add-on is no longer attached.");
  if (addon.recipientCanEdit === false) throw new Error("This add-on must be followed as supplied.");
  return {
    ...plan,
    meta: { ...plan.meta, programAddOns: addons.map((row) => row.id === addOnId ? { ...row, content: extractShareablePlanContent(content) } : row) },
  };
}
