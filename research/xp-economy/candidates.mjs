// Evaluation only: retains earned XP for group rankings; no new economy/boards.
import {buildXpDebugRows,scoreSets,setDidSomething,isDayGreenForXp,XP_RULES} from '../../src/engine/xpEngine.js';
import {buildWorkoutStreakSeries} from '../../src/engine/workoutStreakEngine.js';
const pos=x=>Number.isFinite(Number(x))&&Number(x)>0?Number(x):0;
const median=xs=>{const s=[...xs].sort((a,b)=>a-b),i=Math.floor(s.length/2);return s.length%2?s[i]:(s[i-1]+s[i])/2;};
const round=x=>Math.round((x+Number.EPSILON)*100)/100;
const types=new Set(['strength','hiit','box']);

function performed(b){return b&&!b.suspendedByRecoveryMode&&(!b.cancelled||b.performedBeforeCancellation===true);}
function strengthEntries(log){
  const out=[];
  for(const b of log?.blocks||[]) {
    if(!performed(b)||b.activityPurpose==='mobility')continue;
    if(types.has(b.typeId))for(const m of b.movements||[]) {
      const sets=(b.sets?.[m.id]||[]).filter(setDidSomething);
      if(sets.length)out.push({key:m.performanceKey||m.id,sets,block:b});
    }
    if(b.typeId==='session'&&b.activityPurpose==='strength')for(const m of b.session?.movements||[]) {
      if(m.skipped)continue;
      const sets=(m.result?.overall?.sets||m.result?.sets||[]).filter(setDidSomething);
      if(sets.length)out.push({key:m.performanceKey||m.id,sets,block:b});
    }
  }
  return out;
}
function setsByKey(log){
  const map=new Map(),seen=new Set();
  for(const e of strengthEntries(log))for(const s of e.sets){
    if(s.id&&seen.has(s.id))continue;
    if(s.id)seen.add(s.id);
    map.set(e.key,[...map.get(e.key)||[],s]);
  }
  return map;
}
function perSet(sets){return sets.length?scoreSets(sets)/sets.length:0;}
function strengthImprovement(records,date,log){
  let gainWork=0,comparableSets=0,comparables=0;
  for(const [key,sets] of setsByKey(log)) {
    const history=records.filter(r=>r.date_ymd<date&&r.date_ymd>=new Date(Date.parse(date)-42*86400000).toISOString().slice(0,10)).map(r=>({date:r.date_ymd,sets:setsByKey(r.log).get(key)||[]})).filter(r=>r.sets.length);
    // At most one result per historical day; require real comparable history.
    const byDate=new Map();for(const h of history)byDate.set(h.date,[...byDate.get(h.date)||[],...h.sets]);
    if(byDate.size<3)continue;
    const dates=[...byDate.keys()].sort();
    const baseline=Math.max(median([...byDate.values()].map(perSet)),perSet(byDate.get(dates.at(-1))));
    if(!baseline)continue;
    const gain=perSet(sets)/baseline-1;
    const qualified=gain>=.01?Math.min(.2,gain):0;
    gainWork+=sets.length*qualified;comparableSets+=sets.length;comparables++;
  }
  return {rawXp:gainWork*2*5,comparableSets,comparables};
}

function cardioGroups(log){
  const groups=new Map();
  for(const b of log?.blocks||[]) {
    if(!performed(b)||b.typeId!=='cardio')continue;
    const key=b.cardioType||'run',g=groups.get(key)||{km:0,min:0};
    g.km+=pos(b.cardio?.distanceKm);g.min+=pos(b.cardio?.durationMin);groups.set(key,g);
  }
  return groups;
}
function isComplete(log){
  const blocks=(log?.blocks||[]).filter(b=>b&&!b.suspendedByRecoveryMode&&!b.cancelled&&!b.optional&&!b.isOptional&&b.typeId!=='tasks');
  if(!blocks.length)return false;
  return blocks.every(b=>{
    if(types.has(b.typeId)) {
      const required=(b.movements||[]).filter(m=>!m.optional&&!m.isOptional);
      return required.length>0&&required.every(m=>{
        // Missing target data must not be treated as automatically complete.
        const count=pos(m.sets)||pos(b.setsPerMovement);
        return count>0&&(b.sets?.[m.id]||[]).filter(setDidSomething).length>=count;
      });
    }
    if(b.typeId==='duration')return pos(b.duration?.minutes)>0 && (!pos(b.plannedMinutes)||pos(b.duration.minutes)>=pos(b.plannedMinutes));
    if(b.typeId==='cardio')return (pos(b.cardio?.durationMin)>0||pos(b.cardio?.distanceKm)>0)&&(!pos(b.targetDistanceKm)||pos(b.cardio.distanceKm)>=pos(b.targetDistanceKm))&&(!pos(b.targetMinutes)||pos(b.cardio.durationMin)>=pos(b.targetMinutes));
    if(b.typeId==='session')return !!b.session?.completed&&(b.session?.movements||[]).filter(m=>!m.skipped&&!m.optional).every(m=>m.completed||m.result);
    if(b.typeId==='recovery')return !!b.recoveryDone||(b.isProfileRecoveryBlock&&b.profileRecoveryMode==='injury'&&pos(b.duration?.minutes)>0);
    return false;
  });
}

