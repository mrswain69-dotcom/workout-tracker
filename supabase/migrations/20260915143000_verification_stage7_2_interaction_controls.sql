-- Verification Integrations — Stage 7.2 interaction controls
-- Adds reversible user control around sync, matching and provider retention without
-- rewriting Workout Tracker logs or changing XP/reward authority.

alter table public.external_connections
  add column if not exists last_manual_sync_at timestamptz;

alter table public.external_connection_preferences
  add column if not exists initial_import_days integer not null default 90,
  add column if not exists auto_log_window_days integer not null default 2;

alter table public.external_connection_preferences
  drop constraint if exists external_connection_preferences_initial_import_days_check;
alter table public.external_connection_preferences
  add constraint external_connection_preferences_initial_import_days_check
  check (initial_import_days in (0, 7, 30, 90, 365));

alter table public.external_connection_preferences
  drop constraint if exists external_connection_preferences_auto_log_window_days_check;
alter table public.external_connection_preferences
  add constraint external_connection_preferences_auto_log_window_days_check
  check (auto_log_window_days between 0 and 3);

alter table public.verified_activities
  add column if not exists auto_match_suppressed boolean not null default false,
  add column if not exists ignored_at timestamptz,
  add column if not exists ignored_by_user_id uuid references auth.users(id) on delete set null;

alter table public.verified_activities
  drop constraint if exists verified_activities_status_check;
alter table public.verified_activities
  add constraint verified_activities_status_check
  check (status in ('active', 'ignored', 'source_deleted'));

alter table public.external_activity_links
  add column if not exists date_offset_days smallint not null default 0,
  add column if not exists confirmed_at timestamptz;

alter table public.external_activity_links
  drop constraint if exists external_activity_links_date_offset_days_check;
alter table public.external_activity_links
  add constraint external_activity_links_date_offset_days_check
  check (date_offset_days between -2 and 2);

create table if not exists public.external_activity_audit_events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  provider text,
  verified_activity_id uuid references public.verified_activities(id) on delete set null,
  observation_id uuid references public.external_activity_observations(id) on delete set null,
  event_type text not null,
  event_data jsonb not null default '{}'::jsonb,
  actor_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (provider is null or provider in ('garmin','strava','apple_health','health_connect','google_fit_legacy')),
  check (char_length(event_type) between 1 and 80),
  check (jsonb_typeof(event_data) = 'object')
);

create index if not exists external_activity_audit_events_profile_created_idx
  on public.external_activity_audit_events(profile_id, created_at desc);

alter table public.external_activity_audit_events enable row level security;
revoke all on table public.external_activity_audit_events from anon, authenticated;

comment on column public.external_connections.last_manual_sync_at is
  'Server-authoritative timestamp used to enforce the manual source-check cooldown.';
comment on column public.external_connection_preferences.initial_import_days is
  'Bounded provider history window requested when connecting/reconnecting. Zero means from now onwards.';
comment on column public.external_connection_preferences.auto_log_window_days is
  'Maximum recent-day window reserved for Stage 7.3 automatic Workout Tracker log population.';
comment on column public.verified_activities.auto_match_suppressed is
  'Prevents automatic reconciliation from reattaching an activity after the athlete deliberately detaches or manually resolves it.';
comment on table public.external_activity_audit_events is
  'Server-only audit trail for verification sync, match, ignore, detach and provider purge actions.';
