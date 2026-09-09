// Minimal DB layer for Supabase (family account with profiles)

import { supabase } from "./supabaseClient";

export function isSupabaseReady() {
  return !!supabase;
}

export async function getSession() {
  if (!supabase) return { session: null, error: new Error("Supabase not configured") };
  const { data, error } = await supabase.auth.getSession();
  return { session: data?.session || null, error };
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  return { data, error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

// --- family/profile/plans/logs ---
export async function getOrCreateFamily(defaultFamilyName = "Family") {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) return { family: null, error: new Error("Not logged in") };

  // Find existing family
  const { data: fam, error: fErr } = await supabase
    .from("families")
    .select("*")
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (fErr) return { family: null, error: fErr };
  if (fam) return { family: fam, error: null };

  // Create
  const { data: created, error: cErr } = await supabase
    .from("families")
    .insert({ owner_user_id: user.id, name: defaultFamilyName })
    .select("*")
    .single();

  return { family: created || null, error: cErr };
}

export async function listProfiles(familyId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("family_id", familyId)
    .eq("archived", false)
    .order("created_at", { ascending: true });
  return { data: data || [], error };
}

export async function addProfile(familyId, name) {
  const { data, error } = await supabase
    .from("profiles")
    .insert({ family_id: familyId, name })
    .select("*")
    .single();
  return { data, error };
}

export async function renameProfile(profileId, name) {
  const { data, error } = await supabase
    .from("profiles")
    .update({ name })
    .eq("id", profileId)
    .select("*")
    .single();
  return { data, error };
}

export async function setProfileBodyweight(profileId, body_weight_kg) {
  const { data, error } = await supabase
    .from("profiles")
    .update({ body_weight_kg })
    .eq("id", profileId)
    .select("*")
    .single();
  return { data, error };
}


export async function updateAgeGroup(profileId, ageGroup) {
  const { data, error } = await supabase
    .from("profiles")
    .update({ age_group: ageGroup })
    .eq("id", profileId)
    .select("*")
    .single();
  return { data, error };
}


export async function archiveProfile(profileId) {
  const { data, error } = await supabase
    .from("profiles")
    .update({ archived: true })
    .eq("id", profileId)
    .select("*")
    .single();
  return { data, error };
}

export async function getPlan(familyId) {
  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .eq("family_id", familyId)
    .maybeSingle();
  return { data, error };
}

export async function upsertPlan(familyId, plan) {
  const { data, error } = await supabase
    .from("plans")
    .upsert({ family_id: familyId, plan_json: plan }, { onConflict: "family_id" })
    .select("*")
    .single();
  return { data, error };
}

// -------- Per-profile weekly plans --------
// Live weekly plan is stored directly on the profiles table (plan_json).
// familyId is unused here but kept in the signature for compatibility.
export async function getProfilePlan(familyId, profileId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("plan_json")
    .eq("id", profileId)
    .maybeSingle();

  return { data, error };
}

export async function upsertProfilePlan(familyId, profileId, plan) {
  const { data, error } = await supabase
    .from("profiles")
    .update({ plan_json: plan })
    .eq("id", profileId)
    .select("plan_json")
    .single();

  return { data, error };
}


export async function getLog(familyId, profileId, date_ymd) {
  const { data, error } = await supabase
    .from("logs")
    .select("*")
    .eq("family_id", familyId)
    .eq("profile_id", profileId)
    .eq("date_ymd", date_ymd)
    .maybeSingle();
  return { data, error };
}

export async function upsertLog(familyId, profileId, date_ymd, log) {
  const { data, error } = await supabase
    .from("logs")
    .upsert(
      { family_id: familyId, profile_id: profileId, date_ymd, log_json: log },
      { onConflict: "family_id,profile_id,date_ymd" }
    )
    .select("*")
    .single();

  return { data, error };
}

export async function listLogs(familyId, profileId, limit = 500) {
  const { data, error } = await supabase
    .from("logs")
    .select("*")
    .eq("family_id", familyId)
    .eq("profile_id", profileId)
    .order("date_ymd", { ascending: true })
    .limit(limit);

  return { data: data || [], error };
}


// -------- Plan templates (saved weeks) --------
export async function listPlanTemplates(familyId) {
  const { data, error } = await supabase
    .from("plan_templates")
    .select("*")
    .eq("family_id", familyId)
    .order("updated_at", { ascending: false });
  return { data: data || [], error };
}

export async function createPlanTemplate(familyId, name, planJson) {
  const { data, error } = await supabase
    .from("plan_templates")
    .insert({ family_id: familyId, name, plan_json: planJson })
    .select("*")
    .single();
  return { data, error };
}

export async function updatePlanTemplate(templateId, name, planJson) {
  const { data, error } = await supabase
    .from("plan_templates")
    .update({ name, plan_json: planJson })
    .eq("id", templateId)
    .select("*")
    .single();
  return { data, error };
}

export async function deletePlanTemplate(templateId) {
  const { error } = await supabase.from("plan_templates").delete().eq("id", templateId);
  return { error };
}

// -------- Session Library: programmes --------
export async function listProgrammes(familyId, { includeArchived = false } = {}) {
  let query = supabase
    .from("programmes")
    .select("*")
    .eq("family_id", familyId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (!includeArchived) query = query.eq("archived", false);

  const { data, error } = await query;
  return { data: data || [], error };
}

export async function createProgramme(familyId, programme = {}) {
  const { data, error } = await supabase
    .from("programmes")
    .insert({
      family_id: familyId,
      name: programme.name || "",
      category: programme.category || "",
      description: programme.description || "",
      sort_order: Number.isFinite(Number(programme.sortOrder))
        ? Number(programme.sortOrder)
        : 0,
    })
    .select("*")
    .single();

  return { data, error };
}

export async function updateProgramme(programmeId, patch = {}) {
  const payload = {};
  if (patch.name !== undefined) payload.name = patch.name;
  if (patch.category !== undefined) payload.category = patch.category;
  if (patch.description !== undefined) payload.description = patch.description;
  if (patch.sortOrder !== undefined) payload.sort_order = Number(patch.sortOrder) || 0;
  if (patch.archived !== undefined) payload.archived = !!patch.archived;

  const { data, error } = await supabase
    .from("programmes")
    .update(payload)
    .eq("id", programmeId)
    .select("*")
    .single();

  return { data, error };
}

export async function archiveProgramme(programmeId, archived = true) {
  return updateProgramme(programmeId, { archived });
}

// -------- Session Library: canonical movements --------
export async function listMovements(familyId, { includeArchived = false } = {}) {
  let query = supabase
    .from("movements")
    .select("*")
    .eq("family_id", familyId)
    .order("name", { ascending: true })
    .order("created_at", { ascending: true });

  if (!includeArchived) query = query.eq("archived", false);

  const { data, error } = await query;
  return { data: data || [], error };
}

export async function createMovement(familyId, movement = {}) {
  const { data, error } = await supabase
    .from("movements")
    .insert({
      family_id: familyId,
      name: movement.name || "",
      description: movement.description || "",
    })
    .select("*")
    .single();

  return { data, error };
}

export async function updateMovement(movementId, patch = {}) {
  const payload = {};
  if (patch.name !== undefined) payload.name = patch.name;
  if (patch.description !== undefined) payload.description = patch.description;
  if (patch.archived !== undefined) payload.archived = !!patch.archived;

  const { data, error } = await supabase
    .from("movements")
    .update(payload)
    .eq("id", movementId)
    .select("*")
    .single();

  return { data, error };
}

export async function archiveMovement(movementId, archived = true) {
  return updateMovement(movementId, { archived });
}

// -------- Session Library: session templates --------
export async function listSessionTemplates(
  familyId,
  { includeArchived = false, programmeId = null } = {}
) {
  let query = supabase
    .from("session_templates")
    .select("*")
    .eq("family_id", familyId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (!includeArchived) query = query.eq("archived", false);
  if (programmeId) query = query.eq("programme_id", programmeId);

  const { data, error } = await query;
  return { data: data || [], error };
}

export async function createSessionTemplate(familyId, template = {}) {
  const { data, error } = await supabase
    .from("session_templates")
    .insert({
      family_id: familyId,
      programme_id: template.programmeId,
      display_code: template.displayCode || "",
      name: template.name || "",
      description: template.description || "",
      planned_duration_sec:
        template.plannedDurationSec === null || template.plannedDurationSec === undefined
          ? null
          : Math.max(0, Number(template.plannedDurationSec) || 0),
      version: Math.max(1, Number(template.version) || 1),
      sort_order: Number.isFinite(Number(template.sortOrder))
        ? Number(template.sortOrder)
        : 0,
    })
    .select("*")
    .single();

  return { data, error };
}

export async function updateSessionTemplate(templateId, patch = {}) {
  const payload = {};
  if (patch.programmeId !== undefined) payload.programme_id = patch.programmeId;
  if (patch.displayCode !== undefined) payload.display_code = patch.displayCode;
  if (patch.name !== undefined) payload.name = patch.name;
  if (patch.description !== undefined) payload.description = patch.description;
  if (patch.plannedDurationSec !== undefined) {
    payload.planned_duration_sec =
      patch.plannedDurationSec === null
        ? null
        : Math.max(0, Number(patch.plannedDurationSec) || 0);
  }
  if (patch.version !== undefined) payload.version = Math.max(1, Number(patch.version) || 1);
  if (patch.sortOrder !== undefined) payload.sort_order = Number(patch.sortOrder) || 0;
  if (patch.archived !== undefined) payload.archived = !!patch.archived;

  const { data, error } = await supabase
    .from("session_templates")
    .update(payload)
    .eq("id", templateId)
    .select("*")
    .single();

  return { data, error };
}

export async function archiveSessionTemplate(templateId, archived = true) {
  return updateSessionTemplate(templateId, { archived });
}

// -------- Session Library: ordered movements inside templates --------
export async function listSessionTemplateMovements(
  familyId,
  { sessionTemplateId = null } = {}
) {
  let query = supabase
    .from("session_template_movements")
    .select("*")
    .eq("family_id", familyId)
    .order("session_template_id", { ascending: true })
    .order("position", { ascending: true });

  if (sessionTemplateId) {
    query = query.eq("session_template_id", sessionTemplateId);
  }

  const { data, error } = await query;
  return { data: data || [], error };
}

export async function createSessionTemplateMovement(familyId, definition = {}) {
  const { data, error } = await supabase
    .from("session_template_movements")
    .insert({
      family_id: familyId,
      session_template_id: definition.sessionTemplateId,
      movement_id: definition.movementId,
      position: Math.max(1, Number(definition.position) || 1),
      display_label: definition.displayLabel || "",
      instructions: definition.instructions || "",
      planned_duration_sec:
        definition.plannedDurationSec === null || definition.plannedDurationSec === undefined
          ? null
          : Math.max(0, Number(definition.plannedDurationSec) || 0),
      tracking_method: definition.trackingMethod || "completion",
      tracking_config:
        definition.trackingConfig && typeof definition.trackingConfig === "object"
          ? definition.trackingConfig
          : {},
    })
    .select("*")
    .single();

  return { data, error };
}

export async function updateSessionTemplateMovement(templateMovementId, patch = {}) {
  const payload = {};
  if (patch.sessionTemplateId !== undefined) {
    payload.session_template_id = patch.sessionTemplateId;
  }
  if (patch.movementId !== undefined) payload.movement_id = patch.movementId;
  if (patch.position !== undefined) payload.position = Math.max(1, Number(patch.position) || 1);
  if (patch.displayLabel !== undefined) payload.display_label = patch.displayLabel;
  if (patch.instructions !== undefined) payload.instructions = patch.instructions;
  if (patch.plannedDurationSec !== undefined) {
    payload.planned_duration_sec =
      patch.plannedDurationSec === null
        ? null
        : Math.max(0, Number(patch.plannedDurationSec) || 0);
  }
  if (patch.trackingMethod !== undefined) payload.tracking_method = patch.trackingMethod;
  if (patch.trackingConfig !== undefined) {
    payload.tracking_config =
      patch.trackingConfig && typeof patch.trackingConfig === "object"
        ? patch.trackingConfig
        : {};
  }

  const { data, error } = await supabase
    .from("session_template_movements")
    .update(payload)
    .eq("id", templateMovementId)
    .select("*")
    .single();

  return { data, error };
}

export async function deleteSessionTemplateMovement(templateMovementId) {
  const { error } = await supabase
    .from("session_template_movements")
    .delete()
    .eq("id", templateMovementId);

  return { error };
}

// -------- Session Library: development tags --------
export async function listDevelopmentTags(familyId, { includeArchived = false } = {}) {
  let query = supabase
    .from("development_tags")
    .select("*")
    .eq("family_id", familyId)
    .order("name", { ascending: true });

  if (!includeArchived) query = query.eq("archived", false);

  const { data, error } = await query;
  return { data: data || [], error };
}

export async function createDevelopmentTag(familyId, tag = {}) {
  const { data, error } = await supabase
    .from("development_tags")
    .insert({
      family_id: familyId,
      name: tag.name || "",
      slug: tag.slug || "",
    })
    .select("*")
    .single();

  return { data, error };
}

export async function updateDevelopmentTag(tagId, patch = {}) {
  const payload = {};
  if (patch.name !== undefined) payload.name = patch.name;
  if (patch.slug !== undefined) payload.slug = patch.slug;
  if (patch.archived !== undefined) payload.archived = !!patch.archived;

  const { data, error } = await supabase
    .from("development_tags")
    .update(payload)
    .eq("id", tagId)
    .select("*")
    .single();

  return { data, error };
}

export async function archiveDevelopmentTag(tagId, archived = true) {
  return updateDevelopmentTag(tagId, { archived });
}

// -------- Session Library: movement/tag relationships --------
export async function listMovementDevelopmentTags(
  familyId,
  { movementId = null, developmentTagId = null } = {}
) {
  let query = supabase
    .from("movement_development_tags")
    .select("*")
    .eq("family_id", familyId)
    .order("created_at", { ascending: true });

  if (movementId) query = query.eq("movement_id", movementId);
  if (developmentTagId) query = query.eq("development_tag_id", developmentTagId);

  const { data, error } = await query;
  return { data: data || [], error };
}

export async function addMovementDevelopmentTag(familyId, movementId, developmentTagId) {
  const { data, error } = await supabase
    .from("movement_development_tags")
    .upsert(
      {
        family_id: familyId,
        movement_id: movementId,
        development_tag_id: developmentTagId,
      },
      { onConflict: "movement_id,development_tag_id" }
    )
    .select("*")
    .single();

  return { data, error };
}

export async function removeMovementDevelopmentTag(movementId, developmentTagId) {
  const { error } = await supabase
    .from("movement_development_tags")
    .delete()
    .eq("movement_id", movementId)
    .eq("development_tag_id", developmentTagId);

  return { error };
}

// Load the full family-owned definition library in one call for app consumers.
// This is definitions only: it does not read or change plans or workout logs.
export async function loadSessionLibrary(familyId, { includeArchived = false } = {}) {
  const [
    programmesResult,
    movementsResult,
    templatesResult,
    templateMovementsResult,
    developmentTagsResult,
    movementDevelopmentTagsResult,
  ] = await Promise.all([
    listProgrammes(familyId, { includeArchived }),
    listMovements(familyId, { includeArchived }),
    listSessionTemplates(familyId, { includeArchived }),
    listSessionTemplateMovements(familyId),
    listDevelopmentTags(familyId, { includeArchived }),
    listMovementDevelopmentTags(familyId),
  ]);

  const error =
    programmesResult.error ||
    movementsResult.error ||
    templatesResult.error ||
    templateMovementsResult.error ||
    developmentTagsResult.error ||
    movementDevelopmentTagsResult.error ||
    null;

  return {
    data: {
      programmes: programmesResult.data || [],
      movements: movementsResult.data || [],
      templates: templatesResult.data || [],
      templateMovements: templateMovementsResult.data || [],
      developmentTags: developmentTagsResult.data || [],
      movementDevelopmentTags: movementDevelopmentTagsResult.data || [],
    },
    error,
  };
}

// -------- Parent lock (PIN) stored on family --------
export async function setFamilyPinHash(familyId, pinHash) {
  const { data, error } = await supabase
    .from("families")
    .update({ pin_hash: pinHash, pin_updated_at: new Date().toISOString() })
    .eq("id", familyId)
    .select("*")
    .single();
  return { data, error };
}

export async function clearFamilyPin(familyId) {
  const { data, error } = await supabase
    .from("families")
    .update({ pin_hash: null, pin_updated_at: new Date().toISOString() })
    .eq("id", familyId)
    .select("*")
    .single();
  return { data, error };
}
