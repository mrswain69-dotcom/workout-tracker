-- Verification Integrations — Stage 2 Strava server authority
-- Server-only OAuth/token/webhook persistence. No existing workout data is rewritten.

create table public.external_connection_access_tokens (
  connection_id uuid primary key references public.external_connections(id) on delete cascade,
  access_token text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(access_token) between 16 and 2048)
);

create table public.external_connection_refresh_tokens (
  connection_id uuid primary key references public.external_connections(id) on delete cascade,
  refresh_token text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(refresh_token) between 16 and 2048)
);

create table public.strava_oauth_states (
  id uuid primary key default gen_random_uuid(),
  state_hash text not null unique,
  family_id uuid not null references public.families(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  requested_scopes jsonb not null default '["activity:read"]'::jsonb check (jsonb_typeof(requested_scopes) = 'array'),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  check (state_hash ~ '^[0-9a-f]{64}$')
);
create index strava_oauth_states_active_idx
  on public.strava_oauth_states(expires_at)
  where consumed_at is null;
create index strava_oauth_states_profile_idx
  on public.strava_oauth_states(profile_id, created_at desc);

create table public.strava_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  subscription_id bigint not null,
  owner_id bigint not null,
  object_type text not null check (object_type in ('activity','athlete')),
  object_id bigint not null,
  aspect_type text not null check (aspect_type in ('create','update','delete')),
  updates jsonb not null default '{}'::jsonb check (jsonb_typeof(updates) = 'object'),
  event_time timestamptz not null,
  connection_id uuid references public.external_connections(id) on delete set null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text,
  check (char_length(event_key) between 16 and 200),
  check (processing_error is null or char_length(processing_error) <= 1000)
);
create index strava_webhook_events_unprocessed_idx
  on public.strava_webhook_events(received_at)
  where processed_at is null;
create index strava_webhook_events_owner_idx
  on public.strava_webhook_events(owner_id, event_time desc);

create or replace function private.enforce_strava_token_connection()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.external_connections c
    where c.id = new.connection_id
      and c.provider = 'strava'
  ) then
    raise exception 'Strava token must belong to a Strava connection';
  end if;
  return new;
end
$$;

create or replace function private.enforce_strava_oauth_state_integrity()
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
    raise exception 'OAuth state profile does not belong to supplied family or is archived';
  end if;

  if tg_op = 'UPDATE' and (
    old.family_id is distinct from new.family_id or
    old.profile_id is distinct from new.profile_id or
    old.state_hash is distinct from new.state_hash
  ) then
    raise exception 'OAuth state identity cannot be reassigned';
  end if;

  return new;
end
$$;

revoke all on function private.enforce_strava_token_connection() from public;
revoke all on function private.enforce_strava_oauth_state_integrity() from public;

create trigger trg_external_connection_access_tokens_strava
before insert or update on public.external_connection_access_tokens
for each row execute function private.enforce_strava_token_connection();
create trigger trg_external_connection_refresh_tokens_strava
before insert or update on public.external_connection_refresh_tokens
for each row execute function private.enforce_strava_token_connection();
create trigger trg_strava_oauth_states_integrity
before insert or update on public.strava_oauth_states
for each row execute function private.enforce_strava_oauth_state_integrity();

create trigger trg_external_connection_access_tokens_updated
before update on public.external_connection_access_tokens
for each row execute function public.set_updated_at();
create trigger trg_external_connection_refresh_tokens_updated
before update on public.external_connection_refresh_tokens
for each row execute function public.set_updated_at();

alter table public.external_connection_access_tokens enable row level security;
alter table public.external_connection_refresh_tokens enable row level security;
alter table public.strava_oauth_states enable row level security;
alter table public.strava_webhook_events enable row level security;

-- These tables are server authority only. Browser roles receive no privileges.
revoke all on table public.external_connection_access_tokens from public, anon, authenticated;
revoke all on table public.external_connection_refresh_tokens from public, anon, authenticated;
revoke all on table public.strava_oauth_states from public, anon, authenticated;
revoke all on table public.strava_webhook_events from public, anon, authenticated;

grant select, insert, update, delete on table public.external_connection_access_tokens to service_role;
grant select, insert, update, delete on table public.external_connection_refresh_tokens to service_role;
grant select, insert, update, delete on table public.strava_oauth_states to service_role;
grant select, insert, update, delete on table public.strava_webhook_events to service_role;

-- Explicit deny policies document the client boundary and avoid accidental future access.
create policy external_connection_access_tokens_no_client_access
on public.external_connection_access_tokens for all
to authenticated
using (false)
with check (false);

create policy external_connection_refresh_tokens_no_client_access
on public.external_connection_refresh_tokens for all
to authenticated
using (false)
with check (false);

create policy strava_oauth_states_no_client_access
on public.strava_oauth_states for all
to authenticated
using (false)
with check (false);

create policy strava_webhook_events_no_client_access
on public.strava_webhook_events for all
to authenticated
using (false)
with check (false);
