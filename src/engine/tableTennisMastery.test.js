import { describe, expect, it } from "vitest";
import { buildBadgeStatsV2, TABLE_TENNIS_MASTERY_START_YMD } from "./badgeStatsV2.js";
import { hasSportAvatarArtwork } from "../config/sportAvatarArtwork.js";
import { SPORT_MASTERY_PACKS } from "../config/badges.js";
import { resolveAvatarIdentity } from "../config/avatarIdentity.js";
import { getRewardXpForKey } from "./xpEngine.js";
const row=(date,blocks)=>({date_ymd:date,log:{blocks,meta:{}}});
const practice=(extra={})=>({typeId:"duration",activityName:"Table Tennis practice",duration:{minutes:30},...extra});
const stats=allLogs=>buildBadgeStatsV2({allLogs,todayYmd:"2026-10-15",isAdult:true}).sportMastery;
describe("Table Tennis mastery release",()=>{
 it("counts Table Tennis and Ping Pong once per day across duplicate blocks and rows",()=>{
  const r=stats([row("2026-10-13",[practice(),practice()]),row("2026-10-13",[practice()]),row("2026-10-14",[practice({activityName:"Ping-pong practice"})]),row("2026-10-15",[practice({activityName:"TableTennis",typeId:"cardio",cardio:{durationMin:20}})])]);
  expect(r.table_tennis).toEqual({sessions:3,days:3,lastDate:"2026-10-15"});expect(r.tennis.sessions).toBe(0);
 });
 it("preserves historic Tennis attribution and only starts the new collection at cutover",()=>{
  expect(TABLE_TENNIS_MASTERY_START_YMD).toBe("2026-10-13");const r=stats([row("2026-10-12",[practice(),practice({activityName:"Ping Pong"})]),row("2026-10-13",[practice(),practice({activityName:"PingPong"})]),row("2026-10-14",[practice({activityName:"Tennis"})])]);
  expect(r.tennis.sessions).toBe(2);expect(r.table_tennis.sessions).toBe(1);
 });
 it("does not count unrelated fragments as Table Tennis",()=>{
  expect(stats([row("2026-10-13",[practice({activityName:"Table Tennisball stories"})]),row("2026-10-14",[practice({activityName:"Ping Pongology"})]),row("2026-10-15",[practice({activityName:"UnTableTennis vocabulary"})])]).table_tennis.sessions).toBe(0);
 });
 it("excludes empty cancelled recovery-suspended and future practice",()=>{
  expect(stats([row("2026-10-13",[practice({duration:{}}),practice({cancelled:true}),practice({suspendedByRecoveryMode:true})]),row("2026-10-16",[practice()])]).table_tennis.sessions).toBe(0);
 });
 it("preserves earlier named sport and native cardio/strength precedence",()=>{
  const r=stats([row("2026-10-13",[practice({activityName:"Football Table Tennis warmup"}),practice({activityName:"Tennis"})]),row("2026-10-14",[{typeId:"run",activityName:"Table Tennis",cardio:{durationMin:20}},{typeId:"bike",activityName:"Table Tennis",cardio:{durationMin:20}}]),row("2026-10-15",[{typeId:"swim",activityName:"Table Tennis",cardio:{durationMin:20}},{typeId:"strength",activityName:"Table Tennis",sets:{squat:[{reps:10,weightKg:20}]}}])]);
  expect(r.table_tennis.sessions).toBe(0);for(const key of ["football","tennis","running","cycling","swimming","strength_training"])expect(r[key].sessions).toBe(1);
 });
 it("requires performed activity in structured sessions",()=>{
  const session=extra=>({typeId:"session",session:{name:"Table Tennis",movements:[],plannedDurationSec:1800,completed:false,...extra}});
  expect(stats([row("2026-10-13",[session({})]),row("2026-10-14",[session({completed:true,actualDurationSec:1200})])]).table_tennis.sessions).toBe(1);
 });
 it("shares eight logical unlocks stories and rewards across appearances",()=>{
  expect(hasSportAvatarArtwork("table_tennis")).toBe(true);expect(SPORT_MASTERY_PACKS.table_tennis.label).toBe("Table Tennis");
  const tiers=["bronze","silver","gold","platinum","diamond","elite","champion","unreal"],ids=tiers.map(t=>resolveAvatarIdentity(`sport_avatar_table_tennis_${t}`));
  expect(ids.map(x=>x.unlockSource.requirement.sessions)).toEqual([40,80,120,160,200,240,280,320]);expect(tiers.map(t=>getRewardXpForKey(`sport_avatar_table_tennis_${t}`))).toEqual([25,35,50,70,95,125,160,200]);
  expect(Array.from({length:9},(_,i)=>getRewardXpForKey(`badge_sport_table_tennis_mastery_${i+1}`))).toEqual([20,30,45,65,90,110,130,160,200]);expect(new Set(ids.map(x=>x.story)).size).toBe(8);
  for(const id of ids){expect(id.story.split(/\s+/).length).toBeGreaterThanOrEqual(30);expect(id.story.split(/\s+/).length).toBeLessThanOrEqual(70);expect(resolveAvatarIdentity(id.id,{edition:"paired_v2",variant:"female"}).unlockSource).toEqual(id.unlockSource);}
 });
});