export function evaluate(records,plan={}, {candidate='weighted',activationDate='2026-10-19',todayYmd='2026-10-20'}={}) {
  records=[...records].sort((a,b)=>a.date_ymd.localeCompare(b.date_ymd));
  const legacy=buildXpDebugRows(records,plan,{todayYmd});
  const annotated=records.map(r=>({...r,log:{...r.log,_scoreDate:r.date_ymd}}));
  const streak=buildWorkoutStreakSeries({records:annotated,todayYmd,fallbackPlan:plan,isDayComplete:log=>log._scoreDate<activationDate?isDayGreenForXp(log):isComplete(log)});
  return legacy.map(old=>{
    if(old.date<activationDate||old.kind!=='blocks')return old;
    const log=records.find(r=>r.date_ymd===old.date)?.log;
    if(!log)return old;
    const blocks=(log.blocks||[]).filter(performed),warnings=[];
    const byKey=setsByKey(log);
    const setCount=[...byKey.values()].reduce((n,s)=>n+s.length,0);
    let strength=setCount*2;
    const groups=cardioGroups(log);
    let cardio=0,cardioImprovementXp=0;
    for(const [key,g] of groups) {
      const multiplier=key==='walk'?.6:1;
      const base=(g.min*.5+g.km*2)*multiplier;
      cardio+=base;
      const prior=records.filter(r=>r.date_ymd<old.date).map(r=>cardioGroups(r.log).get(key)).filter(g=>g&&g.min>0&&g.km>0);
      if(prior.length>=3&&g.min>0&&g.km>0) {
        const baseline=Math.max(median(prior.slice(-5).map(g=>g.km/g.min)),prior.at(-1).km/prior.at(-1).min);
        const gain=g.km/g.min/baseline-1;
        if(gain>=.01)cardioImprovementXp+=base*Math.min(.2,gain)*5;
      }
    }
    let durationMinutes=0,skillsMinutes=0,unmeasuredSession=false,recovery=0;
    for(const b of blocks) {
      if(b.typeId==='duration')durationMinutes+=pos(b.duration?.minutes);
      if(types.has(b.typeId)&&b.activityPurpose==='mobility') {
        const seconds=Object.values(b.sets||{}).flat().reduce((n,s)=>n+pos(s.timeSeconds),0);
        const minutes=pos(b.actualMinutes)||seconds/60;
        durationMinutes+=minutes;
        if(!minutes&&Object.values(b.sets||{}).flat().some(setDidSomething))warnings.push('Mobility duration missing');
      }
      if(b.typeId==='session'&&b.activityPurpose!=='strength') {
        const minutes=pos(b.session?.actualDurationSec)/60;
        if(b.activityPurpose==='mobility')durationMinutes+=minutes;
        else if(minutes)skillsMinutes+=minutes;
        else if(b.session?.completed)unmeasuredSession=true;
      }
      if(b.typeId==='recovery') {
        const done=b.recoveryDone||(b.isProfileRecoveryBlock&&b.profileRecoveryMode==='injury'&&pos(b.duration?.minutes)>0);
        if(done)recovery=Math.max(recovery,b.profileRecoveryMode==='injury'?10:5);
      }
    }
    // Aggregate before rounding, with one category bonus independent of blocks.
    strength=strength>0?strength+5:0;
    cardio=cardio>0?Math.round(cardio+5):0;
    const duration=durationMinutes>0?Math.ceil(durationMinutes*.2-1e-9)+5:0;
    const session=skillsMinutes>0?Math.ceil(skillsMinutes*.5-1e-9)+5:unmeasuredSession?10:0;
    if(unmeasuredSession)warnings.push('Unmeasured Session retains one daily compatibility award');
    const complete=isComplete(log);
    const dayCompleteXp=complete?10:0;
    const tasks=Math.min(15,old.tasksXp);
    const streakXp=XP_RULES.streak[streak.streakByDate[old.date]] || 0;
    const activityUncapped=strength+cardio+duration+session+recovery+tasks+dayCompleteXp+old.dailyBonusXp+streakXp;
    const activityXp=Math.min(150,activityUncapped);
    const improvement=strengthImprovement(records,old.date,log);
    let strengthImprovementXp=candidate==='flat'?(improvement.rawXp>0?30:0):Math.round(improvement.rawXp);
    const improvementXp=Math.min(100,strengthImprovementXp+Math.round(cardioImprovementXp));
    const earnedXp=activityXp+improvementXp;
    return {...old,complete,streakXp,earnedXp,competitionXp:earnedXp,totalXp:earnedXp+old.bonusXp,activityXp,activityUncapped,improvementXp,strengthXp:strength,cardioXp:cardio,durationXp:duration,sessionXp:session,recoveryXp:recovery,tasksXp:tasks,dayCompleteXp,strengthProgressXp:strengthImprovementXp,cardioProgressXp:Math.round(cardioImprovementXp),progXp:improvementXp,scoreVersion:'xp-amendment-preview-1',warnings};
  });
}
