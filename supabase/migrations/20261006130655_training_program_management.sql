-- Owner-only management APIs. No log, XP, active-plan or assignment writes.
create function public.training_program_update_details(
  p_program_id uuid, p_expected_updated_at timestamptz, p_title text,
  p_description text, p_purpose text, p_sport text, p_difficulty text,
  p_age_band text, p_equipment text[], p_tags text[]
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_program public.training_programs;
begin
  select * into v_program from public.training_programs p
    where p.id=p_program_id and private.training_program_owned_family(p.owner_family_id) for update;
  if v_program.id is null then raise exception 'Programme access required'; end if;
  if v_program.updated_at is distinct from p_expected_updated_at then
    raise exception 'Programme changed elsewhere. Refresh before saving details.';
  end if;
  update public.training_programs set title=btrim(p_title), description=btrim(coalesce(p_description,'')),
    purpose=btrim(coalesce(p_purpose,'')),sport=btrim(coalesce(p_sport,'')),
    difficulty=p_difficulty,age_band=p_age_band,equipment=coalesce(p_equipment,'{}'),tags=coalesce(p_tags,'{}'),
    updated_at=clock_timestamp() where id=p_program_id;
  return true;
end $$;
revoke all on function public.training_program_update_details(uuid,timestamptz,text,text,text,text,text,text,text[],text[]) from public,anon;
grant execute on function public.training_program_update_details(uuid,timestamptz,text,text,text,text,text,text,text[],text[]) to authenticated;

create function public.training_program_restore_archived(p_program_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.training_programs p set status='active',updated_at=clock_timestamp()
    where p.id=p_program_id and p.status='archived' and private.training_program_owned_family(p.owner_family_id);
  return found;
end $$;
revoke all on function public.training_program_restore_archived(uuid) from public,anon;
grant execute on function public.training_program_restore_archived(uuid) to authenticated;

create function public.training_program_copy_version(
  p_program_id uuid, p_version_id uuid, p_duplicate boolean, p_title text,
  p_change_note text, p_expected_version_id uuid
)
returns table(program_id uuid,version_id uuid,version_no integer)
language plpgsql security definer set search_path = '' as $$
declare v_program public.training_programs; v_content jsonb; v_no integer;
begin
  select * into v_program from public.training_programs p
    where p.id=p_program_id and private.training_program_owned_family(p.owner_family_id) for update;
  if v_program.id is null then raise exception 'Programme access required'; end if;
  if p_duplicate is null then raise exception 'Choose duplicate or restore'; end if;
  if not p_duplicate and v_program.status<>'active' then raise exception 'Restore the archived programme first'; end if;
  if not p_duplicate and v_program.current_version_id is distinct from p_expected_version_id then
    raise exception 'A newer version has been saved. Refresh before restoring.';
  end if;
  select v.content_json,v.version_no into v_content,v_no from public.training_program_versions v
    where v.id=p_version_id and v.program_id=p_program_id;
  if v_content is null then raise exception 'Version is not part of this programme'; end if;
  if char_length(btrim(coalesce(p_change_note,''))) not between 1 and 300 then raise exception 'Add a change note of up to 300 characters'; end if;
  return query select * from public.training_program_save(
    case when p_duplicate then null else p_program_id end,
    v_program.owner_family_id,v_program.creator_profile_id,
    case when p_duplicate then p_title else v_program.title end,
    v_program.description,v_program.purpose,v_program.sport,v_program.difficulty,v_program.age_band,
    v_program.equipment,v_program.tags,v_program.creator_role,v_content,p_change_note);
end $$;
revoke all on function public.training_program_copy_version(uuid,uuid,boolean,text,text,uuid) from public,anon;
grant execute on function public.training_program_copy_version(uuid,uuid,boolean,text,text,uuid) to authenticated;

create function public.training_program_update_link(p_link_id uuid,p_revoke boolean,p_expires_in_days integer default 30)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_link public.training_program_share_links;
begin
  select l.* into v_link from public.training_program_share_links l join public.training_programs p on p.id=l.program_id
    where l.id=p_link_id and private.training_program_owned_family(p.owner_family_id) for update of l;
  if v_link.id is null then raise exception 'Sharing link access required'; end if;
  if p_revoke is null then raise exception 'Choose revoke or expiry'; end if;
  if v_link.revoked_at is not null then raise exception 'This link is already revoked. Create a new link to share again.'; end if;
  if p_revoke then
    update public.training_program_share_links set revoked_at=clock_timestamp() where id=p_link_id;
  else
    if p_expires_in_days is null or p_expires_in_days not between 1 and 365 then raise exception 'Expiry must be 1 to 365 days'; end if;
    update public.training_program_share_links set expires_at=clock_timestamp()+make_interval(days=>p_expires_in_days) where id=p_link_id;
  end if;
  return true;
end $$;
revoke all on function public.training_program_update_link(uuid,boolean,integer) from public,anon;
grant execute on function public.training_program_update_link(uuid,boolean,integer) to authenticated;

-- Restoring/duplicating retains the original frozen Assessment definitions.
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
        -- Preserve only snapshots matching a saved version owned by this account.
        select saved_cp->'assessmentDefinition' into definition
          from public.training_program_versions v join public.training_programs p on p.id=v.program_id,
            lateral jsonb_array_elements(v.content_json #> '{program,phases}') saved_phase,
            lateral jsonb_array_elements(coalesce(saved_phase->'assessments','[]')) saved_cp
          where p.owner_family_id=new.created_by_family_id
            and private.training_program_owned_family(p.owner_family_id)
            and saved_cp->>'assessmentTemplateId'=template_uuid::text
            and saved_cp->'assessmentDefinition'=checkpoint->'assessmentDefinition' limit 1;
        if definition is null then
        select jsonb_build_object('template',to_jsonb(t)-'family_id',
          'tests',(select coalesce(jsonb_agg(to_jsonb(test)-'family_id'),'[]') from public.tests test
            where test.id in (select tt.test_id from public.assessment_template_tests tt where tt.assessment_template_id=t.id) and not test.archived),
          'templateTests',(select coalesce(jsonb_agg(to_jsonb(tt)-'family_id' order by tt.position),'[]') from public.assessment_template_tests tt where tt.assessment_template_id=t.id))
          into definition from public.assessment_templates t where t.id=template_uuid and t.family_id=new.created_by_family_id and not t.archived;
        end if;
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
