import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDay, evaluateWeek, evaluateVersionedDay } from './engine.mjs';
import { adaptLog } from './adapter.mjs';

const date='2026-10-19';
const history=['2026-09-28','2026-10-05','2026-10-12'].map(date=>({date,key:'squat',protocol:'controlled-sets',unit:'reps',direction:'higher',value:10}));
const benchmark={key:'squat',protocol:'controlled-sets',unit:'reps',direction:'higher',value:11};
function day(events,patch={}) {return {date,events,requirements:[{key:'strength',target:144}],benchmarkSlots:['squat'],benchmarks:[benchmark],history,...patch};}
function strength(n=1,reps=144,minutes=20,format='blocks') {return Array.from({length:n},(_,i)=>({id:`event-${i}`,purpose:'strength',reps:reps/n,minutes:minutes/n,requirementKey:'strength',amount:reps/n,label:`Movement ${i}`,format,blockId:`block-${i}`}));}
function score(d,strategy='recorded-time') {const r=evaluateDay(d,strategy);assert.equal(r.valid,true);return r;}
function comparable(r) {return {credits:r.credits,activity:r.activityScore,improvement:r.improvementScore,consistency:r.consistencyScore,xp:r.earnedXp,overall:r.overallScore};}

test('equivalent work is invariant to 1-200 block/movement partitions, order and naming',()=>{
  for(const strategy of ['recorded-time','work-units']) {
    const expected=comparable(score(day(strength()),strategy));
    for(let n=1;n<=200;n++) {
      assert.deepEqual(comparable(score(day(strength(n).reverse()),strategy)),expected);
      assert.deepEqual(comparable(score(day(strength(n).map(e=>({...e,label:'Renamed exercise',blockId:'another'}))),strategy)),expected);
    }
  }
});
test('equal recorded strength work in standard blocks and Sessions scores identically',()=>{
  assert.deepEqual(comparable(score(day(strength(3,144,20,'blocks')))),comparable(score(day(strength(3,144,20,'session')))));
});
test('mobility aggregation is invariant to small fractions and logging format',()=>{
  const fixture=n=>day(Array.from({length:n},(_,i)=>({id:`m${i}`,purpose:'mobility',minutes:20/n,format:n===1?'duration':'strength'})),{requirements:[],benchmarkSlots:[]});
  const expected=comparable(score(fixture(1)));
  for(let n=1;n<=200;n++) assert.deepEqual(comparable(score(fixture(n))),expected);
});
test('cardio distance is supplemental and cannot create extra activity points when split',()=>{
  const fixture=n=>day(Array.from({length:n},(_,i)=>({id:`run${i}`,purpose:'cardio',minutes:30/n,distanceKm:3/n})),{requirements:[],benchmarkSlots:[]});
  const expected=comparable(score(fixture(1)));
  for(let n=1;n<=200;n++) assert.deepEqual(comparable(score(fixture(n))),expected);
});
test('tiny run cannot relabel an entire walk as running',()=>{
  const walk=day([{id:'walk',purpose:'walk',minutes:30,distanceKm:3}],{requirements:[],benchmarkSlots:[]});
  const a=score(walk),b=score({...walk,events:[...walk.events,{id:'tiny',purpose:'cardio',minutes:.1,distanceKm:.01}]});
  assert.ok(b.activityScore-a.activityScore<1);
});
test('duplicate events do not double count and conflicting duplicate values are rejected',()=>{
  const fixture=day(strength());
  assert.deepEqual(comparable(score({...fixture,events:[...fixture.events,...fixture.events]})),comparable(score(fixture)));
  assert.equal(evaluateDay({...fixture,events:[...fixture.events,{...fixture.events[0],reps:999}]}).valid,false);
});
test('required work completion does not depend on block boundaries or optional work',()=>{
  const requirements=[{key:'strength',target:144},{key:'optional',target:100,optional:true}];
  for(const n of [1,3,6,24]) {
    const r=score(day(strength(n,72,10),{requirements}));
    assert.equal(r.completion.complete,false); assert.equal(r.consistencyScore,50);
  }
});
test('exact targets complete a plan; no planned work never manufactures full completion',()=>{
  assert.equal(score(day(strength())).completion.complete,true);
  assert.equal(score(day(strength(),{requirements:[]})).consistencyScore,null);
});
test('cancelled retained work needs explicit evidence; performed work keeps partial credit',()=>{
  const data=strength().map(e=>({...e,cancelled:true}));
  assert.equal(score(day(data)).earnedXp,0);
  assert.equal(score(day(data)).activityXp,0);
  const performed=score(day(data.map(e=>({...e,performedBeforeCancellation:true,reps:72,minutes:10,amount:72}))));
  assert.equal(performed.consistencyScore,50); assert.ok(performed.activityXp>0);
});
test('suspended work and zero entries award no activity points',()=>{
  assert.equal(score(day(strength().map(e=>({...e,suspended:true})))).activityXp,0);
  assert.equal(score(day([{id:'empty',purpose:'strength',reps:0,minutes:0}],{benchmarks:[]})).earnedXp,0);
});
test('task rewards are personal, bounded and cannot change athletic competition',()=>{
  const base=day(strength()), a=score(base),b=score({...base,events:[...base.events,{id:'task',purpose:'tasks',completed:true,taskXp:100000}]});
  assert.equal(a.overallScore,b.overallScore); assert.equal(a.activityScore,b.activityScore);
  assert.equal(b.activityXp-a.activityXp,15);
});
test('reward bonuses stay separate from earned and competition scores',()=>{
  const a=score(day(strength())),b=score(day(strength(),{rewardXp:500}));
  assert.equal(a.earnedXp,b.earnedXp);assert.equal(a.overallScore,b.overallScore);assert.equal(b.totalXp-a.totalXp,500);
});
test('same recorded work scores identically for children and adults and ignores absolute load',()=>{
  const a=score(day(strength(),{age:10,weightKg:46,loadKg:2})),b=score(day(strength(),{age:45,weightKg:90,loadKg:50}));
  assert.deepEqual(comparable(a),comparable(b));
});
test('recorded-time model avoids rewarding higher repetition count for the same duration',()=>{
  const low=day(strength(1,24,20)),high=day(strength(1,240,20));
  low.requirements=[];high.requirements=[];
  assert.equal(score(low).activityScore,score(high).activityScore);
  assert.notEqual(score(low,'work-units').activityScore,score(high,'work-units').activityScore);
});
test('strength without time is clearly provisional and excluded from strict overall ranking',()=>{
  const r=score(day(strength(3,144,0)));
  assert.equal(r.provisional,true);assert.equal(r.overallScore,null);assert.equal(r.competitionEligible,false);
});
test('improvement needs three prior comparable dates spanning seven days',()=>{
  for(const h of [[],history.slice(0,2),history.map((e,i)=>({...e,date:`2026-10-${16+i}`}))]) assert.equal(score(day(strength(),{history:h})).improvement.eligible,false);
});
test('benchmarks cannot be multiplied through new labels, repeated attempts or protocol changes',()=>{
  const base=day(strength());
  assert.equal(score({...base,benchmarks:[benchmark,benchmark,benchmark]}).improvementScore,score(base).improvementScore);
  assert.equal(score({...base,benchmarks:[{...benchmark,protocol:'other'}]}).improvement.eligible,false);
  assert.equal(score({...base,benchmarks:[{...benchmark,unit:'kg'}]}).improvement.eligible,false);
});
test('missing weak benchmark cannot silently improve overall rank',()=>{
  const r=score(day(strength(),{benchmarkSlots:['squat','missing']}));
  assert.equal(r.improvement.eligible,false);assert.equal(r.overallScore,null);assert.equal(r.improvementScore,50);
});
test('median history resists one deliberately low baseline; small gains receive partial points',()=>{
  const h=history.map((e,i)=>({...e,value:i===0?1:10}));
  const r=score(day(strength(),{history:h,benchmarks:[{...benchmark,value:10.5}]}));
  assert.equal(r.improvementScore,50); assert.equal(r.improvement.evidence[0].baseline,10);
});
test('lower-is-better protocol works and improvement does not exceed its budget',()=>{
  const h=history.map(e=>({...e,direction:'lower',unit:'seconds',value:100}));
  const r=score(day(strength(),{history:h,benchmarks:[{...benchmark,direction:'lower',unit:'seconds',value:50}]}));
  assert.equal(r.improvementXp,100);assert.ok(r.earnedXp<=250);
});
test('recovery supports consistency while avoiding high-intensity activity points',()=>{
  const r=score(day([{id:'rest',purpose:'recovery',completed:true,requirementKey:'rest'}],{requirements:[{key:'rest',target:1}],benchmarkSlots:[]}));
  assert.equal(r.consistencyScore,100);assert.equal(r.activityScore,0);assert.equal(r.earnedXp,20);
});
test('activity returns diminish and caps protect XP without limiting data collection',()=>{
  const scores=[10,20,30,40,60,120].map(minutes=>score(day(strength(1,144,minutes))));
  assert.ok(scores[3].activityScore-scores[2].activityScore<scores[2].activityScore-scores[1].activityScore);
  assert.equal(scores[4].activityScore,scores[5].activityScore);
  for(const r of scores)assert.ok(r.activityXp<=150&&r.improvementXp<=100&&r.earnedXp<=250);
});
test('invalid, negative, infinite and unknown activity values produce visible errors',()=>{
  for(const event of [{id:'a',purpose:'strength',minutes:-1},{id:'a',purpose:'strength',minutes:Infinity},{id:'a',purpose:'mystery',minutes:10},{purpose:'strength',minutes:10}])assert.equal(evaluateDay(day([event])).valid,false);
});
test('weekly consistency uses frozen schedule, including absent logged days',()=>{
  const frozenRequirements={'2026-10-19':[{key:'strength',target:144}],'2026-10-20':[{key:'strength',target:144}]};
  const a=evaluateWeek([day(strength())],{weekStart:date,frozenRequirements});
  assert.equal(a.consistency,50);
  const b=evaluateWeek([day(strength(),{requirements:[]})],{weekStart:date,frozenRequirements});
  assert.equal(a.consistency,b.consistency);
  assert.throws(()=>evaluateWeek([day(strength()),day(strength())],{weekStart:date,frozenRequirements}));
});
test('schedule changes require an approved amendment and cannot manufacture completion by deleting everything',()=>{
  const requirements=[{key:'strength',target:144},{key:'run',target:20}];
  assert.equal(score(day(strength(),{requirements,amendment:{approved:false,excludedKeys:['run']}})).completion.complete,false);
  assert.equal(score(day(strength(),{requirements,amendment:{approved:true,excludedKeys:['run']}})).completion.complete,true);
  assert.equal(score(day(strength(),{requirements,amendment:{approved:true,excludedKeys:['strength','run']}})).completion.eligible,false);
});
test('historical scores are delegated unchanged and no rollout date is guessed',()=>{
  const old={xp:999,avatarUnlocked:true};
  assert.equal(evaluateVersionedDay(day(strength(),{date:'2026-10-12'}),{activationDate:date,legacyScore:()=>old}),old);
  assert.throws(()=>evaluateVersionedDay(day(strength())));
  assert.equal(evaluateVersionedDay(day(strength()),{activationDate:date}).version,'fairness-lab-1');
});

