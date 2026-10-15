-- Repair only identical, unused duplicate bootstrap profiles. Preserve a complete
-- private snapshot and fail closed if any duplicate has dependent training data.
lock table public.families, public.profiles in access exclusive mode;
create table if not exists private.account_bootstrap_duplicate_backups (
  family_id uuid primary key,
  retained_family_id uuid not null,
  family_row jsonb not null,
  profile_rows jsonb not null,
  schedule_rows jsonb not null,
  repaired_at timestamptz not null default now()
);
alter table private.account_bootstrap_duplicate_backups enable row level security;
revoke all on private.account_bootstrap_duplicate_backups from public, anon, authenticated;

do $$
declare
  duplicate record;
  dependency record;
  has_dependents boolean;
  duplicate_profiles jsonb;
  retained_profiles jsonb;
begin
  for duplicate in
    select * from (
      select f.*, first_value(id) over (partition by owner_user_id order by created_at, id) as keep_id,
        row_number() over (partition by owner_user_id order by created_at, id) as position
      from public.families f
    ) ranked where position > 1
  loop
    select jsonb_agg(to_jsonb(p) - 'id' - 'family_id' - 'created_at' order by p.name)
      into duplicate_profiles from public.profiles p where p.family_id = duplicate.id;
    select jsonb_agg(to_jsonb(p) - 'id' - 'family_id' - 'created_at' order by p.name)
      into retained_profiles from public.profiles p where p.family_id = duplicate.keep_id;
    if duplicate_profiles is distinct from retained_profiles then
      raise exception 'Duplicate account has distinct profiles; manual reconciliation required';
    end if;
    if exists (
      select 1 from public.profile_consistency_schedule_snapshots s
      join public.profiles p on p.id = s.profile_id
      where p.family_id = duplicate.id
        and s.schedule_json is distinct from '{"Mon":[],"Tue":[],"Wed":[],"Thu":[],"Fri":[],"Sat":[],"Sun":[]}'::jsonb
    ) then
      raise exception 'Duplicate account has a nonblank schedule; manual reconciliation required';
    end if;
    -- Check every FK, including private tables, before any cascading delete.
    for dependency in
      select c.conrelid::regclass as relation, a.attname as column_name, c.confrelid as parent
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
      where c.contype = 'f' and c.confrelid in ('public.families'::regclass, 'public.profiles'::regclass)
        and c.conrelid <> 'public.profiles'::regclass
        and c.conrelid <> 'public.profile_consistency_schedule_snapshots'::regclass
    loop
      if dependency.parent = 'public.families'::regclass then
        execute format('select exists(select 1 from %s where %I = $1)', dependency.relation, dependency.column_name)
          into has_dependents using duplicate.id;
      else
        execute format('select exists(select 1 from %s where %I in (select id from public.profiles where family_id = $1))', dependency.relation, dependency.column_name)
          into has_dependents using duplicate.id;
      end if;
      if has_dependents then
        raise exception 'Duplicate account has dependent data in %; manual reconciliation required', dependency.relation;
      end if;
    end loop;
    insert into private.account_bootstrap_duplicate_backups (family_id, retained_family_id, family_row, profile_rows, schedule_rows)
      select f.id, duplicate.keep_id, to_jsonb(f),
        coalesce((select jsonb_agg(to_jsonb(p)) from public.profiles p where p.family_id = f.id), '[]'::jsonb),
        coalesce((select jsonb_agg(to_jsonb(s)) from public.profile_consistency_schedule_snapshots s
          join public.profiles p on p.id = s.profile_id where p.family_id = f.id), '[]'::jsonb)
      from public.families f where f.id = duplicate.id;
    delete from public.families where id = duplicate.id;
  end loop;
end $$;

alter table public.families add constraint families_one_per_owner unique (owner_user_id);

-- Serialize the family AND initial profile in one transaction, including calls
-- from separate tabs/devices. RLS continues to apply to every operation.
create or replace function public.bootstrap_family_account(
  default_family_name text default 'My Family', initial_plan jsonb default null
) returns public.families
language plpgsql security invoker set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  account public.families;
begin
  if caller_id is null then raise exception 'Not logged in' using errcode = '42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(caller_id::text, 0));
  select * into account from public.families where owner_user_id = caller_id;
  if account.id is null then
    insert into public.families (owner_user_id, name)
      values (caller_id, default_family_name)
      on conflict (owner_user_id) do nothing;
    select * into strict account from public.families where owner_user_id = caller_id;
  end if;
  if not exists (select 1 from public.profiles where family_id = account.id and not archived) then
    insert into public.profiles (family_id, name, plan_json) values (account.id, 'Athlete', initial_plan);
  end if;
  return account;
end $$;
revoke all on function public.bootstrap_family_account(text, jsonb) from public, anon;
grant execute on function public.bootstrap_family_account(text, jsonb) to authenticated;
