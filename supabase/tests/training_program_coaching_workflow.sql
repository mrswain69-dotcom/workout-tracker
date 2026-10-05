-- Two real auth identities, temporary fixtures, every write rolled back.
begin;
do $$
declare
  cf uuid; cu uuid; af uuid; au uuid; coach uuid; athlete uuid; outsider uuid; team uuid; member uuid;
  programme uuid; version_uuid uuid; assignment uuid; cp uuid; after_cp uuid; run_uuid uuid; template_uuid uuid; test_uuid uuid;
  recipient_template uuid; recipient_test uuid; start_day date := date_trunc('week',current_date)::date;
  content jsonb; plan jsonb; next_plan jsonb; payload jsonb; report jsonb; denied boolean; notification uuid; count_before integer;
begin
  select id,owner_user_id into cf,cu from public.families order by created_at limit 1;
  select id,owner_user_id into af,au from public.families where owner_user_id<>cu order by created_at limit 1;
  if af is null then raise exception 'Two account families required'; end if;
  perform set_config('request.jwt.claim.sub',cu::text,true);
  content := '{"version":5,"activityTypes":[],"blocksByWeekday":{"Mon":[],"Tue":[],"Wed":[],"Thu":[],"Fri":[],"Sat":[],"Sun":[]},"program":{"schemaVersion":1,"name":"Coaching fixture","description":"","startDate":"","completionMode":"repeat","phases":[{"id":"phase","name":"Build","focus":"","weeks":[{"id":"week","name":"Week 1","focus":"","blocksByWeekday":{"Mon":[],"Tue":[],"Wed":[],"Thu":[],"Fri":[],"Sat":[],"Sun":[]}}],"assessments":[]}]}}';
  content := jsonb_set(content,'{program,startDate}',to_jsonb(start_day::text));
  -- Every day has exactly one assigned duration block; private block is never counted.
  for payload in select to_jsonb(d) from unnest(array['Mon','Tue','Wed','Thu','Fri','Sat','Sun']) d loop
    content:=jsonb_set(content,array['program','phases','0','weeks','0','blocksByWeekday',payload#>>'{}'],
      '[{"id":"assigned-mobility","typeId":"duration","plannedMinutes":"10","label":"Mobility"}]');
  end loop;
  insert into public.profiles(family_id,name,plan_json) values(cf,'Fixture coach',content) returning id into coach;
  insert into public.profiles(family_id,name,plan_json) values(af,'Fixture athlete',content) returning id into athlete;
  insert into public.profiles(family_id,name,plan_json) values(af,'Other fixture athlete',content) returning id into outsider;
  insert into public.groups(name,created_by_family_id) values('Fixture coach team',cf) returning id into team;
  insert into public.group_memberships(group_id,family_id,profile_id,role,nickname) values(team,cf,coach,'admin','Coach');
  insert into public.group_memberships(group_id,family_id,profile_id,role,nickname) values(team,af,athlete,'member','Athlete') returning id into member;
  insert into public.assessment_templates(family_id,name) values(cf,'Sprint benchmark') returning id into template_uuid;
  insert into public.tests(family_id,name,unit,scoring_direction) values(cf,'Sprint time','s','lower') returning id into test_uuid;
  insert into public.assessment_template_tests(family_id,assessment_template_id,test_id,position) values(cf,template_uuid,test_uuid,1);
  content:=jsonb_set(content,'{program,phases,0,assessments}',jsonb_build_array(
    jsonb_build_object('id','before','timing','before','title','Sprint benchmark','assessmentTemplateId',template_uuid,'required',true),
    jsonb_build_object('id','after','timing','after','title','Sprint benchmark','assessmentTemplateId',template_uuid,'required',true)));
  insert into public.training_programs(owner_family_id,title) values(cf,'Coaching fixture') returning id into programme;
  insert into public.training_program_versions(program_id,version_no,content_json,created_by_family_id) values(programme,1,content,cf) returning id into version_uuid;
  update public.training_programs set current_version_id=version_uuid where id=programme;
  if (select content_json #>> '{program,phases,0,assessments,0,assessmentDefinition,tests,0,name}' from public.training_program_versions where id=version_uuid)<>'Sprint time' then raise exception 'Assessment snapshot was not frozen'; end if;
  update public.tests set name='Changed later' where id=test_uuid;
  if public.training_program_assign_members_with_permissions(programme,array[member],start_day,'repeat',false,'Follow supplied',false)<>1 then raise exception 'Assignment create failed'; end if;
  select id into assignment from public.training_program_assignments where program_id=programme;
  select id into notification from public.training_program_notifications where assignment_id=assignment and audience='recipient';
  if notification is null then raise exception 'Recipient notification missing'; end if;
  -- Existing pending rights can be changed only by the assigning coach.
  if not public.training_program_set_permissions(assignment,false,false) then raise exception 'Pending permissions failed'; end if;
  denied:=false;
  begin perform public.training_program_set_reporting(assignment,true,true); exception when others then denied:=true; end;
  -- Reporting setter returns false for a different recipient instead of mutating.
  if (select share_adherence from public.training_program_assignments where id=assignment) then raise exception 'Coach enabled athlete reporting'; end if;

  perform set_config('request.jwt.claim.sub',au::text,true);
  if not public.training_program_read_notification(notification) then raise exception 'Recipient could not read own notification'; end if;
  denied:=false;
  begin perform public.training_program_set_permissions(assignment,true,true); exception when others then denied:=true; end;
  if not denied then raise exception 'Recipient escalated edit permission'; end if;
  -- A tampered keep-tasks payload must not bypass follow-as-supplied.
  payload:=jsonb_set(content,'{program,phases,0,name}','"Tampered"');
  denied:=false;
  begin perform public.training_program_accept_assignment(assignment,athlete,'replace_keep_tasks',payload); exception when others then denied:=true; end;
  if not denied then raise exception 'Prepared plan bypassed locked adoption'; end if;
  next_plan:=public.training_program_accept_with_sharing(assignment,athlete,'replace',null,false,false);
  if next_plan #>> '{meta,activeProgramSource,recipientCanEdit}'<>'false' then raise exception 'Recipient rights missing in adopted plan'; end if;
  if (select count(*) from public.training_program_checkpoints where profile_id=athlete and active)<>2 then raise exception 'Real phase checkpoints were not scheduled'; end if;
  select id,assessment_template_id into cp,recipient_template from public.training_program_checkpoints where profile_id=athlete and timing='before';
  select id into after_cp from public.training_program_checkpoints where profile_id=athlete and timing='after';
  if (select due_date from public.training_program_checkpoints where id=cp)<>start_day
    or (select due_date from public.training_program_checkpoints where id=after_cp)<>start_day+6 then raise exception 'Checkpoint phase dates wrong'; end if;
  if (select name from public.assessment_templates where id=recipient_template)<>'Sprint benchmark' then raise exception 'Recipient Assessment missing'; end if;
  select tt.test_id into recipient_test from public.assessment_template_tests tt where tt.assessment_template_id=recipient_template;
  if (select name from public.tests where id=recipient_test)<>'Sprint time' then raise exception 'Later coach edit changed issued Test'; end if;
  update public.tests set name='Recipient edited library' where id=recipient_test;
  if (select definition_json #>> '{tests,0,name}' from public.training_program_checkpoints where id=cp)<>'Sprint time' then raise exception 'Recipient library edit changed the frozen checkpoint'; end if;
  if (select assessment_template_id from public.training_program_checkpoints where id=after_cp)<>recipient_template then raise exception 'Before/after unnecessarily duplicated the Assessment'; end if;
  -- Direct authenticated REST-equivalent writes are guarded; ordinary reward metadata still saves.
  execute 'set local role authenticated';
  update public.profiles set plan_json=jsonb_set(next_plan,'{meta,avatarFixture}','"allowed"') where id=athlete;
  denied:=false;
  begin update public.profiles set plan_json=jsonb_set(next_plan,'{program,name}','"Changed"') where id=athlete; exception when others then denied:=true; end;
  if not denied then raise exception 'Direct REST edit bypassed follow-as-supplied'; end if;
  denied:=false;
  begin update public.profiles set plan_json=next_plan where id=outsider; exception when others then denied:=true; end;
  if not denied then raise exception 'Assignment marker attached to another profile'; end if;
  execute 'reset role';
  -- Copy permission is enforced on saving an unchanged issued programme.
  denied:=false;
  begin insert into public.training_program_versions(program_id,version_no,content_json,created_by_family_id) values(programme,9,(select content_json from public.training_program_versions where id=version_uuid),af); exception when others then denied:=true; end;
  if not denied then raise exception 'No-copy issued version was copied'; end if;
  insert into public.logs(family_id,profile_id,date_ymd,log_json) values(af,athlete,current_date,
    '{"blocks":[{"id":"assigned-mobility","typeId":"duration","duration":{"minutes":"10"}},{"id":"private-run","typeId":"cardio","note":"DO NOT DISCLOSE","cardio":{"durationMin":"40"}}],"meta":{"privateNote":"DO NOT DISCLOSE"}}');
  insert into public.assessment_runs(family_id,profile_id,assessment_template_id,date_ymd,status,completed_at,program_checkpoint_id,notes)
    values(af,athlete,recipient_template,current_date,'completed',now(),cp,'PRIVATE ASSESSMENT NOTE') returning id into run_uuid;
  insert into public.assessment_test_results(family_id,assessment_run_id,test_id,position,test_name_snapshot,metric_snapshot,comparable_value,notes)
    values(af,run_uuid,recipient_test,1,'Sprint time','{"unit":"s","scoringDirection":"lower"}',7.2,'PRIVATE TEST NOTE');
  perform set_config('request.jwt.claim.sub',cu::text,true);
  report:=public.training_program_coach_report(assignment,current_date,28);
  if report->'days'<>'[]' or report->'checkpoints'<>'[]' then raise exception 'Reports disclosed data without consent'; end if;
  if not exists(select 1 from public.training_program_notifications where assignment_id=assignment and audience='coach' and kind='accepted') then raise exception 'Coach acceptance notification missing'; end if;
  if public.training_program_read_notification(notification) then raise exception 'Coach marked recipient notification read'; end if;
  perform set_config('request.jwt.claim.sub',au::text,true);
  if not public.training_program_set_reporting(assignment,true,true) then raise exception 'Recipient sharing change failed'; end if;
  perform set_config('request.jwt.claim.sub',cu::text,true);
  report:=public.training_program_coach_report(assignment,current_date,28);
  if (report->>'completed')::integer<>1 or (report->>'planned')::integer<>1 then raise exception 'Programme report mixed in unrelated activity: %',report; end if;
  if report #>> '{checkpoints,0,results,0,value}'<>'7.2' then raise exception 'Linked checkpoint outcome missing: %',report; end if;
  if report::text like '%PRIVATE%' or report::text like '%DO NOT DISCLOSE%' then raise exception 'Private notes leaked'; end if;
  perform set_config('request.jwt.claim.sub',au::text,true);
  perform public.training_program_set_reporting(assignment,false,false);
  perform set_config('request.jwt.claim.sub',cu::text,true);
  if public.training_program_coach_report(assignment,current_date,28)->'checkpoints'<>'[]' then raise exception 'Withdrawn sharing remained accessible'; end if;
  -- A later repeat pass gets fresh identities and due dates without losing results.
  perform private.training_program_schedule_source(athlete,af,assignment::text,assignment,next_plan,start_day+7);
  if not exists(select 1 from public.training_program_checkpoints where profile_id=athlete and phase_name='Build · Cycle 2' and timing='before' and due_date=start_day+7) then raise exception 'Repeat cycle checkpoints missing'; end if;
  if (select definition_json #>> '{tests,0,name}' from public.training_program_checkpoints where profile_id=athlete and phase_name='Build · Cycle 2' and timing='before')<>'Sprint time' then raise exception 'Repeated checkpoint changed its frozen definition'; end if;
  if not exists(select 1 from public.assessment_runs where id=run_uuid and program_checkpoint_id=cp) then raise exception 'Repeat cycle lost completed results'; end if;
  update public.group_memberships set status='removed' where id=member;
  denied:=false;
  begin perform public.training_program_coach_report(assignment,current_date,28); exception when others then denied:=true; end;
  if not denied then raise exception 'Former team admin could still report'; end if;
  perform set_config('request.jwt.claim.sub',au::text,true);
  if (select count(*) from public.training_program_recipient_controls(athlete))<>1 then raise exception 'Leaving a team removed recipient-owned programme controls'; end if;
  if not public.training_program_set_reporting(assignment,false,false) then raise exception 'Former member cannot withdraw their own sharing'; end if;
  if has_function_privilege('anon','public.training_program_coach_report(uuid,date,integer)','execute') then raise exception 'Anonymous report privilege'; end if;
  -- Recovery, partial strength and complete tracked sets match saved log semantics.
  if private.training_program_block_state('{"typeId":"recovery"}','{"recoveryDone":true}','{}')<>'completed' then raise exception 'Recovery completion missing'; end if;
  if private.training_program_block_state('{"typeId":"strength","movements":[{"id":"m","sets":2}]}','{"sets":{"m":[{"reps":10}]}}','{}')<>'recorded' then raise exception 'Partial strength marked complete'; end if;
end $$;
select 'Recipient permissions, authenticated direct writes, transactional notifications, frozen checkpoints, opt-in reports and private-data isolation passed' as result;
rollback;
