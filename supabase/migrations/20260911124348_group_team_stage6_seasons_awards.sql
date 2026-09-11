-- Workout Tracker Group & Team Ecosystem Stage 6
-- Calendar-month + fixed 8-week Group seasons with frozen standings and explicit progress awards.
-- Additive only: existing workout, Assessment, plan, XP, Consistency and Improvement history is not rewritten.

create table if not exists public.profile_period_improvement_baselines (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  period_type text not null check (period_type in ('month','season')),
  period_start date not null,
  baseline_json jsonb not null default '{}'::jsonb,
  score_version smallint not null default 1 check (score_version > 0),
  created_at timestamptz not null default now(),
  primary key (profile_id, period_type, period_start, score_version),
  check (jsonb_typeof(baseline_json) = 'object')
);

create index if not exists profile_period_improvement_baselines_lookup_idx
  on public.profile_period_improvement_baselines(profile_id, period_type, period_start desc, score_version);

alter table public.profile_period_improvement_baselines enable row level security;
revoke all on table public.profile_period_improvement_baselines from public, anon, authenticated;

create table if not exists public.group_period_results (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  membership_id uuid not null,
  period_type text not null check (period_type in ('month','season')),
  period_start date not null,
  period_end date not null,
  season_number integer,
  eligible_from date not null,
  eligible_through date not null,
  xp bigint not null default 0 check (xp >= 0),
  planned_days smallint not null default 0 check (planned_days >= 0),
  completed_days smallint not null default 0 check (completed_days >= 0 and completed_days <= planned_days),
  consistency_pct numeric(5,1),
  consistency_state text not null,
  improvement_pct numeric(5,1),
  improvement_metric_count smallint not null default 0 check (improvement_metric_count between 0 and 200),
  improvement_state text not null,
  score_version smallint not null default 1 check (score_version > 0),
  nickname text not null,
  avatar_id text not null default '',
  avatar_frame text not null default '',
  avatar_frames_enabled boolean not null default true,
  frozen_at timestamptz not null default now(),
  calculated_at timestamptz not null default now(),
  check (period_end >= period_start),
  check (eligible_from <= eligible_through),
  check (eligible_from <= period_end and eligible_through >= period_start),
  check (
    (period_type = 'month' and season_number is null and extract(day from period_start) = 1)
    or
    (period_type = 'season' and season_number >= 1 and extract(isodow from period_start) = 1 and period_end = period_start + 55)
  ),
  check (consistency_pct is null or consistency_pct between 0 and 100),
  check (improvement_pct is null or improvement_pct between -50 and 50),
  check (consistency_state in ('scored','no_planned_days','schedule_unavailable','not_started')),
  check (improvement_state in ('scored','no_current_performance','no_comparable_baseline','not_started')),
  check (
    (improvement_state = 'scored' and improvement_pct is not null and improvement_metric_count > 0)
    or
    (improvement_state <> 'scored' and improvement_pct is null and improvement_metric_count = 0)
  ),
  check (nickname = btrim(nickname) and char_length(nickname) between 1 and 32 and nickname !~ '[\r\n\t]'),
  check (char_length(avatar_id) <= 160),
  check (char_length(avatar_frame) <= 80),
  unique (group_id, membership_id, period_type, period_start, score_version)
);

create index if not exists group_period_results_lookup_idx
  on public.group_period_results(group_id, period_type, period_start desc, score_version);

alter table public.group_period_results enable row level security;
revoke all on table public.group_period_results from public, anon, authenticated;
grant select on table public.group_period_results to authenticated;

create policy group_period_results_member_select
  on public.group_period_results
  for select
  to authenticated
  using (group_id in (select private.current_user_group_ids()));

create table if not exists public.group_progress_awards (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  membership_id uuid not null,
  period_type text not null check (period_type in ('month','season')),
  period_start date not null,
  period_end date not null,
  season_number integer,
  award_type text not null check (award_type in (
    'monthly_xp','monthly_consistency','monthly_improvement',
    'season_xp','season_consistency','season_improvement','season_finisher'
  )),
  rank smallint,
  score_value numeric,
  score_unit text not null check (score_unit in ('xp','pct','participation')),
  score_version smallint not null default 1 check (score_version > 0),
  nickname text not null,
  avatar_id text not null default '',
  avatar_frame text not null default '',
  avatar_frames_enabled boolean not null default true,
  awarded_at timestamptz not null default now(),
  check (period_end >= period_start),
  check (
    (period_type = 'month' and season_number is null and award_type like 'monthly_%')
    or
    (period_type = 'season' and season_number >= 1 and award_type like 'season_%')
  ),
  check (
    (award_type = 'season_finisher' and rank is null and score_value is null and score_unit = 'participation')
    or
    (award_type <> 'season_finisher' and rank = 1 and score_value is not null and score_unit in ('xp','pct'))
  ),
  check (nickname = btrim(nickname) and char_length(nickname) between 1 and 32 and nickname !~ '[\r\n\t]'),
  check (char_length(avatar_id) <= 160),
  check (char_length(avatar_frame) <= 80),
  unique (group_id, membership_id, period_type, period_start, award_type, score_version)
);

create index if not exists group_progress_awards_lookup_idx
  on public.group_progress_awards(group_id, awarded_at desc, period_start desc);

alter table public.group_progress_awards enable row level security;
revoke all on table public.group_progress_awards from public, anon, authenticated;
grant select on table public.group_progress_awards to authenticated;

create policy group_progress_awards_member_select
  on public.group_progress_awards
  for select
  to authenticated
  using (group_id in (select private.current_user_group_ids()));
