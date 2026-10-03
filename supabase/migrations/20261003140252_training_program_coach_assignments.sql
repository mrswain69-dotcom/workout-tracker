-- Coach/client Program management: selected member assignment and safe pending revocation.
-- Existing immutable Program versions and recipient-owned active plans remain unchanged.

create or replace function public.training_program_assign_members(
  p_program_id uuid,
  p_membership_ids uuid[],
  p_start_date date,
  p_completion_mode text default 'repeat',
  p_recipient_can_edit boolean default true,
  p_message text default ''
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
    message
  )
  select
    p_program_id,
    v_version_id,
    v_family_id,
    requested.membership_id,
    p_start_date,
    p_completion_mode,
    coalesce(p_recipient_can_edit, true),
    v_message
  from (select distinct unnest(p_membership_ids) as membership_id) requested
  on conflict (version_id, target_membership_id, start_date)
    where target_membership_id is not null and status = 'pending'
  do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end
$$;

revoke all on function public.training_program_assign_members(uuid,uuid[],date,text,boolean,text)
  from public, anon;
grant execute on function public.training_program_assign_members(uuid,uuid[],date,text,boolean,text)
  to authenticated;

create or replace function public.training_program_revoke_assignment(p_assignment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;

  update public.training_program_assignments assignment
  set status = 'revoked', responded_at = now()
  where assignment.id = p_assignment_id
    and assignment.status = 'pending'
    and private.training_program_owned_family(assignment.assigned_by_family_id);

  return found;
end
$$;

revoke all on function public.training_program_revoke_assignment(uuid) from public, anon;
grant execute on function public.training_program_revoke_assignment(uuid) to authenticated;

comment on function public.training_program_assign_members(uuid,uuid[],date,text,boolean,text) is
  'Assigns the current immutable Program version to selected active Group memberships administered by the caller.';
comment on function public.training_program_revoke_assignment(uuid) is
  'Revokes an unaccepted Program assignment owned by the caller family; accepted recipient plans are never rewritten.';
