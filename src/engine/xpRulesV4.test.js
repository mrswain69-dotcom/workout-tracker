import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { buildXpDebugRows, computeXpFromLogs, XP_ENGINE_SCORE_VERSION } from './xpEngine.js';
import { XP_RULES_ACTIVATION_DATE } from './xpRuleVersions.js';
import { revisedActivityXp, revisedPhysicalXpAllocations } from './xpActivityRules.js';
import { BADGE_CARDS } from '../config/badges.js';
import { performanceBadgeState } from './performanceBadgeProgression.js';
const strength = (reps=10,weight=0,id='press',count=1,extra={}) => ({id:`s-${id}`,typeId:'strength',movements:[{id,name:id,...extra}],sets:{[id]:Array.from({length:count},()=>({reps,weight}))}});
const cardio = (minutes=30,km=5,sport='run',id='c') => ({id,typeId:'cardio',cardio:{sport,distanceKm:km,durationMin:minutes}});
const duration = (minutes,id='d') => ({id,typeId:'duration',duration:{minutes}});
const row = (date,blocks,meta={}) => ({date_ymd:date,log:{blocks,meta}});
const score = (records,date='2026-10-14',plan={}) => buildXpDebugRows(records,plan).find(r=>r.date===date);
const before = block => row('2026-10-13',[block]);
const now = blocks => row('2026-10-14',blocks);

