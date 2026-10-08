-- Community discovery is separate from active plans and competitive rewards.
alter table public.training_programs add column community_allow_copy boolean not null default true,
 add column community_suspended boolean not null default false,
 add column community_origin_program_id uuid references public.training_programs(id) on delete set null,
 add column community_origin_version_id uuid references public.training_program_versions(id) on delete set null;
create index training_program_community_origin_idx on public.training_programs(community_origin_program_id);
create index training_program_community_origin_version_idx on public.training_programs(community_origin_version_id);
alter table public.training_program_creators add column community_suspended boolean not null default false;

create table private.community_bookmarks (
 profile_id uuid references public.profiles(id) on delete cascade,
 program_id uuid references public.training_programs(id) on delete cascade,
 title text not null, created_at timestamptz not null default now(), primary key(profile_id,program_id)
);
create index community_bookmarks_program_idx on private.community_bookmarks(program_id);
create table private.community_votes (
 profile_id uuid references public.profiles(id) on delete cascade,
 program_id uuid references public.training_programs(id) on delete cascade,
 version_id uuid not null references public.training_program_versions(id) on delete cascade,
 purpose text not null, helpful boolean not null, updated_at timestamptz not null default now(),
 primary key(profile_id,program_id)
);
create index community_votes_program_version_idx on private.community_votes(program_id,version_id);
create index community_votes_version_idx on private.community_votes(version_id);
create table private.community_reports (
 id uuid primary key default gen_random_uuid(),
 reporter_profile_id uuid not null references public.profiles(id) on delete cascade,
 program_id uuid references public.training_programs(id) on delete cascade,
 creator_id uuid references public.training_program_creators(id) on delete cascade,
 target_name text not null, snapshot jsonb not null, reason text not null check(reason in ('safety','misleading','ownership','inappropriate','other')),
 details text not null check(char_length(btrim(details)) between 10 and 2000),
 status text not null default 'open' check(status in ('open','reviewing','resolved','dismissed')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(num_nonnulls(program_id,creator_id)=1)
);
create index community_reports_reporter_idx on private.community_reports(reporter_profile_id);
create index community_reports_program_idx on private.community_reports(program_id);
create index community_reports_creator_idx on private.community_reports(creator_id);
create table private.community_report_actions (
 id uuid primary key default gen_random_uuid(), report_id uuid not null references private.community_reports(id) on delete cascade,
 reviewer_id uuid not null references auth.users(id), action text not null, note text not null,
 created_at timestamptz not null default now()
);
create index community_report_actions_report_idx on private.community_report_actions(report_id);
create index community_report_actions_reviewer_idx on private.community_report_actions(reviewer_id);
alter table private.community_bookmarks enable row level security;
alter table private.community_votes enable row level security;
alter table private.community_reports enable row level security;
alter table private.community_report_actions enable row level security;
revoke all on private.community_bookmarks,private.community_votes,private.community_reports,private.community_report_actions from public,anon,authenticated;

create function private.community_available(p public.training_programs) returns boolean language sql stable security definer set search_path='' as $$
 select p.status='active' and p.marketplace_status='published' and p.access_model='free' and p.current_version_id is not null
 and not p.community_suspended and not exists(select 1 from public.training_program_creators c where c.id=p.creator_profile_id and c.community_suspended);
$$;
revoke all on function private.community_available(public.training_programs) from public,anon,authenticated;

-- Holds cannot be cleared through the normal creator/programme editors.
create function private.community_publication_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='training_programs' then
  if new.marketplace_status='published' and (new.community_suspended or exists(select 1 from public.training_program_creators c where c.id=new.creator_profile_id and c.community_suspended)) then raise exception 'Community publishing is paused while this content is reviewed'; end if;
  if new.marketplace_status='published' and new.community_origin_program_id is not null then raise exception 'Personal Community copies cannot be republished as your own'; end if;
 else
  if new.published and new.community_suspended then raise exception 'Your creator bio is paused while it is reviewed'; end if;
 end if;
 return new;
end $$;
revoke all on function private.community_publication_guard() from public,anon,authenticated;
create trigger community_program_publication_guard before insert or update on public.training_programs for each row execute function private.community_publication_guard();
create trigger community_creator_publication_guard before insert or update on public.training_program_creators for each row execute function private.community_publication_guard();

create function public.community_context(p_profile_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.training_program_target_visible(p_profile_id,null) then raise exception 'Profile access required'; end if;
 select jsonb_build_object(
  'programmes',coalesce((select jsonb_agg(jsonb_build_object('program_id',p.id,'allow_copy',p.community_allow_copy,
   'can_vote',not private.training_program_owned_family(p.owner_family_id),
   'helpful',(select count(*) from private.community_votes v where v.program_id=p.id and v.version_id=p.current_version_id and v.purpose=p.purpose and v.helpful),
   'not_helpful',(select count(*) from private.community_votes v where v.program_id=p.id and v.version_id=p.current_version_id and v.purpose=p.purpose and not v.helpful),
   'my_vote',(select v.helpful from private.community_votes v where v.program_id=p.id and v.profile_id=p_profile_id and v.version_id=p.current_version_id and v.purpose=p.purpose)))
   from public.training_programs p where private.community_available(p)), '[]'::jsonb),
  'bookmarks',coalesce((select jsonb_agg(jsonb_build_object('program_id',b.program_id,'title',b.title,'available',private.community_available(p)))
   from private.community_bookmarks b join public.training_programs p on p.id=b.program_id where b.profile_id=p_profile_id),'[]'::jsonb),
  'reviewer',private.creator_is_reviewer()) into result;
 return result;
end $$;

create function public.community_bookmark(p_profile_id uuid,p_program_id uuid,p_saved boolean) returns boolean language plpgsql security definer set search_path='' as $$
declare p public.training_programs;
begin
 if not private.training_program_target_visible(p_profile_id,null) then raise exception 'Profile access required'; end if;
 if p_saved is null then raise exception 'Choose whether to save this programme'; end if;
 if not p_saved then delete from private.community_bookmarks where profile_id=p_profile_id and program_id=p_program_id; return true; end if;
 select * into p from public.training_programs where id=p_program_id for share;
 if p.id is null or not private.community_available(p) then raise exception 'Community programme is unavailable'; end if;
 insert into private.community_bookmarks(profile_id,program_id,title) values(p_profile_id,p_program_id,p.title) on conflict(profile_id,program_id) do update set title=excluded.title;
 return true;
end $$;

create function public.community_vote(p_profile_id uuid,p_program_id uuid,p_helpful boolean,p_version_id uuid,p_purpose text) returns boolean language plpgsql security definer set search_path='' as $$
declare p public.training_programs;
begin
 if not private.training_program_target_visible(p_profile_id,null) then raise exception 'Profile access required'; end if;
 if p_helpful is null then delete from private.community_votes where profile_id=p_profile_id and program_id=p_program_id; return true; end if;
 select * into p from public.training_programs where id=p_program_id for share;
 if p.id is null or not private.community_available(p) then raise exception 'Community programme is unavailable'; end if;
 if private.training_program_owned_family(p.owner_family_id) then raise exception 'You cannot vote on your own account’s programmes'; end if;
 if p_version_id is distinct from p.current_version_id or p_purpose is distinct from p.purpose then raise exception 'This programme has changed. Reopen it before voting'; end if;
 insert into private.community_votes(profile_id,program_id,version_id,purpose,helpful) values(p_profile_id,p.id,p.current_version_id,p.purpose,p_helpful)
 on conflict(profile_id,program_id) do update set version_id=excluded.version_id,purpose=excluded.purpose,helpful=excluded.helpful,updated_at=now();
 return true;
end $$;

create function public.community_set_copy_permission(p_program_id uuid,p_allow_copy boolean) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if p_allow_copy is null then raise exception 'Choose a copy permission'; end if;
 update public.training_programs set community_allow_copy=p_allow_copy,updated_at=now() where id=p_program_id and private.training_program_owned_family(owner_family_id);
 if not found then raise exception 'Programme access required'; end if;
 return true;
end $$;

create function public.community_copy(p_profile_id uuid,p_program_id uuid,p_version_id uuid,p_title text) returns uuid language plpgsql security definer set search_path='' as $$
declare p public.training_programs; family uuid; content jsonb; copied uuid;
begin
 if not private.training_program_target_visible(p_profile_id,null) then raise exception 'Profile access required'; end if;
 if char_length(btrim(coalesce(p_title,''))) not between 2 and 160 then raise exception 'Give the copy a name between 2 and 160 characters'; end if;
 select * into p from public.training_programs where id=p_program_id for share;
 if p.id is null or not private.community_available(p) then raise exception 'Community programme is unavailable'; end if;
 if not p.community_allow_copy then raise exception 'The creator has not allowed personal library copies'; end if;
 if p.current_version_id is distinct from p_version_id then raise exception 'This programme has changed. Reopen it before copying'; end if;
 select family_id into family from public.profiles where id=p_profile_id;
 select content_json-'meta' into content from public.training_program_versions where id=p.current_version_id;
 content:=jsonb_set(content,'{program,name}',to_jsonb(btrim(p_title)),true);
 select program_id into copied from public.training_program_save(null,family,p_profile_id,btrim(p_title),p.description,p.purpose,p.sport,p.difficulty,p.age_band,p.equipment,p.tags,'community',content,'Personal adaptation of '||p.title||' · version '||p.current_version_no);
 update public.training_programs set community_origin_program_id=p.id,community_origin_version_id=p.current_version_id where id=copied;
 return copied;
end $$;

-- Same-content saves cannot bypass a creator's no-copy choice through the active builder.
create function private.community_copy_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.training_programs p join public.training_program_versions v on v.program_id=p.id
  where not p.community_allow_copy and p.owner_family_id<>new.created_by_family_id
   and exists(select 1 from public.training_program_entitlements e where e.program_id=p.id and e.family_id=new.created_by_family_id)
   and not exists(select 1 from public.training_programs owned where owned.id=new.program_id and owned.community_origin_program_id is not null) and
   (new.content_json-'meta'-'program')=(v.content_json-'meta'-'program') and
   ((new.content_json->'program')-'name'-'startDate'-'completionMode')=((v.content_json->'program')-'name'-'startDate'-'completionMode')) then
  raise exception 'The creator has not allowed saving a personal copy of this programme';
 end if;
 return new;
end $$;
revoke all on function private.community_copy_guard() from public,anon,authenticated;
create trigger community_copy_guard before insert on public.training_program_versions for each row execute function private.community_copy_guard();

create function public.community_report(p_profile_id uuid,p_program_id uuid,p_creator_id uuid,p_reason text,p_details text) returns uuid language plpgsql security definer set search_path='' as $$
declare name text; snapshot jsonb; result uuid;
begin
 if not private.training_program_target_visible(p_profile_id,null) then raise exception 'Profile access required'; end if;
 if num_nonnulls(p_program_id,p_creator_id)<>1 then raise exception 'Choose a programme or creator to report'; end if;
 if p_program_id is not null then select p.title,jsonb_build_object('description',p.description,'purpose',p.purpose,'version_no',p.current_version_no,'content_json',v.content_json) into name,snapshot from public.training_programs p join public.training_program_versions v on v.id=p.current_version_id where p.id=p_program_id and private.community_available(p);
 else select display_name,jsonb_build_object('headline',headline,'bio',bio,'experience',experience,'qualifications',qualifications) into name,snapshot from public.training_program_creators where id=p_creator_id and published and not community_suspended; end if;
 if name is null then raise exception 'Reported content is unavailable'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_profile_id::text,0));
 if exists(select 1 from private.community_reports where reporter_profile_id=p_profile_id and program_id is not distinct from p_program_id and creator_id is not distinct from p_creator_id and status in ('open','reviewing')) then raise exception 'You already have an open report for this content'; end if;
 if (select count(*) from private.community_reports where reporter_profile_id=p_profile_id and created_at>now()-interval '1 day')>=10 then raise exception 'You have reached today’s reporting limit'; end if;
 insert into private.community_reports(reporter_profile_id,program_id,creator_id,target_name,snapshot,reason,details) values(p_profile_id,p_program_id,p_creator_id,name,snapshot,p_reason,btrim(p_details)) returning id into result;
 return result;
