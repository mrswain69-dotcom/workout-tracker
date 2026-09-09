-- Workout Tracker Phase 2 Assessments foundation
-- Additive migration only: no Assessment seed data, profile-plan changes, or workout-log rewrites.

-- -----------------------------------------------------------------------------
-- Assessment templates
-- -----------------------------------------------------------------------------
create table public.assessment_templates (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null,
  category text not null default '',
  description text not null default '',
  version integer not null default 1 check (version >= 1),
  sort_order integer not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, family_id)
);

-- -----------------------------------------------------------------------------
-- Canonical reusable Tests
-- -----------------------------------------------------------------------------
create table public.tests (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null,
  description text not null default '',
  version integer not null default 1 check (version >= 1),
  metric_type text not null default 'numeric',
  unit text not null default '',
  scoring_direction text not null default 'higher'
    check (scoring_direction in ('higher', 'lower')),
  attempt_count integer not null default 1 check (attempt_count >= 1),
  result_strategy text not null default 'single'
    check (result_strategy in ('single', 'best', 'average')),
  side_mode text not null default 'none'
    check (side_mode in ('none', 'separate')),
  allow_negative boolean not null default false,
  pb_eligible boolean not null default true,
  metric_config jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metric_config) = 'object'),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, family_id)
);

-- -----------------------------------------------------------------------------
-- Ordered Tests inside each Assessment Template
-- -----------------------------------------------------------------------------
create table public.assessment_template_tests (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  assessment_template_id uuid not null,
  test_id uuid not null,
  position integer not null check (position >= 1),
  section_label text not null default '',
  display_label text not null default '',
  instructions text not null default '',
  protocol_text text not null default '',
  config_override jsonb not null default '{}'::jsonb
    check (jsonb_typeof(config_override) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, family_id),
  unique (assessment_template_id, position),
  foreign key (assessment_template_id, family_id)
    references public.assessment_templates(id, family_id)
    on delete cascade,
  foreign key (test_id, family_id)
    references public.tests(id, family_id)
);

-- -----------------------------------------------------------------------------
-- Shared Development Tag relationships for Tests
-- -----------------------------------------------------------------------------
create table public.test_development_tags (
  family_id uuid not null,
  test_id uuid not null,
  development_tag_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (test_id, development_tag_id),
  foreign key (test_id, family_id)
    references public.tests(id, family_id)
    on delete cascade,
  foreign key (development_tag_id, family_id)
    references public.development_tags(id, family_id)
    on delete cascade
);

-- -----------------------------------------------------------------------------
-- Historical Assessment runs
-- -----------------------------------------------------------------------------
create table public.assessment_runs (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  profile_id uuid not null references public.profiles(id),
  assessment_template_id uuid not null,
  date_ymd date not null,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed', 'cancelled')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  template_version integer not null default 1 check (template_version >= 1),
  template_snapshot jsonb not null default '{}'::jsonb
    check (jsonb_typeof(template_snapshot) = 'object'),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, family_id),
  foreign key (assessment_template_id, family_id)
    references public.assessment_templates(id, family_id)
);

-- -----------------------------------------------------------------------------
-- Historical Test results within an Assessment run
-- -----------------------------------------------------------------------------
create table public.assessment_test_results (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  assessment_run_id uuid not null,
  test_id uuid not null,
  assessment_template_test_id uuid,
  position integer not null check (position >= 1),
  section_label_snapshot text not null default '',
  test_name_snapshot text not null default '',
  metric_snapshot jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metric_snapshot) = 'object'),
  result_data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(result_data) = 'object'),
  retained_result jsonb not null default '{}'::jsonb
    check (jsonb_typeof(retained_result) = 'object'),
  comparable_value numeric,
  comparable_dimensions jsonb not null default '{}'::jsonb
    check (jsonb_typeof(comparable_dimensions) = 'object'),
  is_valid boolean not null default true,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, family_id),
  unique (assessment_run_id, position),
  foreign key (assessment_run_id, family_id)
    references public.assessment_runs(id, family_id)
    on delete cascade,
  foreign key (test_id, family_id)
    references public.tests(id, family_id),
  foreign key (assessment_template_test_id, family_id)
    references public.assessment_template_tests(id, family_id)
);

-- -----------------------------------------------------------------------------
-- Covering indexes for family filters, history lookups and composite FKs
-- -----------------------------------------------------------------------------
create index assessment_templates_family_idx
  on public.assessment_templates(family_id, archived, sort_order);

