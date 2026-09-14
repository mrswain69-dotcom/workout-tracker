-- Verification Integrations — Stage 1 external activity foundation
-- Additive only: no existing logs, plans, XP, Assessments or historical records are rewritten.
-- Provider credentials/tokens are deliberately NOT stored in these client-readable tables.

create table public.external_connections (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('garmin','strava','apple_health','health_connect','google_fit_legacy')),
  provider_account_id text,
  status text not null default 'pending' check (status in ('pending','active','error','disconnected')),
  auto_sync_enabled boolean not null default true,
  scopes jsonb not null default '[]'::jsonb check (jsonb_typeof(scopes) = 'array'),
  connected_at timestamptz,
  disconnected_at timestamptz,
  last_sync_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, provider),
  check (provider_account_id is null or char_length(provider_account_id) between 1 and 200),
  check (last_error_code is null or char_length(last_error_code) <= 120)
);

create unique index external_connections_active_provider_account_idx
  on public.external_connections(provider, provider_account_id)
  where provider_account_id is not null and status <> 'disconnected';
create index external_connections_family_profile_idx
  on public.external_connections(family_id, profile_id, status);

create table public.external_activity_observations (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.external_connections(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('garmin','strava','apple_health','health_connect','google_fit_legacy')),
  provider_activity_id text not null,
  started_at timestamptz not null,
  activity_type text not null default 'unknown',
  activity_name text,
  distance_m numeric,
  elapsed_duration_sec integer,
  moving_duration_sec integer,
  average_heart_rate_bpm numeric,
  max_heart_rate_bpm numeric,
  elevation_gain_m numeric,
  calories_kcal numeric,
  source_created_at timestamptz,
  source_updated_at timestamptz,
  source_deleted_at timestamptz,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, provider_activity_id),
  check (char_length(provider_activity_id) between 1 and 240),
  check (activity_type = btrim(activity_type) and char_length(activity_type) between 1 and 80),
  check (activity_name is null or char_length(activity_name) <= 240),
  check (distance_m is null or distance_m >= 0),
  check (elapsed_duration_sec is null or elapsed_duration_sec >= 0),
  check (moving_duration_sec is null or moving_duration_sec >= 0),
  check (average_heart_rate_bpm is null or average_heart_rate_bpm > 0),
  check (max_heart_rate_bpm is null or max_heart_rate_bpm > 0),
  check (elevation_gain_m is null or elevation_gain_m >= 0),
  check (calories_kcal is null or calories_kcal >= 0)
);
create index external_activity_observations_profile_started_idx
  on public.external_activity_observations(profile_id, started_at desc);
create index external_activity_observations_connection_updated_idx
  on public.external_activity_observations(connection_id, source_updated_at, updated_at);

