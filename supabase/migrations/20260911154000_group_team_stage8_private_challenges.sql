-- Workout Tracker Group & Team Ecosystem Stage 8
-- Private, bounded Group Challenges with server-controlled rules and reward pools.
-- Additive only: no existing workout, Assessment or planned-block history is rewritten.

create table if not exists public.group_challenges (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  created_by_membership_id uuid not null references public.group_memberships(id) on delete restrict,
  template_key text not null check (template_key in (
    'xp_100','xp_175','xp_250',
    'consistency_75','consistency_85','consistency_95',
    'improvement_2','improvement_5','improvement_8'
  )),
  metric_type text not null check (metric_type in ('xp_rate','consistency','improvement')),
  title text not null,
  description text not null default '',
  target_value numeric(8,1) not null check (target_value > 0),
  target_unit text not null check (target_unit in ('xp_per_athlete_week','pct')),
  start_date date not null,
  end_date date not null,
  duration_days smallint not null check (duration_days in (7,14,28,42)),
  reward_pool_xp smallint not null check (reward_pool_xp between 0 and 200),
  rules_version smallint not null default 1 check (rules_version > 0),
  outcome text check (outcome in ('completed','missed','unavailable')),
  final_value numeric(10,1),
  final_reason text,
  final_evidence jsonb not null default '{}'::jsonb,
  finalized_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (title = btrim(title) and char_length(title) between 2 and 80 and title !~ '[\r\n\t]'),
  check (description = btrim(description) and char_length(description) <= 240 and description !~ '[\r\n\t]'),
  check (end_date = start_date + (duration_days::integer - 1)),
  check (jsonb_typeof(final_evidence) = 'object'),
  check (
    (template_key = 'xp_100' and metric_type = 'xp_rate' and target_value = 100 and target_unit = 'xp_per_athlete_week') or
    (template_key = 'xp_175' and metric_type = 'xp_rate' and target_value = 175 and target_unit = 'xp_per_athlete_week') or
    (template_key = 'xp_250' and metric_type = 'xp_rate' and target_value = 250 and target_unit = 'xp_per_athlete_week') or
    (template_key = 'consistency_75' and metric_type = 'consistency' and target_value = 75 and target_unit = 'pct') or
    (template_key = 'consistency_85' and metric_type = 'consistency' and target_value = 85 and target_unit = 'pct') or
    (template_key = 'consistency_95' and metric_type = 'consistency' and target_value = 95 and target_unit = 'pct') or
    (template_key = 'improvement_2' and metric_type = 'improvement' and target_value = 2 and target_unit = 'pct') or
    (template_key = 'improvement_5' and metric_type = 'improvement' and target_value = 5 and target_unit = 'pct') or
    (template_key = 'improvement_8' and metric_type = 'improvement' and target_value = 8 and target_unit = 'pct')
  ),
  check (
    reward_pool_xp =
      (case duration_days when 7 then 20 when 14 then 30 when 28 then 40 when 42 then 50 end)
      *
      (case
        when template_key in ('xp_100','consistency_75','improvement_2') then 1
        when template_key in ('xp_175','consistency_85','improvement_5') then 2
        when template_key in ('xp_250','consistency_95','improvement_8') then 3
      end)
  ),
  check (
    (outcome is null and finalized_at is null and final_value is null and final_reason is null)
    or
    (outcome in ('completed','missed') and finalized_at is not null and final_value is not null and final_reason = 'scored')
    or
    (outcome = 'unavailable' and finalized_at is not null and final_value is null and final_reason is not null)
  ),
  check (not (cancelled_at is not null and finalized_at is not null))
);

create index if not exists group_challenges_group_window_idx
  on public.group_challenges(group_id, start_date desc, end_date desc);
create index if not exists group_challenges_open_idx
  on public.group_challenges(group_id, metric_type, start_date, end_date)
  where cancelled_at is null and finalized_at is null;

alter table public.group_challenges enable row level security;
revoke all on table public.group_challenges from public, anon, authenticated;

