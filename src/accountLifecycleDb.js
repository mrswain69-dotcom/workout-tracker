import { supabase } from "./supabaseClient";

function unavailable() {
  return { data: null, error: new Error("Account service unavailable") };
}

async function invoke(body) {
  if (!supabase) return unavailable();
  const { data, error } = await supabase.functions.invoke("account-lifecycle", { body });
  return { data: data || null, error: error || null };
}

export function getAccountDeletionSummary() {
  return invoke({ action: "summary" });
}

export function sendWelcomeTutorialEmail() {
  return invoke({ action: "send_welcome" });
}

export function permanentlyDeleteAccount({ password, confirmation }) {
  return invoke({
    action: "delete_account",
    password: String(password || ""),
    confirmation: String(confirmation || ""),
  });
}
