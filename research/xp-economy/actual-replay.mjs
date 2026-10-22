// Read-only research replay. Raw input stays outside git; reports use A/B/C aliases.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {buildXpDebugRows,setDidSomething} from '../../src/engine/xpEngine.js';
import {activityBase,improvementEvidence,datedAward} from './revision-rules.mjs';
const positive=x=>Number.isFinite(Number(x))&&Number(x)>0?Number(x):0;
const kinds=new Set(['strength','hiit','box']);
const sum=(rows,key)=>rows.reduce((n,r)=>n+(Number(r[key])||0),0);
const percent=(a,b)=>a?Math.round((b/a-1)*1000)/10:null;
export function factsFor(record,{excludeCancelled=false}={}){
 const out=[];let fallbackIdentities=0;
 for(const [bi,b] of (record.log?.blocks||[]).entries()){
  if(!b||b.suspendedByRecoveryMode||(excludeCancelled&&b.cancelled&&!b.performedBeforeCancellation))continue;
  if(kinds.has(b.typeId))for(const [mi,[movementId,entries]] of Object.entries(b.sets||{}).entries())for(const [si,s] of (Array.isArray(entries)?entries:[]).entries()){
   if(!setDidSomething(s))continue;
   const id=s.id||`replay:${record.date_ymd}:${bi}:${mi}:${si}`;if(!s.id)fallbackIdentities++;
   out.push({id,kind:'strength',reps:positive(s.reps)||positive(s.count)||positive(s.distanceKm)||positive(s.durationMin),seconds:positive(s.timeSeconds),block:b.id,label:b.label});
  }
  if(b.typeId==='cardio')out.push({id:`replay:${record.date_ymd}:${bi}:cardio`,kind:'cardio',activity:b.cardioType||'run',minutes:positive(b.cardio?.durationMin),km:positive(b.cardio?.distanceKm),block:b.id});
  if(b.typeId==='duration')out.push({id:`replay:${record.date_ymd}:${bi}:duration`,kind:'mobility',seconds:positive(b.duration?.minutes)*60,block:b.id});
 }
 return {facts:out,fallbackIdentities};
}
// Legacy-unit/exercise identity and ordinal slots are assumptions, not certification.
export function probesFor(record){
 const grouped=new Map();
 for(const b of record.log?.blocks||[]){
  if(!b||b.suspendedByRecoveryMode||b.cancelled||!kinds.has(b.typeId))continue;
  for(const m of b.movements||[]){
   if(!m.id)continue;
   const entries=b.sets?.[m.id]||[];
   if(!entries.some(setDidSomething))continue;
   const key=String(m.id),old=grouped.get(key)||{m,sets:[]};old.sets.push(...entries);grouped.set(key,old);
  }
 }
 const out=[];
 for(const [exercise,{m,sets}] of grouped){
  const common={date:record.date_ymd,exercise,direction:'higher'};
  const vector=field=>sets.map(s=>positive(s?.[field]));
  const probes=[];
  if(sets.every(s=>positive(s?.reps))) {
   probes.push({metric:'repetitions',unit:'reps',protocol:'reps-at-load:'+JSON.stringify(vector('weight')),values:vector('reps')});
   if(sets.every(s=>positive(s?.weight)))probes.push({metric:'load',unit:'legacy-weight-unit',protocol:'load-at-reps:'+JSON.stringify(vector('reps')),values:vector('weight')});
  }
  if(m.trackDuration&&sets.every(s=>positive(s?.timeSeconds)))probes.push({metric:'hold',unit:'seconds',protocol:'timed-hold:'+JSON.stringify(vector('weight')),values:vector('timeSeconds')});
  for(const p of probes)out.push({...common,metric:p.metric,unit:p.unit,protocol:p.protocol,slots:p.values.map((value,i)=>({slot:`ordinal:${i}`,value}))});
 }
 return out;
}
function completionAudit(log){
 const required=(log?.blocks||[]).filter(b=>b&&!b.suspendedByRecoveryMode&&!b.optional&&!b.isOptional&&!b.isExtra&&b.typeId!=='tasks');
 let performed=0,missing=0,unknown=0,cancelled=0;
 for(const b of required){
  if(b.cancelled){cancelled++;unknown++;continue;}
  if(kinds.has(b.typeId))for(const m of (b.movements||[]).filter(m=>!m.optional&&!m.isOptional)){
   const count=positive(m.sets)||positive(b.setsPerMovement);
   if(!Number.isInteger(count)||count<1){unknown++;continue;}
   const actual=(b.sets?.[m.id]||[]).filter(setDidSomething).length;performed+=Math.min(count,actual);missing+=Math.max(0,count-actual);
  }
  else if(b.typeId==='duration'){if(positive(b.plannedMinutes)){performed+=positive(b.duration?.minutes)>=positive(b.plannedMinutes)?1:0;missing+=positive(b.duration?.minutes)>=positive(b.plannedMinutes)?0:1;}else unknown++;}
  else if(b.typeId==='cardio'){unknown++;} // targetText is not an immutable numeric target.
  else if(b.typeId==='session'){unknown++;} // No assumption that a completed flag proves actual work.
  else if(b.typeId==='recovery'){unknown++;} // Existing live recovery policy is preserved.
  else unknown++;
 }
 return {performed,missing,unknown,cancelled,status:missing?'partial':unknown?'unknown':performed?'complete':'none'};
}
export function replay(profiles,{minDates=3,startDate='2026-09-12',endDate='2026-10-12'}={}){
 const start=startDate,end=endDate;
 const reports=[];let layoutChecks=0,nonemptyLayoutChecks=0,duplicateChecks=0,omissionChecks=0,preservationChecks=0,pairedChecks=0;
 for(const [pi,p] of profiles.entries()){
  const alias=String.fromCharCode(65+pi),records=p.records||[],legacy=buildXpDebugRows(records,p.plan_json||{}, {todayYmd:end,scheduleSnapshots:p.scheduleSnapshots||[]});
  const inferredHistory=records.flatMap(probesFor),rows=[],proof=[],audits=[],reasons={};
  let nativeIDs=0,sets=0,classified=0,totalBlocks=0,eligibleMovements=0,improvedMovements=0,probedMovements=0;
  for(const record of records){
   const date=record.date_ymd,old=legacy.find(r=>r.date===date&&r.kind==='blocks');
   if(!old){continue;}
   const extracted=factsFor(record),base=activityBase(extracted.facts),currentBase=old.strengthXp+old.cardioXp+old.durationXp;
   const previews=Array.from({length:8},(_,partition)=>extracted.facts.map((f,i)=>({...f,block:`split${i%(partition+1)}`,label:`renamed${i}`})));
   for(const variant of previews){assert.deepEqual(activityBase(variant),base);layoutChecks++;if(base.total>0)nonemptyLayoutChecks++;}
   assert.deepEqual(activityBase([...extracted.facts,...extracted.facts]),base);duplicateChecks++;
   assert.deepEqual(datedAward(date,'2026-10-13',old,()=>{throw Error('History recalculated');}),old);preservationChecks++;
   const cancellationExcluded=activityBase(factsFor(record,{excludeCancelled:true}).facts);
   const audit=completionAudit(record.log);audits.push({date,...audit,oldComplete:old.dayCompleteXp>0});
   const groups=new Map();for(const probe of probesFor(record)){const g=groups.get(probe.exercise)||[];g.push(probe);groups.set(probe.exercise,g);}
   let rawImprovement=0,qualified=0;
   for(const probes of groups.values()){
    const checked=probes.map(probe=>({probe,evidence:improvementEvidence(probe,inferredHistory,{minDates})}));
    const best=checked.sort((a,b)=>(b.evidence.gain||0)-(a.evidence.gain||0)).find(x=>x.evidence.eligible);
    if(date>=start){probedMovements++;if(best)eligibleMovements++;else{const reason=checked[0]?.evidence.reason||'unmeasured';reasons[reason]=(reasons[reason]||0)+1;}}
    if(best){qualified++;rawImprovement+=2*best.evidence.matchedSlots*best.evidence.gain*5;if(date>=start&&best.evidence.gain>0)improvedMovements++;
     if(best.evidence.matchedSlots>1){const omitted=structuredClone(best.probe);omitted.slots.pop();assert.equal(improvementEvidence(omitted,inferredHistory,{minDates}).eligible,false);omissionChecks++;}
    }
   }
   const improvementPreview=Math.min(100,Math.round(rawImprovement));
   const layoutOnly=old.earnedXp-currentBase+base.total;
   // Only strength improvement substituted: cardio/streak/tasks/claims/completion remain legacy.
   const matchedPreview=layoutOnly-old.strengthProgressXp+improvementPreview;
   const row={date,earnedCurrent:old.earnedXp,layoutOnly,matchedPreview,currentBase,revisedBase:base.total,cancellationExcludedBase:cancellationExcluded.total,legacyStrengthImprovement:old.strengthProgressXp,exploratoryStrengthImprovement:improvementPreview,qualified,legacyUnchangedComponents:old.earnedXp-currentBase-old.strengthProgressXp,cosmeticXp:old.bonusXp||0};rows.push(row);
   if(date>=start){
    totalBlocks+=(record.log.blocks||[]).length;classified+=(record.log.blocks||[]).filter(b=>b.activityPurpose).length;
    const logged=(record.log.blocks||[]).flatMap(b=>Object.values(b.sets||{}).flat()).filter(setDidSomething);sets+=logged.length;nativeIDs+=logged.filter(s=>s.id).length;
   }
   for(const b of record.log.blocks||[]){if(!kinds.has(b.typeId)||b.suspendedByRecoveryMode||b.cancelled)continue;
    const entries=Object.entries(b.sets||{}).flatMap(([key,ss])=>(Array.isArray(ss)?ss:[]).filter(setDidSomething).map(s=>({key,s}))),count=entries.length;if(count<2)continue;
    const split=entries.map(({key,s},i)=>({...b,id:`partition-${i}`,sets:{[key]:[s]}}));
    const scored=blocks=>buildXpDebugRows([{date_ymd:date,log:{blocks}}],{}, {todayYmd:date}).find(r=>r.date===date).strengthXp;
    const oneBlockCurrent=scored([b]),oneSetPerBlockCurrent=scored(split);assert.equal(oneBlockCurrent,count*2+5);assert.equal(oneSetPerBlockCurrent,count*7);
    proof.push({date,sets:count,oneBlockCurrent,oneSetPerBlockCurrent,revised:count*2+5});pairedChecks++;
   }
  }
  const window=rows.filter(r=>r.date>=start&&r.date<=end),windowAudits=audits.filter(r=>r.date>=start);
  const weeks=new Map();for(const r of window){const d=new Date(r.date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));const key=d.toISOString().slice(0,10);const w=weeks.get(key)||{week:key,current:0,layoutOnly:0,matchedPreview:0};w.current+=r.earnedCurrent;w.layoutOnly+=r.layoutOnly;w.matchedPreview+=r.matchedPreview;weeks.set(key,w);}
  const oldTotals=legacy.filter(r=>r.date>=start&&r.date<=end);
  // Non-block award rows preserved and added to all previews identically.
  const others=oldTotals.filter(r=>r.kind!=='blocks'),extraEarned=sum(others,'earnedXp');
  for(const r of others){const d=new Date(r.date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));const key=d.toISOString().slice(0,10),w=weeks.get(key)||{week:key,current:0,layoutOnly:0,matchedPreview:0};for(const field of ['current','layoutOnly','matchedPreview'])w[field]+=Number(r.earnedXp)||0;weeks.set(key,w);}
  reports.push({alias,totalRecords:records.length,nativeBlockRecords:records.filter(r=>Array.isArray(r.log?.blocks)).length,comparisonDates:window.length,activeBaseDates:window.filter(r=>r.revisedBase>0).length,currentEarned:sum(window,'earnedCurrent')+extraEarned,layoutOnlyEarned:sum(window,'layoutOnly')+extraEarned,layoutChangePct:percent(sum(window,'earnedCurrent')+extraEarned,sum(window,'layoutOnly')+extraEarned),exploratoryMatchedEarned:sum(window,'matchedPreview')+extraEarned,matchedChangePct:percent(sum(window,'earnedCurrent')+extraEarned,sum(window,'matchedPreview')+extraEarned),currentStrengthImprovement:sum(window,'legacyStrengthImprovement'),exploratoryStrengthImprovement:sum(window,'exploratoryStrengthImprovement'),readiness:{recordedSets:sets,nativeStableSetIDs:nativeIDs,classifiedBlocks:classified,totalBlocks,probedMovements,eligibleUnderInferredProtocol:eligibleMovements,improvedUnderInferredProtocol:improvedMovements,notEligibleReasons:reasons,certifiedImprovementComparisons:0},completionAudit:{strictlyPartial:windowAudits.filter(r=>r.status==='partial').length,currentlyGreenButMissingRequiredSets:windowAudits.filter(r=>r.oldComplete&&r.missing>0).length,unknown:windowAudits.filter(r=>r.status==='unknown').length,provisionalComplete:windowAudits.filter(r=>r.status==='complete').length,immutableSnapshotsCertified:0},unchangedEarnedComponents:{tasks:sum(oldTotals,'tasksXp'),dailyClaims:sum(oldTotals,'dailyBonusXp'),streaks:sum(oldTotals,'streakXp'),completion:sum(oldTotals,'dayCompleteXp'),sessions:sum(oldTotals,'sessionXp'),recovery:sum(oldTotals,'recoveryXp'),cardioImprovement:sum(oldTotals,'cardioProgressXp')},latest:window.find(r=>r.date===end)||null,weekly:[...weeks.values()].sort((a,b)=>a.week.localeCompare(b.week)),partitionEvidence:proof.filter(r=>r.date>=start).sort((a,b)=>b.sets-a.sets).slice(0,2)});
 }
 const fullWeeks=[...new Set(reports.flatMap(p=>p.weekly.map(w=>w.week)))].filter(w=>w<'2026-10-12').sort();
 const rankings=fullWeeks.map(week=>({week,...Object.fromEntries(['current','layoutOnly','matchedPreview'].map(field=>[field,reports.map(p=>({alias:p.alias,xp:p.weekly.find(w=>w.week===week)?.[field]||0})).sort((a,b)=>b.xp-a.xp||a.alias.localeCompare(b.alias))]))}));
 return {scope:'read-only replay; all supplied records inspected, no historical awards changed',minimumHistoryDates:minDates,comparisonWindow:{start,end,baselineHistory:'all available prior records; eligible matched baseline limited to 28 days'},scoreBase:'production b0b9ab9018b40df33dd39adbc1b50fb1253ff043',scenarios:{current:'existing earned-XP engine',layoutOnly:'only strength/cardio/duration base aggregation substituted; category bonus once daily; walking factor per work; all other earned components unchanged',matchedPreview:'layoutOnly plus exploratory matched strength improvement using 2 * matchedSlots * relativeGain * 5, 100 ceiling; legacy cardio improvement and other components retained; NOT final whole-rule payout'},assumptions:['Replay-local IDs preserve work under transformations, not proof of native deduplication','No automatic mobility/skills classification by name','Ordinal matching and legacy weight-unit identity are provisional, not certified','Current-plan task XP used by production scorer; dated task snapshots unavailable','Completion audit uses saved fields, not guaranteed immutable targets; no completion/streak changes applied','No overall daily cap applied; canonical cap/milestone policy requires calibration','Three profiles from one family are not population or physiological validation'],checks:{layoutChecks,nonemptyLayoutChecks,duplicateChecks,omissionChecks,preservationChecks,pairedChecks},profiles:reports,weeklyRankings:rankings};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const report=replay(JSON.parse(fs.readFileSync(process.argv[2],'utf8')));
 if(process.argv[3])fs.writeFileSync(process.argv[3],JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({records:report.profiles.reduce((n,p)=>n+p.totalRecords,0),checks:report.checks,profiles:report.profiles.map(({weekly,partitionEvidence,...p})=>p),rankChanges:report.weeklyRankings.filter(w=>w.current.map(p=>p.alias).join()!==w.matchedPreview.map(p=>p.alias).join())},null,2));
}
