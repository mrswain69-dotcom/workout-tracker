-- Avatar Identity Views
-- Prospective-only selection history and privacy-scoped group identity summaries.

create table if not exists public.avatar_selection_periods (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  avatar_id text not null check (char_length(btrim(avatar_id)) between 1 and 160),
  selected_at timestamptz not null default now(),
  deselected_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint avatar_selection_periods_valid_range
    check (deselected_at is null or deselected_at >= selected_at)
);

create index if not exists avatar_selection_periods_profile_timeline_idx
  on public.avatar_selection_periods (profile_id, selected_at desc);

create index if not exists avatar_selection_periods_avatar_timeline_idx
  on public.avatar_selection_periods (profile_id, avatar_id, selected_at desc);

create unique index if not exists avatar_selection_periods_one_open_profile_idx
  on public.avatar_selection_periods (profile_id)
  where deselected_at is null;

alter table public.avatar_selection_periods enable row level security;

drop policy if exists avatar_selection_periods_owner_select
  on public.avatar_selection_periods;
create policy avatar_selection_periods_owner_select
  on public.avatar_selection_periods
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.families f
      where f.id = avatar_selection_periods.family_id
        and f.owner_user_id = (select auth.uid())
    )
  );

revoke all on table public.avatar_selection_periods from public, anon;
grant select on table public.avatar_selection_periods to authenticated;

-- Establish the release-time selection. This is a prospective starting point,
-- not a reconstruction of any earlier selection history.
insert into public.avatar_selection_periods (
  family_id,
  profile_id,
  avatar_id,
  selected_at
)
select
  p.family_id,
  p.id,
  btrim(p.plan_json #>> '{meta,avatarId}'),
  statement_timestamp()
from public.profiles p
where nullif(btrim(p.plan_json #>> '{meta,avatarId}'), '') is not null
  and not exists (
    select 1
    from public.avatar_selection_periods asp
    where asp.profile_id = p.id
      and asp.deselected_at is null
  );

create or replace function public.set_profile_avatar_identity(
  p_profile_id uuid,
  p_avatar_id text,
  p_selected_at timestamptz default null
)
returns public.avatar_selection_periods
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_current public.avatar_selection_periods%rowtype;
  v_result public.avatar_selection_periods%rowtype;
  v_avatar_id text := btrim(coalesce(p_avatar_id, ''));
  v_selected_at timestamptz := coalesce(p_selected_at, statement_timestamp());
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if char_length(v_avatar_id) < 1 or char_length(v_avatar_id) > 160 then
    raise exception 'Invalid avatar id' using errcode = '22023';
  end if;

  select p.*
  into v_profile
  from public.profiles p
  join public.families f on f.id = p.family_id
  where p.id = p_profile_id
    and f.owner_user_id = (select auth.uid())
  for update of p;

  if not found then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;

  select asp.*
  into v_current
  from public.avatar_selection_periods asp
  where asp.profile_id = p_profile_id
    and asp.deselected_at is null
  for update;

  if found and v_current.avatar_id = v_avatar_id then
    update public.profiles p
    set plan_json = jsonb_set(
      jsonb_set(coalesce(p.plan_json, '{}'::jsonb), '{meta}', coalesce(p.plan_json->'meta', '{}'::jsonb), true),
      '{meta,avatarId}',
      to_jsonb(v_avatar_id),
      true
    )
    where p.id = p_profile_id;
    return v_current;
  end if;

  if v_current.id is not null then
    v_selected_at := greatest(v_selected_at, v_current.selected_at);
    update public.avatar_selection_periods asp
    set deselected_at = v_selected_at,
        updated_at = statement_timestamp()
    where asp.id = v_current.id;
  end if;

  insert into public.avatar_selection_periods (
    family_id,
    profile_id,
    avatar_id,
    selected_at
  ) values (
    v_profile.family_id,
    v_profile.id,
    v_avatar_id,
    v_selected_at
  )
  returning * into v_result;

  update public.profiles p
  set plan_json = jsonb_set(
    jsonb_set(coalesce(p.plan_json, '{}'::jsonb), '{meta}', coalesce(p.plan_json->'meta', '{}'::jsonb), true),
    '{meta,avatarId}',
    to_jsonb(v_avatar_id),
    true
  )
  where p.id = p_profile_id;

  return v_result;
end;
$$;

revoke all on function public.set_profile_avatar_identity(uuid, text, timestamptz)
  from public, anon;
grant execute on function public.set_profile_avatar_identity(uuid, text, timestamptz)
  to authenticated;

create or replace function public.group_avatar_identity_stats(
  p_group_id uuid,
  p_membership_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.group_memberships viewer
    join public.families f on f.id = viewer.family_id
    where viewer.group_id = p_group_id
      and viewer.status = 'active'
      and f.owner_user_id = (select auth.uid())
  ) then
    raise exception 'Group access denied' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.group_member_directory target
    where target.group_id = p_group_id
      and target.membership_id = p_membership_id
  ) then
    raise exception 'Group member not found' using errcode = 'P0002';
  end if;

  select jsonb_build_object(
    'weeksWon', (
      select count(*)::integer
      from public.group_weekly_xp_results target
      where target.group_id = p_group_id
        and target.membership_id = p_membership_id
        and target.xp > 0
        and target.xp = (
          select max(peer.xp)
          from public.group_weekly_xp_results peer
          where peer.group_id = target.group_id
            and peer.week_start = target.week_start
        )
    ),
    'sharedChallengesCompleted', (
      select count(*)::integer
      from public.group_challenges challenge
      where challenge.group_id = p_group_id
        and challenge.outcome = 'completed'
        and challenge.cancelled_at is null
    ),
    'challengeRewardsEarned', (
      select count(*)::integer
      from public.group_challenge_rewards reward
      where reward.group_id = p_group_id
        and reward.membership_id = p_membership_id
    ),
    'awards', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'type', award.award_type,
          'periodType', award.period_type,
          'periodStart', award.period_start,
          'periodEnd', award.period_end,
          'seasonNumber', award.season_number,
          'rank', award.rank,
          'awardedAt', award.awarded_at
        ) order by award.awarded_at desc
      )
      from public.group_progress_awards award
      where award.group_id = p_group_id
        and award.membership_id = p_membership_id
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.group_avatar_identity_stats(uuid, uuid)
  from public, anon;
grant execute on function public.group_avatar_identity_stats(uuid, uuid)
  to authenticated;

