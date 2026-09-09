-- Workout Tracker Phase 2 / Stage 8
-- Generic recurring Assessment scheduling.
-- Additive only: does not alter profile plans, workout logs, Assessment history,
-- Session definitions, XP, streaks or badges.

create table public.assessment_schedules (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  assessment_template_id uuid not null,
  start_date date not null,
  cadence_days integer not null default 28
    check (cadence_days >= 1),
  window_days integer not null default 7
    check (window_days >= 1 and window_days <= cadence_days),
  workflow_config jsonb not null default '{}'::jsonb
    check (jsonb_typeof(workflow_config) = 'object'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, family_id),
  unique (family_id, profile_id, assessment_template_id),
  foreign key (assessment_template_id, family_id)
    references public.assessment_templates(id, family_id)
    on delete cascade
);

create index assessment_schedules_family_profile_active_idx
  on public.assessment_schedules(family_id, profile_id, active, start_date);

create index assessment_schedules_template_family_idx
  on public.assessment_schedules(assessment_template_id, family_id);

create trigger trg_assessment_schedules_updated
before update on public.assessment_schedules
for each row execute function public.set_updated_at();

alter table public.assessment_schedules enable row level security;

create policy assessment_schedules_owner_select
on public.assessment_schedules for select
to authenticated
using (
  exists (
    select 1
    from public.families f
    join public.profiles p
      on p.id = assessment_schedules.profile_id
     and p.family_id = assessment_schedules.family_id
    where f.id = assessment_schedules.family_id
      and f.owner_user_id = (select auth.uid())
  )
);

create policy assessment_schedules_owner_insert
on public.assessment_schedules for insert
to authenticated
with check (
  exists (
    select 1
    from public.families f
    join public.profiles p
      on p.id = assessment_schedules.profile_id
     and p.family_id = assessment_schedules.family_id
    where f.id = assessment_schedules.family_id
      and f.owner_user_id = (select auth.uid())
  )
);

create policy assessment_schedules_owner_update
on public.assessment_schedules for update
to authenticated
using (
  exists (
    select 1
    from public.families f
    join public.profiles p
      on p.id = assessment_schedules.profile_id
     and p.family_id = assessment_schedules.family_id
    where f.id = assessment_schedules.family_id
      and f.owner_user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.families f
    join public.profiles p
      on p.id = assessment_schedules.profile_id
     and p.family_id = assessment_schedules.family_id
    where f.id = assessment_schedules.family_id
      and f.owner_user_id = (select auth.uid())
  )
);

revoke all on table public.assessment_schedules from anon, authenticated;
grant select, insert, update on table public.assessment_schedules to authenticated;
