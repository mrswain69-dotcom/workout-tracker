import { describe, expect, it } from 'vitest';
import { buildMovementPersonalBest } from './movementPersonalBestEngine.js';
const movement={id:'bench',name:'Bench Press',trackWeight:true};
const row=(date,sets,extra={},blockExtra={})=>({date_ymd:date,log:{blocks:[{typeId:'strength',movements:[{...movement,...extra}],sets:{bench:sets},...blockExtra}]}});
const summary=logs=>buildMovementPersonalBest(logs,movement,'2026-10-15');
describe('current movement PB evidence',()=>{
 it('shows an all-time record even when it lies outside the chart range',()=>{
  const result=summary([row('2025-01-01',[{weight:100,reps:5}]),row('2026-10-14',[{weight:50,reps:10}])]);
  expect(result.records[0]).toMatchObject({weight:100,reps:5,date:'2025-01-01'});
  expect(result.records[1]).toMatchObject({weight:50,reps:10,label:'Best reps at your latest load'});
 });
 it('retains actual weight/reps pairs rather than combining independent maxima',()=>{
  const result=summary([row('2026-10-01',[{weight:100,reps:5},{weight:50,reps:30}])]);
  expect(result.records[0]).toMatchObject({weight:100,reps:5});
  expect(result.records.some(r=>r.weight===100&&r.reps===30)).toBe(false);
 });
 it('uses the best reps at the highest load and the earliest date on a tie',()=>{
  const result=summary([row('2026-10-13',[{weight:50,reps:12}]),row('2026-10-01',[{weight:50,reps:10}]),row('2026-10-12',[{weight:50,reps:12}])]);
  expect(result.records).toHaveLength(2);
  expect(result.records[0]).toMatchObject({weight:50,reps:12,date:'2026-10-12'});
  expect(result.records[1]).toMatchObject({kind:'reps',value:12,date:'2026-10-12'});
 });
 it('dates a rep record from its first weighted achievement rather than a later unweighted match',()=>{
  const result=summary([row('2026-06-08',[{reps:20}]),row('2026-03-09',[{weight:25,reps:20}]),row('2026-10-14',[{weight:25,reps:20}])]);
  expect(result.records.find(r=>r.label==='Heaviest set')).toMatchObject({weight:25,reps:20,date:'2026-03-09'});
  expect(result.records.find(r=>r.label==='Most reps in one set')).toMatchObject({value:20,weight:25,date:'2026-03-09'});
 });
 it('changes a rep record date only for a higher result and retains its first achievement on repeats',()=>{
  const result=summary([row('2026-10-14',[{reps:21}]),row('2026-03-09',[{weight:25,reps:20}]),row('2026-06-08',[{weight:20,reps:21}])]);
  expect(result.records.find(r=>r.kind==='reps')).toMatchObject({value:21,date:'2026-06-08'});
 });
 it('retains the earliest hold record when later dates match it',()=>{
  const result=summary([row('2026-10-14',[{timeSeconds:95}]),row('2026-03-09',[{timeSeconds:95}])]);
  expect(result.records[0]).toMatchObject({kind:'hold',value:95,date:'2026-03-09'});
 });
 it('shows rep and hold records without needing three dates to display the result',()=>{
  const result=summary([row('2026-10-13',[{reps:30},{timeSeconds:95}])]);
  expect(result.records.map(r=>[r.kind,r.value])).toEqual([['reps',30],['hold',95]]);
  expect(result.priorDates).toBe(1);
 });
 it('does not count today, future entries or repeated same-day rows as earlier dates',()=>{
  const result=summary([row('2026-10-13',[{reps:30}]),row('2026-10-13',[{reps:30}]),row('2026-10-15',[{reps:31}]),row('2026-10-16',[{reps:500}])]);
  expect(result.priorDates).toBe(1);expect(result.records[0].value).toBe(31);
 });
 it('isolates movement IDs, protocols, units and record-only/warmup data',()=>{
  const invalid=[row('2026-10-01',[{weight:500,reps:20}],{id:'different'}),row('2026-10-02',[{weight:500,reps:20}],{protocolId:'different'}),row('2026-10-03',[{weight:500,reps:20}],{weightUnit:'lb'}),row('2026-10-04',[{weight:500,reps:20}],{progressionRewards:false}),row('2026-10-05',[{weight:500,reps:20}],{activityPurpose:'warmup'})];
  expect(summary(invalid).records).toEqual([]);
 });
 it('excludes cancelled and suspended results, including an apparent record',()=>{
  const result=summary([row('2026-10-01',[{weight:20,reps:10}]),row('2026-10-02',[{weight:100,reps:10}],{},{cancelled:true}),row('2026-10-03',[{weight:100,reps:10}],{},{suspendedByRecoveryMode:true})]);
  expect(result.records[0].weight).toBe(20);
 });
 it('uses explicit shared performance identity across copied movement IDs',()=>{
  const logs=[row('2026-10-01',[{weight:30,reps:10}],{performanceKey:'press'})];
  expect(buildMovementPersonalBest(logs,{id:'copy',performanceKey:'press'},'2026-10-15').records[0]).toMatchObject({weight:30,reps:10});
 });
 it('supports log_json records, read-only input and an empty history',()=>{
  const item=row('2026-10-01',[{weight:30,reps:10}]);const logs=[{date:'2026-10-01',log_json:item.log}];
  const snapshot=JSON.stringify(logs);expect(summary(logs).records[0].weight).toBe(30);expect(JSON.stringify(logs)).toBe(snapshot);
  expect(summary([])).toMatchObject({records:[],priorDates:0});
 });
 it('explains deliberate record-only tracking rather than presenting a missing PB as a bug',()=>{
  expect(buildMovementPersonalBest([row('2026-10-01',[{reps:30}])],{...movement,progressionRewards:false},'2026-10-15')).toMatchObject({disabled:true,records:[]});
 });
});

