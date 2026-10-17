import { afterEach, expect, it, vi } from 'vitest';
const client=vi.hoisted(()=>({from:vi.fn()}));
vi.mock('./supabaseClient',()=>({supabase:client}));
import { upsertLog } from './db.js';
afterEach(()=>{vi.useRealTimers();vi.clearAllMocks();});
it('uses the existing unique day key and bounds a hung write without reporting success',async()=>{
 vi.useFakeTimers();let signal;
 const chain={upsert:vi.fn(()=>chain),select:()=>chain,single:()=>chain,abortSignal:s=>{
  signal=s;return new Promise(resolve=>s.addEventListener('abort',()=>resolve({data:null,error:new Error('Timed out')})));
 }};
 client.from.mockReturnValue(chain);
 const pending=upsertLog('family','profile','2026-10-17',{blocks:[]});
 expect(chain.upsert).toHaveBeenCalledWith({family_id:'family',profile_id:'profile',date_ymd:'2026-10-17',log_json:{blocks:[]}},{onConflict:'family_id,profile_id,date_ymd'});
 await vi.advanceTimersByTimeAsync(15000);
 const result=await pending;expect(signal.aborted).toBe(true);expect(result.error).toBeTruthy();expect(result.data).toBeNull();
 expect(vi.getTimerCount()).toBe(0);
});
