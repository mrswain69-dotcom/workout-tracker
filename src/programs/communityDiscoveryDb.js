import { supabase } from "../supabaseClient";

const rpc = (name, args = {}) => supabase
  ? supabase.rpc(name, args)
  : Promise.resolve({ data: null, error: new Error("Community tools are unavailable") });

export const communityContext = (profileId) => rpc("community_context", { p_profile_id: profileId });
export const bookmarkCommunity = (profileId, programId, saved) => rpc("community_bookmark", { p_profile_id: profileId, p_program_id: programId, p_saved: saved });
export const voteCommunity = (profileId, program, helpful) => rpc("community_vote", { p_profile_id: profileId, p_program_id: program.id, p_helpful: helpful, p_version_id: program.current_version_id, p_purpose: program.purpose || "" });
export const copyCommunity = (profileId, program, title) => rpc("community_copy", { p_profile_id: profileId, p_program_id: program.id, p_version_id: program.current_version_id, p_title: title });
export const setCommunityCopyPermission = (programId, allowed) => rpc("community_set_copy_permission", { p_program_id: programId, p_allow_copy: allowed });
export const reportCommunity = (profileId, target, reason, details) => rpc("community_report", { p_profile_id: profileId, p_program_id: target.programId || null, p_creator_id: target.creatorId || null, p_reason: reason, p_details: details });
export const listCommunityReports = () => rpc("community_reports");
export const reviewCommunityReport = (id, action, note) => rpc("community_review_report", { p_report_id: id, p_action: action, p_note: note });