describe('dated XP rules v4',()=>{
 it('keeps the activation date and shared score version explicit',()=>{
  expect(XP_RULES_ACTIVATION_DATE).toBe('2026-10-14'); expect(XP_ENGINE_SCORE_VERSION).toBe(4);
 });
 it('preserves old block/progression rules even when an older log is edited later',()=>{
  const records=[row('2026-10-12',[strength(10)]),row('2026-10-13',[strength(11),{...strength(11,0,'other'),id:'extra'}])];
  const old=score(records,'2026-10-13');
  expect(old).toMatchObject({ruleVersion:3,strengthXp:14,strengthProgressXp:10});
  expect(score(records,'2026-10-13').totalXp).toBe(old.totalXp);
 });
 it('pays one Strength category award across all block names',()=>{
  const one=revisedActivityXp({blocks:[strength(10,20,'a',12)]});
  const many=revisedActivityXp({blocks:Array.from({length:12},(_,i)=>strength(10,20,`a${i}`))});
  expect(one.strengthXp).toBe(29); expect(many.strengthXp).toBe(29);
 });
 it('aggregates Duration and Cardio work before rounding and category awards',()=>{
  expect(revisedActivityXp({blocks:[duration(20)]}).durationXp).toBe(9);
  expect(revisedActivityXp({blocks:Array.from({length:20},(_,i)=>duration(1,`d${i}`))}).durationXp).toBe(9);
  expect(revisedActivityXp({blocks:[cardio(30,3)]}).cardioXp).toBe(26);
  expect(revisedActivityXp({blocks:Array.from({length:10},(_,i)=>cardio(3,.3,'run',`c${i}`))}).cardioXp).toBe(26);
 });
 it('discounts walking only, keeping mixed walk/run days independent of block splitting',()=>{
  const mixed=revisedActivityXp({blocks:[cardio(20,2,'walk','walk'),cardio(30,5)]});
  expect(mixed.cardioXp).toBe(38);expect(mixed.cardioMode).toBe('mixed');
  expect(revisedActivityXp({blocks:[cardio(20,2,'walk')]}).cardioXp).toBe(11);
 });
 it('retains ten XP per genuine Session, with one recovery award at the higher rate',()=>{
  const blocks=[{id:'s1',typeId:'session',session:{completed:true}},{id:'s2',typeId:'session',session:{completed:true}},
   {id:'r1',typeId:'recovery',recoveryDone:true},{id:'r2',typeId:'recovery',isProfileRecoveryBlock:true,profileRecoveryMode:'illness',recoveryDone:true},
   {id:'r3',typeId:'recovery',isProfileRecoveryBlock:true,profileRecoveryMode:'injury',duration:{minutes:10}}];
  expect(revisedActivityXp({blocks})).toMatchObject({sessionXp:20,recoveryXp:10});
 });
 it('does not pay for retained cancelled/suspended activity or duplicate block/set IDs',()=>{
  const base=strength(10,0,'a');base.sets.a[0].id='set1';
  const cancelled={...strength(11,0,'cancel'),cancelled:true};
  const suspended={...strength(11,0,'pause'),suspendedByRecoveryMode:true};
  expect(revisedActivityXp({blocks:[base,{...base,id:'copy'},base,cancelled,suspended]}).strengthXp).toBe(7);
 });
 it('scales repetitions relative to the starting count, not number of movement names',()=>{
  expect(score([before(strength(30)),now([strength(31)])]).strengthProgressXp).toBe(1);
  expect(score([before(strength(300)),now([strength(301)])]).strengthProgressXp).toBe(0);
  expect(score([before(strength(30)),now([strength(36)])]).strengthProgressXp).toBe(5);
 });
 it('scales actual weighted pairs, rewards both gains, and applies the fifteen XP cap',()=>{
  expect(score([before(strength(10,20)),now([strength(10,21)])]).strengthProgressXp).toBe(5);
  expect(score([before(strength(10,20)),now([strength(11,20)])]).strengthProgressXp).toBe(10);
  expect(score([before(strength(10,20)),now([strength(11,21)])]).strengthProgressXp).toBe(15);
  expect(score([before(strength(10,20)),now([strength(5,40)])]).strengthProgressXp).toBe(0);
 });
 it('cannot invent a weighted maximum by combining separate sets or dropping a weak set',()=>{
  const old=strength();old.sets.press=[{weight:100,reps:5},{weight:50,reps:15}];
  expect(score([before(old),now([strength(10,60)])]).strengthProgressXp).toBe(0);
  const same=strength();same.sets.press=[{weight:50,reps:15}];
  expect(score([before(old),now([same])]).strengthProgressXp).toBe(0);
 });
 it('does not turn added sets or repeats into improvement XP',()=>{
  expect(score([before(strength(10,20)),now([strength(10,20,'press',20)])]).strengthProgressXp).toBe(0);
 });
 it('uses only the best Strength and Cardio improvements per day',()=>{
  const old=[strength(10,20,'a'),strength(30,0,'b'),cardio(30,5)];
  const current=[strength(11,21,'a'),strength(40,0,'b'),cardio(24,5)];
  const result=score([row('2026-10-13',old),now(current)]);
  expect(result).toMatchObject({strengthProgressXp:15,cardioProgressXp:10,progXp:25,progressionWins:2});
 });
 it('uses percentage time reduction and never compares different distances or sports',()=>{
  expect(score([before(cardio()),now([cardio(29)])]).cardioProgressXp).toBe(3);
  expect(score([before(cardio()),now([cardio(20,4)])]).cardioProgressXp).toBe(0);
  expect(score([before(cardio()),now([cardio(20,5,'swim')])]).cardioProgressXp).toBe(0);
 });
 it('does not mix Duration time into Cardio improvement',()=>{
  expect(score([before(cardio()),now([cardio(),duration(120)])]).cardioProgressXp).toBe(0);
  expect(score([before(duration(20)),now([duration(100)])]).progXp).toBe(0);
 });
 it('supports rep/hold improvement without rewarding explicit warmup or record-only movements',()=>{
  const hold=seconds=>{const block=strength();block.sets.press=[{timeSeconds:seconds}];return block;};
  expect(score([before(hold(60)),now([hold(66)])]).strengthProgressXp).toBe(5);
  const excluded=strength(20,20,'press',1,{progressionRewards:false});
  expect(score([before(strength(10,20)),now([excluded])])).toMatchObject({strengthXp:7,strengthProgressXp:0,personalBestXp:0});
 });
 it('allows a small established PB once per date after three prior comparable dates',()=>{
  const prior=['2026-10-10','2026-10-11','2026-10-12'].flatMap(date=>[row(date,[strength(300),cardio()])]);
  const result=score([...prior,now([strength(301),cardio(30-1/60)])]);
  expect(result).toMatchObject({progXp:0,personalBestXp:15});
  expect(result.earnedXp).toBe(result.nonBonusXp+result.progXp+result.personalBestXp+result.streakXp+result.dailyBonusXp);
 });
 it('does not retroactively award daily PB XP or pay again for an all-time tie',()=>{
  const records=['2026-10-10','2026-10-11','2026-10-12'].map(date=>row(date,[strength(30)]));
  records.push(row('2026-10-13',[strength(31)]),now([strength(31)]));
  expect(score(records,'2026-10-13').personalBestXp).toBe(0);
  expect(score(records).personalBestXp).toBe(0);
 });
 it('keeps badge claims separate from daily PB earned XP and gives a truthful balance',()=>{
  const records=['2026-10-10','2026-10-11','2026-10-12'].map(date=>row(date,[strength(30)]));records.push(now([strength(31)]));
  const plan={meta:{claimedRewards:[{key:'badge_personal_bests_1',claimedAtYmd:'2026-10-14'}]}};
  const result=score(records,'2026-10-14',plan);
  expect(result.bonusXp).toBe(25);expect(result.personalBestXp).toBe(15);
  expect(result.totalXp).toBe(result.earnedXp+25);
  expect(computeXpFromLogs(records,plan)).toBe(buildXpDebugRows(records,plan).reduce((sum,r)=>sum+r.totalXp,0));
 });
 it('does not allow future revised activity to raise the current balance',()=>{
  expect(buildXpDebugRows([now([strength()])],{}, {todayYmd:'2026-10-13'})).toEqual([]);
 });
 it('has full PB tiers and ten Unreal stars with the requested prestige milestones',()=>{
  const card=BADGE_CARDS.find(c=>c.id==='personal_bests');
  expect(card.tiers.map(t=>[t.tier,t.threshold])).toEqual([['bronze',1],['silver',3],['gold',5],['platinum',10],['diamond',25],['pro',50],['champion',100],['elite',150],['unreal',250]]);
  expect(card.starTiers).toHaveLength(10);expect(card.starTiers.at(-1).threshold).toBe(750);
  expect(performanceBadgeState(card,150).currentTier.tier).toBe('elite');
 });
 it('allocates physical verification XP without duplicating category awards',()=>{
  const log={blocks:[strength(10,20,'a'),strength(10,20,'b'),cardio(20,2,'walk','walk'),cardio(),duration(20)]};
  const score=revisedActivityXp(log),alloc=revisedPhysicalXpAllocations(log);
  expect([...alloc.values()].reduce((sum,n)=>sum+n,0)).toBe(score.strengthXp+score.cardioXp+score.durationXp+score.sessionXp);
  expect(alloc.get(0)+alloc.get(1)).toBe(9);
 });
 it('ships identical dated rules and helper engines with both Group scorers',()=>{
  for(const file of ['xpEngine.js','xpActivityRules.js','xpProgressionEngine.js','xpRuleVersions.js','personalBestBadgeEngine.js'])
   for(const directory of ['group-xp-leaderboard','group-seasons-awards'])
    expect(fs.readFileSync(new URL(`../../supabase/functions/${directory}/${file}`,import.meta.url),'utf8')).toBe(fs.readFileSync(new URL(file,import.meta.url),'utf8'));
 });
});

it('does not award a floating-point rounding penny when blocks land exactly on a rate boundary',()=>{
 const blocks=Array.from({length:10},(_,i)=>cardio(.2,.1,'run',`fraction-${i}`));
 expect(revisedActivityXp({blocks}).cardioXp).toBe(8);
});
