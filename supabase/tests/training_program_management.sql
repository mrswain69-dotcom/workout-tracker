-- Temporary fixtures across two existing accounts. All writes rolled back.
begin;
do $$
declare
  cf uuid; cu uuid; af uuid; au uuid; owner_profile uuid; programme uuid; old_version uuid;
  new_version uuid; duplicate_id uuid; link_id uuid; token uuid; stamp timestamptz;
  content jsonb; frozen jsonb; denied boolean; template_id uuid; test_id uuid; source_plan jsonb; assigned_profile uuid; assignment_id uuid;
begin
  select id,owner_user_id into cf,cu from public.families order by created_at limit 1;
  select id,owner_user_id into af,au from public.families where owner_user_id<>cu order by created_at limit 1;
  if af is null then raise exception 'Two account families required'; end if;
  perform set_config('request.jwt.claim.sub',cu::text,true);
  content := '{"version":5,"activityTypes":[],"blocksByWeekday":{"Mon":[],"Tue":[],"Wed":[],"Thu":[],"Fri":[],"Sat":[],"Sun":[]},"program":{"schemaVersion":1,"name":"Management fixture","description":"","startDate":"2026-10-05","completionMode":"repeat","phases":[{"id":"phase","name":"Build","focus":"","weeks":[{"id":"week","name":"Week 1","focus":"","blocksByWeekday":{"Mon":[],"Tue":[],"Wed":[],"Thu":[],"Fri":[],"Sat":[],"Sun":[]}}],"assessments":[]}]}}';
  insert into public.profiles(family_id,name,plan_json) values(cf,'Management fixture',content) returning id into owner_profile;
  insert into public.tests(family_id,name,unit,scoring_direction) values(cf,'Frozen test','reps','higher') returning id into test_id;
  insert into public.assessment_templates(family_id,name) values(cf,'Frozen assessment') returning id into template_id;
  insert into public.assessment_template_tests(family_id,assessment_template_id,test_id,position) values(cf,template_id,test_id,1);
  content := jsonb_set(content,'{program,phases,0,assessments}',jsonb_build_array(jsonb_build_object('id','before','name','Frozen assessment','timing','before','assessmentTemplateId',template_id)));
  select program_id,version_id into programme,old_version from public.training_program_save(null,cf,owner_profile,'Management fixture','','','football','beginner','teen','{mat}','{skills}','community',content,'First version');
  insert into public.profiles(family_id,name,plan_json) values(af,'Management recipient',content) returning id into assigned_profile;
  insert into public.training_program_assignments(program_id,version_id,assigned_by_family_id,target_profile_id,status,start_date,completion_mode)
    values(programme,old_version,cf,assigned_profile,'pending','2026-10-05','repeat') returning id into assignment_id;
  select content_json into frozen from public.training_program_versions where id=old_version;
  select plan_json into source_plan from public.profiles where id=owner_profile;
  select updated_at into stamp from public.training_programs where id=programme;
  if not public.training_program_update_details(programme,stamp,'Renamed programme','Description','Preparation','rugby','advanced','adult','{mat,bands}','{rugby}') then raise exception 'Metadata update failed'; end if;
  if (select current_version_id from public.training_programs where id=programme)<>old_version then raise exception 'Metadata created a version'; end if;
  if (select content_json from public.training_program_versions where id=old_version)<>frozen then raise exception 'Metadata rewrote frozen version'; end if;
  denied:=false;
  begin perform public.training_program_update_details(programme,stamp,'Stale save','','','','all_levels','all_ages','{}','{}'); exception when others then denied:=true; end;
  if not denied then raise exception 'Stale details overwrote newer data'; end if;
  -- Archive the source Assessment: duplication/restoration must still use its snapshot.
  update public.tests set name='Changed test',archived=true where id=test_id;
  update public.assessment_templates set archived=true where id=template_id;
  select program_id into duplicate_id from public.training_program_copy_version(programme,old_version,true,'Separate copy','Copied original',old_version);
  if duplicate_id=programme then raise exception 'Duplicate reused original'; end if;
  if (select v.content_json from public.training_program_versions v join public.training_programs p on p.current_version_id=v.id where p.id=duplicate_id)<>frozen then raise exception 'Duplicate changed frozen Assessment'; end if;
  select version_id into new_version from public.training_program_copy_version(programme,old_version,false,'Ignored title','Restored original',old_version);
  if new_version=old_version or (select current_version_no from public.training_programs where id=programme)<>2 then raise exception 'Restore did not append version'; end if;
  if (select content_json from public.training_program_versions where id=new_version)<>frozen then raise exception 'Restore changed snapshot'; end if;
  denied:=false;
  begin perform public.training_program_copy_version(programme,old_version,false,'Ignored','Stale restore',old_version); exception when others then denied:=true; end;
  if not denied then raise exception 'Stale restore replaced newer version'; end if;
  select share_token into token from public.training_program_create_share(programme,'copy',30);
  select id into link_id from public.training_program_share_links where share_token=token;
  if not public.training_program_update_link(link_id,false,1) then raise exception 'Expiry update failed'; end if;
  if (select expires_at from public.training_program_share_links where id=link_id) > clock_timestamp()+interval '25 hours' then raise exception 'Expiry did not change'; end if;
  perform set_config('request.jwt.claim.sub',au::text,true);
  denied:=false;
  begin perform public.training_program_copy_version(programme,old_version,true,'Stolen','Stolen version',new_version); exception when others then denied:=true; end;
  if not denied then raise exception 'Other account copied private version'; end if;
  denied:=false;
  begin perform public.training_program_update_link(link_id,true,1); exception when others then denied:=true; end;
  if not denied then raise exception 'Other account revoked link'; end if;
  if public.training_program_restore_archived(programme) then raise exception 'Other account restored programme'; end if;
  perform set_config('request.jwt.claim.sub',cu::text,true);
  if not public.training_program_update_link(link_id,true,1) then raise exception 'Revoke failed'; end if;
  if exists(select 1 from public.training_program_preview_share(token)) then raise exception 'Revoked share still accessible'; end if;
  denied:=false;
  begin perform public.training_program_update_link(link_id,false,30); exception when others then denied:=true; end;
  if not denied then raise exception 'Revoked link was revived'; end if;
  if not public.training_program_archive(programme) or not public.training_program_restore_archived(programme) then raise exception 'Archive restore failed'; end if;
  if (select version_id from public.training_program_assignments where id=assignment_id)<>old_version then raise exception 'Management rewrote an issued version'; end if;
  -- Exercise the public API and RLS as an authenticated caller, not postgres.
  execute 'set local role authenticated';
  if not exists(select 1 from public.training_program_versions where id=old_version) then raise exception 'Owner cannot read version history'; end if;
  perform set_config('request.jwt.claim.sub',au::text,true);
  if exists(select 1 from public.training_program_share_links where id=link_id) then raise exception 'Other account read sharing tokens'; end if;
  -- The assigned version is readable by this recipient, but management remains owner-only.
  denied:=false;
  begin perform public.training_program_copy_version(programme,old_version,true,'Unauthorized','Unauthorized',new_version); exception when others then denied:=true; end;
  if not denied then raise exception 'Recipient managed owner programme'; end if;
  perform set_config('request.jwt.claim.sub',cu::text,true);
  select updated_at into stamp from public.training_programs where id=programme;
  if not public.training_program_update_details(programme,stamp,'Final title','','','','all_levels','all_ages','{}','{}') then raise exception 'Authenticated metadata update failed'; end if;
  execute 'reset role';
  if has_function_privilege('anon','public.training_program_copy_version(uuid,uuid,boolean,text,text,uuid)','execute') then raise exception 'Anonymous management enabled'; end if;
  if (select plan_json from public.profiles where id=owner_profile)<>source_plan then raise exception 'Management changed active plan'; end if;
end $$;
rollback;
