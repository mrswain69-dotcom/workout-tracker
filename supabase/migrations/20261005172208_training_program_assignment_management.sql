-- Changes to an accepted programme are recipient-approved offers. No logs are touched.
alter table public.training_program_assignments
  add column replaces_assignment_id uuid references public.training_program_assignments(id) on delete set null,
  add column replacement_adoption_mode text
    check (replacement_adoption_mode is null or replacement_adoption_mode in ('add','replace','replace_keep_tasks'));
create index training_program_assignments_replaces_idx
  on public.training_program_assignments(replaces_assignment_id);
create unique index training_program_assignments_one_pending_offer_idx
  on public.training_program_assignments(replaces_assignment_id)
  where replaces_assignment_id is not null and status = 'pending';

create function private.training_program_can_manage_assignment(p_assignment_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.training_program_assignments a
    where a.id = p_assignment_id
      and (select auth.uid()) is not null
      and private.training_program_owned_family(a.assigned_by_family_id)
      and (
        exists (select 1 from public.profiles p where p.id = a.target_profile_id
          and private.training_program_owned_family(p.family_id))
        or exists (
          select 1 from public.group_memberships target
          join public.group_memberships admin on admin.group_id = target.group_id
          where target.id = a.target_membership_id and target.status = 'active'
            and admin.status = 'active' and admin.role = 'admin'
            and private.training_program_owned_family(admin.family_id)
        )
      )
  );
$$;
revoke all on function private.training_program_can_manage_assignment(uuid) from public, anon, authenticated;

create function public.training_program_reschedule_assignment(
  p_assignment_id uuid, p_start_date date, p_completion_mode text, p_message text default ''
)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if p_start_date is null or p_completion_mode is null or p_completion_mode not in ('repeat','once','hold')
    or char_length(coalesce(p_message,'')) > 500 then raise exception 'Invalid assignment schedule'; end if;
  if not private.training_program_can_manage_assignment(p_assignment_id) then raise exception 'Assignment management access required'; end if;
  update public.training_program_assignments
    set start_date = p_start_date - (extract(isodow from p_start_date)::integer - 1),
        completion_mode = p_completion_mode, message = btrim(coalesce(p_message,''))
    where id = p_assignment_id and status = 'pending';
  return found;
end;
$$;
revoke all on function public.training_program_reschedule_assignment(uuid,date,text,text) from public, anon;
grant execute on function public.training_program_reschedule_assignment(uuid,date,text,text) to authenticated;

create function public.training_program_offer_replacement(
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
  v_parent_id := coalesce(v_old.replaces_assignment_id, v_old.id);
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

-- Keep the established adoption implementation private; wrap it to replace the
-- original slot atomically and capture the full original plan for recipient undo.
alter function public.training_program_accept_assignment(uuid,uuid,text,jsonb) rename to training_program_accept_assignment_original;
alter function public.training_program_accept_assignment_original(uuid,uuid,text,jsonb) set schema private;
revoke all on function private.training_program_accept_assignment_original(uuid,uuid,text,jsonb) from public, anon, authenticated;

create function public.training_program_accept_assignment(
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

create function public.training_program_assignment_states(p_family_id uuid, p_reference_date date default current_date)
returns table (assignment_id uuid, active_state text)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_row record;
  v_source jsonb;
  v_start date;
  v_weeks integer;
  v_mode text;
begin
  if (select auth.uid()) is null or not private.training_program_owned_family(p_family_id)
    then raise exception 'Assignment status access required'; end if;
  for v_row in
    select a.*, p.plan_json from public.training_program_assignments a
      left join public.group_memberships gm on gm.id = a.target_membership_id
      left join public.profiles p on p.id = coalesce(a.target_profile_id, gm.profile_id)
      where a.assigned_by_family_id = p_family_id
      order by a.created_at desc limit 200
  loop
    assignment_id := v_row.id;
    active_state := v_row.status;
    if v_row.status = 'accepted' then
      active_state := 'inactive';
      v_source := null;
      if not private.training_program_can_manage_assignment(v_row.id) then active_state := 'unavailable';
      elsif v_row.removed_at is not null then active_state := 'removed';
      elsif v_row.undone_at is not null then active_state := 'undone';
      else
        if v_row.plan_json #>> '{meta,activeProgramSource,assignmentId}' = v_row.id::text then
          v_source := v_row.plan_json;
        else
          select addon->'content' into v_source
            from jsonb_array_elements(coalesce(v_row.plan_json #> '{meta,programAddOns}','[]'::jsonb)) addon
            where addon->>'id' = v_row.id::text limit 1;
        end if;
        if v_source is not null then
          begin v_start := coalesce((v_source #>> '{program,startDate}')::date, v_row.start_date);
          exception when others then v_start := v_row.start_date; end;
          select coalesce(sum(jsonb_array_length(case when jsonb_typeof(phase->'weeks') = 'array' then phase->'weeks' else '[]'::jsonb end)),1)::integer
            into v_weeks from jsonb_array_elements(coalesce(v_source #> '{program,phases}','[]'::jsonb)) phase;
          v_weeks := greatest(1,v_weeks);
          v_mode := coalesce(v_source #>> '{program,completionMode}', v_row.completion_mode);
          active_state := case when coalesce(p_reference_date,current_date) < v_start then 'scheduled'
            when coalesce(p_reference_date,current_date) >= v_start + v_weeks * 7 and v_mode = 'once' then 'finished'
            when coalesce(p_reference_date,current_date) >= v_start + v_weeks * 7 and v_mode = 'hold' then 'holding'
            else 'active' end;
        end if;
      end if;
    end if;
    return next;
  end loop;
end;
$$;
revoke all on function public.training_program_assignment_states(uuid,date) from public, anon;
grant execute on function public.training_program_assignment_states(uuid,date) to authenticated;
comment on function public.training_program_assignment_states(uuid,date) is
  'Returns minimal assignment lifecycle status to an authorised coach; no recipient plan content or logs are returned.';
