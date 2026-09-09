-- Workout Tracker Phase 2 / Stage 8
-- Initial recurring Assessment schedules for Wilf and Xander.
-- Data seed only: no profile plan_json edits and no Assessment history rows.
--
-- The 2026-09-21 anchor is an implementation choice for the initial family
-- rollout: it follows the current guide's 1–2 week return-to-routine ramp.
-- The source requirement itself is a benchmark every four weeks.

begin;

do $$
declare
  target_family constant uuid := 'f483eb48-b1cd-4b36-899a-49d69ae8ae8b';
  benchmark_count integer;
  boy_count integer;
  existing_count integer;
begin
  select count(*) into benchmark_count
  from public.assessment_templates
  where family_id = target_family
    and name = 'Football Monthly Benchmark'
    and archived = false;

  if benchmark_count <> 1 then
    raise exception 'Stage 8 expected exactly one active Football Monthly Benchmark, found %', benchmark_count;
  end if;

  select count(*) into boy_count
  from public.profiles
  where family_id = target_family
    and name in ('Wilf', 'Xander')
    and archived = false;

  if boy_count <> 2 then
    raise exception 'Stage 8 expected exactly two active target profiles (Wilf/Xander), found %', boy_count;
  end if;

  select count(*) into existing_count
  from public.assessment_schedules s
  join public.assessment_templates at
    on at.id = s.assessment_template_id
   and at.family_id = s.family_id
  join public.profiles p
    on p.id = s.profile_id
   and p.family_id = s.family_id
  where s.family_id = target_family
    and at.name = 'Football Monthly Benchmark'
    and p.name in ('Wilf', 'Xander');

  if existing_count <> 0 then
    raise exception 'Stage 8 target schedules already exist; verify before reseeding';
  end if;
end $$;

insert into public.assessment_schedules (
  family_id,
  profile_id,
  assessment_template_id,
  start_date,
  cadence_days,
  window_days,
  workflow_config,
  active
)
select
  p.family_id,
  p.id,
  at.id,
  date '2026-09-21',
  28,
  7,
  jsonb_build_object(
    'guidance', jsonb_build_array(
      'The technical benchmark may replace one normal 15-minute home skills Session during benchmark week.',
      'Keep benchmark testing separate from a hard strength session or match so fatigue does not distort the scores.',
      'Use the same set-up, equipment and conditions as consistently as practical each cycle.'
    ),
    'allowSplitAcrossDays', true
  ),
  true
from public.profiles p
cross join public.assessment_templates at
where p.family_id = 'f483eb48-b1cd-4b36-899a-49d69ae8ae8b'
  and p.name in ('Wilf', 'Xander')
  and p.archived = false
  and at.family_id = p.family_id
  and at.name = 'Football Monthly Benchmark'
  and at.archived = false;

commit;
