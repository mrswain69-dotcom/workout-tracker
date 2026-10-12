-- Verify existing save/apply APIs support undated drafts; all fixtures roll back.
begin;
do $$
declare
  owner_family uuid; owner_user uuid; other_family uuid; profile uuid;
  programme uuid; version uuid; next_version uuid; content jsonb; before_plan jsonb;
  applied jsonb; denied boolean := false;
begin
  select id, owner_user_id into owner_family, owner_user from public.families order by created_at limit 1;
  select id into other_family from public.families where owner_user_id <> owner_user order by created_at limit 1;
  if owner_family is null or other_family is null then raise exception 'Two account families required'; end if;
  content := '{"version":5,"activityTypes":[],"blocksByWeekday":{"Mon":[],"Tue":[],"Wed":[],"Thu":[],"Fri":[],"Sat":[],"Sun":[]},"program":{"schemaVersion":1,"name":"Undated draft fixture","description":"","startDate":"","completionMode":"repeat","phases":[{"id":"phase","name":"Build","weeks":[{"id":"week","name":"Week 1","blocksByWeekday":{"Mon":[],"Tue":[],"Wed":[],"Thu":[],"Fri":[],"Sat":[],"Sun":[]}}],"assessments":[]}]}}';
  before_plan := jsonb_set(content,'{program,startDate}','"2026-10-05"') || '{"meta":{"xp":12345,"draftFixture":true}}'::jsonb;
  insert into public.profiles(family_id,name,plan_json) values(owner_family,'Draft fixture',before_plan) returning id into profile;
  select plan_json into before_plan from public.profiles where id=profile;
  perform set_config('request.jwt.claim.sub',owner_user::text,true);
  execute 'set local role authenticated';
  select program_id,version_id into programme,version from public.training_program_save(null,owner_family,profile,'Undated draft fixture','','','','all_levels','all_ages','{}','{}','community',content,'Draft');
  if (select content_json #>> '{program,startDate}' from public.training_program_versions where id=version) <> '' then raise exception 'Draft unexpectedly dated'; end if;
  if (select plan_json from public.profiles where id=profile) is distinct from before_plan then raise exception 'Saving draft changed active plan'; end if;
  select version_id into next_version from public.training_program_save(programme,owner_family,profile,'Undated draft fixture','','','','all_levels','all_ages','{}','{}','community',jsonb_set(content,'{program,phases,0,weeks,0,name}','"Edited week"'),'Draft edits');
  if (select plan_json from public.profiles where id=profile) is distinct from before_plan then raise exception 'Editing library changed active plan'; end if;
  if (select content_json from public.training_program_versions where id=version) is distinct from content then raise exception 'Saved original version changed'; end if;
  begin
    perform public.training_program_save(null,other_family,null,'Denied','','','','all_levels','all_ages','{}','{}','community',content,'Denied');
  exception when others then denied := true;
  end;
  if not denied then raise exception 'Cross-family draft save allowed'; end if;
  applied := public.training_program_apply_accessible(programme,profile,'2026-11-02','once','replace',null);
  if applied #>> '{program,startDate}' <> '2026-11-02' then raise exception 'Apply failed to use chosen date'; end if;
  if applied #>> '{program,completionMode}' <> 'once' then raise exception 'Apply failed to use completion choice'; end if;
  if applied #>> '{meta,xp}' <> '12345' then raise exception 'Apply changed rewards'; end if;
  if (select content_json #>> '{program,startDate}' from public.training_program_versions where id=next_version) <> '' then raise exception 'Apply dated library copy'; end if;
  execute 'reset role';
end $$;
rollback;
