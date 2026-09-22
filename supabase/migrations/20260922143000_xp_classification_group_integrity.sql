-- XP Classification & Group Integrity.
-- Separates shareable Group score evidence from private raw logs and gives Group admins
-- a reversible competition-integrity control without changing a member's personal XP.

alter table public.group_memberships
  add column if not exists xp_evidence_visible boolean not null default false,
  add column if not exists competition_excluded boolean not null default false,
  add column if not exists competition_exclusion_label text not null default '',
  add column if not exists competition_excluded_at timestamptz,
  add column if not exists competition_excluded_by_membership_id uuid references public.group_memberships(id) on delete set null;

alter table public.group_member_directory
  add column if not exists xp_evidence_visible boolean not null default false,
  add column if not exists competition_excluded boolean not null default false,
  add column if not exists competition_exclusion_label text not null default '';

alter table public.group_memberships
  drop constraint if exists group_memberships_competition_exclusion_label_check;
alter table public.group_memberships
  add constraint group_memberships_competition_exclusion_label_check
  check (char_length(competition_exclusion_label) <= 48);

alter table public.group_member_directory
  drop constraint if exists group_member_directory_competition_exclusion_label_check;
alter table public.group_member_directory
  add constraint group_member_directory_competition_exclusion_label_check
  check (char_length(competition_exclusion_label) <= 48);

create table if not exists public.group_competition_integrity_audit (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  membership_id uuid not null references public.group_memberships(id) on delete cascade,
  changed_by_membership_id uuid references public.group_memberships(id) on delete set null,
  action text not null check (action in ('exclude','restore')),
  label text not null default '',
  created_at timestamptz not null default now(),
  check (char_length(label) <= 48)
);

create index if not exists group_competition_integrity_audit_group_created_idx
  on public.group_competition_integrity_audit(group_id, created_at desc);

alter table public.group_competition_integrity_audit enable row level security;
revoke all on table public.group_competition_integrity_audit from anon, authenticated;
grant select on table public.group_competition_integrity_audit to authenticated;

drop policy if exists group_competition_integrity_audit_admin_select
  on public.group_competition_integrity_audit;
create policy group_competition_integrity_audit_admin_select
on public.group_competition_integrity_audit for select
to authenticated
using (group_id in (select private.current_user_admin_group_ids()));

create or replace function private.sync_group_member_directory()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.group_member_directory where membership_id = old.id;
    return old;
  end if;

  if new.status = 'active' then
    insert into public.group_member_directory (
      membership_id, group_id, nickname, role, avatar_id, avatar_frame,
      avatar_frames_enabled, joined_at, xp_evidence_visible,
      competition_excluded, competition_exclusion_label, updated_at
    ) values (
      new.id, new.group_id, new.nickname, new.role, new.avatar_id, new.avatar_frame,
      new.avatar_frames_enabled, new.joined_at, new.xp_evidence_visible,
      new.competition_excluded, new.competition_exclusion_label, now()
    )
    on conflict (membership_id) do update set
      group_id = excluded.group_id,
      nickname = excluded.nickname,
      role = excluded.role,
      avatar_id = excluded.avatar_id,
      avatar_frame = excluded.avatar_frame,
      avatar_frames_enabled = excluded.avatar_frames_enabled,
      joined_at = excluded.joined_at,
      xp_evidence_visible = excluded.xp_evidence_visible,
      competition_excluded = excluded.competition_excluded,
      competition_exclusion_label = excluded.competition_exclusion_label,
      updated_at = now();
  else
    delete from public.group_member_directory where membership_id = new.id;
  end if;

  return new;
end
$$;

create or replace function public.group_set_xp_evidence_visibility(
  p_group_id uuid,
  p_membership_id uuid,
  p_visible boolean
)
returns table (
  membership_id uuid,
  xp_evidence_visible boolean
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;

  update public.group_memberships gm
  set xp_evidence_visible = coalesce(p_visible, false)
  from public.families f
  where gm.id = p_membership_id
    and gm.group_id = p_group_id
    and gm.status = 'active'
    and f.id = gm.family_id
    and f.owner_user_id = (select auth.uid());

  if not found then
    raise exception 'Active owned Group membership required';
  end if;

  return query
  select gm.id, gm.xp_evidence_visible
  from public.group_memberships gm
  where gm.id = p_membership_id;
end
$$;

create or replace function public.group_set_competition_exclusion(
  p_group_id uuid,
  p_membership_id uuid,
  p_excluded boolean,
  p_label text default 'Gamed XP'
)
returns table (
  membership_id uuid,
  competition_excluded boolean,
  competition_exclusion_label text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_membership_id uuid;
  v_excluded boolean := coalesce(p_excluded, false);
  v_label text := left(btrim(coalesce(nullif(p_label, ''), 'Gamed XP')), 48);
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not exists (
    select 1 from private.current_user_admin_group_ids() x where x = p_group_id
  ) then
    raise exception 'Group admin access required';
  end if;

  select gm.id into v_admin_membership_id
  from public.group_memberships gm
  join public.families f on f.id = gm.family_id
  where gm.group_id = p_group_id
    and gm.role = 'admin'
    and gm.status = 'active'
    and f.owner_user_id = (select auth.uid())
  order by gm.joined_at, gm.id
  limit 1;

  update public.group_memberships gm
  set
    competition_excluded = v_excluded,
    competition_exclusion_label = case when v_excluded then v_label else '' end,
    competition_excluded_at = case when v_excluded then now() else null end,
    competition_excluded_by_membership_id = case when v_excluded then v_admin_membership_id else null end
  where gm.id = p_membership_id
    and gm.group_id = p_group_id
    and gm.status = 'active';

  if not found then
    raise exception 'Active Group member not found';
  end if;

  insert into public.group_competition_integrity_audit (
    group_id, membership_id, changed_by_membership_id, action, label
  ) values (
    p_group_id,
    p_membership_id,
    v_admin_membership_id,
    case when v_excluded then 'exclude' else 'restore' end,
    case when v_excluded then v_label else '' end
  );

  return query
  select gm.id, gm.competition_excluded, gm.competition_exclusion_label
  from public.group_memberships gm
  where gm.id = p_membership_id;
end
$$;

revoke all on function public.group_set_xp_evidence_visibility(uuid, uuid, boolean)
  from public, anon;
grant execute on function public.group_set_xp_evidence_visibility(uuid, uuid, boolean)
  to authenticated;

revoke all on function public.group_set_competition_exclusion(uuid, uuid, boolean, text)
  from public, anon;
grant execute on function public.group_set_competition_exclusion(uuid, uuid, boolean, text)
  to authenticated;

-- Bring existing directory rows up to date immediately.
update public.group_member_directory d
set
  xp_evidence_visible = gm.xp_evidence_visible,
  competition_excluded = gm.competition_excluded,
  competition_exclusion_label = gm.competition_exclusion_label,
  updated_at = now()
from public.group_memberships gm
where gm.id = d.membership_id;
