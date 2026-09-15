-- Group Stage 10 concurrency hardening
-- Replaces the reusable join/request RPC so code rotation and duplicate submissions
-- serialize cleanly without changing the public contract.

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

  -- Lock both the reusable access row and Group row. Rotating a code and consuming
  -- that same code therefore cannot race each other.
  select g.id, g.join_mode, g.max_members
    into v_group_id, v_mode, v_max_members
  from private.group_join_access a
  join public.groups g on g.id = a.group_id
  where a.join_code_normalized = v_shared and g.status = 'active'
  for update of a, g;

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
      -- The partial unique index makes duplicate requests idempotent even when the
      -- same athlete submits from two devices at nearly the same time.
      insert into private.group_join_requests (
        group_id, family_id, profile_id, requested_nickname,
        avatar_id, avatar_frame, avatar_frames_enabled
      ) values (
        v_group_id, v_family_id, p_profile_id, v_nickname,
        v_avatar_id, v_avatar_frame, v_avatar_frames_enabled
      )
      on conflict (group_id, profile_id) where status = 'pending'
      do update set
        requested_nickname = excluded.requested_nickname,
        avatar_id = excluded.avatar_id,
        avatar_frame = excluded.avatar_frame,
        avatar_frames_enabled = excluded.avatar_frames_enabled,
        requested_at = now(),
        updated_at = now()
      returning id into v_request_id;

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

  -- Backwards-compatible one-use/private invite path remains unchanged.
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

revoke execute on function public.group_join_or_request(uuid,text,text) from public, anon, authenticated;
grant execute on function public.group_join_or_request(uuid,text,text) to authenticated;
