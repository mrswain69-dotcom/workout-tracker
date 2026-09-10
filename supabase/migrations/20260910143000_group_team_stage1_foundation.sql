-- Group & Team Ecosystem — Stage 1 foundation
-- Additive only: no group seed data, workout-log rewrites, profile-plan rewrites, or leaderboard scores.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  group_type text not null default 'private' check (group_type in ('private','squad','club')),
  created_by_family_id uuid not null references public.families(id) on delete cascade,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  status text not null default 'active' check (status in ('active','archived')),
  max_members smallint not null default 20 check (max_members between 2 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (name = btrim(name) and char_length(name) between 2 and 80 and name !~ '[\r\n\t]'),
  check (char_length(description) <= 500)
);

create table public.group_memberships (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('admin','member')),
  nickname text not null,
  avatar_id text not null default '',
  avatar_frame text not null default '',
  avatar_frames_enabled boolean not null default true,
  status text not null default 'active' check (status in ('active','left','removed')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (nickname = btrim(nickname) and char_length(nickname) between 1 and 32 and nickname !~ '[\r\n\t]'),
  check (char_length(avatar_id) <= 160),
  check (char_length(avatar_frame) <= 80)
);

create unique index group_memberships_one_active_profile_per_group
  on public.group_memberships(group_id, profile_id)
  where status = 'active';
create unique index group_memberships_unique_active_nickname
  on public.group_memberships(group_id, lower(nickname))
  where status = 'active';
create index group_memberships_family_profile_idx
  on public.group_memberships(family_id, profile_id, status);
create index group_memberships_group_status_idx
  on public.group_memberships(group_id, status, joined_at);

-- Safe cross-family competitive identity. This deliberately omits family/profile IDs,
-- raw plans, logs, body data, readiness, assessment data and private notes.
create table public.group_member_directory (
  membership_id uuid primary key references public.group_memberships(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  nickname text not null,
  role text not null check (role in ('admin','member')),
  avatar_id text not null default '',
  avatar_frame text not null default '',
  avatar_frames_enabled boolean not null default true,
  joined_at timestamptz not null,
  updated_at timestamptz not null default now(),
  check (nickname = btrim(nickname) and char_length(nickname) between 1 and 32 and nickname !~ '[\r\n\t]'),
  check (char_length(avatar_id) <= 160),
  check (char_length(avatar_frame) <= 80)
);
create unique index group_member_directory_unique_nickname
  on public.group_member_directory(group_id, lower(nickname));
create index group_member_directory_group_idx
  on public.group_member_directory(group_id, joined_at);

-- Invite secrets are never stored in plaintext. Stage 2 will generate/consume them
-- through tightly authorised RPCs; only a short non-secret hint is retained for admins.
create table public.group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  code_hash text not null unique,
  code_hint text not null default '',
  created_by_membership_id uuid references public.group_memberships(id) on delete set null,
  expires_at timestamptz not null,
  max_uses smallint not null default 1 check (max_uses between 1 and 20),
  use_count smallint not null default 0 check (use_count >= 0 and use_count <= max_uses),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (code_hash ~ '^[0-9a-f]{64}$'),
  check (char_length(code_hint) <= 12)
);
create index group_invites_group_active_idx
  on public.group_invites(group_id, expires_at)
  where revoked_at is null;

-- Private SECURITY DEFINER helpers break membership-policy recursion without exposing
-- raw cross-family rows. They are executable only by authenticated callers.
create or replace function private.current_user_family_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select f.id from public.families f
  where f.owner_user_id = (select auth.uid())
$$;

create or replace function private.current_user_group_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select distinct gm.group_id
  from public.group_memberships gm
  join public.families f on f.id = gm.family_id
  where gm.status = 'active'
    and f.owner_user_id = (select auth.uid())
$$;

create or replace function private.current_user_admin_group_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select distinct gm.group_id
  from public.group_memberships gm
  join public.families f on f.id = gm.family_id
  where gm.status = 'active'
    and gm.role = 'admin'
    and f.owner_user_id = (select auth.uid())
$$;

revoke all on function private.current_user_family_ids() from public;
revoke all on function private.current_user_group_ids() from public;
revoke all on function private.current_user_admin_group_ids() from public;
grant execute on function private.current_user_family_ids() to authenticated;
grant execute on function private.current_user_group_ids() to authenticated;
grant execute on function private.current_user_admin_group_ids() to authenticated;

