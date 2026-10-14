import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { transformWithOxc } from 'vite';

const endpoints = ['group-xp-leaderboard', 'group-consistency-leaderboard', 'group-improvement-leaderboard', 'group-seasons-awards'];
const referenceDate = '2026-10-14';
const member = { id:'m',group_id:'g',profile_id:'p',family_id:'f',nickname:'Athlete',status:'active',role:'member',joined_at:'2026-10-12T09:00:00Z',left_at:null };
const logs = [{ id:'log',profile_id:'p',date_ymd:referenceDate,log_json:{blocks:[
 {id:'strength',typeId:'strength',loggedAt:referenceDate+'T10:00:00Z',sets:{squat:[{reps:5}]}},
 {id:'cardio',typeId:'cardio',loggedAt:referenceDate+'T10:00:00Z',cardio:{durationMin:20}},
 {id:'session',typeId:'session',session:{completed:true,completedAt:referenceDate+'T11:00:00Z'}},
]}}];

// Run the actual deployed handler with realistic database responses. No secrets or live writes.
async function handlerFor(endpoint, failLogs = false) {
 const tables = {
  group_memberships:[member], groups:[{id:'g',status:'active',competition_start_date:'2026-10-12',xp_history_scope:'group_start'}],
  profiles:[{id:'p',plan_json:{meta:{},blocksByWeekday:{}}}], logs,
 };
 const client = {
  auth:{getUser:async()=>({data:{user:{id:'u'}},error:null})},
  from(table) {
   let rows=[...(tables[table] || [])], single=false, write=false;
   const query = new Proxy({}, {get(_,method) {
    if (method==='then') return (resolveResult,reject) => Promise.resolve({data:write ? null : single ? rows[0] || null : rows,error:table==='logs' && failLogs ? new Error('Fixture log query failure') : null}).then(resolveResult,reject);
    return (...args)=>{
     if (method==='maybeSingle' || method==='single') single=true;
     if (method==='upsert' || method==='insert') write=true;
     if (method==='eq') rows=rows.filter(row=>row[args[0]]===args[1]);
     if (method==='in') rows=rows.filter(row=>args[1].includes(row[args[0]]));
     if (method==='gte') rows=rows.filter(row=>row[args[0]]>=args[1]);
     if (method==='lte') rows=rows.filter(row=>row[args[0]]<=args[1]);
     return query;
    };
   }});
   return query;
  },
 };
 let handler;
 vi.stubGlobal('__groupTestCreateClient',()=>client);
 vi.stubGlobal('Deno',{env:{get:key=>key==='SUPABASE_URL' ? 'https://test.supabase.co' : key.endsWith('_KEYS') ? undefined : 'fixture-key'},serve:fn=>{handler=fn;}});
 const file=new URL(`./${endpoint}/index.ts`,import.meta.url);
 let source=readFileSync(file,'utf8');
 source=source.replace(/^import "jsr:[^\n]+\n/m,'').replace(/import \{ createClient \} from "npm:[^\n]+\n/,'const createClient = globalThis.__groupTestCreateClient;\n');
 source=source.replace(/from "(\.\/[^\"]+)"/g,(_,path)=>`from "${pathToFileURL(resolve(fileURLToPath(new URL('.',file)),path)).href}"`);
 const {code}=await transformWithOxc(source,fileURLToPath(file));
 await import(/* @vite-ignore */`data:text/javascript;base64,${Buffer.from(code).toString('base64')}#${endpoint}-${failLogs}`);
 return handler;
}
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
describe('Actual Group Edge Function responses',()=>{
 it.each(endpoints)('%s returns activity totals on its successful response',async endpoint=>{
  const handler=await handlerFor(endpoint);
  const response=await handler(new Request('https://test/functions/'+endpoint,{method:'POST',headers:{Authorization:'Bearer fixture-token','Content-Type':'application/json'},body:JSON.stringify({groupId:'g',membershipId:'m',referenceDate})}));
  expect(response.status).toBe(200);
  const payload=await response.json();
  const periods=endpoint==='group-seasons-awards' ? [payload.monthly.current,payload.season.current] : [payload.current];
  for (const period of periods) expect(period.rows[0].completedBlocks).toMatchObject({strength:1,cardio:1,session:1,total:3});
 });
 it.each(endpoints)('%s returns a safe 500 when a database query fails',async endpoint=>{
  vi.spyOn(console,'error').mockImplementation(()=>{});
  const handler=await handlerFor(endpoint,true);
  const response=await handler(new Request('https://test/functions/'+endpoint,{method:'POST',headers:{Authorization:'Bearer fixture-token','Content-Type':'application/json'},body:JSON.stringify({groupId:'g',membershipId:'m',referenceDate})}));
  expect(response.status).toBe(500);
  expect((await response.json()).error).toMatch(/^Could not calculate Group/);
 });
});