test('new XP improvement rewards require a fresh result, rather than repeated claims of yesterday’s performance',()=>{
  const rewardedBenchmarks=[{...benchmark,value:11}];
  const old=score(day(strength(),{rewardedBenchmarks}));
  assert.equal(old.improvementScore,100);assert.equal(old.improvementXp,0);
  assert.equal(score(day(strength(),{rewardedBenchmarks,benchmarks:[{...benchmark,value:11.01}]})).improvementXp,0);
  const fresh=score(day(strength(),{rewardedBenchmarks,benchmarks:[{...benchmark,value:11.2}]}));
  assert.equal(fresh.improvementXp,100);
});

test('native strength and Session sets map to the same recorded-time score',()=>{
  const sets=Array.from({length:4},()=>({reps:12,weight:5}));
  const standard={blocks:[{id:'standard',typeId:'strength',sets:{squat:sets,press:sets,row:sets}}]};
  const structured={blocks:[{id:'session',typeId:'session',session:{completed:true,actualDurationSec:1200,movements:['squat','press','row'].map(id=>({id,completed:true,trackingMethod:'sets_reps',result:{overall:{sets}}}))}}]};
  const a=adaptLog(standard,date,{recordedMinutes:{standard:20}});
  const b=adaptLog(structured,date,{classifications:{session:'strength'}});
  assert.deepEqual(comparable(score(a)),comparable(score(b)));
});

