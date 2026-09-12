import { supabase } from "./supabaseClient";

function unavailable() {
  return { data: null, error: new Error("Supabase not configured") };
}

export async function loadHistoricalTimelineData(profileId, referenceDate = "") {
  if (!supabase) return unavailable();
  if (!profileId) {
    return {
      data: {
        profile: null,
        consistencySnapshots: [],
        groupAwards: [],
        knowledge: { sourceAvailable: false, milestones: [] },
        referenceDate: referenceDate || "",
      },
      error: null,
    };
  }

  const body = { profileId };
  if (referenceDate) body.referenceDate = referenceDate;
  const { data, error } = await supabase.functions.invoke("historical-timeline-data", {
    body,
  });
  return { data: data || null, error };
}
