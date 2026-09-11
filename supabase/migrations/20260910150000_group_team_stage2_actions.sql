-- Workout Tracker Group & Team Ecosystem Stage 2
-- Authenticated Group actions and automatic cosmetic identity sync.
-- Additive only: no leaderboard scoring and no historical workout/Assessment rewrites.

create or replace function private.group_owned_profile_snapshot(p_profile_id uuid)
returns table (
  family_id uuid,
  profile_name text,
  avatar_id text,
  avatar_frame text,
  avatar_frames_enabled boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.family_id,
    p.name,
    coalesce(p.plan_json->'meta'->>'avatarId', ''),
    coalesce(p.plan_json->'meta'->>'avatarFrame', ''),
    case
      when jsonb_typeof(p.plan_json->'meta'->'avatarFramesEnabled') = 'boolean'
        then (p.plan_json->'meta'->>'avatarFramesEnabled')::boolean
      else true
    end
  from public.profiles p
  join public.families f on f.id = p.family_id
  where p.id = p_profile_id
    and p.archived = false
    and f.owner_user_id = (select auth.uid())
  limit 1
$$;

create or replace function public.group_create(
  p_profile_id uuid,
  p_name text,
  p_nickname text default null,
  p_description text default '',
  p_group_type text default 'private'
)
returns table (group_id uuid, membership_id uuid)
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
  v_group_id uuid;
  v_membership_id uuid;
  v_name text := btrim(coalesce(p_name, ''));
  v_description text := btrim(coalesce(p_description, ''));
  v_type text := lower(btrim(coalesce(p_group_type, 'private')));
  v_nickname text;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;

  select s.family_id, s.profile_name, s.avatar_id, s.avatar_frame, s.avatar_frames_enabled
  into v_family_id, v_profile_name, v_avatar_id, v_avatar_frame, v_avatar_frames_enabled
  from private.group_owned_profile_snapshot(p_profile_id) s;

  if v_family_id is null then raise exception 'Profile is not available to the current account'; end if;
  if char_length(v_name) < 2 or char_length(v_name) > 80 or v_name ~ E'[\\r\\n\\t]' then raise exception 'Group name must be 2 to 80 characters'; end if;
  if char_length(v_description) > 500 then raise exception 'Group description must be 500 characters or fewer'; end if;
  if v_type not in ('private','squad','club') then raise exception 'Invalid group type'; end if;

  v_nickname := btrim(coalesce(nullif(p_nickname, ''), v_profile_name, ''));
  if char_length(v_nickname) < 1 or char_length(v_nickname) > 32 or v_nickname ~ E'[\\r\\n\\t]' then raise exception 'Group nickname must be 1 to 32 characters'; end if;

  insert into public.groups (name, description, group_type, created_by_family_id, created_by_profile_id)
  values (v_name, v_description, v_type, v_family_id, p_profile_id)
  returning id into v_group_id;

  insert into public.group_memberships (
    group_id, family_id, profile_id, role, nickname, avatar_id, avatar_frame, avatar_frames_enabled
  ) values (
    v_group_id, v_family_id, p_profile_id, 'admin', v_nickname, v_avatar_id, v_avatar_frame, v_avatar_frames_enabled
  ) returning id into v_membership_id;

  return query select v_group_id, v_membership_id;
end
$$;

create or replace function public.group_create_invite(
  p_group_id uuid,
  p_expires_in_days integer default 7,
  p_max_uses integer default 1
)
returns table (invite_id uuid, invite_code text, code_hint text, expires_at timestamptz, max_uses smallint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
  v_hash text;
  v_hint text;
  v_expires timestamptz;
  v_invite_id uuid;
  v_membership_id uuid;
  v_days integer := coalesce(p_expires_in_days, 7);
  v_uses integer := coalesce(p_max_uses, 1);
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from private.current_user_admin_group_ids() x where x = p_group_id) then raise exception 'Group admin access required'; end if;
  if not exists (select 1 from public.groups g where g.id = p_group_id and g.status = 'active') then raise exception 'Group is not active'; end if;
  if v_days < 1 or v_days > 30 then raise exception 'Invite expiry must be between 1 and 30 days'; end if;
  if v_uses < 1 or v_uses > 20 then raise exception 'Invite max uses must be between 1 and 20'; end if;

  select gm.id into v_membership_id
  from public.group_memberships gm
  join public.families f on f.id = gm.family_id
  where gm.group_id = p_group_id and gm.status = 'active' and gm.role = 'admin'
    and f.owner_user_id = (select auth.uid())
  order by gm.joined_at, gm.id limit 1;

  loop
    v_code := encode(extensions.gen_random_bytes(18), 'hex');
    v_hash := encode(extensions.digest(v_code, 'sha256'), 'hex');
    exit when not exists (select 1 from public.group_invites gi where gi.code_hash = v_hash);
  end loop;

  v_hint := substring(v_code from 1 for 4) || '…' || right(v_code, 4);
  v_expires := now() + make_interval(days => v_days);

  insert into public.group_invites (
    group_id, code_hash, code_hint, created_by_membership_id, expires_at, max_uses
  ) values (p_group_id, v_hash, v_hint, v_membership_id, v_expires, v_uses)
  returning id into v_invite_id;

  return query select v_invite_id, v_code, v_hint, v_expires, v_uses::smallint;
end
$$;

create or replace function public.group_preview_invite(p_invite_code text)
returns table (group_id uuid, group_name text, group_type text, expires_at timestamptz, remaining_uses integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_code text := lower(btrim(coalesce(p_invite_code, '')));
  v_hash text;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if v_code = '' then return; end if;
  v_hash := encode(extensions.digest(v_code, 'sha256'), 'hex');

  return query
  select g.id, g.name, g.group_type, gi.expires_at,
         greatest(0, gi.max_uses::integer - gi.use_count::integer)
  from public.group_invites gi
  join public.groups g on g.id = gi.group_id
  where gi.code_hash = v_hash and gi.revoked_at is null and gi.expires_at > now()
    and gi.use_count < gi.max_uses and g.status = 'active'
  limit 1;
end
$$;

create or replace function public.group_join(
  p_profile_id uuid,
  p_invite_code text,
  p_nickname text default null
)
returns table (group_id uuid, membership_id uuid)
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
  v_group_id uuid;
  v_invite_id uuid;
  v_membership_id uuid;
  v_code text := lower(btrim(coalesce(p_invite_code, '')));
  v_hash text;
  v_nickname text;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;

  select s.family_id, s.profile_name, s.avatar_id, s.avatar_frame, s.avatar_frames_enabled
  into v_family_id, v_profile_name, v_avatar_id, v_avatar_frame, v_avatar_frames_enabled
  from private.group_owned_profile_snapshot(p_profile_id) s;

  if v_family_id is null then raise exception 'Profile is not available to the current account'; end if;
  if v_code = '' then raise exception 'Invite code is required'; end if;
  v_hash := encode(extensions.digest(v_code, 'sha256'), 'hex');

  select gi.id, gi.group_id into v_invite_id, v_group_id
  from public.group_invites gi
  join public.groups g on g.id = gi.group_id
  where gi.code_hash = v_hash and gi.revoked_at is null and gi.expires_at > now()
    and gi.use_count < gi.max_uses and g.status = 'active'
  for update of gi, g;

  if v_invite_id is null then raise exception 'Invite is invalid, expired, revoked, or fully used'; end if;
  if exists (
    select 1 from public.group_memberships gm
    where gm.group_id = v_group_id and gm.profile_id = p_profile_id and gm.status = 'active'
  ) then raise exception 'This athlete is already an active member of the Group'; end if;

  v_nickname := btrim(coalesce(nullif(p_nickname, ''), v_profile_name, ''));
  if char_length(v_nickname) < 1 or char_length(v_nickname) > 32 or v_nickname ~ E'[\\r\\n\\t]' then raise exception 'Group nickname must be 1 to 32 characters'; end if;

  insert into public.group_memberships (
    group_id, family_id, profile_id, role, nickname, avatar_id, avatar_frame, avatar_frames_enabled
  ) values (
    v_group_id, v_family_id, p_profile_id, 'member', v_nickname, v_avatar_id, v_avatar_frame, v_avatar_frames_enabled
  ) returning id into v_membership_id;

  update public.group_invites set use_count = use_count + 1, updated_at = now() where id = v_invite_id;
  return query select v_group_id, v_membership_id;
end
$$;

create or replace function public.group_update_nickname(p_group_id uuid, p_profile_id uuid, p_nickname text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_nickname text := btrim(coalesce(p_nickname, ''));
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if char_length(v_nickname) < 1 or char_length(v_nickname) > 32 or v_nickname ~ E'[\\r\\n\\t]' then raise exception 'Group nickname must be 1 to 32 characters'; end if;
  update public.group_memberships gm set nickname = v_nickname
  where gm.group_id = p_group_id and gm.profile_id = p_profile_id and gm.status = 'active'
    and gm.family_id in (select private.current_user_family_ids());
  if not found then raise exception 'Active Group membership not found for this athlete'; end if;
end $$;

create or replace function public.group_leave(p_group_id uuid, p_profile_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  update public.group_memberships gm set status = 'left', left_at = now()
  where gm.group_id = p_group_id and gm.profile_id = p_profile_id and gm.status = 'active'
    and gm.family_id in (select private.current_user_family_ids());
  if not found then raise exception 'Active Group membership not found for this athlete'; end if;
end $$;

create or replace function public.group_update_details(
  p_group_id uuid, p_name text default null, p_description text default null, p_group_type text default null
)
returns void language plpgsql security definer set search_path = '' as $$
declare v_name text; v_description text; v_type text;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from private.current_user_admin_group_ids() x where x = p_group_id) then raise exception 'Group admin access required'; end if;
  select g.name, g.description, g.group_type into v_name, v_description, v_type from public.groups g where g.id = p_group_id for update;
  if v_name is null then raise exception 'Group not found'; end if;
  if p_name is not null then v_name := btrim(p_name); end if;
  if p_description is not null then v_description := btrim(p_description); end if;
  if p_group_type is not null then v_type := lower(btrim(p_group_type)); end if;
  if char_length(v_name) < 2 or char_length(v_name) > 80 or v_name ~ E'[\\r\\n\\t]' then raise exception 'Group name must be 2 to 80 characters'; end if;
  if char_length(v_description) > 500 then raise exception 'Group description must be 500 characters or fewer'; end if;
  if v_type not in ('private','squad','club') then raise exception 'Invalid group type'; end if;
  update public.groups set name=v_name, description=v_description, group_type=v_type where id=p_group_id;
end $$;

create or replace function public.group_set_member_role(p_group_id uuid, p_membership_id uuid, p_role text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_role text := lower(btrim(coalesce(p_role, '')));
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if v_role not in ('admin','member') then raise exception 'Invalid Group role'; end if;
  if not exists (select 1 from private.current_user_admin_group_ids() x where x = p_group_id) then raise exception 'Group admin access required'; end if;
  update public.group_memberships gm set role=v_role where gm.id=p_membership_id and gm.group_id=p_group_id and gm.status='active';
  if not found then raise exception 'Active Group member not found'; end if;
end $$;

create or replace function public.group_remove_member(p_group_id uuid, p_membership_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from private.current_user_admin_group_ids() x where x = p_group_id) then raise exception 'Group admin access required'; end if;
  update public.group_memberships gm set status='removed', left_at=now()
  where gm.id=p_membership_id and gm.group_id=p_group_id and gm.status='active';
  if not found then raise exception 'Active Group member not found'; end if;
end $$;

create or replace function public.group_revoke_invite(p_invite_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_group_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select gi.group_id into v_group_id from public.group_invites gi where gi.id=p_invite_id;
  if v_group_id is null or not exists (select 1 from private.current_user_admin_group_ids() x where x=v_group_id) then raise exception 'Group admin access required'; end if;
  update public.group_invites set revoked_at=coalesce(revoked_at,now()), updated_at=now() where id=p_invite_id;
end $$;

create or replace function private.sync_group_cosmetics_from_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_avatar_id text; v_avatar_frame text; v_avatar_frames_enabled boolean;
begin
  if new.plan_json is not distinct from old.plan_json then return new; end if;
  v_avatar_id := coalesce(new.plan_json->'meta'->>'avatarId', '');
  v_avatar_frame := coalesce(new.plan_json->'meta'->>'avatarFrame', '');
  v_avatar_frames_enabled := case
    when jsonb_typeof(new.plan_json->'meta'->'avatarFramesEnabled')='boolean'
      then (new.plan_json->'meta'->>'avatarFramesEnabled')::boolean
    else true end;
  update public.group_memberships gm
  set avatar_id=v_avatar_id, avatar_frame=v_avatar_frame, avatar_frames_enabled=v_avatar_frames_enabled
  where gm.profile_id=new.id and gm.family_id=new.family_id and gm.status='active';
  return new;
end $$;

drop trigger if exists trg_profiles_sync_group_cosmetics on public.profiles;
create trigger trg_profiles_sync_group_cosmetics after update of plan_json on public.profiles
for each row execute function private.sync_group_cosmetics_from_profile();

revoke execute on function private.group_owned_profile_snapshot(uuid) from public, anon, authenticated;
revoke execute on function private.sync_group_cosmetics_from_profile() from public, anon, authenticated;
revoke execute on function public.group_create(uuid,text,text,text,text) from public, anon, authenticated;
revoke execute on function public.group_create_invite(uuid,integer,integer) from public, anon, authenticated;
revoke execute on function public.group_preview_invite(text) from public, anon, authenticated;
revoke execute on function public.group_join(uuid,text,text) from public, anon, authenticated;
revoke execute on function public.group_update_nickname(uuid,uuid,text) from public, anon, authenticated;
revoke execute on function public.group_leave(uuid,uuid) from public, anon, authenticated;
revoke execute on function public.group_update_details(uuid,text,text,text) from public, anon, authenticated;
revoke execute on function public.group_set_member_role(uuid,uuid,text) from public, anon, authenticated;
revoke execute on function public.group_remove_member(uuid,uuid) from public, anon, authenticated;
revoke execute on function public.group_revoke_invite(uuid) from public, anon, authenticated;

grant execute on function public.group_create(uuid,text,text,text,text) to authenticated;
grant execute on function public.group_create_invite(uuid,integer,integer) to authenticated;
grant execute on function public.group_preview_invite(text) to authenticated;
grant execute on function public.group_join(uuid,text,text) to authenticated;
grant execute on function public.group_update_nickname(uuid,uuid,text) to authenticated;
grant execute on function public.group_leave(uuid,uuid) to authenticated;
grant execute on function public.group_update_details(uuid,text,text,text) to authenticated;
grant execute on function public.group_set_member_role(uuid,uuid,text) to authenticated;
grant execute on function public.group_remove_member(uuid,uuid) to authenticated;
grant execute on function public.group_revoke_invite(uuid) to authenticated;
