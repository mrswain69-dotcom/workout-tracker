-- Workout Tracker Group & Team Ecosystem Stage 8 hardening
-- Cover Stage 8 foreign keys used by lifecycle deletes/admin lookups.

create index if not exists group_challenges_created_by_membership_idx
  on public.group_challenges(created_by_membership_id);

create index if not exists group_challenge_rewards_membership_idx
  on public.group_challenge_rewards(membership_id);

create index if not exists group_challenge_rewards_family_idx
  on public.group_challenge_rewards(family_id);