import { buildCardioPersonalBest } from './movementPersonalBestEngine.js';
const run=(date,minutes,km=5,sport='run',id='run',extra={})=>({date,log:{blocks:[{typeId:'cardio',id,cardio:{sport,durationMin:minutes,distanceKm:km},...extra}]}});
it('keeps Cardio records tied to the exact sport and distance, across block IDs',()=>{
 const records=[run('2026-10-01',30),run('2026-10-02',29,5,'run','extra-run'),run('2026-10-03',15,3),run('2026-10-04',10,5,'bike')];
 const current={id:'run',typeId:'cardio',cardio:{sport:'run',durationMin:31,distanceKm:5}};
 const result=buildCardioPersonalBest(records,current,'2026-10-15');
 expect(result.records[0]).toMatchObject({value:1740,distanceKm:5,sport:'run',date:'2026-10-02'});
 expect(result.priorDates).toBe(2);
});
it('uses the latest recorded block distance on empty days, excluding cancelled and future runs',()=>{
 const records=[run('2026-10-01',30),run('2026-10-02',29),run('2026-10-03',20,5,'run','run',{cancelled:true}),run('2026-10-16',10)];
 expect(buildCardioPersonalBest(records,{id:'run'},'2026-10-15').records[0].value).toBe(1740);
});
it('does not invent Cardio PBs from duration-only work or unsupported sports',()=>{
 expect(buildCardioPersonalBest([run('2026-10-01',30,0)],{id:'run'},'2026-10-15').records).toEqual([]);
 expect(buildCardioPersonalBest([run('2026-10-01',30,5,'tennis')],{id:'run'},'2026-10-15').records).toEqual([]);
});
it('retains the first Cardio record date when the same time is matched later',()=>{
 const result=buildCardioPersonalBest([run('2026-10-14',29),run('2026-03-09',29),run('2026-02-01',30)],{id:'run'},'2026-10-15');
 expect(result.records[0]).toMatchObject({value:1740,date:'2026-03-09'});
});

it('does not treat old unweighted results as an established weighted baseline',()=>{
 const result=summary([row('2026-10-01',[{reps:30}]),row('2026-10-02',[{reps:30}]),row('2026-10-03',[{reps:30}]),row('2026-10-14',[{weight:50,reps:10}])]);
 expect(result.priorDates).toBe(1);
});
