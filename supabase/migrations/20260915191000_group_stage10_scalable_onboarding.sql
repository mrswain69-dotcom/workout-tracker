-- Group Stage 10 — scalable team onboarding & member management
-- Adds reusable Group join codes/links, approval workflow, and 50-member capacity.
-- Existing one-use invites remain valid for backwards-compatible private invitations.

-- Raise the original small-group ceiling without changing competition/privacy authority.
alter table public.groups drop constraint if exists groups_max_members_check;
alter table public.groups alter column max_members set default 50;
update public.groups set max_members = 50 where max_members = 20;
alter table public.groups add constraint groups_max_members_check check (max_members between 2 and 50);

alter table public.group_invites drop constraint if exists group_invites_max_uses_check;
alter table public.group_invites add constraint group_invites_max_uses_check check (max_uses between 1 and 50);

alter table public.groups
  add column if not exists join_mode text not null default 'approval'
  check (join_mode in ('approval','instant','closed'));

-- Reusable Group join secrets are deliberately stored in the non-exposed private schema.
-- They are not account passwords; they are revocable Group access secrets. The plaintext
-- must be retrievable by authenticated Group Admins so a coach can re-share one stable code.
create table if not exists private.group_join_access (
  group_id uuid primary key references public.groups(id) on delete cascade,
  join_code_normalized text not null unique,
  created_at timestamptz not null default now(),
  rotated_at timestamptz not null default now(),
  check (join_code_normalized ~ '^[0-9A-F]{16}$')
);
revoke all on table private.group_join_access from public, anon, authenticated;
grant all on table private.group_join_access to service_role;

-- Pending approval requests stay private because they contain owning family/profile ids.
-- Admins can only read the safe RPC projection defined below.
create table if not exists private.group_join_requests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  requested_nickname text not null,
  avatar_id text not null default '',
  avatar_frame text not null default '',
  avatar_frames_enabled boolean not null default true,
  status text not null default 'pending' check (status in ('pending','approved','declined','cancelled')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by_membership_id uuid references public.group_memberships(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requested_nickname = btrim(requested_nickname) and char_length(requested_nickname) between 1 and 32 and requested_nickname !~ '[\r\n\t]'),
  check (char_length(avatar_id) <= 160),
  check (char_length(avatar_frame) <= 80)
);
create unique index if not exists group_join_requests_one_pending_profile
  on private.group_join_requests(group_id, profile_id)
  where status = 'pending';
create index if not exists group_join_requests_group_pending_idx
  on private.group_join_requests(group_id, requested_at)
  where status = 'pending';
revoke all on table private.group_join_requests from public, anon, authenticated;
grant all on table private.group_join_requests to service_role;

