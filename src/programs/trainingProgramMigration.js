import {
  ensurePlanProgram,
  extractShareablePlanContent,
  normaliseProgramStartDate,
} from "../engine/planCycleEngine.js";

export function legacyTemplateToProgramContent(template, startDate = "") {
  const title = String(template?.name || "Saved plan").trim() || "Saved plan";
  const normalised = ensurePlanProgram(template?.plan_json || {}, {
    name: title,
    startDate: normaliseProgramStartDate(startDate),
  });
  return extractShareablePlanContent({
    ...normalised,
    program: {
      ...normalised.program,
      name: title,
      completionMode: normalised.program.completionMode || "repeat",
    },
  });
}

export function findUnmigratedLegacyTemplates(templates = [], programs = []) {
  const migratedIds = new Set(
    programs.map((program) => program?.legacy_plan_template_id).filter(Boolean)
  );
  return templates.filter((template) => template?.id && !migratedIds.has(template.id));
}
