import { useEffect } from 'react';
import { supabase } from './supabaseClient.js';

// A foreground heartbeat, not a page tracker. No timers run while logged out.
export function startUsageHeartbeat(client, doc = document, scheduler = window) {
  let stopped = false;
  const record = () => {
    if (stopped || doc.visibilityState !== 'visible') return;
    Promise.resolve(client.rpc('wt_record_app_visit')).catch(() => {});
  };
  record();
  const timer = scheduler.setInterval(record, 15 * 60 * 1000);
  doc.addEventListener('visibilitychange', record);
  return () => { stopped = true; scheduler.clearInterval(timer); doc.removeEventListener('visibilitychange', record); };
}
export function useAppUsage(enabled) {
  useEffect(() => {
    if (!enabled || !supabase) return;
    return startUsageHeartbeat(supabase);
  }, [enabled]);
}
export async function getUsageAccess() {
  if (!supabase) return false;
  const { data, error } = await supabase.rpc('wt_admin_usage_access');
  return !error && data === true;
}
export async function getUsageDashboard(includeAdmin) {
  const { data, error } = await supabase.rpc('wt_admin_usage_dashboard', { include_admin: includeAdmin });
  if (error) throw error;
  return data;
}
