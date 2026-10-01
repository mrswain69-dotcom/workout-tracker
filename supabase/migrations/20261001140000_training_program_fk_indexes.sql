-- Cover Program foreign keys used by deletes, entitlement checks and coaching flows.
create index training_programs_creator_profile_idx
  on public.training_programs(creator_profile_id);
create index training_programs_current_version_idx
  on public.training_programs(current_version_id);
create index training_program_versions_created_family_idx
  on public.training_program_versions(created_by_family_id);
create index training_program_shares_program_idx
  on public.training_program_share_links(program_id);
create index training_program_shares_version_idx
  on public.training_program_share_links(version_id);
create index training_program_shares_created_family_idx
  on public.training_program_share_links(created_by_family_id);
create index training_program_assignments_program_idx
  on public.training_program_assignments(program_id);
create index training_program_assignments_assigned_family_idx
  on public.training_program_assignments(assigned_by_family_id);
create index training_program_entitlements_program_idx
  on public.training_program_entitlements(program_id);
create index training_program_entitlements_version_idx
  on public.training_program_entitlements(version_id);
