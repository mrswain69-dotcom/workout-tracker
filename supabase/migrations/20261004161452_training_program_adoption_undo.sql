-- Recipient-safe Program adoption: replace, layer alongside, keep personal tasks,
-- and restore the exact pre-adoption plan without exposing that plan to coaches.

alter table public.training_program_assignments
  add column if not exists adoption_mode text
    check (adoption_mode is null or adoption_mode in ('replace','add','replace_keep_tasks')),
  add column if not exists undone_at timestamptz;

create table if not exists private.training_program_assignment_backups (
  assignment_id uuid primary key
    references public.training_program_assignments(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  previous_plan_json jsonb not null check (jsonb_typeof(previous_plan_json) = 'object'),
  created_at timestamptz not null default now(),
  undone_at timestamptz
);

alter table private.training_program_assignment_backups enable row level security;
revoke all on table private.training_program_assignment_backups from public, anon, authenticated;

create or replace function public.training_program_accept_assignment(
  p_assignment_id uuid,
  p_profile_id uuid,
  p_adoption_mode text,
  p_prepared_plan jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignment public.training_program_assignments%rowtype;
  v_target_profile uuid;
  v_family_id uuid;
  v_existing jsonb;
  v_content jsonb;
  v_version_no integer;
  v_program_title text;
  v_next jsonb;
  v_meta jsonb;
  v_addons jsonb;
  v_addon jsonb;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if p_adoption_mode not in ('replace','add','replace_keep_tasks') then
    raise exception 'Invalid Program adoption mode';
  end if;

  select * into v_assignment
  from public.training_program_assignments
  where id = p_assignment_id and status = 'pending'
  for update;
  if not found then raise exception 'Assignment is unavailable'; end if;

  v_target_profile := v_assignment.target_profile_id;
  if v_target_profile is null then
    select gm.profile_id into v_target_profile
    from public.group_memberships gm
    where gm.id = v_assignment.target_membership_id and gm.status = 'active';
  end if;
  if v_target_profile is distinct from p_profile_id then
    raise exception 'Assignment belongs to a different profile';
  end if;

  select p.family_id, p.plan_json
  into v_family_id, v_existing
  from public.profiles p
  join public.families f on f.id = p.family_id
  where p.id = p_profile_id and f.owner_user_id = (select auth.uid())
  for update of p;
  if v_family_id is null then
    raise exception 'Profile is not available to the current account';
  end if;
  if jsonb_typeof(v_existing) <> 'object' then v_existing := '{}'::jsonb; end if;

  select v.content_json, v.version_no, p.title
  into v_content, v_version_no, v_program_title
  from public.training_program_versions v
  join public.training_programs p on p.id = v.program_id
  where v.id = v_assignment.version_id and v.program_id = v_assignment.program_id;
  if v_content is null then raise exception 'Program version is unavailable'; end if;

  insert into private.training_program_assignment_backups (
    assignment_id, profile_id, previous_plan_json
  ) values (
    v_assignment.id, p_profile_id, v_existing
  )
  on conflict (assignment_id) do update set
    profile_id = excluded.profile_id,
    previous_plan_json = excluded.previous_plan_json,
    created_at = now(),
    undone_at = null;

  v_meta := coalesce(v_existing->'meta', '{}'::jsonb)
    - 'programAdoptionUndo';
  v_meta := v_meta || jsonb_build_object(
    'planSetupPrompt', false,
    'programAdoptionUndo', jsonb_build_object(
      'assignmentId', v_assignment.id,
      'programTitle', coalesce(v_program_title, 'Assigned Program'),
      'adoptionMode', p_adoption_mode,
      'appliedAt', now()
    )
  );

  if p_adoption_mode = 'add'
     and jsonb_typeof(v_existing #> '{program,phases}') = 'array' then
    v_content := v_content - 'meta';
    v_content := jsonb_set(
      v_content, '{program,startDate}', to_jsonb(v_assignment.start_date::text), true
    );
    v_content := jsonb_set(
      v_content, '{program,completionMode}', to_jsonb(v_assignment.completion_mode), true
    );
    v_addon := jsonb_build_object(
      'id', v_assignment.id,
      'sourceKind', 'assignment',
      'programId', v_assignment.program_id,
      'versionId', v_assignment.version_id,
      'version', v_version_no,
      'title', coalesce(v_program_title, 'Assigned Program'),
      'content', v_content
    );
    v_addons := case
      when jsonb_typeof(v_meta->'programAddOns') = 'array'
        then v_meta->'programAddOns'
      else '[]'::jsonb
    end;
    v_meta := v_meta || jsonb_build_object('programAddOns', v_addons || jsonb_build_array(v_addon));
    v_next := jsonb_set(v_existing, '{meta}', v_meta, true);
  elsif p_adoption_mode = 'replace_keep_tasks' then
    if jsonb_typeof(p_prepared_plan) <> 'object' then
      raise exception 'Prepared Program is required';
    end if;
    perform 1 from private.training_program_validate_content(p_prepared_plan - 'meta');
    v_meta := (v_meta - 'programAddOns' - 'activeProgramSource') || jsonb_build_object(
      'activeProgramSource', jsonb_build_object(
        'kind', 'assignment',
        'assignmentId', v_assignment.id,
        'programId', v_assignment.program_id,
        'versionId', v_assignment.version_id,
        'version', v_version_no,
        'adoptionMode', p_adoption_mode
      )
    );
    v_next := jsonb_set(p_prepared_plan - 'meta', '{meta}', v_meta, true);
  else
    v_next := v_content - 'meta';
    v_next := jsonb_set(
      v_next, '{program,startDate}', to_jsonb(v_assignment.start_date::text), true
    );
    v_next := jsonb_set(
      v_next, '{program,completionMode}', to_jsonb(v_assignment.completion_mode), true
    );
    v_meta := (v_meta - 'programAddOns' - 'activeProgramSource') || jsonb_build_object(
      'activeProgramSource', jsonb_build_object(
        'kind', 'assignment',
        'assignmentId', v_assignment.id,
        'programId', v_assignment.program_id,
        'versionId', v_assignment.version_id,
        'version', v_version_no,
        'adoptionMode', p_adoption_mode
      )
    );
    v_next := jsonb_set(v_next, '{meta}', v_meta, true);
  end if;

  update public.profiles set plan_json = v_next where id = p_profile_id;

  if not exists (
    select 1 from public.training_program_entitlements e
    where e.family_id = v_family_id
      and e.profile_id is not distinct from p_profile_id
      and e.program_id = v_assignment.program_id
      and e.version_id = v_assignment.version_id
      and e.source_kind = 'assignment'
      and e.status = 'active'
  ) then
    insert into public.training_program_entitlements (
      family_id, profile_id, program_id, version_id, source_kind
    ) values (
      v_family_id, p_profile_id, v_assignment.program_id,
      v_assignment.version_id, 'assignment'
    );
  end if;

  update public.training_program_assignments
  set status = 'accepted',
      adoption_mode = p_adoption_mode,
      responded_at = now(),
      undone_at = null
  where id = v_assignment.id;

  return v_next;
end
$$;

revoke all on function public.training_program_accept_assignment(uuid,uuid,text,jsonb)
  from public, anon;
grant execute on function public.training_program_accept_assignment(uuid,uuid,text,jsonb)
  to authenticated;

-- Compatibility for an older client: replacement remains the conservative default.
create or replace function public.training_program_accept_assignment(
  p_assignment_id uuid,
  p_profile_id uuid
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.training_program_accept_assignment(
    p_assignment_id, p_profile_id, 'replace'::text, null::jsonb
  )
$$;

revoke all on function public.training_program_accept_assignment(uuid,uuid)
  from public, anon;
grant execute on function public.training_program_accept_assignment(uuid,uuid)
  to authenticated;

create or replace function public.training_program_undo_assignment(
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
  v_previous jsonb;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;

  select coalesce(a.target_profile_id, gm.profile_id)
  into v_target_profile
  from public.training_program_assignments a
  left join public.group_memberships gm on gm.id = a.target_membership_id
  where a.id = p_assignment_id
    and a.status = 'accepted'
    and a.undone_at is null;
  if v_target_profile is distinct from p_profile_id then
    raise exception 'Program undo is unavailable';
  end if;

  select p.plan_json
  into v_current
  from public.profiles p
  join public.families f on f.id = p.family_id
  where p.id = p_profile_id and f.owner_user_id = (select auth.uid())
  for update of p;
  if v_current #>> '{meta,programAdoptionUndo,assignmentId}' is distinct from p_assignment_id::text then
    raise exception 'A newer Program or plan change has replaced this undo point';
  end if;

  select b.previous_plan_json
  into v_previous
  from private.training_program_assignment_backups b
  where b.assignment_id = p_assignment_id
    and b.profile_id = p_profile_id
    and b.undone_at is null
  for update;
  if v_previous is null then raise exception 'Program undo is unavailable'; end if;

  update public.profiles set plan_json = v_previous where id = p_profile_id;
  update private.training_program_assignment_backups
    set undone_at = now() where assignment_id = p_assignment_id;
  update public.training_program_assignments
    set undone_at = now() where id = p_assignment_id;

  return v_previous;
end
$$;

revoke all on function public.training_program_undo_assignment(uuid,uuid)
  from public, anon;
grant execute on function public.training_program_undo_assignment(uuid,uuid)
  to authenticated;

comment on table private.training_program_assignment_backups is
  'Private, recipient-only restore points captured immediately before accepting a Program assignment.';
comment on function public.training_program_accept_assignment(uuid,uuid,text,jsonb) is
  'Accepts an assigned Program using replace, add-on, or replace-while-keeping-tasks adoption.';
comment on function public.training_program_undo_assignment(uuid,uuid) is
  'Restores the exact private plan captured before the latest still-active Program adoption.';
