import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {evaluate} from './candidates.mjs';
import {buildXpDebugRows} from '../../src/engine/xpEngine.js';
const date='2026-10-19', historyDates=['2026-09-28','2026-10-05','2026-10-12'];
function strength(movements=3,setsPerMovement=4,blocks=1,reps=12) {
  const b=Array.from({length:blocks},(_,i)=>({id:`b${i}`,typeId:'strength',movements:[],sets:{}}));
  for(let i=0;i<movements;i++){const block=b[i%blocks],id=`m${i}`;block.movements.push({id,sets:setsPerMovement});block.sets[id]=Array.from({length:setsPerMovement},()=>({reps,weight:5}));}
  return {blocks:b};
}
function timed(type,n,minutes,km=0){return {blocks:Array.from({length:n},(_,i)=>({id:`t${i}`,typeId:type,...(type==='cardio'?{cardioType:'run',cardio:{durationMin:minutes/n,distanceKm:km/n}}:{duration:{minutes:minutes/n}})}))};}
function records(log,prior){return [...(prior?historyDates.map(date_ymd=>({date_ymd,log:prior})):[]),{date_ymd:date,log}];}
function score(log,prior,candidate='weighted'){return evaluate(records(log,prior),{}, {candidate}).find(r=>r.date===date);}
function legacy(log,prior){return buildXpDebugRows(records(log,prior),{}, {todayYmd:'2026-10-20'}).find(r=>r.date===date);}
const matrix=[];
function compare(name,a,b,priorA,priorB){const row={name,current:[legacy(a,priorA).earnedXp,legacy(b,priorB).earnedXp],flat:[score(a,priorA,'flat').earnedXp,score(b,priorB,'flat').earnedXp],weighted:[score(a,priorA).earnedXp,score(b,priorB).earnedXp]};matrix.push(row);return row;}
test('block layout does not change XP',()=>{
  const r=compare('12 sets: one vs three blocks',strength(),strength(3,4,3),strength(3,4,1,10),strength(3,4,3,10));assert.equal(r.weighted[0],r.weighted[1]);
});
test('movement labels do not multiply equal improvement',()=>{
  const r=compare('12 sets: three vs six movement labels',strength(3,4),strength(6,2),strength(3,4,1,10),strength(6,2,1,10));assert.equal(r.weighted[0],r.weighted[1]);
});
test('mobility fractions aggregate before rounding',()=>{
  const r=compare('20 mobility minutes: one vs twenty blocks',timed('duration',1,20),timed('duration',20,20));assert.equal(r.weighted[0],r.weighted[1]);
});
test('cardio fractions aggregate before rounding',()=>{
  const r=compare('3km / 30-minute run: one vs ten blocks',timed('cardio',1,30,3),timed('cardio',10,30,3));assert.equal(r.weighted[0],r.weighted[1]);
});
test('classified strength Session uses the same set scoring',()=>{
  const ordinary=strength(),session={blocks:[{id:'s',typeId:'session',activityPurpose:'strength',session:{completed:true,movements:ordinary.blocks[0].movements.map(m=>({...m,completed:true,result:{overall:{sets:ordinary.blocks[0].sets[m.id]}}}))}}]};
  const r=compare('12 strength sets: standard vs classified Session',ordinary,session);assert.equal(r.weighted[0],r.weighted[1]);
});
test('timed mobility strength matches duration',()=>{
  const mobility={blocks:[{id:'mob',typeId:'strength',activityPurpose:'mobility',movements:[{id:'stretch',sets:8}],sets:{stretch:Array.from({length:8},()=>({timeSeconds:60}))}}]};
  const r=compare('8 mobility minutes: strength format vs duration',mobility,timed('duration',1,8));assert.equal(r.weighted[0],r.weighted[1]);
});
test('more real sets receive more base and improvement XP',()=>{
  const r=compare('6 vs 24 sets, both improving 20%',strength(3,2),strength(3,8),strength(3,2,1,10),strength(3,8,1,10));assert.ok(r.weighted[1]>r.weighted[0]);
  const small=score(strength(3,2),strength(3,2,1,10)),large=score(strength(3,8),strength(3,8,1,10));assert.ok(large.improvementXp>small.improvementXp);
});
test('weighted improvement distinguishes minor and substantial gain',()=>{
  const r=compare('12 sets, 2% vs 20% improvement',strength(3,4,1,10.2),strength(3,4,1,12),strength(3,4,1,10),strength(3,4,1,10));assert.equal(r.flat[0],r.flat[1]);assert.ok(r.weighted[1]>r.weighted[0]);
});
test('adding sets alone is volume, not improved per-set performance',()=>{
  const r=score(strength(3,8,1,10),strength(3,4,1,10));assert.equal(r.improvementXp,0);
});
test('incomplete required sets never get day-complete bonus',()=>{
  const log=strength();log.blocks[0].sets.m1=[];const r=score(log);assert.equal(r.dayCompleteXp,0);assert.equal(r.complete,false);
});
test('same incomplete work is independent of block layout',()=>{
  const one=strength(),split=strength(3,4,3);for(const log of [one,split])for(const b of log.blocks)for(const key of Object.keys(b.sets))if(key!=='m0')b.sets[key]=[];
  const r=compare('Only one of three required movements logged: one vs three blocks',one,split);assert.equal(r.weighted[0],r.weighted[1]);
});
test('tiny run does not boost whole walk reward',()=>{
  const walk=timed('cardio',1,30,3);walk.blocks[0].cardioType='walk';const mixed={blocks:[...walk.blocks,...timed('cardio',1,.1,.01).blocks.map(b=>({...b,id:'run'}))]};assert.ok(score(mixed).earnedXp-score(walk).earnedXp<=1);
});
test('new names have no improvement until sufficient comparable history',()=>{
  const prior=strength(),log=strength();log.blocks[0].movements.forEach(m=>m.performanceKey='new');assert.equal(score(log,prior).improvementXp,0);
});
test('duplicate stable set IDs earn base XP once',()=>{
  const log=strength(1,1);log.blocks[0].sets.m0[0].id='set1';const copy=structuredClone(log.blocks[0]);copy.id='copy';assert.equal(score({blocks:[...log.blocks,copy]}).strengthXp,score(log).strengthXp);
});
test('cancelled retained data receives no XP without performance evidence',()=>{
  const log=strength();log.blocks[0].cancelled=true;assert.equal(score(log).earnedXp,0);log.blocks[0].performedBeforeCancellation=true;assert.ok(score(log).strengthXp>0);assert.equal(score(log).dayCompleteXp,0);
});
test('streaks use corrected completion for future dates',()=>{
  const partial=strength();partial.blocks[0].sets.m1=[];const r=evaluate([{date_ymd:'2026-10-19',log:partial},{date_ymd:'2026-10-20',log:strength()}],{}, {todayYmd:'2026-10-20'}).find(r=>r.date==='2026-10-20');assert.equal(r.streakXp,0);
});
test('physio and illness preserve their recovery award',()=>{
  for(const mode of ['injury','illness']){const r=score({meta:{profileRecoveryMode:mode},blocks:[{id:'r',typeId:'recovery',isProfileRecoveryBlock:true,profileRecoveryMode:mode,recoveryDone:true,duration:{minutes:8}}]});assert.equal(r.recoveryXp,mode==='injury'?10:5);}
});
test('earned XP obeys 150 + 100 cap while cosmetic XP stays separate',()=>{
  const r=score(strength(20,20),strength(20,20,1,10));assert.equal(r.activityXp,150);assert.equal(r.improvementXp,100);assert.equal(r.earnedXp,250);assert.equal(r.competitionXp,r.earnedXp);
});
test('historical full rows remain byte-equivalent to original scoring',()=>{
  const data=historyDates.map(date_ymd=>({date_ymd,log:strength(6,2,6)}));assert.deepEqual(evaluate(data),buildXpDebugRows(data,{}, {todayYmd:'2026-10-20'}));
});
test('unmeasured Session is explicitly a compatibility award, not claimed equivalent effort',()=>{
  const r=score({blocks:[{id:'s',typeId:'session',session:{completed:true}}]});assert.equal(r.sessionXp,10);assert.ok(r.warnings.length);
});
test('120 comparable movements across all partition divisors remain equal',()=>{
  const expected=score(strength(120,1),strength(120,1,1,10)).earnedXp;
  for(const count of [1,2,3,4,5,6,8,10,12,15,20,24,30,40,60,120])assert.equal(score(strength(120,1,count),strength(120,1,count,10)).earnedXp,expected);
});
test('repeating yesterday’s performance does not earn improvement again',()=>{
  const data=[...records(strength(3,4,1,12),strength(3,4,1,10)),{date_ymd:'2026-10-20',log:strength(3,4,1,12)}];
  const result=evaluate(data).find(r=>r.date==='2026-10-20');assert.equal(result.improvementXp,0);
});
test('record ordering does not alter baseline selection or scores',()=>{
  const data=records(strength(),strength(3,4,1,10));assert.deepEqual(evaluate(data),evaluate([...data].reverse()));
});
test('write reproducible comparison results',()=>{
  fs.writeFileSync(new URL('./results.json',import.meta.url),JSON.stringify({tests:24,baseCommit:'b0b9ab9018b40df33dd39adbc1b50fb1253ff043',activationDate:'2026-10-19 (fixture only)',matrix},null,2));
});
