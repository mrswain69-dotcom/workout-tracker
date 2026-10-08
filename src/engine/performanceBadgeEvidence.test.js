import { expect, it } from "vitest";
import { BADGE_CARDS } from "../config/badges.js";
import { buildBadgeStatsV2 } from "./badgeStatsV2.js";
import { performanceBadgeState, performanceStat } from "./performanceBadgeProgression.js";
import { buildPerformanceEvidence, performanceEvidenceForCard } from "./performanceBadgeEvidence.js";
const todayYmd="2026-10-08";
const card=BADGE_CARDS.find(c=>c.id==="run_5k_best_time");
function fixture({manual=false,deleted=false,seconds=1320,linked=true}={}) {
  const logs=[{id:"log-1",date_ymd:todayYmd,log:{blocks:[{id:"run-1",typeId:"cardio",cardioType:"run",cardio:{sport:"run",distanceKm:5,durationMin:22}}],meta:{}}}];
  const data={verifiedActivities:[{id:"v1",status:"active",activity_type:"run",started_at:todayYmd+"T07:00:00Z"}],observations:[{id:"o1",provider:"garmin",activity_type:"run",distance_m:5000,moving_duration_sec:seconds,local_date_ymd:todayYmd,source_manual_entry:manual,source_deleted_at:deleted?todayYmd:null}],observationLinks:[{verified_activity_id:"v1",observation_id:"o1"}],manualLinks:linked?[{verified_activity_id:"v1",manual_log_id:"log-1",manual_block_id:"run-1"}]:[]};
  const stats=buildBadgeStatsV2({allLogs:logs,todayYmd,isAdult:true});
  const state=performanceBadgeState(card,performanceStat(stats,card.statKey));
  return {logs,data,stats,state};
}
function inspect(input) { const evidence=buildPerformanceEvidence({...input,todayYmd,isAdult:true});return performanceEvidenceForCard(card,input.state,evidence,input.stats); }
it("verifies the earned target with matched measured data and returns its log date",()=>{
  const result=inspect(fixture());expect(result.verified).toBe(true);expect(result.entries[0]).toMatchObject({date:todayYmd,verified:true,sources:["garmin"]});
});
it("does not stamp a fast manual claim using slower device data",()=>{
  expect(inspect(fixture({seconds:1800})).verified).toBe(false);
});
it("rejects manual provider entries, deleted observations and unmatched recordings",()=>{
  for(const options of [{manual:true},{deleted:true},{linked:false}])expect(inspect(fixture(options)).verified).toBe(false);
});
it("does not verify strength set/rep/weight metrics from a session recording",()=>{
  const input=fixture();const strength=BADGE_CARDS.find(c=>c.id==="total_sets");
  const evidence=buildPerformanceEvidence({...input,todayYmd,isAdult:true});
  const state=performanceBadgeState(strength,5000);
  const result=performanceEvidenceForCard(strength,state,evidence,input.stats);
  expect(result.verified).toBe(false);expect(result.supportsMeasuredVerification).toBe(false);
});
it("rejects a recording linked to the wrong logged sport or cancelled block",()=>{
  const input=fixture();input.logs[0].log.blocks[0].cardioType="swim";input.logs[0].log.blocks[0].cardio.sport="swim";
  expect(inspect(input).verified).toBe(false);
  input.logs[0].log.blocks[0].cardioType="run";input.logs[0].log.blocks[0].cardio.sport="run";input.logs[0].log.blocks[0].cancelled=true;
  expect(inspect(input).verified).toBe(false);
});
it("can verify time-of-day from strength source timing without inventing strength metrics",()=>{
  const input=fixture();
  input.logs[0].log.blocks=[{id:"run-1",typeId:"strength",startedAt:todayYmd+"T06:00:00Z",sets:{squat:[{reps:5,weight:20}]}}];
  input.data.verifiedActivities[0].activity_type="strength";
  input.data.observations[0].activity_type="strength";input.data.observations[0].started_at=todayYmd+"T06:00:00Z";
  const evidence=buildPerformanceEvidence({...input,todayYmd,isAdult:true});
  expect(evidence.verifiedStats.behaviour.earlyBirdSessions).toBe(1);
  expect(evidence.verifiedStats.lifts.totalSets).toBe(0);
});
