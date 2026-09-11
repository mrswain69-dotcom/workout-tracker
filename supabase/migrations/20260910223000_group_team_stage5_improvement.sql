-- Workout Tracker Group & Team Ecosystem Stage 5
-- Truthful Improvement = current-week compatible performance vs locked preceding 28-day self baseline.
-- Additive only: no workout, Assessment or profile-plan history is rewritten.

create table if not exists public.profile_weekly_improvement_baselines (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  week_start date not null,
  baseline_json jsonb not null default '{}'::jsonb,
  score_version smallint not null default 1 check (score_version > 0),
  created_at timestamptz not null default now(),
  primary key (profile_id, week_start, score_version),
  check (extract(isodow from week_start) = 1),
  check (jsonb_typeof(baseline_json) = 'object')
);

create index if not exists profile_weekly_improvement_baselines_lookup_idx
  on public.profile_weekly_improvement_baselines(profile_id, week_start desc, score_version);

alter table public.profile_weekly_improvement_baselines enable row level security;
revoke all on table public.profile_weekly_improvement_baselines from public, anon, authenticated;

create table if not exists public.group_weekly_improvement_results (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  membership_id uuid not null,
  week_start date not null,
  week_end date not null,
  eligible_from date not null,
  eligible_through date not null,
  improvement_pct numeric(5,1),
  metric_count smallint not null default 0,
  improved_metric_count smallint not null default 0,
  declined_metric_count smallint not null default 0,
  unchanged_metric_count smallint not null default 0,
  score_state text not null,
  score_version smallint not null default 1 check (score_version > 0),
  nickname text not null,
  avatar_id text not null default '',
  avatar_frame text not null default '',
  avatar_frames_enabled boolean not null default true,
  frozen_at timestamptz not null default now(),
  calculated_at timestamptz not null default now(),
  check (extract(isodow from week_start) = 1),
  check (week_end = week_start + 6),
  check (eligible_from <= eligible_through),
  check (eligible_from <= week_end and eligible_through >= week_start),
  check (metric_count between 0 and 200),
  check (improved_metric_count between 0 and metric_count),
  check (declined_metric_count between 0 and metric_count),
  check (unchanged_metric_count between 0 and metric_count),
  check (improved_metric_count + declined_metric_count + unchanged_metric_count = metric_count),
  check (score_state in ('scored','no_current_performance','no_comparable_baseline')),
  check (
    (score_state = 'scored' and improvement_pct between -50 and 50 and metric_count > 0)
    or
    (score_state <> 'scored' and improvement_pct is null and metric_count = 0)
  ),
  check (nickname = btrim(nickname) and char_length(nickname) between 1 and 32 and nickname !~ '[\r\n\t]'),
  check (char_length(avatar_id) <= 160),
  check (char_length(avatar_frame) <= 80),
  unique (group_id, membership_id, week_start, score_version)
);

create index if not exists group_weekly_improvement_results_lookup_idx
  on public.group_weekly_improvement_results(group_id, week_start desc, score_version);

alter table public.group_weekly_improvement_results enable row level security;

revoke all on table public.group_weekly_improvement_results from public, anon, authenticated;
grant select on table public.group_weekly_improvement_results to authenticated;

create policy group_weekly_improvement_results_member_select
  on public.group_weekly_improvement_results
  for select
  to authenticated
  using (group_id in (select private.current_user_group_ids()));
