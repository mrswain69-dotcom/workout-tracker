-- Recipient controls, transactional in-app events, frozen assessment checkpoints
-- and opt-in programme-only reporting. No reward or historical-log rewrites.
alter table public.training_program_assignments
  add column recipient_can_copy boolean not null default true,
  add column share_adherence boolean not null default false,
  add column share_assessments boolean not null default false;
update public.training_program_assignments set recipient_can_copy = recipient_can_edit;

create table public.training_program_notifications (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  assignment_id uuid not null references public.training_program_assignments(id) on delete cascade,
  kind text not null,
  audience text not null check (audience in ('coach','recipient')),
  title text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index training_program_notifications_inbox_idx on public.training_program_notifications(family_id,created_at desc);
create index training_program_notifications_profile_idx on public.training_program_notifications(profile_id);
create index training_program_notifications_assignment_idx on public.training_program_notifications(assignment_id);
alter table public.training_program_notifications enable row level security;
revoke all on public.training_program_notifications from public,anon,authenticated;
grant select on public.training_program_notifications to authenticated;
create policy program_notifications_owner on public.training_program_notifications for select to authenticated
  using (private.training_program_owned_family(family_id));

create function private.training_program_assignment_events()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_profile uuid; v_family uuid; v_title text; v_kind text; v_audience text;
begin
  if tg_when='BEFORE' then
    if tg_op = 'INSERT' and new.replaces_assignment_id is not null then
    select recipient_can_copy into new.recipient_can_copy from public.training_program_assignments where id = new.replaces_assignment_id;
    end if;
    return new;
  end if;
  if tg_op = 'INSERT' then v_kind := case when new.replaces_assignment_id is null then 'assigned' else 'update_offered' end; v_audience := 'recipient';
  elsif old.status is distinct from new.status then
    v_kind := new.status; v_audience := case when new.status in ('accepted','declined') then 'coach' else 'recipient' end;
  elsif old.undone_at is distinct from new.undone_at then v_kind := 'undone'; v_audience := 'coach';
  elsif old.removed_at is distinct from new.removed_at then v_kind := 'removed'; v_audience := 'coach';
  elsif old.start_date is distinct from new.start_date or old.completion_mode is distinct from new.completion_mode
    or old.recipient_can_edit is distinct from new.recipient_can_edit or old.recipient_can_copy is distinct from new.recipient_can_copy then
    v_kind := 'changed'; v_audience := 'recipient';
  else return new; end if;
  select title into v_title from public.training_programs where id = new.program_id;
  select coalesce(new.target_profile_id,gm.profile_id) into v_profile from (select 1) seed left join public.group_memberships gm on gm.id=new.target_membership_id;
  select family_id into v_family from public.profiles where id=v_profile;
  if v_audience = 'coach' then v_family := new.assigned_by_family_id; v_profile := null; end if;
  if v_family is not null then
    insert into public.training_program_notifications(family_id,profile_id,assignment_id,kind,audience,title)
    values(v_family,v_profile,new.id,v_kind,v_audience,coalesce(v_title,'Assigned programme') || ' · ' ||
      case v_kind when 'assigned' then 'New assignment' when 'update_offered' then 'Update offered'
      when 'accepted' then 'Accepted' when 'declined' then 'Declined' when 'revoked' then 'Invitation withdrawn'
      when 'undone' then 'Acceptance undone' when 'removed' then 'Add-on removed' else 'Invitation changed' end);
  end if;
  return new;
end $$;
revoke all on function private.training_program_assignment_events() from public,anon,authenticated;
-- BEFORE allows an offer to inherit copy permission before it is inserted.
create trigger training_program_assignment_permissions before insert on public.training_program_assignments
for each row execute function private.training_program_assignment_events();
create trigger training_program_assignment_events after insert or update on public.training_program_assignments
for each row execute function private.training_program_assignment_events();

create function public.training_program_read_notification(p_notification_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  update public.training_program_notifications set read_at=coalesce(read_at,now())
    where id=p_notification_id and private.training_program_owned_family(family_id);
  return found;
end $$;
revoke all on function public.training_program_read_notification(uuid) from public,anon;
grant execute on function public.training_program_read_notification(uuid) to authenticated;

create function public.training_program_set_permissions(p_assignment_id uuid,p_can_edit boolean,p_can_copy boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or not private.training_program_can_manage_assignment(p_assignment_id)
    then raise exception 'Assignment management access required'; end if;
  update public.training_program_assignments set recipient_can_edit=coalesce(p_can_edit,false),recipient_can_copy=coalesce(p_can_copy,false)
    where id=p_assignment_id and status='pending';
  return found;
end $$;
revoke all on function public.training_program_set_permissions(uuid,boolean,boolean) from public,anon;
grant execute on function public.training_program_set_permissions(uuid,boolean,boolean) to authenticated;

create function public.training_program_set_reporting(p_assignment_id uuid,p_share_adherence boolean,p_share_assessments boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  update public.training_program_assignments a set share_adherence=coalesce(p_share_adherence,false),share_assessments=coalesce(p_share_assessments,false)
    where a.id=p_assignment_id and a.status in ('pending','accepted')
      and private.training_program_target_visible(a.target_profile_id,a.target_membership_id);
  return found;
end $$;
revoke all on function public.training_program_set_reporting(uuid,boolean,boolean) from public,anon;
grant execute on function public.training_program_set_reporting(uuid,boolean,boolean) to authenticated;

-- A protected programme may be left or undone; while attached it cannot be edited.
-- The trigger also protects direct REST updates, not just the application controls.
create function private.training_program_guard_plan()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare a record; v_old jsonb; v_new jsonb; v_id text;
begin
  -- Authorised adoption/undo functions run as postgres; ordinary REST writes run
  -- with role authenticated. session_user would be the shared gateway login.
  if current_user not in ('authenticated','anon') then return new; end if;
  v_id := new.plan_json #>> '{meta,activeProgramSource,assignmentId}';
  if v_id is not null and not exists (
    select 1 from public.training_program_assignments ass
    left join public.group_memberships gm on gm.id=ass.target_membership_id
    where ass.id::text=v_id and ass.status='accepted' and coalesce(ass.target_profile_id,gm.profile_id)=new.id
  ) then raise exception 'Assigned programme belongs to another profile'; end if;
  v_id := old.plan_json #>> '{meta,activeProgramSource,assignmentId}';
  if v_id is not null and v_id = new.plan_json #>> '{meta,activeProgramSource,assignmentId}' then
    select recipient_can_edit into a from public.training_program_assignments where id::text=v_id;
    if a.recipient_can_edit=false and
      (old.plan_json->'program' is distinct from new.plan_json->'program'
       or old.plan_json->'activityTypes' is distinct from new.plan_json->'activityTypes'
       or old.plan_json->'blocksByWeekday' is distinct from new.plan_json->'blocksByWeekday') then
      raise exception 'This programme must be followed as supplied. Leave or undo it to use a personal plan.';
    end if;
  end if;
  for a in select id,recipient_can_edit from public.training_program_assignments
      where id::text in (select x->>'id' from jsonb_array_elements(coalesce(old.plan_json #> '{meta,programAddOns}','[]'::jsonb)) x)
        and not recipient_can_edit loop
    select x->'content' into v_old from jsonb_array_elements(old.plan_json #> '{meta,programAddOns}') x where x->>'id'=a.id::text;
    select x->'content' into v_new from jsonb_array_elements(coalesce(new.plan_json #> '{meta,programAddOns}','[]'::jsonb)) x where x->>'id'=a.id::text;
    if v_new is not null and v_new is distinct from v_old then raise exception 'This assigned add-on must be followed as supplied'; end if;
  end loop;
  return new;
end $$;
revoke all on function private.training_program_guard_plan() from public,anon,authenticated;
create trigger training_program_guard_plan before update of plan_json on public.profiles
for each row execute function private.training_program_guard_plan();

-- Freeze real Assessment definitions into every new issued programme version.
create function private.training_program_freeze_assessments()
returns trigger language plpgsql security definer set search_path = '' as $$
declare phase jsonb; checkpoint jsonb; phases jsonb := '[]'; checkpoints jsonb; definition jsonb; template_uuid uuid;
begin
  for phase in select value from jsonb_array_elements(new.content_json #> '{program,phases}') loop
    checkpoints := '[]';
    for checkpoint in select value from jsonb_array_elements(coalesce(phase->'assessments','[]'::jsonb)) loop
      definition := null;
      if coalesce(checkpoint->>'assessmentTemplateId','') <> '' then
        template_uuid := (checkpoint->>'assessmentTemplateId')::uuid;
        select jsonb_build_object('template',to_jsonb(t)-'family_id',
          'tests',(select coalesce(jsonb_agg(to_jsonb(test)-'family_id'),'[]') from public.tests test
            where test.id in (select tt.test_id from public.assessment_template_tests tt where tt.assessment_template_id=t.id) and not test.archived),
          'templateTests',(select coalesce(jsonb_agg(to_jsonb(tt)-'family_id' order by tt.position),'[]') from public.assessment_template_tests tt where tt.assessment_template_id=t.id))
          into definition from public.assessment_templates t
          where t.id=template_uuid and t.family_id=new.created_by_family_id and not t.archived;
        if definition is null or jsonb_array_length(definition->'tests')=0
          or jsonb_array_length(definition->'tests')<>jsonb_array_length(definition->'templateTests')
          then raise exception 'Choose an available Assessment with active Tests for each linked checkpoint'; end if;
      end if;
      checkpoints := checkpoints || jsonb_build_array((checkpoint-'assessmentDefinition') || case when definition is null then '{}'::jsonb else jsonb_build_object('assessmentDefinition',definition) end);
    end loop;
    phases := phases || jsonb_build_array(jsonb_set(phase,'{assessments}',checkpoints,true));
  end loop;
  new.content_json := jsonb_set(new.content_json,'{program,phases}',phases,true);
  return new;
end $$;
revoke all on function private.training_program_freeze_assessments() from public,anon,authenticated;
create trigger training_program_freeze_assessments before insert on public.training_program_versions
for each row execute function private.training_program_freeze_assessments();

create table public.training_program_checkpoints (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  assignment_id uuid references public.training_program_assignments(id) on delete cascade,
  source_key text not null,
  checkpoint_key text not null,
  phase_name text not null,
  timing text not null check (timing in ('before','after')),
  title text not null,
  assessment_template_id uuid not null references public.assessment_templates(id),
  source_assessment_id text not null,
  definition_json jsonb not null default '{}'::jsonb,
  due_date date not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(profile_id,source_key,checkpoint_key)
);
create index training_program_checkpoints_family_idx on public.training_program_checkpoints(family_id,profile_id,active,due_date);
create index training_program_checkpoints_profile_idx on public.training_program_checkpoints(profile_id);
create index training_program_checkpoints_assignment_idx on public.training_program_checkpoints(assignment_id);
create index training_program_checkpoints_template_idx on public.training_program_checkpoints(assessment_template_id);
alter table public.training_program_checkpoints enable row level security;
revoke all on public.training_program_checkpoints from public,anon,authenticated;
grant select on public.training_program_checkpoints to authenticated;
create policy program_checkpoints_owner on public.training_program_checkpoints for select to authenticated
  using(private.training_program_owned_family(family_id));
alter table public.assessment_runs add column program_checkpoint_id uuid references public.training_program_checkpoints(id);
create index assessment_runs_program_checkpoint_idx on public.assessment_runs(program_checkpoint_id);

create function private.training_program_schedule_source(p_profile uuid,p_family uuid,p_source text,p_assignment uuid,p_content jsonb,p_reference_date date default current_date)
returns void language plpgsql security definer set search_path = '' as $$
declare phase jsonb; cp jsonb; definition jsonb; item jsonb; template_id uuid; test_id uuid; id_map jsonb; offset_weeks integer:=0; due date; cp_key text; row_id uuid; cycle integer:=0; total_weeks integer; cycle_offset integer:=0; frozen_definition jsonb;
begin
  select coalesce(sum(jsonb_array_length(ph->'weeks')),0)::integer into total_weeks
    from jsonb_array_elements(coalesce(p_content #> '{program,phases}','[]')) ph;
  if total_weeks=0 then return; end if;
  if p_content #>> '{program,completionMode}'='repeat' and coalesce(p_reference_date,current_date) >= (p_content #>> '{program,startDate}')::date then
    cycle:=((coalesce(p_reference_date,current_date)-(p_content #>> '{program,startDate}')::date)/7)/total_weeks;
  end if;
  cycle_offset:=cycle*total_weeks;
  for phase in select value from jsonb_array_elements(coalesce(p_content #> '{program,phases}','[]'::jsonb)) loop
    for cp in select value from jsonb_array_elements(coalesce(phase->'assessments','[]'::jsonb)) loop
      if coalesce(cp->>'assessmentTemplateId','')='' then continue; end if;
      cp_key := (phase->>'id') || ':' || (cp->>'id') || ':' || (cp->>'assessmentTemplateId') || ':cycle:' || cycle::text;
      due := (p_content #>> '{program,startDate}')::date + (offset_weeks+cycle_offset)*7 +
        case when cp->>'timing'='after' then jsonb_array_length(phase->'weeks')*7-1 else 0 end;
      select id,assessment_template_id into row_id,template_id from public.training_program_checkpoints
        where profile_id=p_profile and source_key=p_source and checkpoint_key=cp_key;
      if row_id is null then
        select assessment_template_id,definition_json into template_id,frozen_definition from public.training_program_checkpoints
          where profile_id=p_profile and source_key=p_source and source_assessment_id=cp->>'assessmentTemplateId' limit 1;
        if p_assignment is null and template_id is null then
          select id into template_id from public.assessment_templates where id=(cp->>'assessmentTemplateId')::uuid and family_id=p_family and not archived;
        end if;
        if template_id is null then
          definition := cp->'assessmentDefinition';
          if definition is null then continue; end if; -- old placeholder versions remain compatible
          insert into public.assessment_templates(family_id,name,category,description,version)
            values(p_family,definition #>> '{template,name}',coalesce(definition #>> '{template,category}',''),
              coalesce(definition #>> '{template,description}',''),coalesce((definition #>> '{template,version}')::integer,1)) returning id into template_id;
          id_map := '{}';
          for item in select value from jsonb_array_elements(definition->'tests') loop
            insert into public.tests(family_id,name,description,version,metric_type,unit,scoring_direction,attempt_count,result_strategy,side_mode,allow_negative,pb_eligible,metric_config)
            values(p_family,item->>'name',coalesce(item->>'description',''),(item->>'version')::integer,item->>'metric_type',item->>'unit',
              item->>'scoring_direction',(item->>'attempt_count')::integer,item->>'result_strategy',item->>'side_mode',
              (item->>'allow_negative')::boolean,(item->>'pb_eligible')::boolean,item->'metric_config') returning id into test_id;
            id_map := id_map || jsonb_build_object(item->>'id',test_id);
          end loop;
          for item in select value from jsonb_array_elements(definition->'templateTests') loop
            insert into public.assessment_template_tests(family_id,assessment_template_id,test_id,position,section_label,display_label,instructions,protocol_text,config_override)
              values(p_family,template_id,(id_map->>(item->>'test_id'))::uuid,(item->>'position')::integer,item->>'section_label',
                item->>'display_label',item->>'instructions',item->>'protocol_text',item->'config_override');
          end loop;
        end if;
        if template_id is null then continue; end if;
        insert into public.training_program_checkpoints(family_id,profile_id,assignment_id,source_key,checkpoint_key,phase_name,timing,title,assessment_template_id,source_assessment_id,definition_json,due_date)
          values(p_family,p_profile,p_assignment,p_source,cp_key,coalesce(phase->>'name','Phase') || case when cycle>0 then ' · Cycle ' || (cycle+1)::text else '' end,coalesce(cp->>'timing','before'),
            coalesce(cp->>'title','Assessment'),template_id,cp->>'assessmentTemplateId',
            coalesce(frozen_definition,jsonb_build_object('templates',(select jsonb_agg(to_jsonb(t)) from public.assessment_templates t where t.id=template_id),
              'tests',(select jsonb_agg(to_jsonb(t)) from public.tests t where t.id in (select tt.test_id from public.assessment_template_tests tt where tt.assessment_template_id=template_id)),
              'templateTests',(select jsonb_agg(to_jsonb(tt) order by tt.position) from public.assessment_template_tests tt where tt.assessment_template_id=template_id),
              'developmentTags','[]'::jsonb,'testDevelopmentTags','[]'::jsonb)),due);
      else
        update public.training_program_checkpoints set due_date=due,active=true where id=row_id;
      end if;
    end loop;
    offset_weeks := offset_weeks+jsonb_array_length(phase->'weeks');
  end loop;
end $$;
revoke all on function private.training_program_schedule_source(uuid,uuid,text,uuid,jsonb,date) from public,anon,authenticated;

create function private.training_program_sync_checkpoints()
returns trigger language plpgsql security definer set search_path = '' as $$
declare addon jsonb; assignment_uuid uuid; source text;
begin
  if tg_op='UPDATE' and old.plan_json->'program' is not distinct from new.plan_json->'program'
    and old.plan_json #> '{meta,programAddOns}' is not distinct from new.plan_json #> '{meta,programAddOns}'
    and old.plan_json #> '{meta,activeProgramSource}' is not distinct from new.plan_json #> '{meta,activeProgramSource}' then return new; end if;
  update public.training_program_checkpoints set active=false where profile_id=new.id and active;
  assignment_uuid := nullif(new.plan_json #>> '{meta,activeProgramSource,assignmentId}','')::uuid;
  source := coalesce(assignment_uuid::text,'personal:' || coalesce(new.plan_json #>> '{program,phases,0,id}',''));
  perform private.training_program_schedule_source(new.id,new.family_id,source,assignment_uuid,new.plan_json);
  for addon in select value from jsonb_array_elements(coalesce(new.plan_json #> '{meta,programAddOns}','[]'::jsonb)) loop
    perform private.training_program_schedule_source(new.id,new.family_id,addon->>'id',(addon->>'id')::uuid,addon->'content');
  end loop;
  return new;
end $$;
revoke all on function private.training_program_sync_checkpoints() from public,anon,authenticated;
create trigger training_program_sync_checkpoints after insert or update of plan_json on public.profiles
for each row execute function private.training_program_sync_checkpoints();

create function private.training_program_validate_checkpoint_run()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.program_checkpoint_id is not null and not exists (
    select 1 from public.training_program_checkpoints cp where cp.id=new.program_checkpoint_id and cp.profile_id=new.profile_id
      and cp.family_id=new.family_id and cp.assessment_template_id=new.assessment_template_id and cp.active
  ) then raise exception 'Programme checkpoint is unavailable for this profile'; end if;
  return new;
end $$;
revoke all on function private.training_program_validate_checkpoint_run() from public,anon,authenticated;
create trigger training_program_validate_checkpoint_run before insert or update of program_checkpoint_id,profile_id,family_id,assessment_template_id
on public.assessment_runs for each row execute function private.training_program_validate_checkpoint_run();

create function public.training_program_accept_with_sharing(p_assignment_id uuid,p_profile_id uuid,p_adoption_mode text,p_prepared_plan jsonb,
  p_share_adherence boolean default false,p_share_assessments boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_next jsonb; a public.training_program_assignments%rowtype; meta jsonb; addons jsonb;
begin
  v_next := public.training_program_accept_assignment(p_assignment_id,p_profile_id,p_adoption_mode,p_prepared_plan);
  select * into a from public.training_program_assignments where id=p_assignment_id;
  update public.training_program_assignments set share_adherence=coalesce(p_share_adherence,false),share_assessments=coalesce(p_share_assessments,false) where id=a.id;
  if p_adoption_mode='add' then
    select jsonb_agg(case when x->>'id'=a.id::text then x || jsonb_build_object('recipientCanEdit',a.recipient_can_edit,'recipientCanCopy',a.recipient_can_copy) else x end)
      into addons from jsonb_array_elements(v_next #> '{meta,programAddOns}') x;
    v_next := jsonb_set(v_next,'{meta,programAddOns}',addons,true);
  else
    meta := (v_next #> '{meta,activeProgramSource}') || jsonb_build_object('recipientCanEdit',a.recipient_can_edit,'recipientCanCopy',a.recipient_can_copy);
    v_next := jsonb_set(v_next,'{meta,activeProgramSource}',meta,true);
  end if;
  update public.profiles set plan_json=v_next where id=p_profile_id;
  return v_next;
end $$;
revoke all on function public.training_program_accept_with_sharing(uuid,uuid,text,jsonb,boolean,boolean) from public,anon;
grant execute on function public.training_program_accept_with_sharing(uuid,uuid,text,jsonb,boolean,boolean) to authenticated;
-- Coach/client Program management: selected member assignment and safe pending revocation.
-- Existing immutable Program versions and recipient-owned active plans remain unchanged.

create or replace function public.training_program_assign_members_with_permissions(
  p_program_id uuid,
  p_membership_ids uuid[],
  p_start_date date,
  p_completion_mode text default 'repeat',
  p_recipient_can_edit boolean default true,
  p_message text default '',
  p_recipient_can_copy boolean default true
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_family_id uuid;
  v_version_id uuid;
  v_count integer;
  v_message text := btrim(coalesce(p_message, ''));
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if p_start_date is null then raise exception 'Program start date is required'; end if;
  if p_completion_mode not in ('repeat','once','hold') then raise exception 'Invalid completion mode'; end if;
  if coalesce(cardinality(p_membership_ids), 0) < 1 then raise exception 'Select at least one recipient'; end if;
  if cardinality(p_membership_ids) > 200 then raise exception 'Too many recipients selected'; end if;
  if char_length(v_message) > 500 then raise exception 'Assignment message is too long'; end if;

  select p.owner_family_id, p.current_version_id
  into v_family_id, v_version_id
  from public.training_programs p
  where p.id = p_program_id and p.status = 'active';

  if v_family_id is null
     or v_version_id is null
     or not private.training_program_owned_family(v_family_id) then
    raise exception 'Program not found or not assignable';
  end if;

  if exists (
    select 1
    from (select distinct unnest(p_membership_ids) as membership_id) requested
    left join public.group_memberships target
      on target.id = requested.membership_id and target.status = 'active'
    where target.id is null
       or not exists (
         select 1
         from public.group_memberships admin_membership
         join public.families admin_family on admin_family.id = admin_membership.family_id
         where admin_membership.group_id = target.group_id
           and admin_membership.status = 'active'
           and admin_membership.role = 'admin'
           and admin_family.owner_user_id = (select auth.uid())
       )
  ) then
    raise exception 'Group admin access is required for every selected recipient';
  end if;

  insert into public.training_program_assignments (
    program_id,
    version_id,
    assigned_by_family_id,
    target_membership_id,
    start_date,
    completion_mode,
    recipient_can_edit,
    recipient_can_copy,
    message
  )
  select
    p_program_id,
    v_version_id,
    v_family_id,
    requested.membership_id,
    p_start_date - (extract(isodow from p_start_date)::integer - 1),
    p_completion_mode,
    coalesce(p_recipient_can_edit, true),
    coalesce(p_recipient_can_copy, false),
    v_message
  from (select distinct unnest(p_membership_ids) as membership_id) requested
  on conflict (version_id, target_membership_id, start_date)
    where target_membership_id is not null and status = 'pending'
  do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end
$$;

revoke all on function public.training_program_assign_members_with_permissions(uuid,uuid[],date,text,boolean,text,boolean)
  from public, anon;
grant execute on function public.training_program_assign_members_with_permissions(uuid,uuid[],date,text,boolean,text,boolean)
  to authenticated;


-- Retain copied checkpoints when an authorised recipient saves an owned version.
-- Permission checks are based on assignments, never on user-editable metadata.
create or replace function private.training_program_freeze_assessments()
returns trigger language plpgsql security definer set search_path = '' as $$
declare phase jsonb; checkpoint jsonb; phases jsonb := '[]'; checkpoints jsonb; definition jsonb; template_uuid uuid;
begin
  for phase in select value from jsonb_array_elements(new.content_json #> '{program,phases}') loop
    checkpoints := '[]';
    for checkpoint in select value from jsonb_array_elements(coalesce(phase->'assessments','[]'::jsonb)) loop
      definition := null;
      if coalesce(checkpoint->>'assessmentTemplateId','') <> '' then
        template_uuid := (checkpoint->>'assessmentTemplateId')::uuid;
        select jsonb_build_object('template',to_jsonb(t)-'family_id',
          'tests',(select coalesce(jsonb_agg(to_jsonb(test)-'family_id'),'[]') from public.tests test
            where test.id in (select tt.test_id from public.assessment_template_tests tt where tt.assessment_template_id=t.id) and not test.archived),
          'templateTests',(select coalesce(jsonb_agg(to_jsonb(tt)-'family_id' order by tt.position),'[]') from public.assessment_template_tests tt where tt.assessment_template_id=t.id))
          into definition from public.assessment_templates t where t.id=template_uuid and t.family_id=new.created_by_family_id and not t.archived;
        if definition is null then
          select saved_cp->'assessmentDefinition' into definition
          from public.training_program_assignments a join public.training_program_versions v on v.id=a.version_id,
            lateral jsonb_array_elements(v.content_json #> '{program,phases}') saved_phase,
            lateral jsonb_array_elements(coalesce(saved_phase->'assessments','[]')) saved_cp
          where a.recipient_can_copy and private.training_program_target_visible(a.target_profile_id,a.target_membership_id)
            and saved_cp->>'assessmentTemplateId'=template_uuid::text limit 1;
        end if;
        if definition is null or jsonb_array_length(definition->'tests')=0
          or jsonb_array_length(definition->'tests')<>jsonb_array_length(definition->'templateTests')
          then raise exception 'Choose an available Assessment with active Tests for each linked checkpoint'; end if;
      end if;
      checkpoints := checkpoints || jsonb_build_array((checkpoint-'assessmentDefinition') || case when definition is null then '{}'::jsonb else jsonb_build_object('assessmentDefinition',definition) end);
    end loop;
    phases := phases || jsonb_build_array(jsonb_set(phase,'{assessments}',checkpoints,true));
  end loop;
  new.content_json := jsonb_set(new.content_json,'{program,phases}',phases,true);
  return new;
end $$;

-- Prevent saving an unchanged no-copy issued programme as an owned version.
create function private.training_program_guard_copy()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.training_program_assignments a join public.training_program_versions v on v.id=a.version_id
    where not a.recipient_can_copy and a.assigned_by_family_id<>new.created_by_family_id
      and private.training_program_target_visible(a.target_profile_id,a.target_membership_id)
      and v.content_json #> '{program,phases}' = new.content_json #> '{program,phases}'
  ) then raise exception 'The coach has not allowed this programme to be copied'; end if;
  return new;
end $$;
revoke all on function private.training_program_guard_copy() from public,anon,authenticated;
create trigger training_program_guard_copy before insert on public.training_program_versions
for each row execute function private.training_program_guard_copy();

create function private.training_program_positive(p_value text)
returns boolean language sql immutable set search_path = '' as $$
  select case when coalesce(p_value,'') ~ '^[0-9]+(\.[0-9]+)?$' then p_value::numeric>0 else false end;
$$;
revoke all on function private.training_program_positive(text) from public,anon,authenticated;

-- Reporting counts only programme blocks, with no notes, raw sets or private tasks returned.
create function private.training_program_block_state(p_plan jsonb,p_log jsonb,p_day_log jsonb)
returns text language plpgsql immutable set search_path = '' as $$
declare movement jsonb; task jsonb; performed integer; expected integer; all_complete boolean:=true; any_recorded boolean:=false; item jsonb;
begin
  if coalesce(p_log->>'suspendedByRecoveryMode','false')='true' or coalesce(p_log->>'cancelled','false')='true' then return 'excused'; end if;
  if p_plan->>'typeId'='recovery' then
    if coalesce(p_log->>'recoveryDone','false')='true' then return 'completed'; end if;
  elsif p_plan->>'typeId'='session' then
    if coalesce(p_log #>> '{session,completed}','false')='true' then return 'completed'; end if;
    if private.training_program_positive(p_log #>> '{session,actualDurationSec}') or exists
      (select 1 from jsonb_array_elements(coalesce(p_log #> '{session,movements}','[]')) m where coalesce(m->>'completed','false')='true') then return 'recorded'; end if;
  elsif p_plan->>'typeId'='cardio' then
    if private.training_program_positive(p_log #>> '{cardio,durationMin}') then return 'completed'; end if;
    if private.training_program_positive(p_log #>> '{cardio,distanceKm}') then return 'recorded'; end if;
  elsif p_plan->>'typeId'='duration' then
    if private.training_program_positive(p_log #>> '{duration,minutes}') then return 'completed'; end if;
  elsif p_plan->>'typeId'='tasks' then
    for task in select value from jsonb_array_elements(coalesce(p_plan->'tasks','[]')) loop
      if coalesce(p_day_log #>> array['tasks',task->>'id','done'],'false')='true' then any_recorded:=true;
      else all_complete:=false; end if;
    end loop;
    if any_recorded and all_complete then return 'completed'; end if;
    if any_recorded then return 'recorded'; end if;
  elsif p_plan->>'typeId' in ('strength','hiit','box') then
    for movement in select value from jsonb_array_elements(coalesce(p_plan->'movements','[]')) loop
      select count(*) into performed from jsonb_array_elements(coalesce(p_log #> array['sets',movement->>'id'],'[]')) s
      where private.training_program_positive(s->>'reps') or private.training_program_positive(s->>'seconds') or private.training_program_positive(s->>'durationSec') or private.training_program_positive(s->>'timeSec') or private.training_program_positive(s->>'timeSeconds');
      if performed>0 then any_recorded:=true; end if;
      select count(*) into performed from jsonb_array_elements(coalesce(p_log #> array['sets',movement->>'id'],'[]')) s
      where private.training_program_positive(s->>'reps')
        and (coalesce(movement->>'trackWeight','false')<>'true' or coalesce(s->>'weight','') ~ '^[0-9]+(\.[0-9]+)?$')
        and (coalesce(movement->>'trackDuration','false')<>'true' or private.training_program_positive(s->>'timeSeconds'));
      expected := case when coalesce(movement->>'sets','') ~ '^[1-9][0-9]*$' then (movement->>'sets')::integer else 1 end;
      any_recorded := any_recorded or performed>0; all_complete := all_complete and performed>=expected;
    end loop;
    if any_recorded and all_complete then return 'completed'; end if;
    if any_recorded then return 'recorded'; end if;
  end if;
  return 'missing';
end $$;
revoke all on function private.training_program_block_state(jsonb,jsonb,jsonb) from public,anon,authenticated;

create function public.training_program_coach_report(p_assignment_id uuid,p_reference_date date,p_days integer default 28)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare a public.training_program_assignments%rowtype; plan jsonb; actual jsonb; profile_uuid uuid; cp_data jsonb;
  weeks jsonb; week jsonb; block jsonb; log_block jsonb; day_log jsonb; day date; from_day date; start_day date; week_index integer;
  state text; total integer:=0; completed integer:=0; recorded integer:=0; excused integer:=0; day_total integer; day_done integer; day_records integer; daily jsonb:='[]';
begin
  if (select auth.uid()) is null or not private.training_program_can_manage_assignment(p_assignment_id)
    then raise exception 'Assignment reporting access required'; end if;
  select * into a from public.training_program_assignments where id=p_assignment_id;
  if a.status<>'accepted' then return jsonb_build_object('adherenceShared',false,'assessmentsShared',false,'days','[]'::jsonb,'checkpoints','[]'::jsonb); end if;
  select coalesce(a.target_profile_id,gm.profile_id) into profile_uuid from (select 1) seed left join public.group_memberships gm on gm.id=a.target_membership_id;
  select plan_json into actual from public.profiles where id=profile_uuid;
  if actual #>> '{meta,activeProgramSource,assignmentId}'=a.id::text then plan:=actual;
  else select x->'content' into plan from jsonb_array_elements(coalesce(actual #> '{meta,programAddOns}','[]')) x where x->>'id'=a.id::text; end if;
  if a.share_adherence and plan is not null and a.undone_at is null and a.removed_at is null then
    start_day := (plan #>> '{program,startDate}')::date;
    from_day := greatest(start_day,coalesce(p_reference_date,current_date)-least(90,greatest(1,coalesce(p_days,28)))+1,a.responded_at::date);
    select jsonb_agg(w order by phase_ord,week_ord) into weeks from jsonb_array_elements(plan #> '{program,phases}') with ordinality phases(ph,phase_ord),
      lateral jsonb_array_elements(ph->'weeks') with ordinality ws(w,week_ord);
    for day in select d::date from generate_series(from_day::timestamp,coalesce(p_reference_date,current_date)::timestamp,interval '1 day') d loop
      week_index := (day-start_day)/7;
      if week_index>=jsonb_array_length(weeks) then
        if plan #>> '{program,completionMode}'='once' then continue;
        elsif plan #>> '{program,completionMode}'='hold' then week_index:=jsonb_array_length(weeks)-1;
        else week_index:=week_index % jsonb_array_length(weeks); end if;
      end if;
      week:=weeks->week_index;
      select log_json into day_log from public.logs where profile_id=profile_uuid and date_ymd=day::text;
      day_total:=0; day_done:=0; day_records:=0;
      for block in select value from jsonb_array_elements(coalesce(week #> array['blocksByWeekday',(array['Mon','Tue','Wed','Thu','Fri','Sat','Sun'])[extract(isodow from day)::integer]],'[]')) loop
        select b into log_block from jsonb_array_elements(coalesce(day_log->'blocks','[]')) b
          where b->>'id'=case when a.adoption_mode='add' then 'assigned_' || a.id::text || '_' || (block->>'id') else block->>'id' end limit 1;
        state:=private.training_program_block_state(block,log_block,day_log);
        if state='excused' then excused:=excused+1; continue; end if;
        day_total:=day_total+1;
        if state='completed' then day_done:=day_done+1; end if;
        if state in ('completed','recorded') then day_records:=day_records+1; end if;
      end loop;
      total:=total+day_total; completed:=completed+day_done; recorded:=recorded+day_records;
      if day_total>0 then daily:=daily || jsonb_build_array(jsonb_build_object('date',day,'planned',day_total,'completed',day_done,'recorded',day_records)); end if;
    end loop;
  end if;
  if a.share_assessments then
    select coalesce(jsonb_agg(jsonb_build_object('id',cp.id,'phase',cp.phase_name,'timing',cp.timing,'title',cp.title,'dueDate',cp.due_date,
      'completedDate',r.date_ymd,'results',coalesce((select jsonb_agg(jsonb_build_object('position',res.position,'name',res.test_name_snapshot,
        'metric',res.metric_snapshot,'protocol',coalesce(r.template_snapshot #>> array['tests',(res.position-1)::text,'protocolText'],''),'value',res.comparable_value,'dimensions',res.comparable_dimensions) order by res.position)
        from public.assessment_test_results res where res.assessment_run_id=r.id and res.is_valid),'[]'::jsonb)) order by cp.due_date),'[]'::jsonb)
      into cp_data from public.training_program_checkpoints cp
      left join lateral (select run.id,run.date_ymd,run.template_snapshot from public.assessment_runs run where run.program_checkpoint_id=cp.id and run.status='completed' order by run.completed_at desc limit 1) r on true
      where cp.assignment_id=a.id;
  end if;
  return jsonb_build_object('adherenceShared',a.share_adherence,'assessmentsShared',a.share_assessments,'attached',plan is not null,
    'planned',total,'completed',completed,'recorded',recorded,'excused',excused,'days',daily,'checkpoints',coalesce(cp_data,'[]'::jsonb));
end $$;
revoke all on function public.training_program_coach_report(uuid,date,integer) from public,anon;
grant execute on function public.training_program_coach_report(uuid,date,integer) to authenticated;

create function public.training_program_recipient_controls(p_profile_id uuid)
returns table(assignment_id uuid,title text,can_edit boolean,can_copy boolean,share_adherence boolean,share_assessments boolean,adoption_mode text)
language plpgsql stable security definer set search_path = '' as $$
declare plan jsonb;
begin
  select p.plan_json into plan from public.profiles p where p.id=p_profile_id and private.training_program_owned_family(p.family_id);
  if (select auth.uid()) is null or plan is null then raise exception 'Profile access required'; end if;
  return query select a.id,p.title,a.recipient_can_edit,a.recipient_can_copy,a.share_adherence,a.share_assessments,a.adoption_mode
    from public.training_program_assignments a join public.training_programs p on p.id=a.program_id
    where a.status='accepted' and a.undone_at is null and a.removed_at is null
      and private.training_program_target_visible(a.target_profile_id,a.target_membership_id)
      and (plan #>> '{meta,activeProgramSource,assignmentId}'=a.id::text or exists
        (select 1 from jsonb_array_elements(coalesce(plan #> '{meta,programAddOns}','[]')) x where x->>'id'=a.id::text));
end $$;
revoke all on function public.training_program_recipient_controls(uuid) from public,anon;
grant execute on function public.training_program_recipient_controls(uuid) to authenticated;

create function private.training_program_non_task_phases(p_content jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare ph jsonb; w jsonb; days jsonb; day text; weeks jsonb; phases jsonb:='[]';
begin
  for ph in select value from jsonb_array_elements(coalesce(p_content #> '{program,phases}','[]')) loop
    weeks:='[]';
    for w in select value from jsonb_array_elements(ph->'weeks') loop
      days:='{}';
      foreach day in array array['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] loop
        days:=days || jsonb_build_object(day,coalesce((select jsonb_agg(b) from jsonb_array_elements(coalesce(w #> array['blocksByWeekday',day],'[]')) b where b->>'typeId'<>'tasks'),'[]'::jsonb));
      end loop;
      weeks:=weeks || jsonb_build_array(jsonb_set(w,'{blocksByWeekday}',days));
    end loop;
    phases:=phases || jsonb_build_array(jsonb_set(ph,'{weeks}',weeks));
  end loop;
  return phases;
end $$;
revoke all on function private.training_program_non_task_phases(jsonb) from public,anon,authenticated;
create or replace function public.training_program_accept_assignment(
  p_assignment_id uuid, p_profile_id uuid, p_adoption_mode text, p_prepared_plan jsonb
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_offer public.training_program_assignments%rowtype;
  v_prior public.training_program_assignments%rowtype;
  v_original jsonb;
  v_next jsonb;
  v_addons jsonb;
  v_remaining jsonb;
  v_frozen jsonb;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if p_adoption_mode is null or p_adoption_mode not in ('add','replace','replace_keep_tasks') then raise exception 'Invalid adoption mode'; end if;
  select * into v_offer from public.training_program_assignments where id = p_assignment_id and status = 'pending' for update;
  if not found then raise exception 'Assignment is unavailable'; end if;
  select p.plan_json into v_original from public.profiles p
    join public.families f on f.id = p.family_id
    where p.id = p_profile_id and f.owner_user_id = (select auth.uid()) for update of p;
  if not found then raise exception 'Profile is not available to the current account'; end if;
  if v_offer.replaces_assignment_id is not null then
    select * into v_prior from public.training_program_assignments where id = v_offer.replaces_assignment_id;
    if v_prior.status = 'accepted' then
      if v_prior.adoption_mode = 'add' then
        if p_adoption_mode <> 'add' then raise exception 'This offer replaces only the assigned add-on'; end if;
        v_addons := coalesce(v_original #> '{meta,programAddOns}', '[]'::jsonb);
        if not exists (select 1 from jsonb_array_elements(v_addons) addon where addon->>'id' = v_prior.id::text)
          then raise exception 'The original add-on is no longer active'; end if;
        select coalesce(jsonb_agg(addon),'[]'::jsonb) into v_remaining
          from jsonb_array_elements(v_addons) addon where addon->>'id' <> v_prior.id::text;
        update public.profiles set plan_json = jsonb_set(v_original, '{meta,programAddOns}', v_remaining, true) where id = p_profile_id;
      else
        if p_adoption_mode = 'add' then raise exception 'This offer replaces the assigned main programme'; end if;
        if v_original #>> '{meta,activeProgramSource,assignmentId}' is distinct from v_prior.id::text
          then raise exception 'The original programme is no longer active'; end if;
      end if;
    end if;
  end if;
  if p_adoption_mode='replace_keep_tasks' and not v_offer.recipient_can_edit then
    select content_json into v_frozen from public.training_program_versions where id=v_offer.version_id;
    if private.training_program_non_task_phases(p_prepared_plan) is distinct from private.training_program_non_task_phases(v_frozen)
      or p_prepared_plan->'activityTypes' is distinct from v_frozen->'activityTypes'
      or p_prepared_plan #>> '{program,startDate}' is distinct from v_offer.start_date::text
      or p_prepared_plan #>> '{program,completionMode}' is distinct from v_offer.completion_mode then
      raise exception 'Assigned programme content must be followed as supplied';
    end if;
  end if;
  v_next := private.training_program_accept_assignment_original(p_assignment_id,p_profile_id,p_adoption_mode,p_prepared_plan);
  if v_offer.replaces_assignment_id is not null and v_prior.status = 'accepted' then
    if v_prior.adoption_mode <> 'add' and jsonb_typeof(v_original #> '{meta,programAddOns}') = 'array' then
      v_next := jsonb_set(v_next, '{meta,programAddOns}', v_original #> '{meta,programAddOns}', true);
      update public.profiles set plan_json = v_next where id = p_profile_id;
    end if;
    update private.training_program_assignment_backups set previous_plan_json = v_original where assignment_id = p_assignment_id;
  end if;
  return v_next;
end;
$$;
revoke all on function public.training_program_accept_assignment(uuid,uuid,text,jsonb) from public, anon;
grant execute on function public.training_program_accept_assignment(uuid,uuid,text,jsonb) to authenticated;


-- Existing pending invitations get one inbox entry when the inbox is introduced.
insert into public.training_program_notifications(family_id,profile_id,assignment_id,kind,audience,title)
select recipient.family_id,recipient.id,a.id,'assigned','recipient',p.title || ' · New assignment'
from public.training_program_assignments a join public.training_programs p on p.id=a.program_id
left join public.group_memberships gm on gm.id=a.target_membership_id
join public.profiles recipient on recipient.id=coalesce(a.target_profile_id,gm.profile_id)
where a.status='pending' and (a.target_membership_id is null or gm.status='active');

create function public.training_program_due_checkpoints(p_profile_id uuid,p_reference_date date)
returns setof public.training_program_checkpoints
language plpgsql security definer set search_path = '' as $$
declare p public.profiles%rowtype; source_uuid uuid; addon jsonb;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select * into p from public.profiles where id=p_profile_id and private.training_program_owned_family(family_id) for update;
  if not found then raise exception 'Profile access required'; end if;
  if p_reference_date is null or p_reference_date < current_date-366 or p_reference_date>current_date+2 then raise exception 'Invalid checkpoint reference date'; end if;
  update public.training_program_checkpoints set active=false where profile_id=p.id and active;
  source_uuid:=nullif(p.plan_json #>> '{meta,activeProgramSource,assignmentId}','')::uuid;
  perform private.training_program_schedule_source(p.id,p.family_id,coalesce(source_uuid::text,'personal:' || coalesce(p.plan_json #>> '{program,phases,0,id}','')),source_uuid,p.plan_json,p_reference_date);
  for addon in select value from jsonb_array_elements(coalesce(p.plan_json #> '{meta,programAddOns}','[]')) loop
    perform private.training_program_schedule_source(p.id,p.family_id,addon->>'id',(addon->>'id')::uuid,addon->'content',p_reference_date);
  end loop;
  return query select cp.* from public.training_program_checkpoints cp where cp.profile_id=p.id and cp.active order by cp.due_date;
end $$;
revoke all on function public.training_program_due_checkpoints(uuid,date) from public,anon;
grant execute on function public.training_program_due_checkpoints(uuid,date) to authenticated;