test('native mobility classification is explicit and names never determine points',()=>{
  const log={blocks:[{id:'mobility',typeId:'strength',label:'Heavy squats',sets:{a:[{timeSeconds:60}],b:[{timeSeconds:60}]}}]};
  const options={classifications:{mobility:'mobility'},recordedMinutes:{mobility:8}};
  const a=adaptLog(log,date,options),b=adaptLog({blocks:[{id:'duration',typeId:'duration',duration:{minutes:8}}]},date);
  assert.deepEqual(comparable(score(a)),comparable(score(b)));
  assert.equal(a.events[0].purpose,'mobility');
});

test('native estimated time and completed Sessions with missing duration remain provisional',()=>{
  const strengthLog={blocks:[{id:'strength',typeId:'strength',sets:{a:[{reps:12}]}}]};
  const adapted=adaptLog(strengthLog,date);
  assert.equal(adapted.warnings.length,1);assert.equal(score(adapted).provisional,true);
  const session=adaptLog({blocks:[{id:'session',typeId:'session',session:{completed:true}}]},date);
  assert.equal(session.warnings.length,1);assert.equal(score(session).competitionEligible,false);
});

test('native duplicate block IDs with conflicting work are not silently added',()=>{
  const native={blocks:[{id:'a',typeId:'duration',duration:{minutes:8}},{id:'a',typeId:'duration',duration:{minutes:10}}]};
  assert.equal(evaluateDay(adaptLog(native,date)).valid,false);
});

test('weekly benchmark score does not rise just because a benchmark is repeated on more days',()=>{
  const opts={weekStart:date,frozenRequirements:{}};
  const first=day(strength()), second=day(strength(),{date:'2026-10-20'});
  const a=evaluateWeek([first],opts),b=evaluateWeek([first,second],opts);
  assert.equal(a.improvement,b.improvement);
});


test('overlapping timer events and impossible daily duration are rejected',()=>{
  const overlap=[{id:'a',purpose:'strength',minutes:20,start:'2026-10-19T10:00:00Z',end:'2026-10-19T10:20:00Z'}, {id:'b',purpose:'cardio',minutes:20,start:'2026-10-19T10:10:00Z',end:'2026-10-19T10:30:00Z'}];
  assert.equal(evaluateDay(day(overlap)).valid,false);
  assert.equal(evaluateDay(day([{id:'a',purpose:'cardio',minutes:1000},{id:'b',purpose:'mobility',minutes:1000}])).valid,false);
});
