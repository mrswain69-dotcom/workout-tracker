// Established records from actual paired sets and exact recorded cardio distances.
// Badge evidence only: does not award daily XP or change the improvement economy.
const positive=x=>Number.isFinite(Number(x))&&Number(x)>0?Number(x):0;
const strengthTypes=new Set(['strength','hiit','box']);
function observations(log){
 const out=[];
 for(const b of log?.blocks||[]){
  if(!b||b.cancelled||b.suspendedByRecoveryMode||b.activityPurpose==='warmup'||b.progressionRewards===false)continue;
  if(strengthTypes.has(b.typeId))for(const m of b.movements||[]){
   if(!m.id||m.activityPurpose==='warmup'||m.progressionRewards===false)continue;
   const key=`strength:${m.performanceKey||m.id}:${m.protocolId||'recorded'}:${m.weightUnit||'kg'}`;
   for(const s of b.sets?.[m.id]||[]){
    const reps=positive(s.reps),weight=positive(s.weight),seconds=positive(s.timeSeconds);
    if(weight&&reps)out.push({key,kind:'weighted',weight,reps});
    else if(reps&&!weight)out.push({key:key+':reps',kind:'reps',value:reps});
    else if(seconds&&!weight)out.push({key:key+':hold',kind:'hold',value:seconds});
   }
  }
  if(b.typeId==='cardio'){
   const sport=String(b.cardio?.sport||b.cardioType||'run').toLowerCase(),km=positive(b.cardio?.distanceKm),minutes=positive(b.cardio?.durationMin);
   if(['run','bike','cycle','walk','row','swim'].includes(sport)&&km&&minutes)out.push({key:`cardio:${sport==='cycle'?'bike':sport}:${km}:${b.protocolId||'recorded'}`,kind:'cardio',value:minutes*60});
  }
 }
 return out;
}
function establishedPb(candidate,prior){
 if(candidate.kind!=='weighted'){
  if(new Set(prior.map(x=>x.date)).size<3)return false;
  return candidate.kind==='cardio'?candidate.value<Math.min(...prior.map(x=>x.value))-1e-7:candidate.value>Math.max(...prior.map(x=>x.value))+1e-7;
 }
 // A heavier load with substantially fewer reps is not a like-for-like PB.
 if(!prior.some(x=>candidate.weight>=x.weight&&candidate.reps>=x.reps&&(candidate.weight>x.weight||candidate.reps>x.reps)))return false;
 const atLoad=prior.filter(x=>x.weight>=candidate.weight),atReps=prior.filter(x=>x.reps>=candidate.reps);
 return (new Set(atLoad.map(x=>x.date)).size>=3&&candidate.reps>Math.max(...atLoad.map(x=>x.reps)))||
  (new Set(atReps.map(x=>x.date)).size>=3&&candidate.weight>Math.max(...atReps.map(x=>x.weight)))||
  (new Set(prior.map(x=>x.date)).size>=3&&prior.every(x=>candidate.weight>x.weight&&candidate.reps>x.reps));
}
export function buildPersonalBestBadgeStats(allLogs=[],todayYmd='9999-12-31'){
 const dates=new Map();
 for(const row of allLogs){const date=row.date_ymd||row.date,log=row.log||row.log_json;if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||date>todayYmd)continue;dates.set(date,[...(dates.get(date)||[]),...observations(log)]);}
 const history=new Map(),pbDates=[],events=[];
 for(const [date,current] of [...dates].sort(([a],[b])=>a.localeCompare(b))){
  let qualifies=false;
  for(const o of current){if(establishedPb(o,history.get(o.key)||[])){qualifies=true;events.push({date,kind:o.kind});}}
  if(qualifies)pbDates.push(date);
  for(const o of current){const previous=history.get(o.key)||[];previous.push({...o,date});history.set(o.key,previous);}
 }
 return {personalBestDays:pbDates.length,personalBestDates:pbDates,personalBestEvents:events};
}