end $$;

create function public.community_reports() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.creator_is_reviewer() then raise exception 'Reviewer access required'; end if;
 return coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object('suspended',case when r.program_id is not null then p.community_suspended else c.community_suspended end,
  'actions',coalesce((select jsonb_agg(jsonb_build_object('action',a.action,'note',a.note,'created_at',a.created_at) order by a.created_at desc) from private.community_report_actions a where a.report_id=r.id),'[]'::jsonb)))
 from (select * from private.community_reports order by (status in ('open','reviewing')) desc,created_at desc limit 200) r
 left join public.training_programs p on p.id=r.program_id left join public.training_program_creators c on c.id=r.creator_id),'[]'::jsonb);
end $$;

create function public.community_review_report(p_report_id uuid,p_action text,p_note text) returns boolean language plpgsql security definer set search_path='' as $$
declare r private.community_reports;
begin
 if not private.creator_is_reviewer() then raise exception 'Reviewer access required'; end if;
 if p_action is null or p_action not in ('reviewing','resolve','dismiss','hide','restore') or char_length(btrim(coalesce(p_note,''))) not between 10 and 1500 then raise exception 'Choose an action and explain your decision in 10 to 1500 characters'; end if;
 select * into r from private.community_reports where id=p_report_id for update;
 if r.id is null then raise exception 'Report is unavailable'; end if;
 if p_action='hide' then
  if r.program_id is not null then update public.training_programs set community_suspended=true,marketplace_status='not_listed',access_model='internal',updated_at=now() where id=r.program_id;
  else
   update public.training_programs set marketplace_status='not_listed',access_model='internal',updated_at=now() where creator_profile_id=r.creator_id;
   update public.training_program_creators set community_suspended=true,published=false,verified_at=null,verified_revision=null,verified_summary='',updated_at=now() where id=r.creator_id;
   update private.creator_verification_requests set status='revoked',review_note=btrim(p_note),reviewer_id=(select auth.uid()),reviewed_at=now() where creator_id=r.creator_id and status='approved';
  end if;
 elsif p_action='restore' then
  if r.program_id is not null then update public.training_programs set community_suspended=false where id=r.program_id;
  else update public.training_program_creators set community_suspended=false where id=r.creator_id; end if;
 end if;
 update private.community_reports set status=case p_action when 'reviewing' then 'reviewing' when 'dismiss' then 'dismissed' else 'resolved' end,updated_at=now() where id=r.id;
 insert into private.community_report_actions(report_id,reviewer_id,action,note) values(r.id,(select auth.uid()),p_action,btrim(p_note));
 return true;
