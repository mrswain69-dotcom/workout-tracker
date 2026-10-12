import { describe, expect, it } from "vitest";
import { buildBadgeStatsV2 } from "./badgeStatsV2.js";
import { hasSportAvatarArtwork } from "../config/sportAvatarArtwork.js";
import { SPORT_MASTERY_PACKS } from "../config/badges.js";
import { resolveAvatarIdentity } from "../config/avatarIdentity.js";
import { getRewardXpForKey } from "./xpEngine.js";
const row=(date,blocks)=>({date_ymd:date,log:{blocks,meta:{}}});
const climbing=(extra={})=>({typeId:"duration",activityName:"Climbing practice",duration:{minutes:30},...extra});
const stats=allLogs=>buildBadgeStatsV2({allLogs,todayYmd:"2026-10-12",isAdult:true}).sportMastery;
describe("Climbing mastery release",()=>{
  it("counts explicit Climbing and Climbing training once per day across blocks and duplicate rows",()=>{
    const result=stats([row("2026-10-10",[climbing(),climbing()]),row("2026-10-10",[climbing()]),row("2026-10-11",[climbing({typeId:"cardio",activityName:"Climbing training",cardio:{durationMin:20}})]),row("2026-10-12",[climbing()])]);
    expect(result.climbing).toEqual({sessions:3,days:3,lastDate:"2026-10-12"});
  });
  it("ignores unrelated words containing fragments of Climbing",()=>{
    expect(stats([row("2026-10-10",[climbing({activityName:"Climb jars"})]),row("2026-10-11",[climbing({activityName:"Climbingish storytelling"})]),row("2026-10-12",[climbing({activityName:"Unclimbing vocabulary"})])]).climbing.sessions).toBe(0);
  });
  it("excludes empty, cancelled, recovery-suspended and future practice",()=>{
    expect(stats([row("2026-10-10",[climbing({duration:{}}),climbing({cancelled:true}),climbing({suspendedByRecoveryMode:true})]),row("2026-10-13",[climbing()])]).climbing.sessions).toBe(0);
  });
  it("preserves existing named sport and native cardio/strength precedence",()=>{
    const result=stats([row("2026-10-10",[climbing({activityName:"Tennis climbing warmup"}),climbing({activityName:"Dance climbing warmup"}),climbing({activityName:"Padel climbing warmup"})]),row("2026-10-11",[{typeId:"run",activityName:"Climbing",cardio:{durationMin:20}},{typeId:"bike",activityName:"Climbing",cardio:{durationMin:20}}]),row("2026-10-12",[{typeId:"swim",activityName:"Climbing",cardio:{durationMin:20}},{typeId:"strength",activityName:"Climbing",sets:{squat:[{reps:10,weightKg:20}]}}])]);
    expect(result.climbing.sessions).toBe(0);
    for(const key of ["tennis","dance","padel","running","cycling","swimming","strength_training"])expect(result[key].sessions).toBe(1);
  });
  it("requires performed activity in structured climbing sessions",()=>{
    const session=extra=>({typeId:"session",session:{name:"Climbing",movements:[],plannedDurationSec:1800,completed:false,...extra}});
    expect(stats([row("2026-10-10",[session({})]),row("2026-10-11",[session({completed:true,actualDurationSec:1200})])]).climbing.sessions).toBe(1);
  });
  it("shares Climbing and Bouldering practice without matching word fragments",()=>{
    const result=stats([row("2026-10-10",[climbing({activityName:"Bouldering"}),climbing()]),row("2026-10-11",[climbing({activityName:"Rock climbing"})]),row("2026-10-12",[climbing({activityName:"Boulderingish vocabulary"}),climbing({activityName:"Unclimbing vocabulary"})])]);
    expect(result.climbing).toEqual({sessions:2,days:2,lastDate:"2026-10-11"});
  });
  it("shares eight logical unlocks, stories and rewards across appearances",()=>{
    expect(hasSportAvatarArtwork("climbing")).toBe(true);expect(SPORT_MASTERY_PACKS.climbing.label).toBe("Climbing");
    const tiers=["bronze","silver","gold","platinum","diamond","elite","champion","unreal"],identities=tiers.map(t=>resolveAvatarIdentity(`sport_avatar_climbing_${t}`));
    expect(identities.map(x=>x.unlockSource.requirement.sessions)).toEqual([40,80,120,160,200,240,280,320]);
    expect(tiers.map(t=>getRewardXpForKey(`sport_avatar_climbing_${t}`))).toEqual([25,35,50,70,95,125,160,200]);
    expect(Array.from({length:9},(_,i)=>getRewardXpForKey(`badge_sport_climbing_mastery_${i+1}`))).toEqual([20,30,45,65,90,110,130,160,200]);
    expect(new Set(identities.map(x=>x.story)).size).toBe(8);
    for(const identity of identities){expect(identity.story.split(/\s+/).length).toBeGreaterThanOrEqual(30);expect(identity.story.split(/\s+/).length).toBeLessThanOrEqual(70);expect(resolveAvatarIdentity(identity.id,{edition:"paired_v2",variant:"female"}).unlockSource).toEqual(identity.unlockSource);}
  });
});
