-- Verification Integrations — Stage 3 matching metadata
-- Preserve provider-local date/timezone so manual date-based history can be matched without UTC-day drift.

alter table public.external_activity_observations
  add column if not exists local_date_ymd text,
  add column if not exists source_timezone text;

alter table public.external_activity_observations
  add constraint external_activity_observations_local_date_ymd_check
    check (local_date_ymd is null or local_date_ymd ~ '^\d{4}-\d{2}-\d{2}$'),
  add constraint external_activity_observations_source_timezone_check
    check (source_timezone is null or char_length(source_timezone) between 1 and 120);

alter table public.verified_activities
  add column if not exists identity_method text not null default 'single_source',
  add column if not exists identity_confidence numeric,
  add column if not exists match_version text not null default 'verification_match_v1';

alter table public.verified_activities
  add constraint verified_activities_identity_method_check
    check (identity_method in ('single_source','automatic_dedup','manual_merge')),
  add constraint verified_activities_identity_confidence_check
    check (identity_confidence is null or (identity_confidence >= 0 and identity_confidence <= 1)),
  add constraint verified_activities_match_version_check
    check (char_length(match_version) between 1 and 80);

create index if not exists external_activity_observations_profile_local_date_idx
  on public.external_activity_observations(profile_id, local_date_ymd, started_at desc)
  where source_deleted_at is null;
