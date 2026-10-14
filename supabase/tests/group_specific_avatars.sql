begin;
do $$
declare v_profile uuid; v_owner uuid; v_group uuid; v_other_group uuid; v_member uuid;
  v_plan jsonb; v_before_periods bigint; v_avatar text; v_new_group record; v_value text;
begin
  select gm.profile_id, f.owner_user_id, gm.group_id, gm.id, p.plan_json
  into v_profile,v_owner,v_group,v_member,v_plan
  from public.group_memberships gm join public.profiles p on p.id=gm.profile_id join public.families f on f.id=p.family_id
  where gm.status='active' and p.archived=false and p.plan_json->'meta'->'unlockedAvatarPacks' ? 'avatar_pack_1' limit 1;
  if v_profile is null then raise exception 'Test requires an active member with starter avatars claimed'; end if;
  perform set_config('request.jwt.claim.sub',v_owner::text,true);
  select count(*) into v_before_periods from public.avatar_selection_periods where profile_id=v_profile;
  select * into v_new_group from public.group_create(v_profile,'Temporary avatar verification','Test');
  v_other_group:=v_new_group.group_id;
  perform public.group_set_avatar(v_group,v_profile,'emoji_rocket');
  if (select avatar_id from public.group_member_directory where membership_id=v_member) <> 'emoji_rocket' then raise exception 'Directory not updated'; end if;
  if (select plan_json from public.profiles where id=v_profile) is distinct from v_plan then raise exception 'Main profile changed'; end if;
  perform public.set_profile_avatar_identity(v_profile,'emoji_tiger');
  if (select avatar_id from public.group_memberships where id=v_member) <> 'emoji_rocket' then raise exception 'Override overwritten'; end if;
  if (select avatar_id from public.group_memberships where group_id=v_other_group and profile_id=v_profile) <> 'emoji_tiger' then raise exception 'Default group did not follow main'; end if;
  perform public.group_set_avatar(v_group,v_profile,null);
  if (select avatar_id from public.group_memberships where id=v_member) <> 'emoji_tiger' then raise exception 'Default reset failed'; end if;
  begin
    perform public.group_set_avatar(v_group,v_profile,'not_an_unlocked_avatar');
    raise exception 'Invalid avatar accepted';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
  begin
    perform public.group_set_avatar(v_group,v_profile,'emoji_rocket');
    raise exception 'Non-owner accepted';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub','',true);
  begin
    perform public.group_set_avatar(v_group,v_profile,'emoji_rocket');
    raise exception 'Unauthenticated caller accepted';
  exception when insufficient_privilege then null; end;
end $$;
select 'PASS: group isolation, main-avatar sync, reset, unlock validation and owner checks' as result;
rollback;
