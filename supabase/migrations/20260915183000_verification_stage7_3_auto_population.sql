-- Verification Integrations — Stage 7.3 safe automatic population
-- Stores only server-side suppression/undo authority. Imported field provenance remains
-- inside the Workout Tracker log JSON beside the values it governs.

create table if not exists public.external_activity_population_controls (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  verified_activity_id uuid not null references public.verified_activities(id) on delete cascade,
  suppressed_at timestamptz not null default now(),
  suppress_reason text not null default 'user_undo',
  actor_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, verified_activity_id),
  check (suppress_reason in ('user_undo'))
);

create index if not exists external_activity_population_controls_family_profile_idx
  on public.external_activity_population_controls(family_id, profile_id);

alter table public.external_activity_population_controls enable row level security;
revoke all on table public.external_activity_population_controls from anon, authenticated;
grant all on table public.external_activity_population_controls to service_role;

create or replace function public.enforce_external_activity_population_control_identity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  verified_family uuid;
  verified_profile uuid;
begin
  select family_id, profile_id
    into verified_family, verified_profile
    from public.verified_activities
    where id = new.verified_activity_id;

  if verified_family is null or verified_profile is null then
    raise exception 'Verified activity is unavailable';
  end if;

  if verified_family <> new.family_id or verified_profile <> new.profile_id then
    raise exception 'Population control identity must match verified activity identity';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_external_activity_population_control_identity() from public, anon, authenticated;
grant execute on function public.enforce_external_activity_population_control_identity() to service_role;

drop trigger if exists external_activity_population_controls_identity_guard
  on public.external_activity_population_controls;
create trigger external_activity_population_controls_identity_guard
before insert or update on public.external_activity_population_controls
for each row execute function public.enforce_external_activity_population_control_identity();

comment on table public.external_activity_population_controls is
  'Server-only authority that prevents a user-undone verified activity from being automatically populated into Workout Tracker again.';
comment on column public.external_activity_population_controls.suppressed_at is
  'Timestamp from which Stage 7.3 automatic Workout Tracker population is suppressed for this verified activity.';