create index tests_family_idx
  on public.tests(family_id, archived, name);

create index assessment_template_tests_family_idx
  on public.assessment_template_tests(family_id);
create index assessment_template_tests_template_family_idx
  on public.assessment_template_tests(assessment_template_id, family_id, position);
create index assessment_template_tests_test_family_idx
  on public.assessment_template_tests(test_id, family_id);

create index test_development_tags_family_idx
  on public.test_development_tags(family_id);
create index test_development_tags_test_family_idx
  on public.test_development_tags(test_id, family_id);
create index test_development_tags_tag_family_idx
  on public.test_development_tags(development_tag_id, family_id);

create index assessment_runs_family_profile_date_idx
  on public.assessment_runs(family_id, profile_id, date_ymd desc);
create index assessment_runs_template_family_idx
  on public.assessment_runs(assessment_template_id, family_id);
create index assessment_runs_profile_idx
  on public.assessment_runs(profile_id);

create index assessment_test_results_family_run_idx
  on public.assessment_test_results(family_id, assessment_run_id);
create index assessment_test_results_run_family_idx
  on public.assessment_test_results(assessment_run_id, family_id, position);
create index assessment_test_results_test_family_idx
  on public.assessment_test_results(test_id, family_id);
create index assessment_test_results_template_test_family_idx
  on public.assessment_test_results(assessment_template_test_id, family_id)
  where assessment_template_test_id is not null;

-- -----------------------------------------------------------------------------
-- updated_at triggers (reuse the Phase 1 trigger function)
-- -----------------------------------------------------------------------------
create trigger trg_assessment_templates_updated
before update on public.assessment_templates
for each row execute function public.set_updated_at();

create trigger trg_tests_updated
before update on public.tests
for each row execute function public.set_updated_at();

create trigger trg_assessment_template_tests_updated
before update on public.assessment_template_tests
for each row execute function public.set_updated_at();

create trigger trg_assessment_runs_updated
before update on public.assessment_runs
for each row execute function public.set_updated_at();

create trigger trg_assessment_test_results_updated
before update on public.assessment_test_results
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.assessment_templates enable row level security;
alter table public.tests enable row level security;
alter table public.assessment_template_tests enable row level security;
alter table public.test_development_tags enable row level security;
alter table public.assessment_runs enable row level security;
alter table public.assessment_test_results enable row level security;

-- Definitions: soft archive rather than delete.
create policy assessment_templates_owner_select
on public.assessment_templates for select
to authenticated
using (
  exists (
    select 1 from public.families f
    where f.id = assessment_templates.family_id
      and f.owner_user_id = (select auth.uid())
  )
);

create policy assessment_templates_owner_insert
on public.assessment_templates for insert
to authenticated
with check (
  exists (
    select 1 from public.families f
    where f.id = assessment_templates.family_id
      and f.owner_user_id = (select auth.uid())
  )
);

create policy assessment_templates_owner_update
on public.assessment_templates for update
to authenticated
using (
  exists (
    select 1 from public.families f
    where f.id = assessment_templates.family_id
      and f.owner_user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.families f
    where f.id = assessment_templates.family_id
      and f.owner_user_id = (select auth.uid())
  )
);

create policy tests_owner_select
on public.tests for select
to authenticated
using (
  exists (
    select 1 from public.families f
    where f.id = tests.family_id
      and f.owner_user_id = (select auth.uid())
  )
);

create policy tests_owner_insert
on public.tests for insert
to authenticated
with check (
  exists (
    select 1 from public.families f
    where f.id = tests.family_id
      and f.owner_user_id = (select auth.uid())
  )
);

create policy tests_owner_update
on public.tests for update
to authenticated
using (
  exists (
    select 1 from public.families f
    where f.id = tests.family_id
      and f.owner_user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.families f
    where f.id = tests.family_id
      and f.owner_user_id = (select auth.uid())
  )
);

-- Ordered template membership is editor-owned and may be removed/reordered.
create policy assessment_template_tests_owner_select
on public.assessment_template_tests for select
to authenticated
using (
  exists (
    select 1 from public.families f
    where f.id = assessment_template_tests.family_id
      and f.owner_user_id = (select auth.uid())
  )
);

create policy assessment_template_tests_owner_insert
on public.assessment_template_tests for insert
to authenticated
with check (
  exists (
    select 1 from public.families f
    where f.id = assessment_template_tests.family_id
      and f.owner_user_id = (select auth.uid())
  )
);

