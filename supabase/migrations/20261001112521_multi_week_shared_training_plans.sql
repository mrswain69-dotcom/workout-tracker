-- Reusable Programs foundation: Program -> Phase -> Week -> Day -> Block.
-- Marketplace metadata is modelled but deliberately dormant in this release.
-- Existing profile plan_json documents, logs, XP and reward metadata are preserved.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.training_programs (
  id uuid primary key default gen_random_uuid(),
  owner_family_id uuid not null references public.families(id) on delete cascade,
  creator_profile_id uuid references public.profiles(id) on delete set null,
  title text not null,
  description text not null default '',
  purpose text not null default '',
  sport text not null default '',
  difficulty text not null default 'all_levels'
    check (difficulty in ('beginner','intermediate','advanced','all_levels')),
  age_band text not null default 'all_ages'
    check (age_band in ('child','teen','adult','all_ages')),
  equipment text[] not null default '{}',
  tags text[] not null default '{}',
  status text not null default 'active' check (status in ('active','archived')),
  creator_role text not null default 'community'
    check (creator_role in ('community','coach','pt','physio')),
  credentials_verified boolean not null default false,
  current_version_no integer not null default 0 check (current_version_no >= 0),
  current_version_id uuid,
  phase_count smallint not null default 1 check (phase_count between 1 and 12),
  week_count smallint not null default 1 check (week_count between 1 and 52),
  access_model text not null default 'internal'
    check (access_model in ('internal','free','one_off','creator_subscription','live')),
  marketplace_status text not null default 'not_listed'
    check (marketplace_status in ('not_listed','draft','published')),
  price_minor integer check (price_minor is null or price_minor >= 0),
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(btrim(title)) between 2 and 100),
  check (char_length(description) <= 1200),
  check (char_length(purpose) <= 80),
  check (char_length(sport) <= 80),
  check (cardinality(equipment) <= 20),
  check (cardinality(tags) <= 20),
  check (marketplace_status = 'not_listed' or access_model <> 'internal')
);

create table public.training_program_versions (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.training_programs(id) on delete cascade,
  version_no integer not null check (version_no > 0),
  content_json jsonb not null,
  change_note text not null default '',
  created_by_family_id uuid not null references public.families(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (program_id, version_no),
  check (jsonb_typeof(content_json) = 'object'),
  check (not (content_json ? 'meta')),
  check (char_length(change_note) <= 300)
);

alter table public.training_programs
  add constraint training_programs_current_version_fk
  foreign key (current_version_id) references public.training_program_versions(id) on delete set null;

create table public.training_program_share_links (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.training_programs(id) on delete cascade,
  version_id uuid not null references public.training_program_versions(id) on delete cascade,
  created_by_family_id uuid not null references public.families(id) on delete cascade,
  share_token uuid not null default gen_random_uuid() unique,
  permission text not null default 'copy' check (permission in ('view','copy','follow')),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at is null or expires_at > created_at)
);