create table if not exists public.profile_group_challenge_improvement_baselines (
  challenge_id uuid not null references public.group_challenges(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  baseline_json jsonb not null default '{}'::jsonb,
  score_version smallint not null default 1 check (score_version > 0),
  created_at timestamptz not null default now(),
  primary key (challenge_id, profile_id, score_version),
  check (jsonb_typeof(baseline_json) = 'object')
);

create index if not exists profile_group_challenge_baseline_profile_idx
  on public.profile_group_challenge_improvement_baselines(profile_id, created_at desc);

alter table public.profile_group_challenge_improvement_baselines enable row level security;
revoke all on table public.profile_group_challenge_improvement_baselines from public, anon, authenticated;

create table if not exists public.group_challenge_rewards (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.group_challenges(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  membership_id uuid not null references public.group_memberships(id) on delete restrict,
  family_id uuid not null references public.families(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  xp_awarded smallint not null check (xp_awarded between 1 and 30),
  awarded_on date not null,
  nickname text not null,
  avatar_id text not null default '',
  avatar_frame text not null default '',
  avatar_frames_enabled boolean not null default true,
  awarded_at timestamptz not null default now(),
  check (nickname = btrim(nickname) and char_length(nickname) between 1 and 32 and nickname !~ '[\r\n\t]'),
  check (char_length(avatar_id) <= 160),
  check (char_length(avatar_frame) <= 80),
  unique (challenge_id, membership_id)
);

create index if not exists group_challenge_rewards_profile_idx
  on public.group_challenge_rewards(profile_id, awarded_on, awarded_at);
create index if not exists group_challenge_rewards_group_idx
  on public.group_challenge_rewards(group_id, challenge_id);

alter table public.group_challenge_rewards enable row level security;
revoke all on table public.group_challenge_rewards from public, anon, authenticated;

-- The reward table above is the authority. A minimal mirror is kept inside profile plan metadata
-- only so the existing shared XP engine can consume Challenge XP without a second XP system.
-- Browser plan writes cannot forge or erase this mirror because this helper always rebuilds it
-- from the server-only reward table.
create or replace function private.group_challenge_rewards_for_profile(p_profile_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'challengeId', r.challenge_id::text,
        'awardedOn', r.awarded_on::text,
        'xpAwarded', r.xp_awarded
      )
      order by r.awarded_on, r.awarded_at, r.id
    ),
    '[]'::jsonb
  )
  from public.group_challenge_rewards r
  where r.profile_id = p_profile_id
$$;

revoke all on function private.group_challenge_rewards_for_profile(uuid) from public, anon, authenticated;

create or replace function private.apply_group_challenge_rewards_to_plan(p_profile_id uuid, p_plan jsonb)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_set(
    coalesce(p_plan, '{}'::jsonb),
    '{meta}',
    coalesce(p_plan->'meta', '{}'::jsonb)
      || jsonb_build_object(
        'groupChallengeRewards',
        private.group_challenge_rewards_for_profile(p_profile_id)
      ),
    true
  )
$$;

revoke all on function private.apply_group_challenge_rewards_to_plan(uuid, jsonb) from public, anon, authenticated;

create or replace function private.preserve_profile_group_challenge_rewards()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.plan_json := private.apply_group_challenge_rewards_to_plan(new.id, coalesce(new.plan_json, '{}'::jsonb));
  return new;
end
$$;

revoke all on function private.preserve_profile_group_challenge_rewards() from public, anon, authenticated;

drop trigger if exists profiles_preserve_group_challenge_rewards_trigger on public.profiles;
create trigger profiles_preserve_group_challenge_rewards_trigger
before insert or update of plan_json on public.profiles
for each row
execute function private.preserve_profile_group_challenge_rewards();

create or replace function private.sync_group_challenge_reward_profile_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
begin
  v_profile_id := case when tg_op = 'DELETE' then old.profile_id else new.profile_id end;

  update public.profiles p
  set plan_json = private.apply_group_challenge_rewards_to_plan(p.id, coalesce(p.plan_json, '{}'::jsonb))
  where p.id = v_profile_id;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$$;

revoke all on function private.sync_group_challenge_reward_profile_plan() from public, anon, authenticated;

drop trigger if exists group_challenge_rewards_profile_plan_trigger on public.group_challenge_rewards;
create trigger group_challenge_rewards_profile_plan_trigger
after insert or update or delete on public.group_challenge_rewards
for each row
execute function private.sync_group_challenge_reward_profile_plan();

-- Stage 4 originally treated every plan_json metadata write as a schedule change. Challenge XP
-- introduces protected metadata-only updates, so tighten that capture rule to the actual minimal
-- Consistency schedule. Genuine plan schedule changes still become effective the following London day.
create or replace function private.capture_profile_consistency_schedule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_effective_date date;
  v_new_schedule jsonb;
  v_old_schedule jsonb;
begin
  v_new_schedule := private.consistency_schedule_from_plan(coalesce(new.plan_json, '{}'::jsonb));

  if tg_op = 'INSERT' then
    v_effective_date := ((now() at time zone 'Europe/London')::date);
  else
    v_old_schedule := private.consistency_schedule_from_plan(coalesce(old.plan_json, '{}'::jsonb));
    if v_new_schedule is not distinct from v_old_schedule then
      return new;
    end if;
    v_effective_date := ((now() at time zone 'Europe/London')::date + 1);
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
    v_new_schedule,
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
