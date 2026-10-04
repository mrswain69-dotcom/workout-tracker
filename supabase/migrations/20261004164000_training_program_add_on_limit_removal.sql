-- A profile can run one base Program plus one independently scheduled add-on.
-- Recipients can remove that add-on without restoring or replacing the base plan.

alter table public.training_program_assignments
  add column if not exists removed_at timestamptz;

alter table public.profiles
  add constraint profiles_plan_max_one_program_add_on
  check (
    case
      when jsonb_typeof(plan_json #> '{meta,programAddOns}') = 'array'
        then jsonb_array_length(plan_json #> '{meta,programAddOns}') <= 1
      else true
    end
  ) not valid;

alter table public.profiles
  validate constraint profiles_plan_max_one_program_add_on;

create or replace function public.training_program_remove_add_on(
  p_assignment_id uuid,
  p_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target_profile uuid;
  v_current jsonb;
  v_meta jsonb;
  v_addons jsonb;
  v_remaining jsonb;
  v_next jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  select coalesce(a.target_profile_id, gm.profile_id)
  into v_target_profile
  from public.training_program_assignments a
  left join public.group_memberships gm on gm.id = a.target_membership_id
  where a.id = p_assignment_id
    and a.status = 'accepted'
    and a.adoption_mode = 'add'
    and a.undone_at is null
    and a.removed_at is null
  for update of a;

  if v_target_profile is distinct from p_profile_id then
    raise exception 'Added Program is unavailable';
  end if;

  select p.plan_json
  into v_current
  from public.profiles p
  join public.families f on f.id = p.family_id
  where p.id = p_profile_id
    and f.owner_user_id = (select auth.uid())
  for update of p;

  if jsonb_typeof(v_current) <> 'object' then
    raise exception 'Profile plan is unavailable';
  end if;

  v_meta := coalesce(v_current->'meta', '{}'::jsonb);
  v_addons := case
    when jsonb_typeof(v_meta->'programAddOns') = 'array'
      then v_meta->'programAddOns'
    else '[]'::jsonb
  end;

  if not exists (
    select 1
    from jsonb_array_elements(v_addons) addon
    where addon->>'id' = p_assignment_id::text
  ) then
    raise exception 'Added Program is no longer active';
  end if;

  select coalesce(jsonb_agg(addon), '[]'::jsonb)
  into v_remaining
  from jsonb_array_elements(v_addons) addon
  where addon->>'id' is distinct from p_assignment_id::text;

  if jsonb_array_length(v_remaining) = 0 then
    v_meta := v_meta - 'programAddOns';
  else
    v_meta := jsonb_set(v_meta, '{programAddOns}', v_remaining, true);
  end if;

  if v_meta #>> '{programAdoptionUndo,assignmentId}' = p_assignment_id::text then
    v_meta := v_meta - 'programAdoptionUndo';
  end if;

  v_next := jsonb_set(v_current, '{meta}', v_meta, true);
  update public.profiles set plan_json = v_next where id = p_profile_id;
  update public.training_program_assignments
    set removed_at = now()
    where id = p_assignment_id;
  update private.training_program_assignment_backups
    set undone_at = now()
    where assignment_id = p_assignment_id and undone_at is null;

  return v_next;
end
$$;

revoke all on function public.training_program_remove_add_on(uuid,uuid)
  from public, anon;
grant execute on function public.training_program_remove_add_on(uuid,uuid)
  to authenticated;

comment on function public.training_program_remove_add_on(uuid,uuid) is
  'Removes one accepted add-on Program from its recipient while preserving the base plan and logs.';
