-- Workout Tracker Group & Team Ecosystem Stage 8
-- Private, bounded Group Challenges with server-controlled rules and reward pools.
-- Additive only: no existing workout, Assessment, plan or competition history is rewritten.

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