create or replace function private.enforce_group_membership_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max_members integer;
  v_active_count integer;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = new.profile_id
      and p.family_id = new.family_id
      and p.archived = false
  ) then
    raise exception 'Profile does not belong to the supplied family or is archived';
  end if;

  if tg_op = 'UPDATE' and (
    old.group_id is distinct from new.group_id or
    old.family_id is distinct from new.family_id or
    old.profile_id is distinct from new.profile_id
  ) then
    raise exception 'Membership identity cannot be reassigned';
  end if;

  select g.max_members into v_max_members
  from public.groups g
  where g.id = new.group_id and g.status = 'active'
  for update;

  if v_max_members is null then
    raise exception 'Group is not active';
  end if;

  if new.status = 'active' and (
    tg_op = 'INSERT' or old.status is distinct from 'active'
  ) then
    select count(*) into v_active_count
    from public.group_memberships gm
    where gm.group_id = new.group_id
      and gm.status = 'active'
      and (tg_op = 'INSERT' or gm.id <> new.id);

    if v_active_count >= v_max_members then
      raise exception 'Group member limit reached';
    end if;
  end if;

  if new.status = 'active' then
    new.left_at := null;
  elsif tg_op = 'UPDATE' and old.status = 'active' and new.left_at is null then
    new.left_at := now();
  end if;

  return new;
end
$$;

create or replace function private.prevent_last_group_admin_removal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group_id uuid;
  v_membership_id uuid;
  v_was_admin boolean;
  v_remains_admin boolean;
begin
  if tg_op = 'DELETE' then
    v_group_id := old.group_id;
    v_membership_id := old.id;
    v_was_admin := old.status = 'active' and old.role = 'admin';
    v_remains_admin := false;
  else
    v_group_id := old.group_id;
    v_membership_id := old.id;
    v_was_admin := old.status = 'active' and old.role = 'admin';
    v_remains_admin := new.status = 'active' and new.role = 'admin';
  end if;

  if v_was_admin and not v_remains_admin
    and exists (select 1 from public.groups g where g.id = v_group_id)
    and not exists (
      select 1 from public.group_memberships gm
      where gm.group_id = v_group_id
        and gm.id <> v_membership_id
        and gm.status = 'active'
        and gm.role = 'admin'
    )
  then
    raise exception 'A group must retain at least one active admin';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$$;

create or replace function private.sync_group_member_directory()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.group_member_directory where membership_id = old.id;
    return old;
  end if;

  if new.status = 'active' then
    insert into public.group_member_directory (
      membership_id, group_id, nickname, role, avatar_id, avatar_frame,
      avatar_frames_enabled, joined_at, updated_at
    ) values (
      new.id, new.group_id, new.nickname, new.role, new.avatar_id, new.avatar_frame,
      new.avatar_frames_enabled, new.joined_at, now()
    )
    on conflict (membership_id) do update set
      group_id = excluded.group_id,
      nickname = excluded.nickname,
      role = excluded.role,
      avatar_id = excluded.avatar_id,
      avatar_frame = excluded.avatar_frame,
      avatar_frames_enabled = excluded.avatar_frames_enabled,
      joined_at = excluded.joined_at,
      updated_at = now();
  else
    delete from public.group_member_directory where membership_id = new.id;
  end if;

  return new;
end
$$;

revoke all on function private.enforce_group_membership_integrity() from public;
revoke all on function private.prevent_last_group_admin_removal() from public;
revoke all on function private.sync_group_member_directory() from public;

create trigger trg_groups_updated
before update on public.groups
for each row execute function public.set_updated_at();
create trigger trg_group_memberships_updated
before update on public.group_memberships
for each row execute function public.set_updated_at();
create trigger trg_group_invites_updated
before update on public.group_invites
for each row execute function public.set_updated_at();

create trigger trg_group_membership_integrity
before insert or update on public.group_memberships
for each row execute function private.enforce_group_membership_integrity();
create trigger trg_group_last_admin_guard
before update or delete on public.group_memberships
for each row execute function private.prevent_last_group_admin_removal();
create trigger trg_group_member_directory_sync
after insert or update or delete on public.group_memberships
for each row execute function private.sync_group_member_directory();

alter table public.groups enable row level security;
alter table public.group_memberships enable row level security;
alter table public.group_member_directory enable row level security;
alter table public.group_invites enable row level security;

-- Stage 1 is deliberately read-only through the Data API. Stage 2 will add
-- narrowly scoped authenticated RPCs for create/join/leave/invite/admin actions.
revoke all on table public.groups from anon, authenticated;
revoke all on table public.group_memberships from anon, authenticated;
revoke all on table public.group_member_directory from anon, authenticated;
revoke all on table public.group_invites from anon, authenticated;

grant select on table public.groups to authenticated;
grant select on table public.group_memberships to authenticated;
grant select on table public.group_member_directory to authenticated;
grant select on table public.group_invites to authenticated;

create policy groups_member_select
on public.groups for select
to authenticated
using (id in (select private.current_user_group_ids()));

-- Raw membership rows contain ownership identifiers and are visible only to
-- the owning family account, not to other group members.
create policy group_memberships_owner_select
on public.group_memberships for select
to authenticated
using (family_id in (select private.current_user_family_ids()));

-- Cross-family group members read only the safe competitive directory.
create policy group_member_directory_member_select
on public.group_member_directory for select
to authenticated
using (group_id in (select private.current_user_group_ids()));

create policy group_invites_admin_select
on public.group_invites for select
to authenticated
using (group_id in (select private.current_user_admin_group_ids()));
