-- Fresh isolated databases only. Never run over an existing application schema.
do $$ begin
  if to_regclass('public.families') is not null then
    raise exception 'Legacy bootstrap requires an empty application schema';
  end if;
end $$;
-- Kids Workout Tracker (Online) - Supabase schema + RLS
-- Pattern: One parent account (auth user) owns a family, and can create many profiles.

-- 1) Families
create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  name text not null default 'Family',
  created_at timestamptz not null default now()
);

-- 2) Profiles (sub-users)
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null,
  body_weight_kg numeric,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

-- 3) Plans (one per family)
create table if not exists public.plans (
  family_id uuid primary key references public.families(id) on delete cascade,
  plan_json jsonb not null,
  updated_at timestamptz not null default now()
);

-- 4) Logs (one per profile per day)
create table if not exists public.logs (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  date_ymd text not null, -- 'YYYY-MM-DD'
  log_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (family_id, profile_id, date_ymd)
);

-- Optional: update timestamp trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_logs_updated on public.logs;
create trigger trg_logs_updated before update on public.logs
for each row execute function public.set_updated_at();

drop trigger if exists trg_plans_updated on public.plans;
create trigger trg_plans_updated before update on public.plans
for each row execute function public.set_updated_at();

-- --------------------
-- Row Level Security
-- --------------------
alter table public.families enable row level security;
alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.logs enable row level security;

-- Families: only owner can read/write
create policy families_owner_select
on public.families for select
using (owner_user_id = auth.uid());

create policy families_owner_insert
on public.families for insert
with check (owner_user_id = auth.uid());

create policy families_owner_update
on public.families for update
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

-- Profiles: only owner via family
create policy profiles_owner_select
on public.profiles for select
using (exists (
  select 1 from public.families f
  where f.id = profiles.family_id and f.owner_user_id = auth.uid()
));

create policy profiles_owner_insert
on public.profiles for insert
with check (exists (
  select 1 from public.families f
  where f.id = profiles.family_id and f.owner_user_id = auth.uid()
));

create policy profiles_owner_update
on public.profiles for update
using (exists (
  select 1 from public.families f
  where f.id = profiles.family_id and f.owner_user_id = auth.uid()
))
with check (exists (
  select 1 from public.families f
  where f.id = profiles.family_id and f.owner_user_id = auth.uid()
));

-- Plans: only owner via family
create policy plans_owner_select
on public.plans for select
using (exists (
  select 1 from public.families f
  where f.id = plans.family_id and f.owner_user_id = auth.uid()
));

create policy plans_owner_upsert
on public.plans for insert
with check (exists (
  select 1 from public.families f
  where f.id = plans.family_id and f.owner_user_id = auth.uid()
));

create policy plans_owner_update
on public.plans for update
using (exists (
  select 1 from public.families f
  where f.id = plans.family_id and f.owner_user_id = auth.uid()
))
with check (exists (
  select 1 from public.families f
  where f.id = plans.family_id and f.owner_user_id = auth.uid()
));

-- Logs: only owner via family
create policy logs_owner_select
on public.logs for select
using (exists (
  select 1 from public.families f
  where f.id = logs.family_id and f.owner_user_id = auth.uid()
));

create policy logs_owner_insert
on public.logs for insert
with check (exists (
  select 1 from public.families f
  where f.id = logs.family_id and f.owner_user_id = auth.uid()
));

create policy logs_owner_update
on public.logs for update
using (exists (
  select 1 from public.families f
  where f.id = logs.family_id and f.owner_user_id = auth.uid()
))
with check (exists (
  select 1 from public.families f
  where f.id = logs.family_id and f.owner_user_id = auth.uid()
));

alter table public.families add column pin_hash text, add column pin_updated_at timestamptz;
alter table public.profiles add column age_group text not null default 'under16', add column plan_json jsonb;
create table public.plan_templates (
 id uuid primary key default gen_random_uuid(), family_id uuid not null references public.families(id) on delete cascade,
 name text not null, plan_json jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.plan_templates enable row level security;
create policy plan_templates_owner on public.plan_templates for all to authenticated
using (exists(select 1 from public.families f where f.id=family_id and f.owner_user_id=(select auth.uid())))
with check (exists(select 1 from public.families f where f.id=family_id and f.owner_user_id=(select auth.uid())));
grant select,insert,update,delete on public.families, public.profiles, public.plans, public.logs, public.plan_templates to authenticated;
