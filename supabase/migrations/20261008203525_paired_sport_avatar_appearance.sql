-- Appearance is cosmetic: existing reward keys and identity periods stay intact.
alter table public.group_member_directory add column sport_avatar_appearance jsonb;

create function private.sync_group_directory_avatar_appearance()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_appearance jsonb;
begin
  select p.plan_json->'meta'->'sportAvatarAppearance' into v_appearance
  from public.group_memberships gm join public.profiles p on p.id=gm.profile_id
  where gm.id=new.membership_id;
  new.sport_avatar_appearance := case
    when v_appearance->>'edition'='paired_v2' and v_appearance->>'variant' in ('male','female')
      then jsonb_build_object('edition','paired_v2','variant',v_appearance->>'variant')
    else null end;
  return new;
end $$;
revoke all on function private.sync_group_directory_avatar_appearance() from public, anon, authenticated;
create trigger trg_group_directory_avatar_appearance
before insert or update on public.group_member_directory for each row
execute function private.sync_group_directory_avatar_appearance();
-- Reuse the trigger to backfill only the two permitted cosmetic fields.
update public.group_member_directory set sport_avatar_appearance=null;

create function public.set_profile_avatar_appearance(p_profile_id uuid, p_avatar_id text, p_appearance jsonb default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_plan jsonb; v_appearance jsonb;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select p.plan_json into v_plan from public.profiles p
  join public.families f on f.id=p.family_id
  where p.id=p_profile_id and f.owner_user_id=(select auth.uid()) for update of p;
  if not found then raise exception 'Profile not found' using errcode='42501'; end if;
  if p_appearance is not null and p_appearance <> 'null'::jsonb then
    if p_appearance->>'edition' is distinct from 'paired_v2'
      or coalesce(p_appearance->>'variant','') not in ('male','female')
      or p_avatar_id !~ '^sport_avatar_football_(bronze|silver|gold|platinum|diamond|elite|champion|unreal)$'
      then raise exception 'Unsupported avatar appearance' using errcode='22023'; end if;
    if not exists (
      select 1 from jsonb_array_elements(case when jsonb_typeof(v_plan->'meta'->'claimedRewards')='array'
        then v_plan->'meta'->'claimedRewards' else '[]'::jsonb end) claim
      where claim->>'key'=p_avatar_id or claim=to_jsonb(p_avatar_id)
    ) then raise exception 'Claim this avatar before using it' using errcode='42501'; end if;
    v_appearance := jsonb_build_object('edition','paired_v2','variant',p_appearance->>'variant');
  else v_appearance := 'null'::jsonb;
  end if;
  -- The existing function owns logical selection periods; same identity is a no-op for history.
  perform public.set_profile_avatar_identity(p_profile_id,p_avatar_id);
  update public.profiles p set plan_json=jsonb_set(p.plan_json,'{meta,sportAvatarAppearance}',v_appearance,true)
  where p.id=p_profile_id returning p.plan_json into v_plan;
  return jsonb_build_object('plan_json',v_plan);
end $$;
revoke all on function public.set_profile_avatar_appearance(uuid,text,jsonb) from public, anon;
grant execute on function public.set_profile_avatar_appearance(uuid,text,jsonb) to authenticated;
