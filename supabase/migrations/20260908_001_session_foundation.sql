-- Workout Tracker Phase 1 Sessions foundation
-- Additive migration only: does not alter profile plans or historical workout logs.

-- -----------------------------------------------------------------------------
-- Shared updated_at trigger function
-- -----------------------------------------------------------------------------
-- Keep existing behaviour while pinning search_path to resolve the Supabase
-- security advisor warning on the pre-existing function.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Programmes
-- -----------------------------------------------------------------------------
create table public.programmes (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null,
  category text not null default '',
  description text not null default '',
  sort_order integer not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, family_id)
);

-- -----------------------------------------------------------------------------
-- Canonical movements
-- -----------------------------------------------------------------------------
create table public.movements (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null,
  description text not null default '',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, family_id)
);

-- -----------------------------------------------------------------------------
-- Session templates
-- -----------------------------------------------------------------------------
create table public.session_templates (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  programme_id uuid not null,
  display_code text not null default '',
  name text not null,
  description text not null default '',
  planned_duration_sec integer
    check (planned_duration_sec is null or planned_duration_sec >= 0),
  version integer not null default 1 check (version >= 1),
  sort_order integer not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, family_id),
  foreign key (programme_id, family_id)
    references public.programmes(id, family_id)
    on delete cascade
);

-- -----------------------------------------------------------------------------
-- Ordered movement definitions inside each template
-- -----------------------------------------------------------------------------
create table public.session_template_movements (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  session_template_id uuid not null,
  movement_id uuid not null,
  position integer not null check (position >= 1),
  display_label text not null default '',
  instructions text not null default '',
  planned_duration_sec integer
    check (planned_duration_sec is null or planned_duration_sec >= 0),
  tracking_method text not null default 'completion'
    check (
      tracking_method in (
        'completion',
        'repetitions',
        'sets_reps',
        'duration',
        'distance',
        'weight',
        'successful_executions',
        'attempts_successes',
        'best_score',
        'numeric'
      )
    ),
  tracking_config jsonb not null default '{}'::jsonb
    check (jsonb_typeof(tracking_config) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (session_template_id, family_id)
    references public.session_templates(id, family_id)
    on delete cascade,
  foreign key (movement_id, family_id)
    references public.movements(id, family_id),
  unique (session_template_id, position)
);

-- -----------------------------------------------------------------------------
-- Shared development tags (foundation for later Assessment linking)
-- -----------------------------------------------------------------------------
create table public.development_tags (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null,
  slug text not null,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, family_id),
  unique (family_id, slug)
);

create table public.movement_development_tags (
  family_id uuid not null,
  movement_id uuid not null,
  development_tag_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (movement_id, development_tag_id),
  foreign key (movement_id, family_id)
    references public.movements(id, family_id)
    on delete cascade,
  foreign key (development_tag_id, family_id)
    references public.development_tags(id, family_id)
    on delete cascade
);

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------
create index programmes_family_idx
  on public.programmes(family_id, archived, sort_order);

create index movements_family_idx
  on public.movements(family_id, archived);

create index session_templates_family_idx
  on public.session_templates(family_id, archived, sort_order);

create index session_templates_programme_idx
  on public.session_templates(programme_id, archived);

create index session_template_movements_family_idx
  on public.session_template_movements(family_id);

create index session_template_movements_template_idx
  on public.session_template_movements(session_template_id, position);

create index session_template_movements_movement_idx
  on public.session_template_movements(movement_id);

create index development_tags_family_idx
  on public.development_tags(family_id, archived);

create index movement_development_tags_family_idx
  on public.movement_development_tags(family_id);

create index movement_development_tags_tag_idx
  on public.movement_development_tags(development_tag_id);

-- -----------------------------------------------------------------------------
-- updated_at triggers
-- -----------------------------------------------------------------------------
create trigger trg_programmes_updated
before update on public.programmes
for each row execute function public.set_updated_at();

create trigger trg_movements_updated
before update on public.movements
for each row execute function public.set_updated_at();

create trigger trg_session_templates_updated
before update on public.session_templates
for each row execute function public.set_updated_at();

create trigger trg_session_template_movements_updated
before update on public.session_template_movements
for each row execute function public.set_updated_at();

create trigger trg_development_tags_updated
before update on public.development_tags
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.programmes enable row level security;
alter table public.movements enable row level security;
alter table public.session_templates enable row level security;
alter table public.session_template_movements enable row level security;
alter table public.development_tags enable row level security;
alter table public.movement_development_tags enable row level security;

