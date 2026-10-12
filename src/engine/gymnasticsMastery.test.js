import { describe, expect, it } from "vitest";
import { buildBadgeStatsV2 } from "./badgeStatsV2.js";
import { hasSportAvatarArtwork } from "../config/sportAvatarArtwork.js";
import { SPORT_MASTERY_PACKS } from "../config/badges.js";
import { resolveAvatarIdentity } from "../config/avatarIdentity.js";
import { getRewardXpForKey } from "./xpEngine.js";
const row=(date,blocks)=>({date_ymd:date,log:{blocks,meta:{}}});
const gymnastics=(extra={})=>({typeId:"duration",activityName:"Gymnastics practice",duration:{minutes:30},...extra});
const stats=allLogs=>buildBadgeStatsV2({allLogs,todayYmd:"2026-10-12",isAdult:true}).sportMastery;
describe("Gymnastics mastery release",()=>{
  it("counts explicit Gymnastics and Gymnastics training once per day across blocks and duplicate rows",()=>{
    const result=stats([row("2026-10-10",[gymnastics(),gymnastics()]),row("2026-10-10",[gymnastics()]),row("2026-10-11",[gymnastics({typeId:"cardio",activityName:"Gymnastics training",cardio:{durationMin:20}})]),row("2026-10-12",[gymnastics()])]);
    expect(result.gymnastics).toEqual({sessions:3,days:3,lastDate:"2026-10-12"});
  });
  it("ignores unrelated words containing fragments of Gymnastics",()=>{
    expect(stats([row("2026-10-10",[gymnastics({activityName:"Gym workout"})]),row("2026-10-11",[gymnastics({activityName:"Gymnastical storytelling"})]),row("2026-10-12",[gymnastics({activityName:"Ungymnastics vocabulary"})])]).gymnastics.sessions).toBe(0);
  });
  it("excludes empty, cancelled, recovery-suspended and future practice",()=>{
    expect(stats([row("2026-10-10",[gymnastics({duration:{}}),gymnastics({cancelled:true}),gymnastics({suspendedByRecoveryMode:true})]),row("2026-10-13",[gymnastics()])]).gymnastics.sessions).toBe(0);
  });
  it("preserves existing named sport and native cardio/strength precedence",()=>{
    const result=stats([row("2026-10-10",[gymnastics({activityName:"Football gymnastics warmup"}),gymnastics({activityName:"Dance gymnastics warmup"})]),row("2026-10-11",[{typeId:"run",activityName:"Gymnastics",cardio:{durationMin:20}},{typeId:"bike",activityName:"Gymnastics",cardio:{durationMin:20}}]),row("2026-10-12",[{typeId:"swim",activityName:"Gymnastics",cardio:{durationMin:20}},{typeId:"strength",activityName:"Gymnastics",sets:{squat:[{reps:10,weightKg:20}]}}])]);
    expect(result.gymnastics.sessions).toBe(0);
    for(const key of ["football","dance","running","cycling","swimming","strength_training"])expect(result[key].sessions).toBe(1);
  });
  it("requires performed activity in structured gymnastics sessions",()=>{
    const session=extra=>({typeId:"session",session:{name:"Gymnastics",movements:[],plannedDurationSec:1800,completed:false,...extra}});
    expect(stats([row("2026-10-10",[session({})]),row("2026-10-11",[session({completed:true,actualDurationSec:1200})])]).gymnastics.sessions).toBe(1);
  });
  it("shares eight logical unlocks, stories and rewards across appearances",()=>{
    expect(hasSportAvatarArtwork("gymnastics")).toBe(true);expect(SPORT_MASTERY_PACKS.gymnastics.label).toBe("Gymnastics");
    const tiers=["bronze","silver","gold","platinum","diamond","elite","champion","unreal"],identities=tiers.map(t=>resolveAvatarIdentity(`sport_avatar_gymnastics_${t}`));
    expect(identities.map(x=>x.unlockSource.requirement.sessions)).toEqual([40,80,120,160,200,240,280,320]);
    expect(tiers.map(t=>getRewardXpForKey(`sport_avatar_gymnastics_${t}`))).toEqual([25,35,50,70,95,125,160,200]);
    expect(Array.from({length:9},(_,i)=>getRewardXpForKey(`badge_sport_gymnastics_mastery_${i+1}`))).toEqual([20,30,45,65,90,110,130,160,200]);
    expect(new Set(identities.map(x=>x.story)).size).toBe(8);
    for(const identity of identities){expect(identity.story.split(/\s+/).length).toBeGreaterThanOrEqual(30);expect(identity.story.split(/\s+/).length).toBeLessThanOrEqual(70);expect(resolveAvatarIdentity(identity.id,{edition:"paired_v2",variant:"female"}).unlockSource).toEqual(identity.unlockSource);}
  });
});
