-- Explicit profile-to-coach consent, separate from teams and programme adoption.
create table public.training_program_client_connections (
  id uuid primary key default gen_random_uuid(),
  coach_family_id uuid not null references public.families(id) on delete cascade,
  coach_profile_id uuid not null references public.profiles(id) on delete cascade,
  coach_name text not null check(char_length(btrim(coach_name)) between 2 and 100),
  client_profile_id uuid references public.profiles(id) on delete cascade,
  client_name text,
  invite_token uuid not null default gen_random_uuid() unique,
  status text not null default 'pending' check(status in ('pending','active','revoked')),
  expires_at timestamptz not null default now()+interval '14 days',
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check(status<>'active' or client_profile_id is not null)
);
create index program_clients_coach_idx on public.training_program_client_connections(coach_family_id,status);
create index program_clients_coach_profile_idx on public.training_program_client_connections(coach_profile_id);
create index program_clients_profile_idx on public.training_program_client_connections(client_profile_id,status);
create unique index program_clients_active_unique on public.training_program_client_connections(coach_profile_id,client_profile_id) where status='active';
alter table public.training_program_client_connections enable row level security;
revoke all on public.training_program_client_connections from public,anon,authenticated;
grant select on public.training_program_client_connections to authenticated;
create policy program_clients_participant on public.training_program_client_connections for select to authenticated
  using(private.training_program_owned_family(coach_family_id) or private.training_program_target_visible(client_profile_id,null));

alter table public.training_program_assignments add column client_connection_id uuid references public.training_program_client_connections(id) on delete set null;
create index program_assignments_client_idx on public.training_program_assignments(client_connection_id);
alter table public.training_program_notifications alter column assignment_id drop not null;
alter table public.training_program_notifications add column client_connection_id uuid references public.training_program_client_connections(id) on delete cascade;
alter table public.training_program_notifications add constraint program_notification_source check((assignment_id is not null) <> (client_connection_id is not null));
create index program_notifications_client_idx on public.training_program_notifications(client_connection_id);

create function public.training_program_invite_client(p_coach_profile_id uuid,p_coach_name text,p_expires_in_days integer default 14)
returns public.training_program_client_connections language plpgsql security definer set search_path='' as $$
declare f uuid; row public.training_program_client_connections;
begin
  select family_id into f from public.profiles p where p.id=p_coach_profile_id and private.training_program_owned_family(p.family_id);
  if f is null then raise exception 'Coach profile access required'; end if;
  if p_expires_in_days is null or p_expires_in_days not between 1 and 30 then raise exception 'Expiry must be 1 to 30 days'; end if;
  perform pg_advisory_xact_lock(hashtextextended(f::text, 0));
  if (select count(*) from public.training_program_client_connections where coach_family_id=f and status='pending' and expires_at>now())>=50 then raise exception 'Revoke unused invitations before creating more'; end if;
  insert into public.training_program_client_connections(coach_family_id,coach_profile_id,coach_name,expires_at)
  values(f,p_coach_profile_id,btrim(p_coach_name),now()+make_interval(days=>p_expires_in_days)) returning * into row;
  return row;
end $$;
revoke all on function public.training_program_invite_client(uuid,text,integer) from public,anon;
grant execute on function public.training_program_invite_client(uuid,text,integer) to authenticated;

create function public.training_program_preview_client_invite(p_token uuid)
returns table(connection_id uuid,coach_name text,expires_at timestamptz)
language sql stable security definer set search_path='' as $$
  select c.id,c.coach_name,c.expires_at from public.training_program_client_connections c
  where (select auth.uid()) is not null and c.invite_token=p_token and c.status='pending' and c.expires_at>now();
$$;
revoke all on function public.training_program_preview_client_invite(uuid) from public,anon;
grant execute on function public.training_program_preview_client_invite(uuid) to authenticated;

