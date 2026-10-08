import { expect, it, vi } from "vitest";
import { claimMasterySequence } from "./masteryClaimSequence.js";
const rewards=[{key:"bronze",xp:20},{key:"silver",xp:30},{key:"gold",xp:45}];
it("claims only unsaved earned tiers in order",async()=>{
  const claims=new Set(["bronze"]); const claimOne=vi.fn(async key=>{claims.add(key);return true;});
  const result=await claimMasterySequence({rewards,claimOne,isClaimed:key=>claims.has(key),isCurrentProfile:()=>true});
  expect(claimOne.mock.calls.map(([key])=>key)).toEqual(["silver","gold"]);
  expect(result).toEqual({complete:true,claimed:rewards.slice(1)});
});
it("stops at a failure and retries without reclaiming earlier saved rewards",async()=>{
  const claims=new Set(); let fail=true; const claimOne=vi.fn(async key=>{if(key==="silver" && fail)return false;claims.add(key);return true;});
  const input={rewards,claimOne,isClaimed:key=>claims.has(key),isCurrentProfile:()=>true};
  expect((await claimMasterySequence(input)).complete).toBe(false); expect(claims.has("gold")).toBe(false);
  fail=false; const result=await claimMasterySequence(input); expect(result.claimed.map(r=>r.key)).toEqual(["silver","gold"]);
});
it("stops on a profile switch and does not claim the next profile's reward",async()=>{
  let current=true; const claimOne=vi.fn(async()=>{current=false;return true;});
  const result=await claimMasterySequence({rewards,claimOne,isClaimed:()=>false,isCurrentProfile:()=>current});
  expect(claimOne).toHaveBeenCalledTimes(1); expect(result.complete).toBe(false);
});
