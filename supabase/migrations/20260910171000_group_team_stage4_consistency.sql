-- Workout Tracker Group & Team Ecosystem Stage 4
-- Truthful Consistency = completed planned performance/recovery days / planned days.
-- Additive only: no workout, Assessment or profile-plan history is rewritten.

create or replace function private.consistency_schedule_from_plan(p_plan jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_day text;
  v_blocks jsonb;
  v_result jsonb := '{}'::jsonb;
begin
  foreach v_day in array array['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] loop
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', btrim(block->>'id'),
          'typeId', lower(btrim(block->>'typeId'))
        )
        order by ord
      ),
      '[]'::jsonb
    )
    into v_blocks
    from jsonb_array_elements(
      coalesce(p_plan->'blocksByWeekday'->v_day, '[]'::jsonb)
    ) with ordinality as x(block, ord)
    where lower(btrim(coalesce(block->>'typeId', ''))) = any(array[
      'strength','hiit','box','cardio','run','swim','walk','row','cycle','bike','duration','session','recovery'
    ]::text[])
      and btrim(coalesce(block->>'id', '')) <> ''
      and lower(coalesce(block->>'cancelled', 'false')) <> 'true';

    v_result := v_result || jsonb_build_object(v_day, v_blocks);
  end loop;

  return v_result;
end
$$;

revoke all on function private.consistency_schedule_from_plan(jsonb) from public, anon, authenticated;

create table if not exists public.profile_consistency_schedule_snapshots (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  effective_date date not null,
  schedule_json jsonb not null,
  plan_hash text not null,
  created_at timestamptz not null default now(),
  primary key (profile_id, effective_date),
  check (jsonb_typeof(schedule_json) = 'object'),
  check (char_length(plan_hash) = 32)
);

create index if not exists profile_consistency_schedule_snapshots_lookup_idx
  on public.profile_consistency_schedule_snapshots(profile_id, effective_date desc);

alter table public.profile_consistency_schedule_snapshots enable row level security;
revoke all on table public.profile_consistency_schedule_snapshots from public, anon, authenticated;

insert into public.profile_consistency_schedule_snapshots (
  profile_id,
  effective_date,
  schedule_json,
  plan_hash
)
select
  p.id,
  ((now() at time zone 'Europe/London')::date),
  private.consistency_schedule_from_plan(coalesce(p.plan_json, '{}'::jsonb)),
  md5(coalesce(p.plan_json, '{}'::jsonb)::text)
from public.profiles p
on conflict (profile_id, effective_date) do nothing;

create or replace function private.capture_profile_consistency_schedule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_effective_date date;
begin
  if tg_op = 'INSERT' then
    v_effective_date := ((now() at time zone 'Europe/London')::date);
  elsif new.plan_json is distinct from old.plan_json then
    -- A plan changed during a day becomes the locked schedule from the next day.
    -- This prevents same-day/past denominator edits from rewriting Consistency.
    v_effective_date := ((now() at time zone 'Europe/London')::date + 1);
  else
    return new;
  end if;

  insert into public.profile_consistency_schedule_snapshots (
    profile_id,
    effective_date,
    schedule_json,
    plan_hash,
    created_at
  ) values (
    new.id,
    v_effective_date,
    private.consistency_schedule_from_plan(coalesce(new.plan_json, '{}'::jsonb)),
    md5(coalesce(new.plan_json, '{}'::jsonb)::text),
    now()
  )
  on conflict (profile_id, effective_date)
  do update set
    schedule_json = excluded.schedule_json,
    plan_hash = excluded.plan_hash,
    created_at = excluded.created_at;

  return new;
end
$$;

revoke all on function private.capture_profile_consistency_schedule() from public, anon, authenticated;

drop trigger if exists profiles_consistency_schedule_snapshot_trigger on public.profiles;
create trigger profiles_consistency_schedule_snapshot_trigger
after insert or update of plan_json on public.profiles
for each row
execute function private.capture_profile_consistency_schedule();

create table if not exists public.group_weekly_consistency_results (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  membership_id uuid not null,
  week_start date not null,
  week_end date not null,
  eligible_from date not null,
  eligible_through date not null,
  planned_days smallint not null default 0,
  completed_days smallint not null default 0,
  consistency_pct numeric(5,1),
  score_version smallint not null default 1 check (score_version > 0),
  nickname text not null,
  avatar_id text not null default '',
  avatar_frame text not null default '',
  avatar_frames_enabled boolean not null default true,
  frozen_at timestamptz not null default now(),
  calculated_at timestamptz not null default now(),
  check (week_end = week_start + 6),
  check (eligible_from <= eligible_through),
  check (eligible_from <= week_end and eligible_through >= week_start),
  check (planned_days between 0 and 7),
  check (completed_days between 0 and planned_days),
  check (
    (planned_days = 0 and consistency_pct is null)
    or
    (planned_days > 0 and consistency_pct between 0 and 100)
  ),
  check (nickname = btrim(nickname) and char_length(nickname) between 1 and 32 and nickname !~ '[\r\n\t]'),
  check (char_length(avatar_id) <= 160),
  check (char_length(avatar_frame) <= 80),
  unique (group_id, membership_id, week_start, score_version)
);

create index if not exists group_weekly_consistency_results_lookup_idx
  on public.group_weekly_consistency_results(group_id, week_start desc, score_version);

alter table public.group_weekly_consistency_results enable row level security;

revoke all on table public.group_weekly_consistency_results from public, anon, authenticated;
grant select on table public.group_weekly_consistency_results to authenticated;

create policy group_weekly_consistency_results_member_select
  on public.group_weekly_consistency_results
  for select
  to authenticated
  using (group_id in (select private.current_user_group_ids()));
