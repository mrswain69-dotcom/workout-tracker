import { describe, expect, it } from "vitest";
import { buildBadgeStatsV2 } from "./badgeStatsV2.js";
import { hasSportAvatarArtwork } from "../config/sportAvatarArtwork.js";
import { SPORT_MASTERY_PACKS } from "../config/badges.js";
import { resolveAvatarIdentity } from "../config/avatarIdentity.js";
import { getRewardXpForKey } from "./xpEngine.js";
const row=(date,blocks)=>({date_ymd:date,log:{blocks,meta:{}}});
const golf=(extra={})=>({typeId:"duration",activityName:"Golf practice",duration:{minutes:30},...extra});
const stats=allLogs=>buildBadgeStatsV2({allLogs,todayYmd:"2026-10-12",isAdult:true}).sportMastery;
describe("Golf mastery release",()=>{
  it("counts explicit Golf and Golf training once per day across blocks and duplicate rows",()=>{
    const result=stats([row("2026-10-10",[golf(),golf()]),row("2026-10-10",[golf()]),row("2026-10-11",[golf({typeId:"cardio",activityName:"Golf training",cardio:{durationMin:20}})]),row("2026-10-12",[golf()])]);
    expect(result.golf).toEqual({sessions:3,days:3,lastDate:"2026-10-12"});
  });
  it("ignores unrelated words containing fragments of Golf",()=>{
    expect(stats([row("2026-10-10",[golf({activityName:"Pickle jars"})]),row("2026-10-11",[golf({activityName:"Golfistic storytelling"})]),row("2026-10-12",[golf({activityName:"Ungolf vocabulary"})])]).golf.sessions).toBe(0);
  });
  it("excludes empty, cancelled, recovery-suspended and future practice",()=>{
    expect(stats([row("2026-10-10",[golf({duration:{}}),golf({cancelled:true}),golf({suspendedByRecoveryMode:true})]),row("2026-10-13",[golf()])]).golf.sessions).toBe(0);
  });
  it("preserves existing named sport and native cardio/strength precedence",()=>{
    const result=stats([row("2026-10-10",[golf({activityName:"Tennis golf warmup"}),golf({activityName:"Dance golf warmup"}),golf({activityName:"Padel golf warmup"})]),row("2026-10-11",[{typeId:"run",activityName:"Golf",cardio:{durationMin:20}},{typeId:"bike",activityName:"Golf",cardio:{durationMin:20}}]),row("2026-10-12",[{typeId:"swim",activityName:"Golf",cardio:{durationMin:20}},{typeId:"strength",activityName:"Golf",sets:{squat:[{reps:10,weightKg:20}]}}])]);
    expect(result.golf.sessions).toBe(0);
    for(const key of ["tennis","dance","padel","running","cycling","swimming","strength_training"])expect(result[key].sessions).toBe(1);
  });
  it("requires performed activity in structured golf sessions",()=>{
    const session=extra=>({typeId:"session",session:{name:"Golf",movements:[],plannedDurationSec:1800,completed:false,...extra}});
    expect(stats([row("2026-10-10",[session({})]),row("2026-10-11",[session({completed:true,actualDurationSec:1200})])]).golf.sessions).toBe(1);
  });
  it("shares eight logical unlocks, stories and rewards across appearances",()=>{
    expect(hasSportAvatarArtwork("golf")).toBe(true);expect(SPORT_MASTERY_PACKS.golf.label).toBe("Golf");
    const tiers=["bronze","silver","gold","platinum","diamond","elite","champion","unreal"],identities=tiers.map(t=>resolveAvatarIdentity(`sport_avatar_golf_${t}`));
    expect(identities.map(x=>x.unlockSource.requirement.sessions)).toEqual([40,80,120,160,200,240,280,320]);
    expect(tiers.map(t=>getRewardXpForKey(`sport_avatar_golf_${t}`))).toEqual([25,35,50,70,95,125,160,200]);
    expect(Array.from({length:9},(_,i)=>getRewardXpForKey(`badge_sport_golf_mastery_${i+1}`))).toEqual([20,30,45,65,90,110,130,160,200]);
    expect(new Set(identities.map(x=>x.story)).size).toBe(8);
    for(const identity of identities){expect(identity.story.split(/\s+/).length).toBeGreaterThanOrEqual(30);expect(identity.story.split(/\s+/).length).toBeLessThanOrEqual(70);expect(resolveAvatarIdentity(identity.id,{edition:"paired_v2",variant:"female"}).unlockSource).toEqual(identity.unlockSource);}
  });
});
