-- Rollback-only regression check: never leaves changes to athlete data.
begin;
do $$
declare v_profile uuid; v_owner uuid; v_claims jsonb; v_count bigint; v_plan jsonb; v_saved jsonb; v_denied boolean;
begin
 select p.id,f.owner_user_id,p.plan_json into v_profile,v_owner,v_plan
 from public.profiles p join public.families f on f.id=p.family_id
 order by exists(select 1 from public.group_memberships gm where gm.profile_id=p.id and gm.status='active') desc limit 1;
 if v_profile is null then raise exception 'No test profile available'; end if;
 perform set_config('request.jwt.claim.sub','',true);
 v_denied := false;
 begin perform public.set_profile_avatar_appearance(v_profile,'sport_avatar_football_bronze','{"edition":"paired_v2","variant":"male"}');
 exception when insufficient_privilege then v_denied:=true; end;
 if not v_denied then raise exception 'Anonymous selection allowed'; end if;
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
 v_denied:=false;
 begin perform public.set_profile_avatar_appearance(v_profile,'sport_avatar_football_bronze',null);
 exception when insufficient_privilege then v_denied:=true; end;
 if not v_denied then raise exception 'Non-owner selection allowed'; end if;
 perform set_config('request.jwt.claim.sub',v_owner::text,true);
 -- Empty rewards must not allow paired selection.
 update public.profiles set plan_json=jsonb_set(jsonb_set(coalesce(plan_json,'{}'),'{meta}',coalesce(plan_json->'meta','{}')),'{meta,claimedRewards}','[]') where id=v_profile;
 v_denied:=false;
 begin perform public.set_profile_avatar_appearance(v_profile,'sport_avatar_football_bronze','{"edition":"paired_v2","variant":"female"}');
 exception when insufficient_privilege then v_denied:=true; end;
 if not v_denied then raise exception 'Unclaimed selection allowed'; end if;
 update public.profiles set plan_json=jsonb_set(plan_json,'{meta,claimedRewards}','[{"key":"sport_avatar_football_bronze","claimedAtYmd":"2026-10-08"}]') where id=v_profile;
 select plan_json->'meta'->'claimedRewards' into v_claims from public.profiles where id=v_profile;
 perform public.set_profile_avatar_appearance(v_profile,'sport_avatar_football_bronze','{"edition":"paired_v2","variant":"male"}');
 select count(*) into v_count from public.avatar_selection_periods where profile_id=v_profile;
 v_saved:=public.set_profile_avatar_appearance(v_profile,'sport_avatar_football_bronze','{"edition":"paired_v2","variant":"female","private_note":"must not be shared"}');
 if (select count(*) from public.avatar_selection_periods where profile_id=v_profile)<>v_count then raise exception 'Cosmetic change split history'; end if;
 if v_saved->'plan_json'->'meta'->'claimedRewards'<>v_claims then raise exception 'Cosmetic change altered rewards'; end if;
 if v_saved->'plan_json'->'meta'->'sportAvatarAppearance'<>'{"edition":"paired_v2","variant":"female"}' then raise exception 'Appearance not sanitised'; end if;
 if exists(select 1 from public.group_member_directory gd join public.group_memberships gm on gm.id=gd.membership_id where gm.profile_id=v_profile and gd.sport_avatar_appearance is distinct from '{"edition":"paired_v2","variant":"female"}'::jsonb) then raise exception 'Group appearance did not sync'; end if;
 v_denied:=false;
 begin perform public.set_profile_avatar_appearance(v_profile,'sport_avatar_rugby_bronze','{"edition":"paired_v2","variant":"female"}');
 exception when invalid_parameter_value then v_denied:=true; end;
 if not v_denied then raise exception 'Unfinished collection allowed'; end if;
 v_saved:=public.set_profile_avatar_appearance(v_profile,'sport_avatar_football_bronze',null);
 if v_saved->'plan_json'->'meta'->'sportAvatarAppearance'<>'null'::jsonb then raise exception 'Legacy restoration failed'; end if;
end $$;
select 'Passed: ownership, unlock, paired persistence, shared cosmetic sync, history and reward invariance, legacy restoration' as result;
rollback;
