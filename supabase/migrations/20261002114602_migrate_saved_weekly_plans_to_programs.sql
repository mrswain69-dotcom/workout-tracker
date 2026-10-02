-- Preserve the origin of plans migrated from the retired one-week template UI.
-- The UUID is intentionally retained without a foreign key so the legacy table can
-- be retired later without losing idempotency or provenance.
alter table public.training_programs
  add column if not exists legacy_plan_template_id uuid;

create unique index if not exists training_programs_legacy_template_uq
  on public.training_programs(legacy_plan_template_id)
  where legacy_plan_template_id is not null;

create or replace function public.training_program_import_legacy_template(
  p_template_id uuid,
  p_creator_profile_id uuid,
  p_content jsonb
)
returns table(program_id uuid, version_id uuid, version_no integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_template public.plan_templates%rowtype;
  v_program_id uuid;
  v_version_id uuid;
  v_version_no integer;
  v_phase_count smallint;
  v_week_count smallint;
  v_title text;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  select t.* into v_template
  from public.plan_templates t
  join public.families f on f.id = t.family_id
  where t.id = p_template_id
    and f.owner_user_id = (select auth.uid());

  if not found then
    raise exception 'Saved weekly plan is unavailable';
  end if;

  if p_creator_profile_id is not null and not exists (
    select 1
    from public.profiles p
    where p.id = p_creator_profile_id
      and p.family_id = v_template.family_id
  ) then
    raise exception 'Creator profile must belong to the family';
  end if;

  select p.id, p.current_version_id, p.current_version_no
  into v_program_id, v_version_id, v_version_no
  from public.training_programs p
  where p.legacy_plan_template_id = p_template_id;

  if v_program_id is not null then
    return query select v_program_id, v_version_id, v_version_no;
    return;
  end if;

  select x.phase_count, x.week_count
  into v_phase_count, v_week_count
  from private.training_program_validate_content(p_content) x;

  v_title := left(btrim(coalesce(v_template.name, '')), 100);
  if char_length(v_title) < 2 then
    v_title := 'Saved plan';
  end if;

  begin
    insert into public.training_programs (
      owner_family_id,
      creator_profile_id,
      title,
      description,
      creator_role,
      phase_count,
      week_count,
      legacy_plan_template_id
    ) values (
      v_template.family_id,
      p_creator_profile_id,
      v_title,
      'Migrated from a saved weekly plan.',
      'community',
      v_phase_count,
      v_week_count,
      p_template_id
    )
    returning id into v_program_id;
  exception when unique_violation then
    select p.id, p.current_version_id, p.current_version_no
    into v_program_id, v_version_id, v_version_no
    from public.training_programs p
    where p.legacy_plan_template_id = p_template_id;

    return query select v_program_id, v_version_id, v_version_no;
    return;
  end;

  insert into public.training_program_versions (
    program_id,
    version_no,
    content_json,
    change_note,
    created_by_family_id
  ) values (
    v_program_id,
    1,
    p_content,
    'Migrated from saved weekly plans',
    v_template.family_id
  )
  returning id into v_version_id;

  update public.training_programs
  set current_version_no = 1,
      current_version_id = v_version_id,
      updated_at = now()
  where id = v_program_id;

  insert into public.training_program_entitlements (
    family_id,
    profile_id,
    program_id,
    version_id,
    source_kind
  ) values (
    v_template.family_id,
    p_creator_profile_id,
    v_program_id,
    v_version_id,
    'owner'
  );

  v_version_no := 1;
  return query select v_program_id, v_version_id, v_version_no;
end
$$;

revoke all on function public.training_program_import_legacy_template(uuid,uuid,jsonb)
  from public, anon, authenticated;
grant execute on function public.training_program_import_legacy_template(uuid,uuid,jsonb)
  to authenticated;

comment on column public.training_programs.legacy_plan_template_id is
  'Origin UUID for idempotent migration from the retired saved weekly plan interface.';
