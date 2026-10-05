-- Recipient-owned programme controls survive leaving a team. Coach management
-- and reporting still require the current active team relationship.
create function private.training_program_recipient_owns_assignment(p_assignment_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.training_program_assignments a
      left join public.group_memberships gm on gm.id=a.target_membership_id
      join public.profiles p on p.id=coalesce(a.target_profile_id,gm.profile_id)
    where a.id=p_assignment_id and private.training_program_owned_family(p.family_id)
  );
$$;
revoke all on function private.training_program_recipient_owns_assignment(uuid) from public,anon,authenticated;

create or replace function public.training_program_set_reporting(p_assignment_id uuid,p_share_adherence boolean,p_share_assessments boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  update public.training_program_assignments a set share_adherence=coalesce(p_share_adherence,false),share_assessments=coalesce(p_share_assessments,false)
    where a.id=p_assignment_id and a.status in ('pending','accepted')
      and private.training_program_recipient_owns_assignment(a.id);
  return found;
end $$;
revoke all on function public.training_program_set_reporting(uuid,boolean,boolean) from public,anon;
grant execute on function public.training_program_set_reporting(uuid,boolean,boolean) to authenticated;

-- A protected programme may be left or undone; while attached it cannot be edited.
-- The trigger also protects direct REST updates, not just the application controls.

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
          where a.recipient_can_copy and private.training_program_recipient_owns_assignment(a.id)
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


create or replace function private.training_program_guard_copy()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.training_program_assignments a join public.training_program_versions v on v.id=a.version_id
    where not a.recipient_can_copy and a.assigned_by_family_id<>new.created_by_family_id
      and private.training_program_recipient_owns_assignment(a.id)
      and v.content_json #> '{program,phases}' = new.content_json #> '{program,phases}'
  ) then raise exception 'The coach has not allowed this programme to be copied'; end if;
  return new;
end $$;
revoke all on function private.training_program_guard_copy() from public,anon,authenticated;

create or replace function public.training_program_recipient_controls(p_profile_id uuid)
returns table(assignment_id uuid,title text,can_edit boolean,can_copy boolean,share_adherence boolean,share_assessments boolean,adoption_mode text)
language plpgsql stable security definer set search_path = '' as $$
declare plan jsonb;
begin
  select p.plan_json into plan from public.profiles p where p.id=p_profile_id and private.training_program_owned_family(p.family_id);
  if (select auth.uid()) is null or plan is null then raise exception 'Profile access required'; end if;
  return query select a.id,p.title,a.recipient_can_edit,a.recipient_can_copy,a.share_adherence,a.share_assessments,a.adoption_mode
    from public.training_program_assignments a join public.training_programs p on p.id=a.program_id
    where a.status='accepted' and a.undone_at is null and a.removed_at is null
      and private.training_program_recipient_owns_assignment(a.id)
      and (plan #>> '{meta,activeProgramSource,assignmentId}'=a.id::text or exists
        (select 1 from jsonb_array_elements(coalesce(plan #> '{meta,programAddOns}','[]')) x where x->>'id'=a.id::text));
end $$;
revoke all on function public.training_program_recipient_controls(uuid) from public,anon;
grant execute on function public.training_program_recipient_controls(uuid) to authenticated;


