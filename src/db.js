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

// Plans are stored per profile on profiles.plan_json
export async function getPlan(profileId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, plan_json")
    .eq("id", profileId)
    .single();
  return { data: data?.plan_json || null, error };
}

export async function upsertPlan(profileId, plan) {
  const { data, error } = await supabase
    .from("profiles")
    .update({ plan_json: plan })
    .eq("id", profileId)
    .select("id, plan_json")
    .single();
  return { data: data?.plan_json || null, error };
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
