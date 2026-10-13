import { describe, expect, it } from 'vitest';
import { buildPersonalBestBadgeStats } from './personalBestBadgeEngine.js';
import { buildBadgeStatsV2 } from './badgeStatsV2.js';
import { BADGE_CARDS } from '../config/badges.js';
import { performanceBadgeState } from './performanceBadgeProgression.js';
const strength = (sets, options={}) => ({typeId:'strength',movements:[{id:'squat',...options}],sets:{squat:sets}});
const row = (day, block) => ({date_ymd:`2026-10-${String(day).padStart(2,'0')}`,log:{blocks:[block]}});
const reps = (day, value=30) => row(day,strength([{reps:value}]));
const weighted = (day,weight=20,reps=10) => row(day,strength([{weight,reps}]));
const cardio = (day,minutes=30,km=5,sport='run') => row(day,{typeId:'cardio',cardio:{sport,distanceKm:km,durationMin:minutes}});
const count = logs => buildPersonalBestBadgeStats(logs,'2026-10-31').personalBestDays;
describe('established personal best days',()=>{
 it('requires three earlier distinct dates, counts new records, and ignores ties',()=>{
  expect(count([reps(1),reps(2,31),reps(3,32)])).toBe(0);
  expect(count([reps(1),reps(2),reps(3),reps(4,31),reps(5,31),reps(6,32)])).toBe(2);
 });
 it('is chronological regardless of input order and counts several PBs once per date',()=>{
  const logs=[1,2,3].flatMap(d=>[reps(d),cardio(d)]).concat(reps(4,31),cardio(4,29));
  expect(buildPersonalBestBadgeStats(logs.reverse()).personalBestDates).toEqual(['2026-10-04']);
 });
 it('does not use duplicate rows, extra sets or same-day attempts as baseline dates',()=>{
  expect(count([reps(1),reps(1),reps(1),reps(2,31)])).toBe(0);
  expect(count([reps(1),reps(2),reps(3),row(4,strength(Array(20).fill({reps:30})))])).toBe(0);
 });
 it('rewards either more reps or more load, and both when comparable',()=>{
  const baseline=[weighted(1),weighted(2),weighted(3)];
  for(const set of [[20,11],[21,10],[21,11]]) expect(count([...baseline,weighted(4,...set)])).toBe(1);
  expect(count([...baseline,weighted(4,40,5)])).toBe(0);
 });
 it('uses actual paired sets and preserves all-time records',()=>{
  const baseline=[1,2,3].map(d=>row(d,strength([{weight:100,reps:5},{weight:50,reps:15}])));
  expect(count([...baseline,weighted(4,60,10)])).toBe(0);
  expect(count([...baseline,weighted(4,101,5),weighted(5,101,5),weighted(6,100,5)])).toBe(1);
 });
 it('compares cardio at the same sport and exact distance, including small PBs',()=>{
  const baseline=[cardio(1),cardio(2),cardio(3)];
  expect(count([...baseline,cardio(4,30-1/60)])).toBe(1);
  expect(count([...baseline,cardio(4,29,4.99)])).toBe(0);
  expect(count([...baseline,cardio(4,29,5,'swim')])).toBe(0);
 });
 it('keeps movement identity, protocol and units separate',()=>{
  const baseline=[weighted(1),weighted(2),weighted(3)];
  for(const options of [{performanceKey:'other'},{protocolId:'different'},{weightUnit:'lb'}])
   expect(count([...baseline,row(4,strength([{weight:21,reps:10}],options))])).toBe(0);
 });
 it('excludes warmups, track-only, cancelled, suspended and future entries',()=>{
  const baseline=[reps(1),reps(2),reps(3)];
  for(const flags of [{cancelled:true},{suspendedByRecoveryMode:true},{activityPurpose:'warmup'},{progressionRewards:false}])
   expect(count([...baseline,row(4,{...strength([{reps:31}]),...flags})])).toBe(0);
  expect(count([...baseline,row(4,strength([{reps:31}],{activityPurpose:'warmup'}))])).toBe(0);
  expect(buildPersonalBestBadgeStats([...baseline,reps(4,31)],'2026-10-03').personalBestDays).toBe(0);
 });
 it('counts longer unweighted holds and excludes general duration/session flags',()=>{
  expect(count([1,2,3,4].map(d=>row(d,strength([{timeSeconds:d===4?61:60}]))))).toBe(1);
  expect(count([1,2,3,4].map(d=>row(d,{typeId:'duration',durationMin:d*10,completed:true})))).toBe(0);
 });
 it('feeds the actual badge stats and unlocks Bronze only after the first established PB',()=>{
  const stats=buildBadgeStatsV2({allLogs:[reps(1),reps(2),reps(3),reps(4,31)],todayYmd:'2026-10-04',isAdult:true});
  expect(stats.intelligence.personalBestDays).toBe(1);
  const card=BADGE_CARDS.find(c=>c.id==='personal_bests');
  expect(performanceBadgeState(card,stats.intelligence.personalBestDays).currentTier.tier).toBe('bronze');
 });
});
