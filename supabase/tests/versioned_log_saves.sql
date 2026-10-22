-- Synthetic fixtures, rolled back. Run only against the isolated test project.
begin;
insert into public.families(id,owner_user_id,name) values
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Sync test family'),
 ('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','Other sync family');
insert into public.profiles(id,family_id,name) values
 ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Test athlete'),
 ('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','Other athlete');
set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
do $$
declare
 f uuid := '10000000-0000-0000-0000-000000000001';
 p uuid := '30000000-0000-0000-0000-000000000001';
 result jsonb;
 blocked boolean := false;
begin
 result := public.save_workout_log_versioned(f,p,'2026-10-17','{"blocks":[{"id":"run","cardio":{"durationMin":"30"}}]}',null,'operation-a');
 assert result->>'status'='saved' and (result#>>'{row,row_version}')::bigint=0, 'First save failed';
 result := public.save_workout_log_versioned(f,p,'2026-10-17','{"blocks":[{"id":"run","cardio":{"durationMin":"30"}}]}',null,'operation-a');
 assert result->>'status'='saved' and (result#>>'{row,row_version}')::bigint=0, 'Replay was not idempotent';
 result := public.save_workout_log_versioned(f,p,'2026-10-17','{"blocks":[]}',0,'operation-b');
 assert result->>'status'='saved' and (result#>>'{row,row_version}')::bigint=1, 'Versioned update failed';
 result := public.save_workout_log_versioned(f,p,'2026-10-17','{"blocks":[{"id":"stale"}]}',0,'operation-c');
 assert result->>'status'='conflict' and (result#>>'{row,row_version}')::bigint=1, 'Stale writer was accepted';
 assert result#>'{row,log_json}'='{"blocks":[]}'::jsonb, 'Conflict overwrote the saved version';
 result := public.save_workout_log_versioned(f,p,'2026-10-17','{"blocks":[]}',null,'operation-d');
 assert result->>'status'='conflict', 'Concurrent first save was accepted';
 update public.logs set log_json='{"blocks":[{"id":"legacy"}]}' where family_id=f and profile_id=p;
 result := public.save_workout_log_versioned(f,p,'2026-10-17','{"blocks":[]}',1,'operation-e');
 assert result->>'status'='conflict' and (result#>>'{row,row_version}')::bigint=2, 'Legacy update did not advance version';
 begin
  perform public.save_workout_log_versioned(f,'30000000-0000-0000-0000-000000000002','2026-10-17','{}',null,'wrong-profile');
 exception when insufficient_privilege then blocked:=true;
 end;
 assert blocked, 'Cross-family profile write was accepted';
 blocked:=false;
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',true);
 begin
  perform public.save_workout_log_versioned(f,p,'2026-10-17','{}',null,'wrong-owner');
 exception when insufficient_privilege then blocked:=true;
 end;
 assert blocked, 'Another owner could call the write endpoint';
 assert not exists(select 1 from public.logs where family_id=f), 'RLS exposed another family';
end $$;
reset role;
rollback;
select 'Versioned save, idempotency, stale writes, legacy writes and family isolation passed' as result;