end $$;

revoke all on function public.community_context(uuid),public.community_bookmark(uuid,uuid,boolean),public.community_vote(uuid,uuid,boolean,uuid,text),public.community_set_copy_permission(uuid,boolean),public.community_copy(uuid,uuid,uuid,text),public.community_report(uuid,uuid,uuid,text,text),public.community_reports(),public.community_review_report(uuid,text,text) from public,anon;
grant execute on function public.community_context(uuid),public.community_bookmark(uuid,uuid,boolean),public.community_vote(uuid,uuid,boolean,uuid,text),public.community_set_copy_permission(uuid,boolean),public.community_copy(uuid,uuid,uuid,text),public.community_report(uuid,uuid,uuid,text,text),public.community_reports(),public.community_review_report(uuid,text,text) to authenticated;

-- Preserve reviewed Assessment snapshots and source references in personal adaptations.
create or replace function private.training_program_freeze_assessments()
returns trigger language plpgsql security definer set search_path = '' as $$
declare phase jsonb; checkpoint jsonb; phases jsonb := '[]'; checkpoints jsonb; definition jsonb; template_uuid uuid;
begin
  for phase in select value from jsonb_array_elements(new.content_json #> '{program,phases}') loop
    checkpoints := '[]';
    for checkpoint in select value from jsonb_array_elements(coalesce(phase->'assessments','[]'::jsonb)) loop
      definition := null;
      if coalesce(checkpoint->>'assessmentTemplateId','') <> '' then
        template_uuid := (checkpoint->>'assessmentTemplateId')::uuid;
        select jsonb_build_object('template',to_jsonb(t)-'family_id',
          'tests',(select coalesce(jsonb_agg(to_jsonb(test)-'family_id'),'[]') from public.tests test
            where test.id in (select tt.test_id from public.assessment_template_tests tt where tt.assessment_template_id=t.id) and not test.archived),
          'templateTests',(select coalesce(jsonb_agg(to_jsonb(tt)-'family_id' order by tt.position),'[]') from public.assessment_template_tests tt where tt.assessment_template_id=t.id))
          into definition from public.assessment_templates t where t.id=template_uuid and t.family_id=new.created_by_family_id and not t.archived;
        if definition is null then
          select saved_cp->'assessmentDefinition' into definition
          from public.training_program_assignments a join public.training_program_versions v on v.id=a.version_id,
            lateral jsonb_array_elements(v.content_json #> '{program,phases}') saved_phase,
            lateral jsonb_array_elements(coalesce(saved_phase->'assessments','[]')) saved_cp
          where a.recipient_can_copy and private.training_program_recipient_owns_assignment(a.id)
            and saved_cp->>'assessmentTemplateId'=template_uuid::text limit 1;
        end if;
        if definition is null then
          select saved_cp->'assessmentDefinition' into definition
          from public.training_programs p join public.training_program_versions v on v.program_id=p.id,
            lateral jsonb_array_elements(v.content_json #> '{program,phases}') saved_phase,
            lateral jsonb_array_elements(coalesce(saved_phase->'assessments','[]')) saved_cp
          where (p.owner_family_id=new.created_by_family_id or (private.community_available(p) and p.community_allow_copy and v.id=p.current_version_id))
            and saved_cp->>'assessmentTemplateId'=template_uuid::text limit 1;
        end if;
        if definition is null or jsonb_array_length(definition->'tests')=0
          or jsonb_array_length(definition->'tests')<>jsonb_array_length(definition->'templateTests')
          then raise exception 'Choose an available Assessment with active Tests for each linked checkpoint'; end if;
      end if;
      checkpoints := checkpoints || jsonb_build_array((checkpoint-'assessmentDefinition') || case when definition is null then '{}'::jsonb else jsonb_build_object('assessmentDefinition',definition) end);
    end loop;
    phases := phases || jsonb_build_array(jsonb_set(phase,'{assessments}',checkpoints,true));
  end loop;
  new.content_json := jsonb_set(new.content_json,'{program,phases}',phases,true);
  return new;
end $$;

create or replace function public.training_program_copy_version(
  p_program_id uuid, p_version_id uuid, p_duplicate boolean, p_title text,
  p_change_note text, p_expected_version_id uuid
)
returns table(program_id uuid,version_id uuid,version_no integer)
language plpgsql security definer set search_path = '' as $$
declare v_program public.training_programs; v_content jsonb; v_no integer; copied record;
begin
  select * into v_program from public.training_programs p
    where p.id=p_program_id and private.training_program_owned_family(p.owner_family_id) for update;
  if v_program.id is null then raise exception 'Programme access required'; end if;
  if p_duplicate is null then raise exception 'Choose duplicate or restore'; end if;
  if not p_duplicate and v_program.status<>'active' then raise exception 'Restore the archived programme first'; end if;
  if not p_duplicate and v_program.current_version_id is distinct from p_expected_version_id then
    raise exception 'A newer version has been saved. Refresh before restoring.';
  end if;
  select v.content_json,v.version_no into v_content,v_no from public.training_program_versions v
    where v.id=p_version_id and v.program_id=p_program_id;
  if v_content is null then raise exception 'Version is not part of this programme'; end if;
  if char_length(btrim(coalesce(p_change_note,''))) not between 1 and 300 then raise exception 'Add a change note of up to 300 characters'; end if;
  for copied in select * from public.training_program_save(
    case when p_duplicate then null else p_program_id end,
    v_program.owner_family_id,v_program.creator_profile_id,
    case when p_duplicate then p_title else v_program.title end,
    v_program.description,v_program.purpose,v_program.sport,v_program.difficulty,v_program.age_band,
    v_program.equipment,v_program.tags,v_program.creator_role,v_content,p_change_note) loop
    if p_duplicate then update public.training_programs set community_origin_program_id=v_program.community_origin_program_id,community_origin_version_id=v_program.community_origin_version_id,community_suspended=v_program.community_suspended where id=copied.program_id; end if;
    return query select copied.program_id,copied.version_id,copied.version_no;
  end loop;
end $$;
revoke all on function public.training_program_copy_version(uuid,uuid,boolean,text,text,uuid) from public,anon;
grant execute on function public.training_program_copy_version(uuid,uuid,boolean,text,text,uuid) to authenticated;

-- Library add-ons have programme IDs, not coach assignment IDs.
create or replace function private.training_program_sync_checkpoints()
returns trigger language plpgsql security definer set search_path = '' as $$
declare addon jsonb; assignment_uuid uuid; source text;
begin
  if tg_op='UPDATE' and old.plan_json->'program' is not distinct from new.plan_json->'program'
    and old.plan_json #> '{meta,programAddOns}' is not distinct from new.plan_json #> '{meta,programAddOns}'
    and old.plan_json #> '{meta,activeProgramSource}' is not distinct from new.plan_json #> '{meta,activeProgramSource}' then return new; end if;
  update public.training_program_checkpoints set active=false where profile_id=new.id and active;
  assignment_uuid := nullif(new.plan_json #>> '{meta,activeProgramSource,assignmentId}','')::uuid;
  source := coalesce(assignment_uuid::text,'personal:' || coalesce(new.plan_json #>> '{program,phases,0,id}',''));
  perform private.training_program_schedule_source(new.id,new.family_id,source,assignment_uuid,new.plan_json);
  for addon in select value from jsonb_array_elements(coalesce(new.plan_json #> '{meta,programAddOns}','[]'::jsonb)) loop
    assignment_uuid := case when coalesce(addon->>'sourceKind','assignment') in ('owner','free','purchase','creator_subscription','admin') then null else (addon->>'id')::uuid end;
    perform private.training_program_schedule_source(new.id,new.family_id,addon->>'id',assignment_uuid,addon->'content');
  end loop;
  return new;
end $$;
revoke all on function private.training_program_sync_checkpoints() from public,anon,authenticated;
