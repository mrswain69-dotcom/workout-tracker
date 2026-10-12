import { listOwnedTrainingPrograms, saveTrainingProgram } from "./trainingProgramDb.js";
import { undatedProgramContent } from "./programDrafts.js";

export async function saveProgramDraft(draft, familyId, profileId) {
  let source = draft.sourceProgram;
  if (source) {
    // Keep catalogue metadata current and reject an already superseded editing copy.
    const owned = await listOwnedTrainingPrograms(familyId, true);
    if (owned.error) throw owned.error;
    const latest = owned.data?.find((program) => program.id === source.id);
    if (!latest || latest.status === "archived") throw new Error("This programme is no longer editable. Save it as a separate programme instead.");
    if (latest.current_version_id !== source.current_version_id) throw new Error("A newer version has been saved. Your draft is retained; save it as a separate programme or reopen the latest version.");
    source = latest;
  }
  const content = undatedProgramContent(draft.content);
  const title = content.program.name.trim();
  if (!title || title.length > 100) throw new Error("Give your programme a name of up to 100 characters.");
  const result = await saveTrainingProgram({
    programId: source?.id || null,
    familyId, creatorProfileId: profileId, title,
    description: source?.description || content.program.description || "",
    purpose: source?.purpose || "", sport: source?.sport || "",
    difficulty: source?.difficulty || "all_levels", ageBand: source?.age_band || "all_ages",
    equipment: source?.equipment || [], tags: source?.tags || [],
    creatorRole: source?.creator_role || "community",
    content, changeNote: source ? "Updated in draft editor" : "Saved from draft editor",
  });
  if (result.error) throw result.error;
  if (!result.data?.program_id || !result.data?.version_id) throw new Error("The programme could not be saved. Your draft is retained.");
  return {
    ...source, id: result.data.program_id, title,
    current_version_id: result.data.version_id, current_version_no: result.data.version_no,
    current_version: { id: result.data.version_id, content_json: content },
    status: "active",
  };
}