-- Programmes: soft archive rather than delete.
create policy programmes_owner_select
on public.programmes for select
using (
  exists (
    select 1 from public.families f
    where f.id = programmes.family_id
      and f.owner_user_id = (select auth.uid())
  )
);

create policy programmes_owner_insert
on public.programmes for insert
with check (
  exists (
    select 1 from public.families f
    where f.id = programmes.family_id
      and f.owner_user_id = (select auth.uid())
  )
);

create policy programmes_owner_update
on public.programmes for update
using (
  exists (
    select 1 from public.families f
    where f.id = programmes.family_id
      and f.owner_user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.families f
    where f.id = programmes.family_id
      and f.owner_user_id = (select auth.uid())
  )
);

-- Movements: soft archive rather than delete.
create policy movements_owner_select
on public.movements for select
using (
  exists (
    select 1 from public.families f
    where f.id = movements.family_id
      and f.owner_user_id = (select auth.uid())
  )
);

create policy movements_owner_insert
on public.movements for insert
with check (
  exists (
    select 1 from public.families f
    where f.id = movements.family_id
      and f.owner_user_id = (select auth.uid())
  )
);

create policy movements_owner_update
on public.movements for update
using (
  exists (
    select 1 from public.families f
    where f.id = movements.family_id
      and f.owner_user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.families f
    where f.id = movements.family_id
      and f.owner_user_id = (select auth.uid())
  )
);

-- Session templates: soft archive rather than delete.
create policy session_templates_owner_select
on public.session_templates for select
using (
  exists (
    select 1 from public.families f
    where f.id = session_templates.family_id
      and f.owner_user_id = (select auth.uid())
  )
);

create policy session_templates_owner_insert
on public.session_templates for insert
with check (
  exists (
    select 1 from public.families f
    where f.id = session_templates.family_id
      and f.owner_user_id = (select auth.uid())
  )
);

create policy session_templates_owner_update
on public.session_templates for update
using (
  exists (
    select 1 from public.families f
    where f.id = session_templates.family_id
      and f.owner_user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.families f
    where f.id = session_templates.family_id
      and f.owner_user_id = (select auth.uid())
  )
);

-- Template membership can be inserted, edited and genuinely removed because
-- historical executions hold their own immutable movement snapshots.
create policy session_template_movements_owner_select
on public.session_template_movements for select
using (
  exists (
    select 1 from public.families f
    where f.id = session_template_movements.family_id
      and f.owner_user_id = (select auth.uid())
  )
);

create policy session_template_movements_owner_insert
on public.session_template_movements for insert
with check (
  exists (
    select 1 from public.families f
    where f.id = session_template_movements.family_id
      and f.owner_user_id = (select auth.uid())
  )
);

create policy session_template_movements_owner_update
on public.session_template_movements for update
using (
  exists (
    select 1 from public.families f
    where f.id = session_template_movements.family_id
      and f.owner_user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.families f
    where f.id = session_template_movements.family_id
      and f.owner_user_id = (select auth.uid())
  )
);

create policy session_template_movements_owner_delete
on public.session_template_movements for delete
using (
  exists (
    select 1 from public.families f
    where f.id = session_template_movements.family_id
      and f.owner_user_id = (select auth.uid())
  )
);

-- Development tags: soft archive rather than delete.
create policy development_tags_owner_select
on public.development_tags for select
using (
  exists (
    select 1 from public.families f
    where f.id = development_tags.family_id
      and f.owner_user_id = (select auth.uid())
  )
);

create policy development_tags_owner_insert
on public.development_tags for insert
with check (
  exists (
    select 1 from public.families f
    where f.id = development_tags.family_id
      and f.owner_user_id = (select auth.uid())
  )
);

create policy development_tags_owner_update
on public.development_tags for update
using (
  exists (
    select 1 from public.families f
    where f.id = development_tags.family_id
      and f.owner_user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.families f
    where f.id = development_tags.family_id
      and f.owner_user_id = (select auth.uid())
  )
);

-- Movement/tag links are relationship rows and can be removed.
create policy movement_development_tags_owner_select
on public.movement_development_tags for select
using (
  exists (
    select 1 from public.families f
    where f.id = movement_development_tags.family_id
      and f.owner_user_id = (select auth.uid())
  )
);

create policy movement_development_tags_owner_insert
on public.movement_development_tags for insert
with check (
  exists (
    select 1 from public.families f
    where f.id = movement_development_tags.family_id
      and f.owner_user_id = (select auth.uid())
  )
);

create policy movement_development_tags_owner_delete
on public.movement_development_tags for delete
using (
  exists (
    select 1 from public.families f
    where f.id = movement_development_tags.family_id
      and f.owner_user_id = (select auth.uid())
  )
);
