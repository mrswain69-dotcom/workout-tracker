begin;
do $$
begin
  assert not private.usage_has_activity('{"blocks":[{"typeId":"strength","movements":[{"reps":20}],"sets":{"m":[{"reps":""}]}}]}');
  assert private.usage_has_activity('{"blocks":[{"typeId":"strength","sets":{"m":[{"reps":"20"}]}}]}');
  assert not private.usage_has_activity('{"blocks":[{"typeId":"cardio","cancelled":true,"cardio":{"durationMin":30}}]}');
  assert not private.usage_has_activity('{"blocks":[{"typeId":"duration","suspendedByRecoveryMode":true,"duration":{"minutes":10}}]}');
  assert private.usage_has_activity('{"blocks":[{"typeId":"duration","duration":{"minutes":10}}]}');
  assert private.usage_has_activity('{"blocks":[{"typeId":"session","session":{"movements":[{"completed":true}]}}]}');
  assert not private.usage_has_activity('{"blocks":[{"typeId":"session","session":{"movements":[{"result":null}]}}]}');
  assert private.usage_has_activity('{"blocks":[{"typeId":"recovery","recoveryDone":true}]}');
  assert not private.usage_has_activity('{"blocks":[{"typeId":"tasks","tasks":[{"completed":true}]}]}');
  assert not has_function_privilege('anon','public.wt_admin_usage_dashboard(boolean)','execute');
  assert not has_table_privilege('authenticated','private.usage_admins','insert');
  assert not has_table_privilege('authenticated','private.app_usage_daily','select');
end $$;
-- Both anonymous claims and an ordinary caller must fail even when invoking the API directly.
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000001","user_metadata":{"admin":true}}',true);
do $$
begin
  assert not public.wt_admin_usage_access();
  begin
    perform public.wt_admin_usage_dashboard(false);
    raise exception 'Non-admin was allowed access';
  exception when insufficient_privilege then null; end;
  begin
    perform public.wt_record_app_visit();
    raise exception 'Missing account was allowed to record a visit';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
