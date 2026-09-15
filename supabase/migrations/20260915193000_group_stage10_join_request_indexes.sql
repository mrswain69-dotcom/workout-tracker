-- Group Stage 10 — cover private pending-request foreign keys for team-scale admin flows.
create index if not exists group_join_requests_family_idx
  on private.group_join_requests(family_id);
create index if not exists group_join_requests_profile_idx
  on private.group_join_requests(profile_id);
create index if not exists group_join_requests_reviewed_by_idx
  on private.group_join_requests(reviewed_by_membership_id);
