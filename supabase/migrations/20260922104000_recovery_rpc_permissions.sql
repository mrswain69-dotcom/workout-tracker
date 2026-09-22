-- Recovery RPCs are intentionally callable by signed-in account owners only.
-- Explicit anon revokes avoid SECURITY DEFINER exposure through the REST RPC surface.

revoke execute on function public.set_profile_recovery_mode(uuid, text, date)
from public, anon;

grant execute on function public.set_profile_recovery_mode(uuid, text, date)
to authenticated;

revoke execute on function public.update_profile_recovery_period_timing(
  uuid, uuid, date, timestamptz, date, timestamptz
) from public, anon;

grant execute on function public.update_profile_recovery_period_timing(
  uuid, uuid, date, timestamptz, date, timestamptz
) to authenticated;
