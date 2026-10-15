// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('./supabaseClient.js',()=>({supabase:null}));
import { startUsageHeartbeat } from './adminUsage.js';
afterEach(()=>vi.restoreAllMocks());
it('records foreground use at start, on returning and every 15 minutes; stops after cleanup',()=>{
 const client={rpc:vi.fn().mockResolvedValue({})};
 const doc=new EventTarget();doc.visibilityState='visible';
 const scheduler={setInterval:vi.fn().mockReturnValue(7),clearInterval:vi.fn()};
 const stop=startUsageHeartbeat(client,doc,scheduler);
 expect(client.rpc).toHaveBeenCalledWith('wt_record_app_visit');
 expect(scheduler.setInterval).toHaveBeenCalledWith(expect.any(Function),900000);
 doc.visibilityState='hidden';doc.dispatchEvent(new Event('visibilitychange'));scheduler.setInterval.mock.calls[0][0]();
 expect(client.rpc).toHaveBeenCalledTimes(1);
 doc.visibilityState='visible';doc.dispatchEvent(new Event('visibilitychange'));
 expect(client.rpc).toHaveBeenCalledTimes(2);
 stop();doc.dispatchEvent(new Event('visibilitychange'));scheduler.setInterval.mock.calls[0][0]();
 expect(client.rpc).toHaveBeenCalledTimes(2);expect(scheduler.clearInterval).toHaveBeenCalledWith(7);
});
it('ignores unavailable telemetry without breaking app use',async()=>{
 const client={rpc:vi.fn().mockRejectedValue(new Error('offline'))};
 const doc=new EventTarget();doc.visibilityState='visible';
 const stop=startUsageHeartbeat(client,doc,{setInterval:()=>7,clearInterval:()=>{}});
 await Promise.resolve();stop();expect(client.rpc).toHaveBeenCalledTimes(1);
});
