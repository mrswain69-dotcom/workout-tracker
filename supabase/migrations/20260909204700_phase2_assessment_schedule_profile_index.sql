-- Workout Tracker Phase 2 / Stage 8
-- Cover the assessment_schedules.profile_id foreign key with a leading-column
-- index as recommended by the Supabase database advisor.

create index assessment_schedules_profile_family_idx
  on public.assessment_schedules(profile_id, family_id);