create table public.training_program_assignments (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.training_programs(id) on delete cascade,
  version_id uuid not null references public.training_program_versions(id) on delete restrict,
  assigned_by_family_id uuid not null references public.families(id) on delete cascade,
  target_profile_id uuid references public.profiles(id) on delete cascade,
  target_membership_id uuid references public.group_memberships(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined','revoked')),
  start_date date not null,
  completion_mode text not null default 'repeat' check (completion_mode in ('repeat','once','hold')),
  recipient_can_edit boolean not null default true,
  message text not null default '',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check ((target_profile_id is not null) <> (target_membership_id is not null)),
  check (char_length(message) <= 500)
);

create unique index training_program_assignments_profile_pending_uq
  on public.training_program_assignments(version_id, target_profile_id, start_date)
  where target_profile_id is not null and status = 'pending';
create unique index training_program_assignments_membership_pending_uq
  on public.training_program_assignments(version_id, target_membership_id, start_date)
  where target_membership_id is not null and status = 'pending';

-- Program access and app subscriptions are intentionally separate. A purchase remains
-- followable even if the account does not have Workout Tracker+.
create table public.training_program_entitlements (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  program_id uuid not null references public.training_programs(id) on delete cascade,
  version_id uuid not null references public.training_program_versions(id) on delete restrict,
  source_kind text not null
    check (source_kind in ('owner','free','purchase','creator_subscription','assignment','share','admin')),
  status text not null default 'active' check (status in ('active','revoked','expired')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  external_ref text,
  created_at timestamptz not null default now(),
  check (expires_at is null or expires_at > starts_at),
  check (char_length(coalesce(external_ref,'')) <= 200)
);

create index training_programs_owner_idx on public.training_programs(owner_family_id, status, updated_at desc);
create index training_program_versions_program_idx on public.training_program_versions(program_id, version_no desc);
create index training_program_assignments_profile_idx on public.training_program_assignments(target_profile_id, status, created_at desc);
create index training_program_assignments_membership_idx on public.training_program_assignments(target_membership_id, status, created_at desc);
create index training_program_entitlements_family_idx on public.training_program_entitlements(family_id, status, program_id);
create index training_program_entitlements_profile_idx on public.training_program_entitlements(profile_id, status, program_id);

alter table public.training_programs enable row level security;
alter table public.training_program_versions enable row level security;
alter table public.training_program_share_links enable row level security;
alter table public.training_program_assignments enable row level security;
alter table public.training_program_entitlements enable row level security;

revoke all on table public.training_programs from anon, authenticated;
revoke all on table public.training_program_versions from anon, authenticated;
revoke all on table public.training_program_share_links from anon, authenticated;
revoke all on table public.training_program_assignments from anon, authenticated;
revoke all on table public.training_program_entitlements from anon, authenticated;
grant select on table public.training_programs to authenticated;
grant select on table public.training_program_versions to authenticated;
grant select on table public.training_program_share_links to authenticated;
grant select on table public.training_program_assignments to authenticated;
grant select on table public.training_program_entitlements to authenticated;

create or replace function private.training_program_owned_family(p_family_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.families f
    where f.id = p_family_id and f.owner_user_id = (select auth.uid())
  )
$$;
revoke all on function private.training_program_owned_family(uuid) from public, anon, authenticated;
grant execute on function private.training_program_owned_family(uuid) to authenticated;

create or replace function private.training_program_target_visible(p_profile_id uuid, p_membership_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p join public.families f on f.id = p.family_id
    where p.id = p_profile_id and f.owner_user_id = (select auth.uid())
  ) or exists (
    select 1 from public.group_memberships gm join public.families f on f.id = gm.family_id
    where gm.id = p_membership_id and gm.status = 'active' and f.owner_user_id = (select auth.uid())
  )
$$;
revoke all on function private.training_program_target_visible(uuid,uuid) from public, anon, authenticated;
grant execute on function private.training_program_target_visible(uuid,uuid) to authenticated;

create or replace function private.training_program_can_read(p_program_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.training_programs p
    where p.id = p_program_id and private.training_program_owned_family(p.owner_family_id)
  ) or exists (
    select 1 from public.training_program_entitlements e
    where e.program_id = p_program_id and e.status = 'active'
      and (e.expires_at is null or e.expires_at > now())
      and private.training_program_owned_family(e.family_id)
  ) or exists (
    select 1 from public.training_program_assignments a
    where a.program_id = p_program_id and a.status in ('pending','accepted')
      and private.training_program_target_visible(a.target_profile_id, a.target_membership_id)
  )
$$;
revoke all on function private.training_program_can_read(uuid) from public, anon, authenticated;
grant execute on function private.training_program_can_read(uuid) to authenticated;

create policy training_programs_select on public.training_programs
  for select to authenticated using (private.training_program_can_read(id));
create policy training_program_versions_select on public.training_program_versions
  for select to authenticated using (private.training_program_can_read(program_id));
create policy training_program_share_links_select on public.training_program_share_links
  for select to authenticated using (private.training_program_owned_family(created_by_family_id));
create policy training_program_assignments_select on public.training_program_assignments
  for select to authenticated using (
    private.training_program_owned_family(assigned_by_family_id)
    or private.training_program_target_visible(target_profile_id, target_membership_id)
  );
create policy training_program_entitlements_select on public.training_program_entitlements
  for select to authenticated using (private.training_program_owned_family(family_id));

create or replace function private.training_program_validate_content(p_content jsonb)
returns table(phase_count smallint, week_count smallint)
language plpgsql immutable set search_path = '' as $$
declare
  v_phase jsonb;
  v_phase_count integer;
  v_week_count integer := 0;
begin
  if jsonb_typeof(p_content) <> 'object' or p_content ? 'meta' then
    raise exception 'Program content must be an object without profile metadata';
  end if;
  if jsonb_typeof(p_content #> '{program,phases}') <> 'array' then
    raise exception 'Program phases are required';
  end if;
  v_phase_count := jsonb_array_length(p_content #> '{program,phases}');
  if v_phase_count < 1 or v_phase_count > 12 then raise exception 'Programs require 1 to 12 phases'; end if;
  for v_phase in select value from jsonb_array_elements(p_content #> '{program,phases}') loop
    if jsonb_typeof(v_phase->'weeks') <> 'array' or jsonb_array_length(v_phase->'weeks') < 1 then
      raise exception 'Every phase requires at least one week';
    end if;
    v_week_count := v_week_count + jsonb_array_length(v_phase->'weeks');
  end loop;
  if v_week_count < 1 or v_week_count > 52 then raise exception 'Programs require 1 to 52 weeks'; end if;
  return query select v_phase_count::smallint, v_week_count::smallint;
end
$$;
revoke all on function private.training_program_validate_content(jsonb) from public, anon, authenticated;

create or replace function public.training_program_save(
  p_program_id uuid, p_family_id uuid, p_creator_profile_id uuid, p_title text,
  p_description text, p_purpose text, p_sport text, p_difficulty text,
  p_age_band text, p_equipment text[], p_tags text[], p_creator_role text,
  p_content jsonb, p_change_note text default ''
)
returns table(program_id uuid, version_id uuid, version_no integer)
language plpgsql security definer set search_path = '' as $$
declare
  v_program_id uuid;
  v_version_id uuid;
  v_version_no integer;
  v_phase_count smallint;
  v_week_count smallint;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not private.training_program_owned_family(p_family_id) then raise exception 'Family access required'; end if;
  if p_creator_profile_id is not null and not exists (
    select 1 from public.profiles where id = p_creator_profile_id and family_id = p_family_id
  ) then raise exception 'Creator profile must belong to the family'; end if;
  select x.phase_count, x.week_count into v_phase_count, v_week_count
  from private.training_program_validate_content(p_content) x;

  if p_program_id is null then
    insert into public.training_programs (
      owner_family_id, creator_profile_id, title, description, purpose, sport,
      difficulty, age_band, equipment, tags, creator_role, phase_count, week_count
    ) values (
      p_family_id, p_creator_profile_id, btrim(p_title), btrim(coalesce(p_description,'')),
      btrim(coalesce(p_purpose,'')), btrim(coalesce(p_sport,'')), p_difficulty,
      p_age_band, coalesce(p_equipment,'{}'), coalesce(p_tags,'{}'), p_creator_role,
      v_phase_count, v_week_count
    ) returning id into v_program_id;
    v_version_no := 1;
  else
    select p.id, p.current_version_no + 1 into v_program_id, v_version_no
    from public.training_programs p
    where p.id = p_program_id and p.owner_family_id = p_family_id and p.status = 'active'
    for update;
    if v_program_id is null then raise exception 'Program not found or not editable'; end if;
    update public.training_programs set
      creator_profile_id = p_creator_profile_id, title = btrim(p_title),
      description = btrim(coalesce(p_description,'')), purpose = btrim(coalesce(p_purpose,'')),
      sport = btrim(coalesce(p_sport,'')), difficulty = p_difficulty, age_band = p_age_band,
      equipment = coalesce(p_equipment,'{}'), tags = coalesce(p_tags,'{}'),
      creator_role = p_creator_role, phase_count = v_phase_count, week_count = v_week_count,
      updated_at = now()
    where id = v_program_id;
  end if;

  insert into public.training_program_versions (
    program_id, version_no, content_json, change_note, created_by_family_id
  ) values (
    v_program_id, v_version_no, p_content, btrim(coalesce(p_change_note,'')), p_family_id
  ) returning id into v_version_id;
  update public.training_programs set
    current_version_no = v_version_no, current_version_id = v_version_id, updated_at = now()
  where id = v_program_id;
  insert into public.training_program_entitlements (
    family_id, profile_id, program_id, version_id, source_kind
  ) values (p_family_id, p_creator_profile_id, v_program_id, v_version_id, 'owner');
  return query select v_program_id, v_version_id, v_version_no;
end
$$;
revoke all on function public.training_program_save(uuid,uuid,uuid,text,text,text,text,text,text,text[],text[],text,jsonb,text) from public, anon;
grant execute on function public.training_program_save(uuid,uuid,uuid,text,text,text,text,text,text,text[],text[],text,jsonb,text) to authenticated;

create or replace function public.training_program_archive(p_program_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.training_programs p set status = 'archived', updated_at = now()
  where p.id = p_program_id and private.training_program_owned_family(p.owner_family_id);
  return found;
end
$$;
revoke all on function public.training_program_archive(uuid) from public, anon;
grant execute on function public.training_program_archive(uuid) to authenticated;

create or replace function public.training_program_create_share(
  p_program_id uuid, p_permission text default 'copy', p_expires_in_days integer default 30
)
returns table(share_token uuid, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare v_family_id uuid; v_version_id uuid; v_token uuid; v_expires timestamptz;
begin
  if p_permission not in ('view','copy','follow') then raise exception 'Invalid share permission'; end if;
  if p_expires_in_days < 1 or p_expires_in_days > 365 then raise exception 'Expiry must be 1 to 365 days'; end if;
  select owner_family_id, current_version_id into v_family_id, v_version_id
  from public.training_programs where id = p_program_id and status = 'active';
  if v_family_id is null or not private.training_program_owned_family(v_family_id) then
    raise exception 'Program not found or not shareable';
  end if;
  v_expires := now() + make_interval(days => p_expires_in_days);
  insert into public.training_program_share_links (
    program_id, version_id, created_by_family_id, permission, expires_at
  ) values (p_program_id, v_version_id, v_family_id, p_permission, v_expires)
  returning training_program_share_links.share_token into v_token;
  return query select v_token, v_expires;
end
$$;
revoke all on function public.training_program_create_share(uuid,text,integer) from public, anon;
grant execute on function public.training_program_create_share(uuid,text,integer) to authenticated;

create or replace function private.training_program_share_preview(p_share_token uuid)
returns table(
  program_id uuid, version_id uuid, version_no integer, title text, description text,
  purpose text, sport text, difficulty text, age_band text, week_count smallint,
  phase_count smallint, creator_role text, permission text, content_json jsonb, expires_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select p.id, v.id, v.version_no, p.title, p.description, p.purpose, p.sport,
    p.difficulty, p.age_band, p.week_count, p.phase_count, p.creator_role,
    l.permission, v.content_json, l.expires_at
  from public.training_program_share_links l
  join public.training_programs p on p.id = l.program_id and p.status = 'active'
  join public.training_program_versions v on v.id = l.version_id
  where l.share_token = p_share_token and l.revoked_at is null
    and (l.expires_at is null or l.expires_at > now())
$$;
revoke all on function private.training_program_share_preview(uuid) from public, anon, authenticated;
grant execute on function private.training_program_share_preview(uuid) to authenticated;

create or replace function public.training_program_preview_share(p_share_token uuid)
returns table(
  program_id uuid, version_id uuid, version_no integer, title text, description text,
  purpose text, sport text, difficulty text, age_band text, week_count smallint,
  phase_count smallint, creator_role text, permission text, content_json jsonb, expires_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select * from private.training_program_share_preview(p_share_token)
$$;
revoke all on function public.training_program_preview_share(uuid) from public, anon;
grant execute on function public.training_program_preview_share(uuid) to authenticated;

create or replace function private.training_program_apply_content(
  p_profile_id uuid, p_program_id uuid, p_version_id uuid, p_start_date date,
  p_completion_mode text, p_source_kind text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_family_id uuid; v_existing jsonb; v_content jsonb; v_version_no integer; v_next jsonb;
begin
  if p_completion_mode not in ('repeat','once','hold') then raise exception 'Invalid completion mode'; end if;
  select p.family_id, p.plan_json into v_family_id, v_existing
  from public.profiles p join public.families f on f.id = p.family_id
  where p.id = p_profile_id and f.owner_user_id = (select auth.uid());
  if v_family_id is null then raise exception 'Profile is not available to the current account'; end if;
  select v.content_json, v.version_no into v_content, v_version_no
  from public.training_program_versions v
  where v.id = p_version_id and v.program_id = p_program_id;
  if v_content is null then raise exception 'Program version is unavailable'; end if;

  v_next := v_content - 'meta';
  v_next := jsonb_set(v_next, '{program,startDate}', to_jsonb(p_start_date::text), true);
  v_next := jsonb_set(v_next, '{program,completionMode}', to_jsonb(p_completion_mode), true);
  v_next := jsonb_set(v_next, '{meta}',
    coalesce(v_existing->'meta','{}'::jsonb) || jsonb_build_object(
      'planSetupPrompt', false,
      'activeProgramSource', jsonb_build_object(
        'kind', p_source_kind, 'programId', p_program_id,
        'versionId', p_version_id, 'version', v_version_no
      )
    ), true);
  update public.profiles set plan_json = v_next where id = p_profile_id;
  if not exists (
    select 1 from public.training_program_entitlements e
    where e.family_id = v_family_id and e.profile_id is not distinct from p_profile_id
      and e.program_id = p_program_id and e.version_id = p_version_id
      and e.source_kind = p_source_kind and e.status = 'active'
  ) then
    insert into public.training_program_entitlements (
      family_id, profile_id, program_id, version_id, source_kind
    ) values (v_family_id, p_profile_id, p_program_id, p_version_id, p_source_kind);
  end if;
  return v_next;
end
$$;
revoke all on function private.training_program_apply_content(uuid,uuid,uuid,date,text,text) from public, anon, authenticated;

create or replace function public.training_program_apply_owned(
  p_program_id uuid, p_profile_id uuid, p_start_date date, p_completion_mode text default 'repeat'
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_version_id uuid;
begin
  select current_version_id into v_version_id from public.training_programs p
  where p.id = p_program_id and p.status = 'active'
    and private.training_program_owned_family(p.owner_family_id);
  if v_version_id is null then raise exception 'Program is unavailable'; end if;
  return private.training_program_apply_content(
    p_profile_id, p_program_id, v_version_id, p_start_date, p_completion_mode, 'owner'
  );
end
$$;
revoke all on function public.training_program_apply_owned(uuid,uuid,date,text) from public, anon;
grant execute on function public.training_program_apply_owned(uuid,uuid,date,text) to authenticated;

create or replace function public.training_program_accept_share(
  p_share_token uuid, p_profile_id uuid, p_start_date date, p_completion_mode text default 'repeat'
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_program_id uuid; v_version_id uuid; v_permission text;
begin
  select x.program_id, x.version_id, x.permission into v_program_id, v_version_id, v_permission
  from private.training_program_share_preview(p_share_token) x;
  if v_program_id is null then raise exception 'Share link is invalid or expired'; end if;
  if v_permission = 'view' then raise exception 'This link is view only'; end if;
  return private.training_program_apply_content(
    p_profile_id, v_program_id, v_version_id, p_start_date, p_completion_mode, 'share'
  );
end
$$;
revoke all on function public.training_program_accept_share(uuid,uuid,date,text) from public, anon;
grant execute on function public.training_program_accept_share(uuid,uuid,date,text) to authenticated;

create or replace function public.training_program_assign_group(
  p_program_id uuid, p_group_id uuid, p_start_date date,
  p_completion_mode text default 'repeat', p_message text default ''
)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_family_id uuid; v_version_id uuid; v_count integer;
begin
  if p_completion_mode not in ('repeat','once','hold') then raise exception 'Invalid completion mode'; end if;
  select p.owner_family_id, p.current_version_id into v_family_id, v_version_id
  from public.training_programs p where p.id = p_program_id and p.status = 'active';
  if v_family_id is null or not private.training_program_owned_family(v_family_id) then
    raise exception 'Program not found or not assignable';
  end if;
  if not exists (
    select 1 from public.group_memberships gm join public.families f on f.id = gm.family_id
    where gm.group_id = p_group_id and gm.role = 'admin' and gm.status = 'active'
      and f.owner_user_id = (select auth.uid())
  ) then raise exception 'Group admin access required'; end if;
  insert into public.training_program_assignments (
    program_id, version_id, assigned_by_family_id, target_membership_id,
    start_date, completion_mode, message
  )
  select p_program_id, v_version_id, v_family_id, gm.id,
    p_start_date, p_completion_mode, btrim(coalesce(p_message,''))
  from public.group_memberships gm
  where gm.group_id = p_group_id and gm.status = 'active'
  on conflict (version_id, target_membership_id, start_date)
    where target_membership_id is not null and status = 'pending'
  do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end
$$;
revoke all on function public.training_program_assign_group(uuid,uuid,date,text,text) from public, anon;
grant execute on function public.training_program_assign_group(uuid,uuid,date,text,text) to authenticated;

create or replace function public.training_program_accept_assignment(
  p_assignment_id uuid, p_profile_id uuid
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_assignment public.training_program_assignments%rowtype; v_target_profile uuid; v_result jsonb;
begin
  select * into v_assignment from public.training_program_assignments
  where id = p_assignment_id and status = 'pending' for update;
  if not found then raise exception 'Assignment is unavailable'; end if;
  v_target_profile := v_assignment.target_profile_id;
  if v_target_profile is null then
    select gm.profile_id into v_target_profile from public.group_memberships gm
    where gm.id = v_assignment.target_membership_id and gm.status = 'active';
  end if;
  if v_target_profile is distinct from p_profile_id then raise exception 'Assignment belongs to a different profile'; end if;
  v_result := private.training_program_apply_content(
    p_profile_id, v_assignment.program_id, v_assignment.version_id,
    v_assignment.start_date, v_assignment.completion_mode, 'assignment'
  );
  update public.training_program_assignments set status = 'accepted', responded_at = now()
  where id = p_assignment_id;
  return v_result;
end
$$;
revoke all on function public.training_program_accept_assignment(uuid,uuid) from public, anon;
grant execute on function public.training_program_accept_assignment(uuid,uuid) to authenticated;

create or replace function public.training_program_decline_assignment(p_assignment_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.training_program_assignments a set status = 'declined', responded_at = now()
  where a.id = p_assignment_id and a.status = 'pending'
    and private.training_program_target_visible(a.target_profile_id, a.target_membership_id);
  return found;
end
$$;
revoke all on function public.training_program_decline_assignment(uuid) from public, anon;
grant execute on function public.training_program_decline_assignment(uuid) to authenticated;

-- Consistency snapshots are date-aware, but only contain planned active weekdays.
create or replace function private.consistency_schedule_from_blocks(p_blocks jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare v_result jsonb := '{}'::jsonb; v_day text; v_blocks jsonb;
begin
  foreach v_day in array array['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] loop
    select coalesce(jsonb_agg(block), '[]'::jsonb) into v_blocks
    from jsonb_array_elements(coalesce(p_blocks->v_day, '[]'::jsonb)) block
    where lower(coalesce(block->>'typeId','')) = any (array[
      'strength','hiit','box','cardio','run','swim','walk','row','cycle','bike',
      'duration','session','recovery'
    ]::text[])
      and btrim(coalesce(block->>'id','')) <> ''
      and lower(coalesce(block->>'cancelled','false')) <> 'true';
    v_result := v_result || jsonb_build_object(v_day, v_blocks);
  end loop;
  return v_result;
end
$$;
revoke all on function private.consistency_schedule_from_blocks(jsonb) from public, anon, authenticated;

create or replace function private.consistency_schedule_from_plan(p_plan jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare v_weeks jsonb;
begin
  if jsonb_typeof(p_plan #> '{program,phases}') = 'array'
     and jsonb_array_length(p_plan #> '{program,phases}') > 0 then
    select jsonb_agg(private.consistency_schedule_from_blocks(week->'blocksByWeekday') order by phase_ord, week_ord)
    into v_weeks
    from jsonb_array_elements(p_plan #> '{program,phases}') with ordinality as p(phase, phase_ord)
    cross join lateral jsonb_array_elements(phase->'weeks') with ordinality as w(week, week_ord);
    return jsonb_build_object(
      '__format', 'program_v1',
      'startDate', coalesce(p_plan #>> '{program,startDate}', ''),
      'completionMode', coalesce(p_plan #>> '{program,completionMode}', 'repeat'),
      'weeks', coalesce(v_weeks, '[]'::jsonb)
    );
  end if;
  return private.consistency_schedule_from_blocks(p_plan->'blocksByWeekday');
end
$$;
revoke all on function private.consistency_schedule_from_plan(jsonb) from public, anon, authenticated;

comment on table public.training_programs is
  'Reusable versioned Programs. Marketplace fields are dormant until commerce is released.';
comment on table public.training_program_versions is
  'Immutable Program versions containing no profile XP, rewards, history or other personal metadata.';
comment on table public.training_program_entitlements is
  'Program access independent of Workout Tracker+ subscription status.';
comment on table public.training_program_assignments is
  'Private coach/team assignments pinned to an immutable Program version.';
