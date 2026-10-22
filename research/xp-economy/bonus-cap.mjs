// Narrow evaluation: cap existing category awards; no new economy or time inputs.
import {buildXpDebugRows,setDidSomething,XP_RULES,safeNumber} from '../../src/engine/xpEngine.js';
const strengthTypes=new Set(['strength','hiit','box']);
function complete(block){
 if(block.cancelled)return false;
 if(strengthTypes.has(block.typeId)){
  const required=(block.movements||[]).filter(m=>!m.optional&&!m.isOptional);
  if(!required.length)return null;
  let unknown=false;
  for(const m of required){const target=safeNumber(m.sets)||safeNumber(block.setsPerMovement);if(!Number.isInteger(target)||target<1){unknown=true;continue;}if((block.sets?.[m.id]||[]).filter(setDidSomething).length<target)return false;}
  return unknown?null:true;
 }
 if(block.typeId==='duration'){const goal=safeNumber(block.plannedMinutes);return goal>0?safeNumber(block.duration?.minutes)>=goal:null;}
 if(block.typeId==='cardio'){
  const km=safeNumber(block.targetDistanceKm),min=safeNumber(block.targetMinutes);if(km<=0&&min<=0)return null;
  return (km<=0||safeNumber(block.cardio?.distanceKm)>=km)&&(min<=0||safeNumber(block.cardio?.durationMin)>=min);
 }
 return null;
}
export function bonusCapComponents(log,{completion='current'}={}){
 let strengthBase=0,durationBase=0,cardioBase=0,anyCardio=false,allWalk=true,recovery=0;
 const active={strength:0,cardio:0,duration:0},eligible={strength:0,cardio:0,duration:0},unknown={strength:0,cardio:0,duration:0};
 for(const b of log?.blocks||[]){
  if(!b||b.suspendedByRecoveryMode)continue;
  let kind=null,base=0;
  if(strengthTypes.has(b.typeId)){kind='strength';base=Object.values(b.sets||{}).reduce((n,sets)=>n+(Array.isArray(sets)?sets.filter(setDidSomething).length:0),0)*2;strengthBase+=base;}
  if(b.typeId==='cardio'){kind='cardio';anyCardio=true;if((b.cardioType||'run')!=='walk')allWalk=false;const km=safeNumber(b.cardio?.distanceKm),min=safeNumber(b.cardio?.durationMin);base=(min>0?Math.ceil(min*.5):0)+(km>0?Math.ceil(km*2):0);cardioBase+=base;}
  if(b.typeId==='duration'){kind='duration';const min=safeNumber(b.duration?.minutes);base=min>0?Math.ceil(min*.2):0;durationBase+=base;}
  if(kind&&base>0){active[kind]++;const status=completion==='current'?true:complete(b);if(status)eligible[kind]++;else if(status===null)unknown[kind]++;}
  if(b.typeId==='recovery'){
   const injury=b.isProfileRecoveryBlock&&String(b.profileRecoveryMode).toLowerCase()==='injury';
   const done=injury?safeNumber(b.duration?.minutes)>0:!!b.recoveryDone;
   if(done)recovery=Math.max(recovery,injury?10:5);
  }
 }
 const factor=anyCardio&&allWalk?.6:1;
 return {strengthXp:strengthBase+(eligible.strength?5:0),cardioXp:Math.round((cardioBase+(eligible.cardio?5:0))*factor),durationXp:durationBase+(eligible.duration?5:0),recoveryXp:recovery,active,eligible,unknown};
}
export function evaluateBonusCaps(records,plan={},options={}){
 const {activationDate='2026-10-19',completion='current',...legacyOptions}=options;
 if(!['current','required-work'].includes(completion))throw Error('Unknown completion policy');
 const seen=new Set();for(const r of records){const date=r.date_ymd||r.date;if(seen.has(date))throw Error('Duplicate day requires reconciliation');seen.add(date);}
 const original=buildXpDebugRows(records,plan,legacyOptions);
 const rows=original.map(old=>{
  if(old.date<activationDate||old.kind!=='blocks')return {...old};
  const found=records.find(r=>(r.date_ymd||r.date)===old.date),log=found?.log||found?.log_json;
  const c=bonusCapComponents(log,{completion});
  const removed=old.strengthXp+old.cardioXp+old.durationXp+old.recoveryXp-c.strengthXp-c.cardioXp-c.durationXp-c.recoveryXp;
  const nonBonusXp=old.nonBonusXp-removed;
  return {...old,...Object.fromEntries(['strengthXp','cardioXp','durationXp','recoveryXp'].map(k=>[k,c[k]])),nonBonusXp,baseXp:nonBonusXp,extraXp:c.cardioXp,earnedXp:old.earnedXp-removed,competitionXp:old.competitionXp-removed,totalXp:old.totalXp-removed,bonusCapRemovedXp:removed,bonusEligibility:c,previewVersion:'daily-category-awards-only',completionPolicy:completion};
 });
 let total=rows.reduce((n,r)=>n+r.totalXp,0),earned=rows.reduce((n,r)=>n+r.earnedXp,0),bonus=rows.reduce((n,r)=>n+r.bonusXp,0);
 for(const r of rows){r.runningTotalXp=total;r.runningEarnedXp=earned;r.runningBonusXp=bonus;total-=r.totalXp;earned-=r.earnedXp;bonus-=r.bonusXp;}
 return rows;
}
