-- Workout Tracker Profile Recovery Mode
-- Parent-authorised Injury / Illness recovery periods without rewriting weekly plans.

create table if not exists public.profile_recovery_periods (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  mode text not null check (mode in ('injury', 'illness')),
  started_on date not null,
  ended_on date,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profile_recovery_periods_date_order check (ended_on is null or ended_on >= started_on)
);

create index if not exists profile_recovery_periods_profile_dates_idx
  on public.profile_recovery_periods(profile_id, started_on desc);

create unique index if not exists profile_recovery_periods_one_active_idx
  on public.profile_recovery_periods(profile_id)
  where ended_at is null;

alter table public.profile_recovery_periods enable row level security;

drop policy if exists profile_recovery_periods_owner_select on public.profile_recovery_periods;
create policy profile_recovery_periods_owner_select
on public.profile_recovery_periods
for select
to authenticated
using (
  exists (
    select 1
    from public.families f
    where f.id = profile_recovery_periods.family_id
      and f.owner_user_id = (select auth.uid())
  )
);

revoke all on public.profile_recovery_periods from anon;
grant select on public.profile_recovery_periods to authenticated;

create or replace function public.set_profile_recovery_mode(
  p_profile_id uuid,
  p_mode text,
  p_effective_on date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_family_id uuid;
  v_mode text;
  v_effective_on date := coalesce(p_effective_on, current_date);
  v_active public.profile_recovery_periods%rowtype;
  v_created public.profile_recovery_periods%rowtype;
begin
  select p.family_id into v_family_id
  from public.profiles p
  join public.families f on f.id = p.family_id
  where p.id = p_profile_id
    and p.archived = false
    and f.owner_user_id = auth.uid();

  if v_family_id is null then
    raise exception 'Profile not found or not authorised';
  end if;

  v_mode := lower(trim(coalesce(p_mode, '')));
  if v_mode in ('', 'normal', 'off', 'none') then
    v_mode := null;
  elsif v_mode not in ('injury', 'illness') then
    raise exception 'Invalid recovery mode';
  end if;

  select * into v_active
  from public.profile_recovery_periods
  where profile_id = p_profile_id
    and ended_at is null
  order by started_at desc
  limit 1
  for update;

  if v_active.id is not null and v_active.mode = v_mode then
    return jsonb_build_object('mode', v_active.mode, 'period_id', v_active.id, 'state', 'unchanged');
  end if;

  if v_active.id is not null then
    update public.profile_recovery_periods
    set ended_on = greatest(v_active.started_on, v_effective_on),
        ended_at = now(),
        updated_at = now()
    where id = v_active.id;
  end if;

  if v_mode is null then
    return jsonb_build_object('mode', 'normal', 'period_id', null, 'state', 'ended');
  end if;

  insert into public.profile_recovery_periods (family_id, profile_id, mode, started_on)
  values (v_family_id, p_profile_id, v_mode, v_effective_on)
  returning * into v_created;

  return jsonb_build_object('mode', v_created.mode, 'period_id', v_created.id, 'state', 'active');
end;
$$;

revoke all on function public.set_profile_recovery_mode(uuid, text, date) from public;
grant execute on function public.set_profile_recovery_mode(uuid, text, date) to authenticated;
