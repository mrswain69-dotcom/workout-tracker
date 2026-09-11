-- Workout Tracker Group & Team Ecosystem Stage 3
-- Weekly XP history scope and safe frozen weekly result snapshots.
-- Additive only: does not rewrite workout, Assessment or profile-plan history.

alter table public.groups
  add column if not exists competition_start_date date;

update public.groups
set competition_start_date = (created_at at time zone 'Europe/London')::date
where competition_start_date is null;

alter table public.groups
  alter column competition_start_date set default ((now() at time zone 'Europe/London')::date),
  alter column competition_start_date set not null;

alter table public.groups
  add column if not exists xp_history_scope text not null default 'group_start';

alter table public.groups
  drop constraint if exists groups_xp_history_scope_check;
alter table public.groups
  add constraint groups_xp_history_scope_check
  check (xp_history_scope in ('group_start', 'all_history'));

create table if not exists public.group_weekly_xp_results (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  membership_id uuid not null,
  week_start date not null,
  week_end date not null,
  scope_mode text not null check (scope_mode in ('group_start', 'all_history')),
  eligible_from date not null,
  xp integer not null default 0 check (xp >= 0),
  score_version smallint not null default 1 check (score_version > 0),
  nickname text not null,
  avatar_id text not null default '',
  avatar_frame text not null default '',
  avatar_frames_enabled boolean not null default true,
  frozen_at timestamptz not null default now(),
  calculated_at timestamptz not null default now(),
  check (week_end = week_start + 6),
  check (nickname = btrim(nickname) and char_length(nickname) between 1 and 32 and nickname !~ '[\r\n\t]'),
  check (char_length(avatar_id) <= 160),
  check (char_length(avatar_frame) <= 80),
  unique (group_id, membership_id, week_start, scope_mode, score_version)
);

create index if not exists group_weekly_xp_results_lookup_idx
  on public.group_weekly_xp_results(group_id, scope_mode, week_start desc, score_version);

alter table public.group_weekly_xp_results enable row level security;

revoke all on table public.group_weekly_xp_results from public, anon, authenticated;
grant select on table public.group_weekly_xp_results to authenticated;

create policy group_weekly_xp_results_member_select
  on public.group_weekly_xp_results
  for select
  to authenticated
  using (group_id in (select private.current_user_group_ids()));

create or replace function public.group_update_xp_history_scope(
  p_group_id uuid,
  p_scope text
)
returns table (xp_history_scope text, competition_start_date date)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_scope text := lower(btrim(coalesce(p_scope, '')));
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from private.current_user_admin_group_ids() x
    where x = p_group_id
  ) then
    raise exception 'Group admin access required';
  end if;

  if v_scope not in ('group_start', 'all_history') then
    raise exception 'Invalid XP history scope';
  end if;

  return query
  update public.groups g
  set xp_history_scope = v_scope,
      updated_at = now()
  where g.id = p_group_id
    and g.status = 'active'
  returning g.xp_history_scope, g.competition_start_date;

  if not found then
    raise exception 'Group is not active';
  end if;
end
$$;

revoke all on function public.group_update_xp_history_scope(uuid, text) from public, anon;
grant execute on function public.group_update_xp_history_scope(uuid, text) to authenticated;