create policy assessment_template_tests_owner_update
on public.assessment_template_tests for update
to authenticated
using (
  exists (
    select 1 from public.families f
    where f.id = assessment_template_tests.family_id
      and f.owner_user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.families f
    where f.id = assessment_template_tests.family_id
      and f.owner_user_id = (select auth.uid())
  )
);

create policy assessment_template_tests_owner_delete
on public.assessment_template_tests for delete
to authenticated
using (
  exists (
    select 1 from public.families f
    where f.id = assessment_template_tests.family_id
      and f.owner_user_id = (select auth.uid())
  )
);

-- Shared Test ↔ Development Tag relationships.
create policy test_development_tags_owner_select
on public.test_development_tags for select
to authenticated
using (
  exists (
    select 1 from public.families f
    where f.id = test_development_tags.family_id
      and f.owner_user_id = (select auth.uid())
  )
);

create policy test_development_tags_owner_insert
on public.test_development_tags for insert
to authenticated
with check (
  exists (
    select 1 from public.families f
    where f.id = test_development_tags.family_id
      and f.owner_user_id = (select auth.uid())
  )
);

create policy test_development_tags_owner_delete
on public.test_development_tags for delete
to authenticated
using (
  exists (
    select 1 from public.families f
    where f.id = test_development_tags.family_id
      and f.owner_user_id = (select auth.uid())
  )
);

-- Historical runs: no delete policy; cancel/correct via controlled updates.
create policy assessment_runs_owner_select
on public.assessment_runs for select
to authenticated
using (
  exists (
    select 1 from public.families f
    where f.id = assessment_runs.family_id
      and f.owner_user_id = (select auth.uid())
  )
  and exists (
    select 1 from public.profiles p
    where p.id = assessment_runs.profile_id
      and p.family_id = assessment_runs.family_id
  )
);

create policy assessment_runs_owner_insert
on public.assessment_runs for insert
to authenticated
with check (
  exists (
    select 1 from public.families f
    where f.id = assessment_runs.family_id
      and f.owner_user_id = (select auth.uid())
  )
  and exists (
    select 1 from public.profiles p
    where p.id = assessment_runs.profile_id
      and p.family_id = assessment_runs.family_id
  )
);

create policy assessment_runs_owner_update
on public.assessment_runs for update
to authenticated
using (
  exists (
    select 1 from public.families f
    where f.id = assessment_runs.family_id
      and f.owner_user_id = (select auth.uid())
  )
  and exists (
    select 1 from public.profiles p
    where p.id = assessment_runs.profile_id
      and p.family_id = assessment_runs.family_id
  )
)
with check (
  exists (
    select 1 from public.families f
    where f.id = assessment_runs.family_id
      and f.owner_user_id = (select auth.uid())
  )
  and exists (
    select 1 from public.profiles p
    where p.id = assessment_runs.profile_id
      and p.family_id = assessment_runs.family_id
  )
);

-- Historical results: no delete policy; preserve/correct by controlled updates.
create policy assessment_test_results_owner_select
on public.assessment_test_results for select
to authenticated
using (
  exists (
    select 1 from public.families f
    where f.id = assessment_test_results.family_id
      and f.owner_user_id = (select auth.uid())
  )
);

create policy assessment_test_results_owner_insert
on public.assessment_test_results for insert
to authenticated
with check (
  exists (
    select 1 from public.families f
    where f.id = assessment_test_results.family_id
      and f.owner_user_id = (select auth.uid())
  )
);

create policy assessment_test_results_owner_update
on public.assessment_test_results for update
to authenticated
using (
  exists (
    select 1 from public.families f
    where f.id = assessment_test_results.family_id
      and f.owner_user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.families f
    where f.id = assessment_test_results.family_id
      and f.owner_user_id = (select auth.uid())
  )
);

-- Explicit Data API grants for the authenticated application role only.
grant select, insert, update on public.assessment_templates to authenticated;
grant select, insert, update on public.tests to authenticated;
grant select, insert, update, delete on public.assessment_template_tests to authenticated;
grant select, insert, delete on public.test_development_tags to authenticated;
grant select, insert, update on public.assessment_runs to authenticated;
grant select, insert, update on public.assessment_test_results to authenticated;

revoke all on public.assessment_templates from anon;
revoke all on public.tests from anon;
revoke all on public.assessment_template_tests from anon;
revoke all on public.test_development_tags from anon;
revoke all on public.assessment_runs from anon;
revoke all on public.assessment_test_results from anon;
