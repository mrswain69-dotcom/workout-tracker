-- Each accepted update becomes the parent for the next update.
create or replace function public.training_program_offer_replacement(
  p_assignment_id uuid, p_program_id uuid, p_start_date date,
  p_completion_mode text, p_message text default ''
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_old public.training_program_assignments%rowtype;
  v_program_id uuid;
  v_version_id uuid;
  v_parent_id uuid;
  v_parent_mode text;
  v_profile_id uuid;
  v_plan jsonb;
  v_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if p_start_date is null or p_completion_mode is null or p_completion_mode not in ('repeat','once','hold')
    or char_length(coalesce(p_message,'')) > 500 then raise exception 'Invalid assignment offer'; end if;
  select * into v_old from public.training_program_assignments where id = p_assignment_id for update;
  if not found or not private.training_program_can_manage_assignment(p_assignment_id)
    or v_old.status not in ('pending','accepted') then raise exception 'Assignment is not available for management'; end if;
  if v_old.status = 'accepted' then
    select coalesce(v_old.target_profile_id, gm.profile_id) into v_profile_id
      from (select 1) seed left join public.group_memberships gm on gm.id = v_old.target_membership_id;
    select p.plan_json into v_plan from public.profiles p where p.id = v_profile_id;
    if v_old.undone_at is not null or v_old.removed_at is not null or not (
      coalesce(v_plan #>> '{meta,activeProgramSource,assignmentId}' = v_old.id::text, false)
      or exists (select 1 from jsonb_array_elements(coalesce(v_plan #> '{meta,programAddOns}','[]'::jsonb)) addon
        where addon->>'id' = v_old.id::text)
    ) then raise exception 'That accepted programme is no longer active'; end if;
  end if;
  v_program_id := coalesce(p_program_id, v_old.program_id);
  if p_program_id is null then
    v_version_id := v_old.version_id;
  else
    select p.current_version_id into v_version_id from public.training_programs p
      where p.id = p_program_id and p.owner_family_id = v_old.assigned_by_family_id and p.status = 'active';
    if v_version_id is null then raise exception 'Replacement programme is not available'; end if;
  end if;
  v_parent_id := case when v_old.status = 'accepted' then v_old.id else coalesce(v_old.replaces_assignment_id, v_old.id) end;
  v_parent_mode := case when v_old.status = 'accepted' then v_old.adoption_mode else v_old.replacement_adoption_mode end;
  if exists (select 1 from public.training_program_assignments a where a.replaces_assignment_id = v_parent_id
      and a.status = 'pending' and a.id <> v_old.id) then raise exception 'An update offer is already awaiting a response'; end if;
  if v_old.status = 'pending' then
    update public.training_program_assignments set status = 'revoked', responded_at = now() where id = v_old.id;
  end if;
  insert into public.training_program_assignments (
    program_id, version_id, assigned_by_family_id, target_profile_id, target_membership_id,
    start_date, completion_mode, recipient_can_edit, message, replaces_assignment_id, replacement_adoption_mode
  ) values (
    v_program_id, v_version_id, v_old.assigned_by_family_id, v_old.target_profile_id, v_old.target_membership_id,
    p_start_date - (extract(isodow from p_start_date)::integer - 1), p_completion_mode, v_old.recipient_can_edit,
    btrim(coalesce(p_message,'')), v_parent_id, v_parent_mode
  ) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.training_program_offer_replacement(uuid,uuid,date,text,text) from public, anon;
grant execute on function public.training_program_offer_replacement(uuid,uuid,date,text,text) to authenticated;

