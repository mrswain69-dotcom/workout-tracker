-- Verification Integrations — Stage 7.1 connection management architecture
-- Provider connections remain server-authority. Users may read preferences, while
-- authenticated preference changes are applied through a JWT-protected Edge Function.

alter table public.external_connections
  add column if not exists provider_account_label text;

alter table public.external_connections
  drop constraint if exists external_connections_provider_account_label_check;

alter table public.external_connections
  add constraint external_connections_provider_account_label_check
  check (provider_account_label is null or char_length(provider_account_label) <= 240);

create table if not exists public.external_connection_preferences (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('garmin','strava','apple_health','health_connect','google_fit_legacy')),
  activity_data_enabled boolean not null default true,
  performance_metrics_enabled boolean not null default true,
  heart_rate_enabled boolean not null default false,
  route_location_enabled boolean not null default false,
  health_recovery_enabled boolean not null default false,
  include_private_activities boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, provider)
);

create index if not exists external_connection_preferences_family_profile_idx
  on public.external_connection_preferences(family_id, profile_id, provider);

create or replace function private.enforce_external_connection_preferences_integrity()
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
    raise exception 'External connection preferences must belong to an active profile in the supplied family';
  end if;

  if tg_op = 'UPDATE' and (
    old.family_id is distinct from new.family_id or
    old.profile_id is distinct from new.profile_id or
    old.provider is distinct from new.provider
  ) then
    raise exception 'External connection preference identity cannot be reassigned';
  end if;

  return new;
end
$$;

revoke all on function private.enforce_external_connection_preferences_integrity() from public;

drop trigger if exists trg_external_connection_preferences_integrity on public.external_connection_preferences;
create trigger trg_external_connection_preferences_integrity
before insert or update on public.external_connection_preferences
for each row execute function private.enforce_external_connection_preferences_integrity();

drop trigger if exists trg_external_connection_preferences_updated on public.external_connection_preferences;
create trigger trg_external_connection_preferences_updated
before update on public.external_connection_preferences
for each row execute function public.set_updated_at();

alter table public.external_connection_preferences enable row level security;

revoke all on table public.external_connection_preferences from anon, authenticated;
grant select on table public.external_connection_preferences to authenticated;

drop policy if exists external_connection_preferences_owner_select on public.external_connection_preferences;
create policy external_connection_preferences_owner_select
on public.external_connection_preferences for select
to authenticated
using (
  exists (
    select 1 from public.families f
    where f.id = external_connection_preferences.family_id
      and f.owner_user_id = (select auth.uid())
  )
);

comment on table public.external_connection_preferences is
  'Owner-readable provider stream preferences. Mutations are server-authority so disabling a stream can scrub already persisted optional evidence.';
