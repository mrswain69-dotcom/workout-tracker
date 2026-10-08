import { supabase } from "../supabaseClient";
const unavailable = () => ({ data: null, error: new Error("Supabase not configured") });
const first = (data) => Array.isArray(data) ? data[0] || null : data;
export const creatorVerified = (creator) => !!creator?.verified_at && creator.verified_revision === creator.credential_revision;
export async function getCreator(id) {
  if (!supabase) return unavailable();
  return supabase.from("training_program_creators").select("*").eq("id", id).maybeSingle();
}
export async function saveCreator(id, details) {
  if (!supabase) return unavailable();
  const r = await supabase.rpc("creator_save_profile", { p_profile_id: id, p_details: details });
  return { ...r, data: first(r.data) };
}
export async function listCreatorRequests(id = null) {
  if (!supabase) return unavailable();
  return supabase.rpc("creator_verification_requests", { p_creator_id: id });
}
export async function submitCreatorRequest(id, statement, paths) {
  if (!supabase) return unavailable();
  return supabase.rpc("creator_submit_verification", { p_creator_id: id, p_statement: statement, p_evidence_paths: paths });
}
export async function reviewerAccess() {
  if (!supabase) return unavailable();
  return supabase.rpc("creator_review_access");
}
export async function reviewCreatorRequest(id, decision, note) {
  if (!supabase) return unavailable();
  return supabase.rpc("creator_review_verification", { p_request_id: id, p_decision: decision, p_note: note });
}
export async function uploadCreatorFile(id, kind, file) {
  if (!supabase) return unavailable();
  const photo = kind === "photos";
  const allowed = photo ? ["image/jpeg", "image/png", "image/webp"] : ["application/pdf", "image/jpeg", "image/png"];
  if (!allowed.includes(file.type) || file.size > (photo ? 3 : 5) * 1024 * 1024) return { data: null, error: new Error(photo ? "Choose a JPG, PNG or WebP photo under 3 MB." : "Choose a PDF, JPG or PNG under 5 MB.") };
  const extension = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" }[file.type];
  const path = `${id}/${kind}/${crypto.randomUUID()}.${extension}`;
  const r = await supabase.storage.from(photo ? "creator-photos" : "creator-evidence").upload(path, file, { upsert: false, contentType: file.type });
  return { ...r, data: r.error ? null : { path } };
}
export async function creatorFileUrl(path, kind = "photos") {
  if (!supabase) return unavailable();
  return supabase.storage.from(kind === "photos" ? "creator-photos" : "creator-evidence").createSignedUrl(path, 600);
}
