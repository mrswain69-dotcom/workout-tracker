-- Free Community Programs foundation.
-- Adds safe free publishing/discovery and a reusable adoption path without
-- changing XP, badges, verification or competitive ranking behaviour.

create or replace function public.training_program_publish_free(p_program_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_family_id uuid;
  v_version_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;

  select p.owner_family_id, p.current_version_id
  into v_family_id, v_version_id
  from public.training_programs p
  where p.id = p_program_id
    and p.status = 'active'
  for update;

  if v_family_id is null
     or not private.training_program_owned_family(v_family_id) then
    raise exception 'Program is unavailable';
  end if;
  if v_version_id is null then
    raise exception 'Save a Program version before publishing';
  end if;

  update public.training_programs
  set access_model = 'free',
      marketplace_status = 'published',
      price_minor = null,
      currency = null,
      updated_at = now()
  where id = p_program_id;

  return found;
end
$$;

revoke all on function public.training_program_publish_free(uuid) from public, anon;
grant execute on function public.training_program_publish_free(uuid) to authenticated;


create or replace function public.training_program_unpublish(p_program_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_family_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;

  select p.owner_family_id
  into v_family_id
  from public.training_programs p
  where p.id = p_program_id
  for update;

  if v_family_id is null
     or not private.training_program_owned_family(v_family_id) then
    raise exception 'Program is unavailable';
  end if;

  update public.training_programs
  set access_model = 'internal',
      marketplace_status = 'not_listed',
      price_minor = null,
      currency = null,
      updated_at = now()
  where id = p_program_id;

  return found;
end
$$;

revoke all on function public.training_program_unpublish(uuid) from public, anon;
grant execute on function public.training_program_unpublish(uuid) to authenticated;


create or replace function public.training_program_list_community()
returns table(
  id uuid,
  title text,
  description text,
  purpose text,
  sport text,
  difficulty text,
  age_band text,
  equipment text[],
  tags text[],
  creator_role text,
  credentials_verified boolean,
  current_version_no integer,
  current_version_id uuid,
  week_count smallint,
  phase_count smallint,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;

  return query
  select
    p.id,
    p.title,
    p.description,
    p.purpose,
    p.sport,
    p.difficulty,
    p.age_band,
    p.equipment,
    p.tags,
    p.creator_role,
    p.credentials_verified,
    p.current_version_no,
    p.current_version_id,
    p.week_count,
    p.phase_count,
    p.updated_at
  from public.training_programs p
  where p.status = 'active'
    and p.marketplace_status = 'published'
    and p.access_model = 'free'
    and p.current_version_id is not null
  order by p.updated_at desc, p.title asc
  limit 200;
end
$$;

revoke all on function public.training_program_list_community() from public, anon;
grant execute on function public.training_program_list_community() to authenticated;


create or replace function public.training_program_preview_community(p_program_id uuid)
returns table(
  id uuid,
  title text,
  description text,
  purpose text,
  sport text,
  difficulty text,
  age_band text,
  equipment text[],
  tags text[],
  creator_role text,
  credentials_verified boolean,
  current_version_no integer,
  current_version_id uuid,
  week_count smallint,
  phase_count smallint,
  content_json jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;

  return query
  select
    p.id,
    p.title,
    p.description,
    p.purpose,
    p.sport,
    p.difficulty,
    p.age_band,
    p.equipment,
    p.tags,
    p.creator_role,
    p.credentials_verified,
    p.current_version_no,
    p.current_version_id,
    p.week_count,
    p.phase_count,
    v.content_json
  from public.training_programs p
  join public.training_program_versions v on v.id = p.current_version_id
  where p.id = p_program_id
    and p.status = 'active'
    and p.marketplace_status = 'published'
    and p.access_model = 'free';
end
$$;

revoke all on function public.training_program_preview_community(uuid) from public, anon;
grant execute on function public.training_program_preview_community(uuid) to authenticated;


create or replace function public.training_program_apply_accessible(
  p_program_id uuid,
  p_profile_id uuid,
  p_start_date date,
  p_completion_mode text default 'repeat',
  p_adoption_mode text default 'replace',
  p_prepared_plan jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_family_id uuid;
  v_existing jsonb;
  v_owner_family_id uuid;
  v_version_id uuid;
  v_version_no integer;
  v_program_title text;
  v_content jsonb;
  v_source_kind text;
  v_meta jsonb;
  v_addons jsonb;
  v_addon jsonb;
  v_next jsonb;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if p_start_date is null then raise exception 'Program start date is required'; end if;
  if p_completion_mode not in ('repeat','once','hold') then raise exception 'Invalid completion mode'; end if;
  if p_adoption_mode not in ('replace','add','replace_keep_tasks') then raise exception 'Invalid Program adoption mode'; end if;

  select pr.family_id, pr.plan_json
  into v_family_id, v_existing
  from public.profiles pr
  join public.families f on f.id = pr.family_id
  where pr.id = p_profile_id
    and f.owner_user_id = (select auth.uid())
  for update of pr;

  if v_family_id is null then raise exception 'Profile is unavailable'; end if;
  if jsonb_typeof(v_existing) <> 'object' then v_existing := '{}'::jsonb; end if;

  select p.owner_family_id, p.current_version_id, p.current_version_no, p.title, v.content_json
  into v_owner_family_id, v_version_id, v_version_no, v_program_title, v_content
  from public.training_programs p
  join public.training_program_versions v on v.id = p.current_version_id
  where p.id = p_program_id
    and p.status = 'active';

  if v_version_id is null or v_content is null then raise exception 'Program is unavailable'; end if;

  if private.training_program_owned_family(v_owner_family_id) then
    v_source_kind := 'owner';
  elsif exists (
    select 1
    from public.training_programs p
    where p.id = p_program_id
      and p.marketplace_status = 'published'
      and p.access_model = 'free'
  ) then
    v_source_kind := 'free';
  else
    select e.source_kind
    into v_source_kind
    from public.training_program_entitlements e
    where e.family_id = v_family_id
      and e.profile_id is not distinct from p_profile_id
      and e.program_id = p_program_id
      and e.status = 'active'
      and (e.expires_at is null or e.expires_at > now())
      and e.source_kind in ('free','purchase','creator_subscription','admin')
    order by e.created_at desc
    limit 1;
  end if;

  if v_source_kind is null then raise exception 'Program access is unavailable'; end if;

  v_meta := coalesce(v_existing->'meta','{}'::jsonb) - 'programAdoptionUndo';
  v_meta := v_meta || jsonb_build_object('planSetupPrompt', false);

  if p_adoption_mode = 'add' then
    v_addons := case
      when jsonb_typeof(v_meta->'programAddOns') = 'array' then v_meta->'programAddOns'
      else '[]'::jsonb
    end;
    if jsonb_array_length(v_addons) >= 1 then
      raise exception 'You already have one Program running alongside your base plan';
    end if;

    v_content := v_content - 'meta';
    v_content := jsonb_set(v_content, '{program,startDate}', to_jsonb(p_start_date::text), true);
    v_content := jsonb_set(v_content, '{program,completionMode}', to_jsonb(p_completion_mode), true);

    v_addon := jsonb_build_object(
      'id', p_program_id::text,
      'sourceKind', v_source_kind,
      'programId', p_program_id,
      'versionId', v_version_id,
      'version', v_version_no,
      'title', coalesce(v_program_title,'Program'),
      'recipientCanEdit', true,
      'recipientCanCopy', true,
      'content', v_content
    );
    v_meta := v_meta || jsonb_build_object('programAddOns', jsonb_build_array(v_addon));
    v_next := jsonb_set(v_existing, '{meta}', v_meta, true);
  else
    v_meta := (v_meta - 'activeProgramSource') || jsonb_build_object(
      'activeProgramSource', jsonb_build_object(
        'kind', v_source_kind,
        'programId', p_program_id,
        'versionId', v_version_id,
        'version', v_version_no,
        'title', coalesce(v_program_title,'Program'),
        'adoptionMode', p_adoption_mode
      )
    );

    if p_adoption_mode = 'replace_keep_tasks' then
      if jsonb_typeof(p_prepared_plan) <> 'object' then raise exception 'Prepared Program is required'; end if;
      perform 1 from private.training_program_validate_content(p_prepared_plan - 'meta');
      v_next := p_prepared_plan - 'meta';
    else
      v_next := v_content - 'meta';
    end if;

    v_next := jsonb_set(v_next, '{program,startDate}', to_jsonb(p_start_date::text), true);
    v_next := jsonb_set(v_next, '{program,completionMode}', to_jsonb(p_completion_mode), true);
    v_next := jsonb_set(v_next, '{meta}', v_meta, true);
  end if;

  update public.profiles set plan_json = v_next where id = p_profile_id;

  if not exists (
    select 1
    from public.training_program_entitlements e
    where e.family_id = v_family_id
      and e.profile_id is not distinct from p_profile_id
      and e.program_id = p_program_id
      and e.version_id = v_version_id
      and e.source_kind = v_source_kind
      and e.status = 'active'
  ) then
    insert into public.training_program_entitlements(
      family_id, profile_id, program_id, version_id, source_kind
    ) values (
      v_family_id, p_profile_id, p_program_id, v_version_id, v_source_kind
    );
  end if;

  return v_next;
end
$$;

revoke all on function public.training_program_apply_accessible(uuid,uuid,date,text,text,jsonb) from public, anon;
grant execute on function public.training_program_apply_accessible(uuid,uuid,date,text,text,jsonb) to authenticated;


create or replace function public.training_program_remove_library_add_on(
  p_profile_id uuid,
  p_addon_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current jsonb;
  v_meta jsonb;
  v_addons jsonb;
  v_target jsonb;
  v_remaining jsonb;
  v_next jsonb;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;

  select pr.plan_json
  into v_current
  from public.profiles pr
  join public.families f on f.id = pr.family_id
  where pr.id = p_profile_id
    and f.owner_user_id = (select auth.uid())
  for update of pr;

  if jsonb_typeof(v_current) <> 'object' then raise exception 'Profile plan is unavailable'; end if;

  v_meta := coalesce(v_current->'meta','{}'::jsonb);
  v_addons := case
    when jsonb_typeof(v_meta->'programAddOns') = 'array' then v_meta->'programAddOns'
    else '[]'::jsonb
  end;

  select addon into v_target
  from jsonb_array_elements(v_addons) addon
  where addon->>'id' = p_addon_id
  limit 1;

  if v_target is null then raise exception 'Added Program is no longer active'; end if;
  if coalesce(v_target->>'sourceKind','assignment') not in ('owner','free','purchase','creator_subscription','admin') then
    raise exception 'This added Program must be removed through its assignment';
  end if;

  select coalesce(jsonb_agg(addon), '[]'::jsonb)
  into v_remaining
  from jsonb_array_elements(v_addons) addon
  where addon->>'id' is distinct from p_addon_id;

  if jsonb_array_length(v_remaining) = 0 then
    v_meta := v_meta - 'programAddOns';
  else
    v_meta := jsonb_set(v_meta, '{programAddOns}', v_remaining, true);
  end if;

  v_next := jsonb_set(v_current, '{meta}', v_meta, true);
  update public.profiles set plan_json = v_next where id = p_profile_id;
  return v_next;
end
$$;

revoke all on function public.training_program_remove_library_add_on(uuid,text) from public, anon;
grant execute on function public.training_program_remove_library_add_on(uuid,text) to authenticated;

comment on function public.training_program_list_community() is
  'Returns safe catalogue metadata for free Programs published to Workout Tracker Community.';
comment on function public.training_program_apply_accessible(uuid,uuid,date,text,text,jsonb) is
  'Applies an owned or entitled Program as base, base-with-retained-tasks, or the single allowed add-on.';