create table public.verified_activities (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  activity_type text not null default 'unknown',
  started_at timestamptz not null,
  status text not null default 'active' check (status in ('active','source_deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (activity_type = btrim(activity_type) and char_length(activity_type) between 1 and 80)
);
create index verified_activities_profile_started_idx
  on public.verified_activities(profile_id, started_at desc);

create table public.verified_activity_observations (
  verified_activity_id uuid not null references public.verified_activities(id) on delete cascade,
  observation_id uuid not null unique references public.external_activity_observations(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  linked_at timestamptz not null default now(),
  primary key (verified_activity_id, observation_id)
);
create index verified_activity_observations_profile_idx
  on public.verified_activity_observations(profile_id, verified_activity_id);

create table public.external_activity_links (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  verified_activity_id uuid not null unique references public.verified_activities(id) on delete cascade,
  manual_log_id uuid not null references public.logs(id) on delete cascade,
  manual_block_id text,
  match_method text not null default 'automatic' check (match_method in ('automatic','manual')),
  match_confidence numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (manual_block_id is null or char_length(manual_block_id) between 1 and 160),
  check (match_confidence is null or (match_confidence >= 0 and match_confidence <= 1))
);
create index external_activity_links_profile_log_idx
  on public.external_activity_links(profile_id, manual_log_id);

create or replace function private.enforce_external_connection_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = new.profile_id
      and p.family_id = new.family_id
      and p.archived = false
  ) then
    raise exception 'External connection profile does not belong to supplied family or is archived';
  end if;

  if tg_op = 'UPDATE' and (
    old.family_id is distinct from new.family_id or
    old.profile_id is distinct from new.profile_id or
    old.provider is distinct from new.provider
  ) then
    raise exception 'External connection identity cannot be reassigned';
  end if;

  return new;
end
$$;

create or replace function private.enforce_external_observation_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_family_id uuid;
  v_profile_id uuid;
  v_provider text;
begin
  select c.family_id, c.profile_id, c.provider
    into v_family_id, v_profile_id, v_provider
  from public.external_connections c
  where c.id = new.connection_id;

  if v_family_id is null
     or v_family_id is distinct from new.family_id
     or v_profile_id is distinct from new.profile_id
     or v_provider is distinct from new.provider then
    raise exception 'External observation does not match its connection identity';
  end if;

  if tg_op = 'UPDATE' and (
    old.connection_id is distinct from new.connection_id or
    old.family_id is distinct from new.family_id or
    old.profile_id is distinct from new.profile_id or
    old.provider is distinct from new.provider or
    old.provider_activity_id is distinct from new.provider_activity_id
  ) then
    raise exception 'External observation identity cannot be reassigned';
  end if;

  return new;
end
$$;

create or replace function private.enforce_verified_activity_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = new.profile_id
      and p.family_id = new.family_id
      and p.archived = false
  ) then
    raise exception 'Verified activity profile does not belong to supplied family or is archived';
  end if;

  if tg_op = 'UPDATE' and (
    old.family_id is distinct from new.family_id or
    old.profile_id is distinct from new.profile_id
  ) then
    raise exception 'Verified activity identity cannot be reassigned';
  end if;

  return new;
end
$$;

create or replace function private.enforce_verified_observation_link_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_activity_family_id uuid;
  v_activity_profile_id uuid;
  v_observation_family_id uuid;
  v_observation_profile_id uuid;
begin
  select a.family_id, a.profile_id
    into v_activity_family_id, v_activity_profile_id
  from public.verified_activities a
  where a.id = new.verified_activity_id;

  select o.family_id, o.profile_id
    into v_observation_family_id, v_observation_profile_id
  from public.external_activity_observations o
  where o.id = new.observation_id;

  if v_activity_family_id is null or v_observation_family_id is null
     or v_activity_family_id is distinct from v_observation_family_id
     or v_activity_profile_id is distinct from v_observation_profile_id
     or new.family_id is distinct from v_activity_family_id
     or new.profile_id is distinct from v_activity_profile_id then
    raise exception 'Verified activity and observation must belong to the same athlete';
  end if;

  return new;
end
$$;

create or replace function private.enforce_external_manual_link_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_activity_family_id uuid;
  v_activity_profile_id uuid;
  v_log_family_id uuid;
  v_log_profile_id uuid;
begin
  select a.family_id, a.profile_id
    into v_activity_family_id, v_activity_profile_id
  from public.verified_activities a
  where a.id = new.verified_activity_id;

  select l.family_id, l.profile_id
    into v_log_family_id, v_log_profile_id
  from public.logs l
  where l.id = new.manual_log_id;

  if v_activity_family_id is null or v_log_family_id is null
     or v_activity_family_id is distinct from v_log_family_id
     or v_activity_profile_id is distinct from v_log_profile_id
     or new.family_id is distinct from v_activity_family_id
     or new.profile_id is distinct from v_activity_profile_id then
    raise exception 'Verification link must join evidence and manual history for the same athlete';
  end if;

  if tg_op = 'UPDATE' and (
    old.family_id is distinct from new.family_id or
    old.profile_id is distinct from new.profile_id or
    old.verified_activity_id is distinct from new.verified_activity_id or
    old.manual_log_id is distinct from new.manual_log_id
  ) then
    raise exception 'Verification link identity cannot be reassigned';
  end if;

  return new;
end
$$;

revoke all on function private.enforce_external_connection_integrity() from public;
revoke all on function private.enforce_external_observation_integrity() from public;
revoke all on function private.enforce_verified_activity_integrity() from public;
revoke all on function private.enforce_verified_observation_link_integrity() from public;
revoke all on function private.enforce_external_manual_link_integrity() from public;

create trigger trg_external_connections_integrity
before insert or update on public.external_connections
for each row execute function private.enforce_external_connection_integrity();
create trigger trg_external_observations_integrity
before insert or update on public.external_activity_observations
for each row execute function private.enforce_external_observation_integrity();
create trigger trg_verified_activities_integrity
before insert or update on public.verified_activities
for each row execute function private.enforce_verified_activity_integrity();
create trigger trg_verified_activity_observations_integrity
before insert or update on public.verified_activity_observations
for each row execute function private.enforce_verified_observation_link_integrity();
create trigger trg_external_activity_links_integrity
before insert or update on public.external_activity_links
for each row execute function private.enforce_external_manual_link_integrity();

create trigger trg_external_connections_updated
before update on public.external_connections
for each row execute function public.set_updated_at();
create trigger trg_external_activity_observations_updated
before update on public.external_activity_observations
for each row execute function public.set_updated_at();
create trigger trg_verified_activities_updated
before update on public.verified_activities
for each row execute function public.set_updated_at();
create trigger trg_external_activity_links_updated
before update on public.external_activity_links
for each row execute function public.set_updated_at();

alter table public.external_connections enable row level security;
alter table public.external_activity_observations enable row level security;
alter table public.verified_activities enable row level security;
alter table public.verified_activity_observations enable row level security;
alter table public.external_activity_links enable row level security;

-- Client access is read-only. Provider ingestion/matching will be server-side.
revoke all on table public.external_connections from anon, authenticated;
revoke all on table public.external_activity_observations from anon, authenticated;
revoke all on table public.verified_activities from anon, authenticated;
revoke all on table public.verified_activity_observations from anon, authenticated;
revoke all on table public.external_activity_links from anon, authenticated;

grant select on table public.external_connections to authenticated;
grant select on table public.external_activity_observations to authenticated;
grant select on table public.verified_activities to authenticated;
grant select on table public.verified_activity_observations to authenticated;
grant select on table public.external_activity_links to authenticated;

create policy external_connections_owner_select
on public.external_connections for select
to authenticated
using (
  exists (
    select 1 from public.families f
    where f.id = external_connections.family_id
      and f.owner_user_id = (select auth.uid())
  )
);

create policy external_activity_observations_owner_select
on public.external_activity_observations for select
to authenticated
using (
  exists (
    select 1 from public.families f
    where f.id = external_activity_observations.family_id
      and f.owner_user_id = (select auth.uid())
  )
);

create policy verified_activities_owner_select
on public.verified_activities for select
to authenticated
using (
  exists (
    select 1 from public.families f
    where f.id = verified_activities.family_id
      and f.owner_user_id = (select auth.uid())
  )
);

create policy verified_activity_observations_owner_select
on public.verified_activity_observations for select
to authenticated
using (
  exists (
    select 1 from public.families f
    where f.id = verified_activity_observations.family_id
      and f.owner_user_id = (select auth.uid())
  )
);

create policy external_activity_links_owner_select
on public.external_activity_links for select
to authenticated
using (
  exists (
    select 1 from public.families f
    where f.id = external_activity_links.family_id
      and f.owner_user_id = (select auth.uid())
  )
);
