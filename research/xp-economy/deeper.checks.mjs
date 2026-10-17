import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluate} from './candidates.mjs';
import fs from 'node:fs';
const date='2026-10-19';
const log=(sets,target=sets.length)=>({blocks:[{id:'b',typeId:'strength',movements:[{id:'m',sets:target}],sets:{m:sets}}]});
const score=(current,prior)=>evaluate([...(prior?['2026-09-28','2026-10-05','2026-10-12'].map(date_ymd=>({date_ymd,log:prior})):[]),{date_ymd:date,log:current}]).find(r=>r.date===date);
const findings=[];
test('exposure: splitting equal repetitions multiplies set XP',()=>{
 const a=score(log([{reps:12,weight:10}])),b=score(log(Array.from({length:12},()=>({reps:1,weight:10}))));
 assert.equal(a.strengthXp,7);assert.equal(b.strengthXp,29);findings.push({issue:'same repetitions split into sets',strengthXp:[a.strengthXp,b.strengthXp]});
});
test('exposure: omitting weaker sets earns improvement on less work',()=>{
 const prior=log([{reps:10,weight:10},{reps:5,weight:10}]);
 const a=score(prior,prior),b=score(log([{reps:10,weight:10}],2),prior);
 assert.equal(a.improvementXp,0);assert.equal(b.improvementXp,2);assert.equal(b.complete,false);
 findings.push({issue:'unchanged best set, weaker set omitted',improvementXp:[a.improvementXp,b.improvementXp]});
});
test('exposure: empty completed Session receives day-complete credit',()=>{
 const r=score({blocks:[{id:'s',typeId:'session',session:{completed:true,movements:[]}}]});
 assert.equal(r.earnedXp,20);findings.push({issue:'empty completed Session',earnedXp:r.earnedXp});
});
test('exposure: filled sets below planned repetition targets count complete',()=>{
 const current=log([{reps:1,weight:10}],1);current.blocks[0].movements[0].reps=12;
 assert.equal(score(current).complete,true);findings.push({issue:'one repetition against twelve-repetition target',complete:true});
});
test('exposure: ancient cardio history qualifies when strength history would expire',()=>{
 const cardio=(minutes)=>({blocks:[{id:'c',typeId:'cardio',cardioType:'run',cardio:{distanceKm:3,durationMin:minutes}}]});
 const rows=['2025-01-01','2025-01-08','2025-01-15'].map(date_ymd=>({date_ymd,log:cardio(30)}));rows.push({date_ymd:date,log:cardio(25)});
 const r=evaluate(rows).find(r=>r.date===date);assert.ok(r.improvementXp>0);findings.push({issue:'cardio baseline older than forty-two days',improvementXp:r.improvementXp});
});
test('exposure: daily cap clips the existing 180-day milestone',()=>{
 const rows=Array.from({length:180},(_,i)=>({date_ymd:new Date(Date.parse(date)-(179-i)*86400000).toISOString().slice(0,10),log:log([{reps:10,weight:10}])}));
 const r=evaluate(rows).find(r=>r.date===date);assert.equal(r.streakXp,600);assert.equal(r.earnedXp,150);assert.equal(r.activityUncapped,617);
 findings.push({issue:'180-day streak milestone',streakXp:r.streakXp,uncapped:r.activityUncapped,earnedXp:r.earnedXp});
});
test('save documented exposures; passing tests demonstrate gaps, not readiness',()=>fs.writeFileSync(new URL('./deeper-results.json',import.meta.url),JSON.stringify({status:'candidate not production ready',exposureChecks:6,findings},null,2)));