create function public.training_program_accept_client_invite(p_token uuid,p_profile_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare row public.training_program_client_connections; f uuid; name text;
begin
  select p.family_id,p.name into f,name from public.profiles p
    where p.id=p_profile_id and private.training_program_owned_family(p.family_id);
  if f is null then raise exception 'Recipient profile access required'; end if;
  select * into row from public.training_program_client_connections where invite_token=p_token for update;
  if row.id is null or row.status<>'pending' or row.expires_at<=now() then raise exception 'Invitation is unavailable or expired'; end if;
  if row.coach_family_id=f then raise exception 'Choose a client profile in a different account'; end if;
  begin
    update public.training_program_client_connections set client_profile_id=p_profile_id,client_name=name,status='active',accepted_at=now() where id=row.id;
  exception when unique_violation then
    raise exception 'This profile is already connected to this coach';
  end;
  insert into public.training_program_notifications(family_id,profile_id,client_connection_id,kind,audience,title)
  values(row.coach_family_id,null,row.id,'client_connected','coach',name || ' · Coaching connection accepted'),
    (f,p_profile_id,row.id,'client_connected','recipient',row.coach_name || ' · Coaching connection accepted');
  return row.id;
end $$;
revoke all on function public.training_program_accept_client_invite(uuid,uuid) from public,anon;
grant execute on function public.training_program_accept_client_invite(uuid,uuid) to authenticated;

create function public.training_program_disconnect_client(p_connection_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare row public.training_program_client_connections; f uuid;
begin
  select * into row from public.training_program_client_connections c where c.id=p_connection_id and c.status<>'revoked'
    and (private.training_program_owned_family(c.coach_family_id) or private.training_program_target_visible(c.client_profile_id,null)) for update;
  if row.id is null then raise exception 'Connection access required'; end if;
  update public.training_program_client_connections set status='revoked',revoked_at=now() where id=row.id;
  update public.training_program_assignments set status='revoked',responded_at=now() where client_connection_id=row.id and status='pending';
  if row.client_profile_id is not null then
    select family_id into f from public.profiles where id=row.client_profile_id;
    insert into public.training_program_notifications(family_id,profile_id,client_connection_id,kind,audience,title)
      values(row.coach_family_id,null,row.id,'client_disconnected','coach','Coaching connection ended'),
      (f,row.client_profile_id,row.id,'client_disconnected','recipient',row.coach_name || ' · Coaching connection ended');
  end if;
  return true;
end $$;
revoke all on function public.training_program_disconnect_client(uuid) from public,anon;
grant execute on function public.training_program_disconnect_client(uuid) to authenticated;

-- Connection IDs carry through update offers, with row locks against disconnect races.
create function private.training_program_guard_client_assignment()
returns trigger language plpgsql security definer set search_path='' as $$
declare row public.training_program_client_connections;
begin
  if new.replaces_assignment_id is not null then
    select client_connection_id into new.client_connection_id from public.training_program_assignments where id=new.replaces_assignment_id;
  end if;
  if new.client_connection_id is not null then
    select * into row from public.training_program_client_connections where id=new.client_connection_id for share;
    if row.status is distinct from 'active' or row.coach_family_id is distinct from new.assigned_by_family_id
      or row.client_profile_id is distinct from new.target_profile_id or new.target_membership_id is not null then
      raise exception 'An active client connection is required';
    end if;
  elsif new.target_profile_id is not null and not exists(select 1 from public.profiles p where p.id=new.target_profile_id and p.family_id=new.assigned_by_family_id) then
    raise exception 'Direct assignments require a client connection';
  end if;
  return new;
end $$;
revoke all on function private.training_program_guard_client_assignment() from public,anon,authenticated;
create trigger training_program_guard_client_assignment before insert on public.training_program_assignments for each row execute function private.training_program_guard_client_assignment();

create function public.training_program_assign_clients(
  p_program_id uuid,p_connection_ids uuid[],p_start_date date,p_completion_mode text default 'repeat',
  p_can_edit boolean default true,p_can_copy boolean default true,p_message text default ''
)
returns integer language plpgsql security definer set search_path='' as $$
declare f uuid; v uuid; count integer; connection uuid;
begin
  select owner_family_id,current_version_id into f,v from public.training_programs where id=p_program_id and status='active';
  if f is null or v is null or not private.training_program_owned_family(f) then raise exception 'Programme access required'; end if;
  if p_start_date is null or p_completion_mode is null or p_completion_mode not in ('repeat','once','hold') then raise exception 'Choose a start date and completion mode'; end if;
  if coalesce(cardinality(p_connection_ids),0) not between 1 and 200 then raise exception 'Select 1 to 200 clients'; end if;
  for connection in select distinct unnest(p_connection_ids) order by 1 loop
    perform 1 from public.training_program_client_connections where id=connection and coach_family_id=f and status='active' for share;
    if not found then raise exception 'Active coach access is required for every client'; end if;
  end loop;
  insert into public.training_program_assignments(program_id,version_id,assigned_by_family_id,target_profile_id,client_connection_id,start_date,completion_mode,recipient_can_edit,recipient_can_copy,message)
    select p_program_id,v,f,c.client_profile_id,c.id,p_start_date,p_completion_mode,coalesce(p_can_edit,false),coalesce(p_can_copy,false) and coalesce(p_can_edit,false),btrim(coalesce(p_message,''))
    from public.training_program_client_connections c where c.id=any(p_connection_ids)
    on conflict(version_id,target_profile_id,start_date) where target_profile_id is not null and status='pending' do nothing;
  get diagnostics count=row_count;
  return count;
end $$;
revoke all on function public.training_program_assign_clients(uuid,uuid[],date,text,boolean,boolean,text) from public,anon;
grant execute on function public.training_program_assign_clients(uuid,uuid[],date,text,boolean,boolean,text) to authenticated;

create or replace function private.training_program_can_manage_assignment(p_assignment_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.training_program_assignments a
    where a.id = p_assignment_id
      and (select auth.uid()) is not null
      and private.training_program_owned_family(a.assigned_by_family_id)
      and (
        exists (select 1 from public.profiles p where p.id = a.target_profile_id
          and private.training_program_owned_family(p.family_id))
        or exists(select 1 from public.training_program_client_connections c
          where c.id=a.client_connection_id and c.status='active'
            and c.coach_family_id=a.assigned_by_family_id and c.client_profile_id=a.target_profile_id)
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
