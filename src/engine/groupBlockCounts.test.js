import { describe, expect, it } from 'vitest';
import { countCompletedGroupBlocks, attachGroupBlockCounts } from './groupBlockCounts.js';
const date='2026-10-14';
const done={loggedAt:date+'T09:00:00Z'};
const row=blocks=>({profile_id:'p1',date_ymd:date,log_json:{blocks}});
describe('Group completed block counts',()=>{
 it('counts each completed block once, merges legacy strength/cardio types and ignores cancelled, suspended, incomplete and private health types',()=>{
 const blocks=[
  {id:'s1',typeId:'strength',...done,sets:{squat:[{reps:5}]}},
  {id:'s1',typeId:'strength',...done,sets:{squat:[{reps:5}]}},
  {id:'s2',typeId:'hiit',...done,sets:{jump:[{timeSeconds:30}]}},
  {id:'empty',typeId:'strength',...done,sets:{squat:[{}]}},
  {id:'c',typeId:'cardio',...done,cardio:{durationMin:30}},
  {id:'walk',typeId:'walk',...done,cardio:{distanceKm:2}},
  {id:'d',typeId:'duration',...done,duration:{minutes:10}},
  {id:'ss',typeId:'session',session:{completed:true,completedAt:date+'T10:00:00Z'}},
  {id:'partial',typeId:'session',session:{actualDurationSec:100}},
  {id:'t',typeId:'tasks',tasks:[{id:'a'},{id:'b'}],tasksDone:{a:true,b:true}},
  {id:'t2',typeId:'tasks',tasks:[{id:'a'},{id:'b'}],tasksDone:{a:true}},
  {id:'health',typeId:'recovery',...done,recoveryDone:true},
  {id:'cancelled',typeId:'cardio',...done,cardio:{durationMin:20},cancelled:true},
  {id:'suspended',typeId:'duration',...done,duration:{minutes:10},suspendedByRecoveryMode:true},
 ];
 expect(countCompletedGroupBlocks([row(blocks)],date,date)).toEqual({strength:2,cardio:2,duration:1,session:1,tasks:1,total:7});
 });
 it('respects period cutoffs and preserves standings without exposing log data',()=>{
 const period={startDate:date,endDate:date,state:'frozen',rows:[{membership_id:'m',xp:150,rank:1}]};
 const logs=[row([{id:'c',typeId:'cardio',...done,cardio:{durationMin:30}}]),{...row([]),profile_id:'someone-else'}];
 const result=attachGroupBlockCounts(period,[{id:'m',profile_id:'p1'}],logs,()=>({eligibleFrom:date,eligibleThrough:date}));
 expect(result.rows[0]).toEqual({...period.rows[0],completedBlocks:{strength:0,cardio:1,duration:0,session:0,tasks:0,total:1}});
 expect(period.rows[0].completedBlocks).toBeUndefined();
 expect(countCompletedGroupBlocks(logs,'2026-10-15','2026-10-16').total).toBe(0);
 });
});
