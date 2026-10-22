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

export async function permanentlyDeleteAccount({ password, confirmation }) {
  const result = await invoke({
    action: "delete_account",
    password: String(password || ""),
    confirmation: String(confirmation || ""),
  });
  if (!result.error && result.data?.deleted) {
    // Deleting the server user does not clear the SDK's persisted session.
    // The SDK clears local state even when the now-deleted token is rejected.
    // Never sign out on a rejected or unconfirmed deletion.
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // Server deletion is final; still let the caller purge drafts and reset UI.
    }
  }
  return result;
}
