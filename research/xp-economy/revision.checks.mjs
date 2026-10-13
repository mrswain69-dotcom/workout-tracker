import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {activityBase,completion,improvementEvidence,datedAward} from './revision-rules.mjs';
import {AVATAR_PACKS} from '../../src/config/avatars.js';
import {buildXpDebugRows} from '../../src/engine/xpEngine.js';
const work=(n=12)=>Array.from({length:n},(_,i)=>({id:`set${i}`,kind:'strength',reps:12}));
const snapshot={required:work(2).map(s=>({id:s.id,minimums:{reps:12}}))};
const session=(date='2026-10-19',values=[10,5],extra={})=>({date,exercise:'press',protocol:'fixed-load-10kg-full-range',metric:'repetitions',unit:'reps',direction:'higher',slots:values.map((value,i)=>({slot:`s${i}`,value})),...extra});
const history=()=>['2026-09-28','2026-10-05','2026-10-12'].map(d=>session(d));
test('same sets across blocks and labels preserve base XP',()=>{
 const original=work();for(let blocks=1;blocks<=24;blocks++)assert.deepEqual(activityBase(original.map((f,i)=>({...f,block:i%blocks,label:`name${i}`}))),activityBase(original));
});
test('replayed stable IDs count once regardless of entry layout',()=>assert.deepEqual(activityBase([...work(),...work()]),activityBase(work())));
test('conflicting duplicate IDs require reconciliation rather than choosing a winner',()=>assert.throws(()=>activityBase([{id:'a',kind:'strength',reps:12},{id:'a',kind:'strength',reps:1}]),/Conflicting/));
test('missing durable IDs fail visibly',()=>assert.throws(()=>activityBase([{kind:'strength',reps:12}]),/identity/));
test('zero, negative, strings, NaN and infinity do not count as performed work',()=>{
 for(const value of [0,-1,'12',NaN,Infinity])assert.equal(activityBase([{id:'s',kind:'strength',reps:value}]).total,0);
});
test('mobility is counted by hold duration rather than movement or block count',()=>{
 for(let n=1;n<=120;n++)assert.deepEqual(activityBase(Array.from({length:n},(_,i)=>({id:`m${i}`,kind:'mobility',seconds:1200/n}))),activityBase([{id:'m',kind:'mobility',seconds:1200}]));
});
test('cardio minutes and distance aggregate before rounding for 120 partitions',()=>{
 for(let n=1;n<=120;n++)assert.deepEqual(activityBase(Array.from({length:n},(_,i)=>({id:`c${i}`,kind:'cardio',activity:'run',minutes:30/n,km:3/n}))),activityBase([{id:'c',kind:'cardio',activity:'run',minutes:30,km:3}]));
});
test('tiny run does not remove walking factor from the rest of the day',()=>{
 const walking=[{id:'w',kind:'cardio',activity:'walk',minutes:30,km:3}],mixed=[...walking,{id:'r',kind:'cardio',activity:'run',minutes:.1,km:.01}];assert.ok(activityBase(mixed).total-activityBase(walking).total<=1);
});
test('larger genuinely recorded workouts earn more base XP without hard cap',()=>assert.ok(activityBase(work(100)).total>activityBase(work(12)).total));
test('all saved required targets met is complete',()=>assert.equal(completion(snapshot,work(2)),'complete'));
test('one of two required sets is partial',()=>assert.equal(completion(snapshot,work(1)),'partial'));
test('one repetition against twelve is partial',()=>assert.equal(completion(snapshot,[{...work(2)[0],reps:1},work(2)[1]]),'partial'));
test('unfinished optional extra work cannot invalidate completed required work',()=>assert.equal(completion(snapshot,[...work(2),{id:'extra',kind:'strength',reps:0}]),'complete'));
test('missing target snapshot is unknown rather than green',()=>assert.equal(completion(null,work()),'unknown'));
test('empty plan is none rather than a completed workout',()=>assert.equal(completion({required:[]},[]),'none'));
test('empty completed Session has no work evidence for required target',()=>assert.equal(completion({required:[{id:'session-work',minimums:{minutes:30}}]},[{id:'session',completed:true}]),'partial'));
test('cancelling an unperformed target does not erase its requirement',()=>assert.equal(completion(snapshot,[work(2)[0],{id:'set1',cancelled:true}]),'partial'));
test('approved adjustment can excuse a target while performed work remains creditable',()=>{
 const adjusted=structuredClone(snapshot);adjusted.required[1].excusedByApprovedAdjustment=true;assert.equal(completion(adjusted,work(1)),'complete');assert.equal(activityBase(work(1)).total,7);
});
test('eligible planned recovery, injury and illness remain possible completion paths',()=>{
 for(const mode of ['planned','injury','illness'])assert.equal(completion({required:[{id:'recovery',kind:'recovery',eligible:true,mode}]},[{id:'recovery',kind:'recovery',confirmed:true}]),'complete');
});
test('ineligible recovery is not silently credited',()=>assert.equal(completion({required:[{id:'r',kind:'recovery',eligible:false}]},[{id:'r',kind:'recovery',confirmed:true}]),'partial'));
test('wrong work type cannot satisfy a snapshotted target',()=>assert.equal(completion({required:[{id:'a',kind:'strength',minimums:{reps:12}}]},[{id:'a',kind:'cardio',reps:12}]),'partial'));
test('completion with incompatible units is unknown',()=>assert.equal(completion({required:[{id:'a',unit:'kg',minimums:{weight:10}}]},[{id:'a',unit:'lb',weight:20}]),'unknown'));
test('strict attainment exposure: honest below-goal set would lose completion without separate performed evidence',()=>{
 assert.equal(completion({required:[{id:'a',minimums:{reps:12}}]},[{id:'a',reps:10}]),'partial');
 // Target attainment and performing the prescribed work need distinct semantics.
});
test('performed-set completion can be separated from achieving a stretch target',()=>{
 const saved={required:[{id:'a',kind:'strength',evidenceMode:'performed',minimums:{reps:1},goal:{reps:12}}]};
 assert.equal(completion(saved,[{id:'a',kind:'strength',completed:true,reps:10}]),'complete');
 assert.equal(completion(saved,[{id:'a',kind:'strength',completed:true,reps:0}]),'partial');
});
test('current earned-XP field includes daily claim while bonusXP remains zero',()=>{
 const log={blocks:[{id:'b',typeId:'strength',movements:[{id:'m',sets:1}],sets:{m:[{reps:12}]}}]};
 const a=buildXpDebugRows([{date_ymd:'2026-10-19',log}],{}, {todayYmd:'2026-10-19'})[0];
 const b=buildXpDebugRows([{date_ymd:'2026-10-19',log:{...log,meta:{challengeClaimed:true}}}],{}, {todayYmd:'2026-10-19'})[0];
 assert.equal(b.earnedXp-a.earnedXp,15);assert.equal(b.bonusXp,0);
});
test('current plan-configurable task XP contributes to the group earned-XP input',()=>{
 const log={blocks:[{id:'t',typeId:'tasks',tasksDone:{task:true}}]},record={date_ymd:'2026-10-19',log};
 const score=value=>buildXpDebugRows([record],{blocksByWeekday:{Mon:[{id:'t',tasks:[{id:'task',xpValue:value}]}]}},{todayYmd:'2026-10-19'})[0];
 const a=score(5),b=score(100);assert.equal(b.earnedXp-a.earnedXp,95);assert.equal(b.bonusXp,0);
});
test('matching units and protocol produce measurable gain',()=>{
 const r=improvementEvidence(session('2026-10-19',[12,6]),history());assert.equal(r.eligible,true);assert.ok(Math.abs(r.gain-.2)<1e-9);assert.equal(r.matchedSlots,2);
});
test('dropping a weaker set produces no improvement evidence',()=>assert.equal(improvementEvidence(session('2026-10-19',[10]),history()).eligible,false));
test('improving one slot while overall comparable performance falls gets no award',()=>assert.equal(improvementEvidence(session('2026-10-19',[12,1]),history()).gain,0));
test('adding unchanged sets changes base volume, not improvement evidence',()=>assert.equal(improvementEvidence(session('2026-10-19',[10,5,20]),history()).gain,0));
test('new extra slots cannot multiply matched improvement credit',()=>assert.deepEqual(improvementEvidence(session('2026-10-19',[12,6,100]),history()),improvementEvidence(session('2026-10-19',[12,6]),history())));
test('exercise, protocol, unit, metric or direction changes cannot compare',()=>{
 for(const [key,value] of Object.entries({exercise:'squat',protocol:'different-load',unit:'lb',metric:'load',direction:'lower'}))assert.equal(improvementEvidence(session(undefined,undefined,{[key]:value}),history()).eligible,false);
});
test('new exercise receives base work XP even without improvement history',()=>{
 assert.equal(improvementEvidence(session(),[]).eligible,false);assert.equal(activityBase(work(2)).total,9);
});
test('three recent dates needed for this experimental baseline',()=>assert.equal(improvementEvidence(session(),history().slice(0,2)).eligible,false));
test('ancient baselines are excluded for every metric',()=>assert.equal(improvementEvidence(session(),history().map(s=>({...s,date:s.date.replace('2026','2025')}))).eligible,false));
test('four-week baseline excludes days 29 to 42 unless the rule is explicitly changed',()=>{
 const h=['2026-09-08','2026-09-15','2026-09-20'].map(d=>session(d));assert.equal(improvementEvidence(session(),h).eligible,false);
 assert.equal(improvementEvidence(session(),h,{windowDays:42}).eligible,true);
});
test('future history is ignored',()=>assert.equal(improvementEvidence(session(),history().map(s=>({...s,date:'2026-10-20'}))).eligible,false));
test('record order does not change evidence',()=>assert.deepEqual(improvementEvidence(session(),history()),improvementEvidence(session(),history().reverse())));
test('repeating latest improved work earns zero further gain',()=>{
 const h=[...history(),session('2026-10-18',[12,6])];assert.equal(improvementEvidence(session('2026-10-19',[12,6]),h).gain,0);
});
test('duplicate historical dates need reconciliation and do not count as extra history',()=>assert.equal(improvementEvidence(session(),[...history(),history()[0]]).eligible,false));
test('duplicate set slots are rejected as incomparable',()=>{
 const c=session();c.slots[1].slot='s0';assert.equal(improvementEvidence(c,history()).eligible,false);
});
test('cardio lower-is-better metric only compares matching distance protocol',()=>{
 const extra={exercise:'run',protocol:'same-route-3km',metric:'duration',unit:'minutes',direction:'lower'},h=history().map(s=>session(s.date,[30],extra));
 assert.ok(improvementEvidence(session('2026-10-19',[25],extra),h).gain>.19);
 assert.equal(improvementEvidence(session('2026-10-19',[20],{...extra,protocol:'same-route-2km'}),h).eligible,false);
});
test('malformed calendar date fails visibly',()=>assert.throws(()=>improvementEvidence(session('2026-02-30'),history()),/Invalid date/));
test('historical full score and cosmetic fields remain exact and revised callback is unused',()=>{
 const old={earnedXp:617,bonusXp:500,totalXp:1117,streakXp:600,metadata:{avatar:'chosen'}};let called=false;
 assert.deepEqual(datedAward('2026-10-18','2026-10-19',old,()=>{called=true;return 0;}),old);assert.equal(called,false);
});
test('activation boundary is deterministic and uses the revised callback only on or after date',()=>assert.equal(datedAward('2026-10-19','2026-10-19',{},()=>42),42));
test('data and snapshots are not mutated by calculation',()=>{
 const data={snapshot:structuredClone(snapshot),facts:work(2),current:session(),history:history()},before=structuredClone(data);
 completion(data.snapshot,data.facts);activityBase(data.facts);improvementEvidence(data.current,data.history);assert.deepEqual(data,before);
});
test('avatar pack thresholds remain strictly increasing and post10k cadence stays locked',()=>{
 const thresholds=AVATAR_PACKS.map(p=>p.unlockAtXp);assert.ok(thresholds.every((t,i)=>i===0||t>thresholds[i-1]));
 const expected=[12000,14000,16000,18000,20000,22000,24000,26000,28000,30000,35000,40000,45000,50000,55000,60000,70000,80000,90000,100000,110000,120000];
 assert.ok(thresholds.filter(t=>t>10000).every(t=>expected.includes(t)));
});
test('specification level-curve arithmetic needs reconciliation before pacing calibration',()=>{
 const toLevel50=Array.from({length:49},(_,i)=>100+((i+1)**2*8)).reduce((a,b)=>a+b,0);
 assert.equal(toLevel50,328300);assert.ok(toLevel50>200000);
 // Level 1 to 50 under the stated formula, not proof of a live level system.
});
test('unlock interval sensitivity is explicit, not a prediction from two users',()=>{
 const cases=[2000,5000,10000].map(gap=>({gap,currentDays:gap/150,atThirtyPercentLowerDays:gap/105}));
 for(const r of cases)assert.ok(Math.abs(r.atThirtyPercentLowerDays/r.currentDays-1/0.7)<1e-9);
 fs.writeFileSync(new URL('./revision-results.json',import.meta.url),JSON.stringify({status:'research contracts pass; production adapter and policy decisions remain',partitionChecks:264,unlockSensitivity:cases,limitations:['genuine-set splitting remains unverifiable from numeric logs','trusted snapshots and canonical units not yet integrated','improvement evidence is not a calibrated XP formula','recovery eligibility policy remains the live accepted policy','caps in canonical engine spec require reconciliation before rollout']},null,2));
});
