import { supabase } from "./supabaseClient";
import { validateBirthDateForProfile } from "./engine/historicalAgeEngine.js";

function todayYmd() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function setProfileBirthDate(profileId, birthDate, { today = todayYmd() } = {}) {
  if (!supabase) {
    return { data: null, error: new Error("Supabase not configured") };
  }
  if (!profileId) {
    return { data: null, error: new Error("Profile is required") };
  }

  const validated = validateBirthDateForProfile(birthDate, today);
  if (validated.error) return { data: null, error: validated.error };

  const { data, error } = await supabase
    .from("profiles")
    .update({ birth_date: validated.value })
    .eq("id", profileId)
    .select("id,family_id,name,age_group,birth_date")
    .single();

  return { data: data || null, error };
}
