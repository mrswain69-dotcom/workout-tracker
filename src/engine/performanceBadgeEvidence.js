import { buildBadgeStatsV2 } from "./badgeStatsV2.js";
import { buildVerifiedCardioEvidence, classifyVerifiedCardioType } from "./verifiedCardioEvidenceEngine.js";
import { isPerformanceTierEarned, performanceStat } from "./performanceBadgeProgression.js";

// Provider evidence verifies measured cardio/time data. A timed strength recording
// does not verify entered set counts, reps or weights.
export function buildPerformanceEvidence({ logs=[], data={}, todayYmd, isAdult }) {
  const rows=logs.filter(row=>row?.log && (row.date_ymd||row.date)<=todayYmd);
  const byId=new Map(rows.filter(row=>row.id).map(row=>[row.id,row]));
  const sources=new Map();
  const verifiedByDate=new Map();
  const canonical=buildVerifiedCardioEvidence(data);
  for (const evidence of canonical) {
    const link=evidence.manualLink;
    const row=byId.get(link?.manual_log_id);
    const original=row?.log?.blocks?.find(block=>block.id===link?.manual_block_id);
    if (!row || !original || original.cancelled || original.suspendedByRecoveryMode || !(evidence.distanceKm>0) || !(evidence.durationSec>0)) continue;
    if (evidence.date > todayYmd || classifyVerifiedCardioType(original.cardio?.sport || original.cardioType || original.sport || original.label || original.typeId) !== evidence.cardioKind) continue;
    const sport=evidence.cardioKind==="cycle"?"bike":evidence.cardioKind;
    if (!["run","bike","walk","row","swim"].includes(sport)) continue;
    const date=row.date_ymd||row.date;
    const entries=verifiedByDate.get(date)||[];
    if (entries.some(entry=>entry.id===original.id)) continue;
    entries.push({id:original.id,typeId:"cardio",completed:true,startedAt:evidence.startedAt,cardio:{sport,distanceKm:evidence.distanceKm,durationMin:evidence.durationSec/60},evidenceId:evidence.id});
    verifiedByDate.set(date,entries);
    const providers=sources.get(date)||new Set(); evidence.providers.forEach(p=>providers.add(p));sources.set(date,providers);
  }
  const verifiedLogs=rows.filter(row=>verifiedByDate.has(row.date_ymd||row.date)).map(row=>{
    const blocks=verifiedByDate.get(row.date_ymd||row.date);
    const coveredIds=new Set(blocks.map(b=>b.id));
    const uncovered=row.log.blocks?.some(b=>b&&!b.cancelled&&!b.suspendedByRecoveryMode&&b.typeId!=="tasks"&&!coveredIds.has(b.id));
    return {date_ymd:row.date_ymd||row.date,log:{blocks:[...blocks,...(uncovered?[{typeId:"strength",sets:{}}]:[])],meta:{}}};
  });
  const verifiedStats=buildBadgeStatsV2({allLogs:verifiedLogs,todayYmd,isAdult});
  // A strength recording can support time-of-day badges without verifying sets.
  const earlyDates=new Set(), nightDates=new Set();
  const observationsById=new Map((data.observations||[]).map(o=>[o.id,o]));
  const activitiesById=new Map((data.verifiedActivities||[]).map(a=>[a.id,a]));
  for (const link of data.manualLinks||[]) {
    const row=byId.get(link.manual_log_id), activity=activitiesById.get(link.verified_activity_id);
    const block=row?.log?.blocks?.find(b=>b.id===link.manual_block_id);
    if (!block||block.cancelled||block.suspendedByRecoveryMode||!activity||activity.status==="ignored") continue;
    for (const observationLink of data.observationLinks||[]) {
      if (observationLink.verified_activity_id!==activity.id) continue;
      const observation=observationsById.get(observationLink.observation_id);
      if (!observation||observation.source_deleted_at||observation.source_manual_entry===true) continue;
      const strength=/strength|weight|resistance/i.test(observation.activity_type||activity.activity_type||"");
      const expected=classifyVerifiedCardioType(block.cardio?.sport||block.cardioType||block.label||block.typeId);
      const actual=classifyVerifiedCardioType(observation.activity_type||activity.activity_type);
      if (!(strength&&block.typeId==="strength") && (actual==="unknown"||actual!==expected)) continue;
      const stamp=new Date(observation.started_at||activity.started_at);
      if (!Number.isFinite(stamp.getTime())||stamp.toISOString().slice(0,10)>todayYmd) continue;
      const date=row.date_ymd||row.date, hour=stamp.getHours();
      if (hour<(isAdult?7:8)) earlyDates.add(date);
      if (hour>=(isAdult?20:19)) nightDates.add(date);
      const providers=sources.get(date)||new Set();providers.add(observation.provider);sources.set(date,providers);
    }
  }
  verifiedStats.behaviour.earlyBirdSessions=earlyDates.size;
  verifiedStats.behaviour.nightSessions=nightDates.size;

  const daily=rows.map(row=>({date:row.date_ymd||row.date,stats:buildBadgeStatsV2({allLogs:[row],todayYmd,isAdult}),sources:Array.from(sources.get(row.date_ymd||row.date)||[]),verifiedStats:buildBadgeStatsV2({allLogs:verifiedLogs.filter(v=>v.date_ymd===(row.date_ymd||row.date)),todayYmd,isAdult})}));
  for (const day of daily) {
    day.verifiedStats.behaviour.earlyBirdSessions=earlyDates.has(day.date)?1:0;
    day.verifiedStats.behaviour.nightSessions=nightDates.has(day.date)?1:0;
  }
  return {verifiedStats,daily};
}
export function performanceEvidenceForCard(card,state,evidence,stats) {
  const raw=performanceStat(evidence.verifiedStats,card.statKey);
  const verifiedKeys=new Set([...card.tiers,...(card.starTiers||[])].filter(tier=>isPerformanceTierEarned(card,tier,raw,new Set(),evidence.verifiedStats)).map(tier=>tier.key));
  const target=state.stars?card.starTiers[state.stars-1]:state.currentTier;
  const path=target?.statKey||card.statKey;
  const specialDates=path==="stats.sessions.strengthTrainingDays"?stats?.sessions?.strengthTrainingDates:
    path==="stats.intelligence.paceImprovementDays"?stats?.intelligence?.paceImprovementDates:
    path==="stats.intelligence.progressiveOverloadEvents"?stats?.intelligence?.overloadDates:
    path==="stats.intelligence.paceImprovementBestPct"?stats?.intelligence?.paceImprovementDates:null;
  const entries=evidence.daily.filter(day=>specialDates?specialDates.includes(day.date):
    card.comparator==="lte"? target && isPerformanceTierEarned(card,target,performanceStat(day.stats,path)) : Number(performanceStat(day.stats,path))>0)
    .map(day=>({date:day.date,value:specialDates?null:performanceStat(day.stats,path),sources:day.sources,
      verified:specialDates?path.includes("paceImprovement")&&(evidence.verifiedStats.intelligence?.paceImprovementDates||[]).includes(day.date):card.comparator==="lte"?!!target&&isPerformanceTierEarned(card,target,performanceStat(day.verifiedStats,path)):
        Number(performanceStat(day.verifiedStats,path))>=Number(performanceStat(day.stats,path))&&Number(performanceStat(day.stats,path))>0}));
  return {verified:!!target&&verifiedKeys.has(target.key),verifiedKeys,entries:entries.sort((a,b)=>b.date.localeCompare(a.date)),supportsMeasuredVerification:!path.includes("lifts.")&&!path.includes("sessions.")&&!path.includes("progressiveOverload")};
}