create or replace function private.normalise_group_join_code(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(regexp_replace(coalesce(p_code, ''), '[^0-9A-Za-z]', '', 'g'))
$$;

create or replace function private.format_group_join_code(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when char_length(coalesce(p_code, '')) = 16 then
      substring(p_code from 1 for 4) || '-' ||
      substring(p_code from 5 for 4) || '-' ||
      substring(p_code from 9 for 4) || '-' ||
      substring(p_code from 13 for 4)
    else coalesce(p_code, '')
  end
$$;

create or replace function private.generate_group_join_code()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  loop
    v_code := upper(encode(extensions.gen_random_bytes(8), 'hex'));
    exit when not exists (
      select 1 from private.group_join_access a where a.join_code_normalized = v_code
    );
  end loop;
  return v_code;
end
$$;

revoke all on function private.normalise_group_join_code(text) from public, anon, authenticated;
revoke all on function private.format_group_join_code(text) from public, anon, authenticated;
revoke all on function private.generate_group_join_code() from public, anon, authenticated;

create or replace function private.ensure_group_join_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.group_join_access(group_id, join_code_normalized)
  values (new.id, private.generate_group_join_code())
  on conflict (group_id) do nothing;
  return new;
end
$$;
revoke all on function private.ensure_group_join_access() from public, anon, authenticated;

drop trigger if exists trg_groups_ensure_join_access on public.groups;
create trigger trg_groups_ensure_join_access
after insert on public.groups
for each row execute function private.ensure_group_join_access();

-- Existing Groups gain one stable reusable code. No memberships or invites are changed.
do $$
declare
  v_group record;
begin
  for v_group in select id from public.groups loop
    insert into private.group_join_access(group_id, join_code_normalized)
    values (v_group.id, private.generate_group_join_code())
    on conflict (group_id) do nothing;
  end loop;
end
$$;

create or replace function public.group_get_join_settings(p_group_id uuid)
returns table (
  group_id uuid,
  join_mode text,
  join_code text,
  max_members smallint,
  active_members integer,
  pending_requests integer,
  rotated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from private.current_user_admin_group_ids() x where x = p_group_id) then
    raise exception 'Group admin access required';
  end if;

  return query
  select g.id,
         g.join_mode,
         private.format_group_join_code(a.join_code_normalized),
         g.max_members,
         (select count(*)::integer from public.group_memberships gm where gm.group_id = g.id and gm.status = 'active'),
         (select count(*)::integer from private.group_join_requests jr where jr.group_id = g.id and jr.status = 'pending'),
         a.rotated_at
  from public.groups g
  join private.group_join_access a on a.group_id = g.id
  where g.id = p_group_id and g.status = 'active';
end
$$;

create or replace function public.group_rotate_join_code(p_group_id uuid)
returns table (join_code text, rotated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
  v_rotated timestamptz := now();
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from private.current_user_admin_group_ids() x where x = p_group_id) then
    raise exception 'Group admin access required';
  end if;

  v_code := private.generate_group_join_code();
  insert into private.group_join_access(group_id, join_code_normalized, rotated_at)
  values (p_group_id, v_code, v_rotated)
  on conflict (group_id) do update set
    join_code_normalized = excluded.join_code_normalized,
    rotated_at = excluded.rotated_at;

  return query select private.format_group_join_code(v_code), v_rotated;
end
$$;

create or replace function public.group_set_join_mode(p_group_id uuid, p_join_mode text)
returns table (group_id uuid, join_mode text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mode text := lower(btrim(coalesce(p_join_mode, '')));
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if v_mode not in ('approval','instant','closed') then raise exception 'Invalid Group join mode'; end if;
  if not exists (select 1 from private.current_user_admin_group_ids() x where x = p_group_id) then
    raise exception 'Group admin access required';
  end if;

  update public.groups g set join_mode = v_mode where g.id = p_group_id and g.status = 'active';
  if not found then raise exception 'Group not found'; end if;
  return query select p_group_id, v_mode;
end
$$;

-- One preview surface accepts either the reusable Group code or an existing private one-use invite.
create or replace function public.group_preview_join_code(p_join_code text)
returns table (
  code_kind text,
  group_id uuid,
  group_name text,
  group_type text,
  join_mode text,
  active_members integer,
  max_members smallint,
  expires_at timestamptz,
  remaining_uses integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_shared text := private.normalise_group_join_code(p_join_code);
  v_legacy text := lower(btrim(coalesce(p_join_code, '')));
  v_hash text;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if v_shared = '' then return; end if;

  return query
  select 'shared'::text,
         g.id,
         g.name,
         g.group_type,
         g.join_mode,
         (select count(*)::integer from public.group_memberships gm where gm.group_id = g.id and gm.status = 'active'),
         g.max_members,
         null::timestamptz,
         null::integer
  from private.group_join_access a
  join public.groups g on g.id = a.group_id
  where a.join_code_normalized = v_shared and g.status = 'active'
  limit 1;
  if found then return; end if;

  v_hash := encode(extensions.digest(v_legacy, 'sha256'), 'hex');
  return query
  select 'private_invite'::text,
         g.id,
         g.name,
         g.group_type,
         'instant'::text,
         (select count(*)::integer from public.group_memberships gm where gm.group_id = g.id and gm.status = 'active'),
         g.max_members,
         gi.expires_at,
         greatest(0, gi.max_uses::integer - gi.use_count::integer)
  from public.group_invites gi
  join public.groups g on g.id = gi.group_id
  where gi.code_hash = v_hash
    and gi.revoked_at is null
    and gi.expires_at > now()
    and gi.use_count < gi.max_uses
    and g.status = 'active'
  limit 1;
end
$$;

create or replace function public.group_join_or_request(
  p_profile_id uuid,
  p_join_code text,
  p_nickname text default null
)
returns table (
  group_id uuid,
  membership_id uuid,
  request_id uuid,
  join_status text,
  code_kind text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_family_id uuid;
  v_profile_name text;
  v_avatar_id text;
  v_avatar_frame text;
  v_avatar_frames_enabled boolean;
  v_shared text := private.normalise_group_join_code(p_join_code);
  v_legacy text := lower(btrim(coalesce(p_join_code, '')));
  v_hash text;
  v_group_id uuid;
  v_mode text;
  v_membership_id uuid;
  v_request_id uuid;
  v_invite_id uuid;
  v_nickname text;
  v_max_members integer;
  v_active_count integer;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;

  select s.family_id, s.profile_name, s.avatar_id, s.avatar_frame, s.avatar_frames_enabled
    into v_family_id, v_profile_name, v_avatar_id, v_avatar_frame, v_avatar_frames_enabled
  from private.group_owned_profile_snapshot(p_profile_id) s;
  if v_family_id is null then raise exception 'Profile is not available to the current account'; end if;

  v_nickname := btrim(coalesce(nullif(p_nickname, ''), v_profile_name, ''));
  if char_length(v_nickname) < 1 or char_length(v_nickname) > 32 or v_nickname ~ E'[\r\n\t]' then
    raise exception 'Group nickname must be 1 to 32 characters';
  end if;

  -- Reusable team code path.
  select g.id, g.join_mode, g.max_members
    into v_group_id, v_mode, v_max_members
  from private.group_join_access a
  join public.groups g on g.id = a.group_id
  where a.join_code_normalized = v_shared and g.status = 'active'
  for update of g;

  if v_group_id is not null then
    select gm.id into v_membership_id
    from public.group_memberships gm
    where gm.group_id = v_group_id and gm.profile_id = p_profile_id and gm.status = 'active'
    limit 1;
    if v_membership_id is not null then
      return query select v_group_id, v_membership_id, null::uuid, 'joined'::text, 'shared'::text;
      return;
    end if;

    if v_mode = 'closed' then raise exception 'This Group is not accepting new members right now'; end if;

    select count(*) into v_active_count
    from public.group_memberships gm where gm.group_id = v_group_id and gm.status = 'active';
    if v_active_count >= v_max_members then raise exception 'Group member limit reached'; end if;

    if v_mode = 'approval' then
      select jr.id into v_request_id
      from private.group_join_requests jr
      where jr.group_id = v_group_id and jr.profile_id = p_profile_id and jr.status = 'pending'
      for update;

      if v_request_id is null then
        insert into private.group_join_requests (
          group_id, family_id, profile_id, requested_nickname,
          avatar_id, avatar_frame, avatar_frames_enabled
        ) values (
          v_group_id, v_family_id, p_profile_id, v_nickname,
          v_avatar_id, v_avatar_frame, v_avatar_frames_enabled
        ) returning id into v_request_id;
      else
        update private.group_join_requests set
          requested_nickname = v_nickname,
          avatar_id = v_avatar_id,
          avatar_frame = v_avatar_frame,
          avatar_frames_enabled = v_avatar_frames_enabled,
          requested_at = now(),
          updated_at = now()
        where id = v_request_id;
      end if;

      return query select v_group_id, null::uuid, v_request_id, 'pending'::text, 'shared'::text;
      return;
    end if;

    insert into public.group_memberships (
      group_id, family_id, profile_id, role, nickname,
      avatar_id, avatar_frame, avatar_frames_enabled
    ) values (
      v_group_id, v_family_id, p_profile_id, 'member', v_nickname,
      v_avatar_id, v_avatar_frame, v_avatar_frames_enabled
    ) returning id into v_membership_id;

    return query select v_group_id, v_membership_id, null::uuid, 'joined'::text, 'shared'::text;
    return;
  end if;

  -- Backwards-compatible one-use/private invite path.
  if v_legacy = '' then raise exception 'Group code or invite code is required'; end if;
  v_hash := encode(extensions.digest(v_legacy, 'sha256'), 'hex');

  select gi.id, gi.group_id into v_invite_id, v_group_id
  from public.group_invites gi
  join public.groups g on g.id = gi.group_id
  where gi.code_hash = v_hash
    and gi.revoked_at is null
    and gi.expires_at > now()
    and gi.use_count < gi.max_uses
    and g.status = 'active'
  for update of gi, g;

  if v_invite_id is null then raise exception 'Group code or invite is invalid, expired, revoked, or fully used'; end if;
  if exists (
    select 1 from public.group_memberships gm
    where gm.group_id = v_group_id and gm.profile_id = p_profile_id and gm.status = 'active'
  ) then raise exception 'This athlete is already an active member of the Group'; end if;

  insert into public.group_memberships (
    group_id, family_id, profile_id, role, nickname,
    avatar_id, avatar_frame, avatar_frames_enabled
  ) values (
    v_group_id, v_family_id, p_profile_id, 'member', v_nickname,
    v_avatar_id, v_avatar_frame, v_avatar_frames_enabled
  ) returning id into v_membership_id;

  update public.group_invites set use_count = use_count + 1, updated_at = now() where id = v_invite_id;
  return query select v_group_id, v_membership_id, null::uuid, 'joined'::text, 'private_invite'::text;
end
$$;

create or replace function public.group_list_join_requests(p_group_id uuid)
returns table (
  request_id uuid,
  nickname text,
  avatar_id text,
  avatar_frame text,
  avatar_frames_enabled boolean,
  requested_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from private.current_user_admin_group_ids() x where x = p_group_id) then
    raise exception 'Group admin access required';
  end if;

  return query
  select jr.id, jr.requested_nickname, jr.avatar_id, jr.avatar_frame,
         jr.avatar_frames_enabled, jr.requested_at
  from private.group_join_requests jr
  where jr.group_id = p_group_id and jr.status = 'pending'
  order by jr.requested_at asc, jr.id asc;
end
$$;

create or replace function public.group_review_join_request(
  p_group_id uuid,
  p_request_id uuid,
  p_decision text
)
returns table (request_id uuid, review_status text, membership_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_decision text := lower(btrim(coalesce(p_decision, '')));
  v_admin_membership_id uuid;
  v_family_id uuid;
  v_profile_id uuid;
  v_nickname text;
  v_avatar_id text;
  v_avatar_frame text;
  v_avatar_frames_enabled boolean;
  v_membership_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if v_decision not in ('approve','decline') then raise exception 'Decision must be approve or decline'; end if;

  select gm.id into v_admin_membership_id
  from public.group_memberships gm
  join public.families f on f.id = gm.family_id
  where gm.group_id = p_group_id
    and gm.status = 'active'
    and gm.role = 'admin'
    and f.owner_user_id = (select auth.uid())
  order by gm.joined_at, gm.id
  limit 1;
  if v_admin_membership_id is null then raise exception 'Group admin access required'; end if;

  select jr.family_id, jr.profile_id, jr.requested_nickname,
         jr.avatar_id, jr.avatar_frame, jr.avatar_frames_enabled
    into v_family_id, v_profile_id, v_nickname,
         v_avatar_id, v_avatar_frame, v_avatar_frames_enabled
  from private.group_join_requests jr
  where jr.id = p_request_id and jr.group_id = p_group_id and jr.status = 'pending'
  for update;
  if v_profile_id is null then raise exception 'Pending join request not found'; end if;

  if v_decision = 'decline' then
    update private.group_join_requests set
      status = 'declined',
      reviewed_at = now(),
      reviewed_by_membership_id = v_admin_membership_id,
      updated_at = now()
    where id = p_request_id;
    return query select p_request_id, 'declined'::text, null::uuid;
    return;
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = v_profile_id and p.family_id = v_family_id and p.archived = false
  ) then raise exception 'Requested athlete profile is no longer available'; end if;

  select gm.id into v_membership_id
  from public.group_memberships gm
  where gm.group_id = p_group_id and gm.profile_id = v_profile_id and gm.status = 'active'
  limit 1;

  if v_membership_id is null then
    -- Refresh only the safe cosmetic snapshot at approval time.
    select coalesce(p.plan_json->'meta'->>'avatarId', ''),
           coalesce(p.plan_json->'meta'->>'avatarFrame', ''),
           case
             when jsonb_typeof(p.plan_json->'meta'->'avatarFramesEnabled') = 'boolean'
               then (p.plan_json->'meta'->>'avatarFramesEnabled')::boolean
             else true
           end
      into v_avatar_id, v_avatar_frame, v_avatar_frames_enabled
    from public.profiles p
    where p.id = v_profile_id and p.family_id = v_family_id;

    insert into public.group_memberships (
      group_id, family_id, profile_id, role, nickname,
      avatar_id, avatar_frame, avatar_frames_enabled
    ) values (
      p_group_id, v_family_id, v_profile_id, 'member', v_nickname,
      v_avatar_id, v_avatar_frame, v_avatar_frames_enabled
    ) returning id into v_membership_id;
  end if;

  update private.group_join_requests set
    status = 'approved',
    reviewed_at = now(),
    reviewed_by_membership_id = v_admin_membership_id,
    updated_at = now()
  where id = p_request_id;

  return query select p_request_id, 'approved'::text, v_membership_id;
end
$$;

-- Keep all Stage 10 public functions narrow and authenticated.
revoke execute on function public.group_get_join_settings(uuid) from public, anon, authenticated;
revoke execute on function public.group_rotate_join_code(uuid) from public, anon, authenticated;
revoke execute on function public.group_set_join_mode(uuid,text) from public, anon, authenticated;
revoke execute on function public.group_preview_join_code(text) from public, anon, authenticated;
revoke execute on function public.group_join_or_request(uuid,text,text) from public, anon, authenticated;
revoke execute on function public.group_list_join_requests(uuid) from public, anon, authenticated;
revoke execute on function public.group_review_join_request(uuid,uuid,text) from public, anon, authenticated;

grant execute on function public.group_get_join_settings(uuid) to authenticated;
grant execute on function public.group_rotate_join_code(uuid) to authenticated;
grant execute on function public.group_set_join_mode(uuid,text) to authenticated;
grant execute on function public.group_preview_join_code(text) to authenticated;
grant execute on function public.group_join_or_request(uuid,text,text) to authenticated;
grant execute on function public.group_list_join_requests(uuid) to authenticated;
grant execute on function public.group_review_join_request(uuid,uuid,text) to authenticated;

comment on column public.groups.join_mode is
  'Reusable Group-code behaviour: approval (default), instant join, or closed.';
comment on table private.group_join_access is
  'Server-only reusable Group join secret, retrievable only through Admin-authorized RPCs.';
comment on table private.group_join_requests is
  'Server-only pending join requests. Cross-family ownership identifiers are never returned by the safe Admin RPC.';
