import { extractShareablePlanContent } from "../engine/planCycleEngine.js";

// A library programme describes weeks, not calendar dates or profile state.
export function undatedProgramContent(plan) {
  const content = extractShareablePlanContent(plan);
  const { legacyWeeklySchedule: _legacy, ...program } = content.program;
  return { ...content, program: { ...program, startDate: "" } };
}

export function createProgramDraft(content, program = null) {
  const undated = undatedProgramContent(content);
  if (program?.title) undated.program.name = program.title;
  return {
    content: undated,
    sourceProgram: program,
    dirty: !program,
  };
}

export function programDraftKey(familyId, profileId) {
  return familyId && profileId ? `wt_program_draft_v1:${familyId}:${profileId}` : "";
}

export function readProgramDraft(storage, key) {
  if (!key) return null;
  try {
    const draft = JSON.parse(storage.getItem(key) || "null");
    if (!Array.isArray(draft?.content?.program?.phases) || !draft.content.program.phases.length) return null;
    return { ...draft, content: undatedProgramContent(draft.content) };
  } catch { return null; }
}
