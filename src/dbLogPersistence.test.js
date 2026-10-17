import { afterEach, expect, it, vi } from 'vitest';
const client=vi.hoisted(()=>({from:vi.fn(),rpc:vi.fn()}));
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

it('passes the original version and operation identity and surfaces conflicts',async()=>{
 const row={row_version:4,log_json:{blocks:[]}};
 client.rpc.mockReturnValue({abortSignal:()=>Promise.resolve({data:{status:'conflict',row},error:null})});
 const result=await upsertLog('family','profile','2026-10-17',{blocks:[]},{versioned:true,expectedVersion:3,writeId:'operation-1'});
 expect(client.rpc).toHaveBeenCalledWith('save_workout_log_versioned',{p_family_id:'family',p_profile_id:'profile',p_date_ymd:'2026-10-17',p_log:{blocks:[]},p_expected_version:3,p_write_id:'operation-1'});
 expect(result.conflict.row).toEqual(row);expect(client.from).not.toHaveBeenCalled();
});
it('never falls back to a legacy overwrite when the versioned endpoint is unavailable',async()=>{
 const error={code:'PGRST202',message:'Missing function'};
 client.rpc.mockReturnValue({abortSignal:()=>Promise.resolve({data:null,error})});
 expect((await upsertLog('f','p','2026-10-17',{}, {versioned:true,writeId:'write'})).error).toEqual(error);
 expect(client.from).not.toHaveBeenCalled();
});
it('does not confirm a malformed versioned response',async()=>{
 client.rpc.mockReturnValue({abortSignal:()=>Promise.resolve({data:{status:'saved'},error:null})});
 expect((await upsertLog('f','p','2026-10-17',{}, {versioned:true,writeId:'write'})).error).toBeTruthy();
});
