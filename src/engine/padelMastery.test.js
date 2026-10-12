import { describe, expect, it } from "vitest";
import { buildBadgeStatsV2 } from "./badgeStatsV2.js";
import { hasSportAvatarArtwork } from "../config/sportAvatarArtwork.js";
import { SPORT_MASTERY_PACKS } from "../config/badges.js";
import { resolveAvatarIdentity } from "../config/avatarIdentity.js";
import { getRewardXpForKey } from "./xpEngine.js";
const row=(date,blocks)=>({date_ymd:date,log:{blocks,meta:{}}});
const padel=(extra={})=>({typeId:"duration",activityName:"Padel practice",duration:{minutes:30},...extra});
const stats=allLogs=>buildBadgeStatsV2({allLogs,todayYmd:"2026-10-12",isAdult:true}).sportMastery;
describe("Padel mastery release",()=>{
  it("counts explicit Padel and Padel training once per day across blocks and duplicate rows",()=>{
    const result=stats([row("2026-10-10",[padel(),padel()]),row("2026-10-10",[padel()]),row("2026-10-11",[padel({typeId:"cardio",activityName:"Padel training",cardio:{durationMin:20}})]),row("2026-10-12",[padel()])]);
    expect(result.padel).toEqual({sessions:3,days:3,lastDate:"2026-10-12"});
  });
  it("ignores unrelated words containing fragments of Padel",()=>{
    expect(stats([row("2026-10-10",[padel({activityName:"Paddling"})]),row("2026-10-11",[padel({activityName:"Padelistic storytelling"})]),row("2026-10-12",[padel({activityName:"Unpadel vocabulary"})])]).padel.sessions).toBe(0);
  });
  it("excludes empty, cancelled, recovery-suspended and future practice",()=>{
    expect(stats([row("2026-10-10",[padel({duration:{}}),padel({cancelled:true}),padel({suspendedByRecoveryMode:true})]),row("2026-10-13",[padel()])]).padel.sessions).toBe(0);
  });
  it("preserves existing named sport and native cardio/strength precedence",()=>{
    const result=stats([row("2026-10-10",[padel({activityName:"Tennis padel warmup"}),padel({activityName:"Dance padel warmup"})]),row("2026-10-11",[{typeId:"run",activityName:"Padel",cardio:{durationMin:20}},{typeId:"bike",activityName:"Padel",cardio:{durationMin:20}}]),row("2026-10-12",[{typeId:"swim",activityName:"Padel",cardio:{durationMin:20}},{typeId:"strength",activityName:"Padel",sets:{squat:[{reps:10,weightKg:20}]}}])]);
    expect(result.padel.sessions).toBe(0);
    for(const key of ["tennis","dance","running","cycling","swimming","strength_training"])expect(result[key].sessions).toBe(1);
  });
  it("requires performed activity in structured padel sessions",()=>{
    const session=extra=>({typeId:"session",session:{name:"Padel",movements:[],plannedDurationSec:1800,completed:false,...extra}});
    expect(stats([row("2026-10-10",[session({})]),row("2026-10-11",[session({completed:true,actualDurationSec:1200})])]).padel.sessions).toBe(1);
  });
  it("shares eight logical unlocks, stories and rewards across appearances",()=>{
    expect(hasSportAvatarArtwork("padel")).toBe(true);expect(SPORT_MASTERY_PACKS.padel.label).toBe("Padel");
    const tiers=["bronze","silver","gold","platinum","diamond","elite","champion","unreal"],identities=tiers.map(t=>resolveAvatarIdentity(`sport_avatar_padel_${t}`));
    expect(identities.map(x=>x.unlockSource.requirement.sessions)).toEqual([40,80,120,160,200,240,280,320]);
    expect(tiers.map(t=>getRewardXpForKey(`sport_avatar_padel_${t}`))).toEqual([25,35,50,70,95,125,160,200]);
    expect(Array.from({length:9},(_,i)=>getRewardXpForKey(`badge_sport_padel_mastery_${i+1}`))).toEqual([20,30,45,65,90,110,130,160,200]);
    expect(new Set(identities.map(x=>x.story)).size).toBe(8);
    for(const identity of identities){expect(identity.story.split(/\s+/).length).toBeGreaterThanOrEqual(30);expect(identity.story.split(/\s+/).length).toBeLessThanOrEqual(70);expect(resolveAvatarIdentity(identity.id,{edition:"paired_v2",variant:"female"}).unlockSource).toEqual(identity.unlockSource);}
  });
});
