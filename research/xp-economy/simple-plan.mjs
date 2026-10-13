// Explainable-policy research. Requires trustworthy completion and actual time.
// No production imports; no live XP or reward changes.
const num=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0?x:0;
const rounded=x=>Math.round((x+Number.EPSILON)*100)/100;
export const MODELS={dailyPlan:{dailyPlan:60,progressWeekly:60,activityWeekly:60},balancedDaily:{dailyPlan:40,progressWeekly:90,activityWeekly:90},weeklyPlan:{weeklyPlan:180,progressWeekly:60,activityWeekly:60},weeklyPlanGuarded:{planPerDay:60,planDaysForFullBudget:3,qualifyingPlannedMinutes:10,progressWeekly:60,activityWeekly:60},weeklyPlanGuardedHigher:{planPerDay:100,planDaysForFullBudget:3,qualifyingPlannedMinutes:10,progressWeekly:100,activityWeekly:100}};
export function effort(minutes){
 minutes=num(minutes);
 const bands=[{minutes:Math.min(30,minutes),xp:0},{minutes:Math.min(30,Math.max(0,minutes-30)),xp:0},{minutes:Math.min(60,Math.max(0,minutes-60)),xp:0}];
 bands[0].xp=bands[0].minutes/3;bands[1].xp=bands[1].minutes/6;bands[2].xp=bands[2].minutes/12;
 return {xp:rounded(bands.reduce((n,b)=>n+b.xp,0)),bands};
}
function uniqueActivities(activities){
 const out=new Map();
 for(const a of activities||[]){
  if(!a.sourceId)throw Error('Missing activity identity');
  if(a.durationKind!=='actual')throw Error('Estimated duration is not scoring evidence');
  if(out.has(a.sourceId)&&(out.get(a.sourceId).minutes!==a.minutes||out.get(a.sourceId).planned!==a.planned))throw Error('Conflicting activity needs reconciliation');
  out.set(a.sourceId,a);
 }
 return [...out.values()];
}
function progression(events){
 let xp=0;
 for(const e of events||[]){
  if(!e.comparable||!e.baselinePredatesToday||!e.sameProtocol||!e.matchedWork||!e.meaningfulGain)continue;
  xp=Math.max(xp,e.newLifetimeBest?30:e.beatsRollingBaseline?20:e.beatsLast?10:0);
 }
 return xp;
}
export function scoreWeek(snapshot,days,{model='weeklyPlan'}={}){
 const rules=MODELS[model];if(!rules)throw Error('Unknown model');
 if(!snapshot?.locked||!Array.isArray(snapshot.trainingDates))throw Error('Missing accepted weekly snapshot');
 const dates=[...new Set(snapshot.trainingDates)].sort(),allowed=new Set(dates);
 if(dates.some(d=>d<snapshot.weekStart||d>snapshot.weekEnd))throw Error('Scheduled date outside week');
 let activityUsed=0,progressUsed=0,planTotal=0,activityTotal=0,progressTotal=0;
 const planBudget=rules.planPerDay?rules.planPerDay*Math.min(dates.length,rules.planDaysForFullBudget):rules.weeklyPlan;
 const rows=[],seenSources=new Map();
 const byDate=new Map();for(const day of days){if(byDate.has(day.date))throw Error('Duplicate day needs reconciliation');byDate.set(day.date,day);}
 for(const [date,day] of [...byDate].sort(([a],[b])=>a.localeCompare(b))){
  if(date<snapshot.weekStart||date>snapshot.weekEnd)throw Error('Date outside week');
  const f=day.completionFraction;
  if(allowed.has(date)&&(typeof f!=='number'||!Number.isFinite(f)||f<0||f>1))throw Error('Missing valid completion evidence');
  const activities=uniqueActivities(day.activities);
  for(const a of activities){if(seenSources.has(a.sourceId))throw Error('Activity reused on another date');seenSources.set(a.sourceId,date);}
  const plannedMinutes=activities.filter(a=>a.planned===true).reduce((n,a)=>n+num(a.minutes),0);
  const creditedFraction=rules.qualifyingPlannedMinutes?Math.min(f||0,plannedMinutes/rules.qualifyingPlannedMinutes):f;
  const plan=allowed.has(date)?(rules.dailyPlan||planBudget/dates.length)*creditedFraction:0;
  const minutes=activities.reduce((n,a)=>n+num(a.minutes),0),rawActivity=effort(minutes);
  const activity=Math.min(rawActivity.xp,Math.max(0,rules.activityWeekly-activityUsed));
  const rawProgress=progression(day.progress),progress=Math.min(rawProgress,Math.max(0,rules.progressWeekly-progressUsed));
  planTotal+=plan;activityUsed+=activity;progressUsed+=progress;activityTotal+=activity;progressTotal+=progress;
  rows.push({date,planXp:rounded(plan),activityXp:rounded(activity),progressXp:rounded(progress),totalXp:rounded(plan+activity+progress),minutes,activityBands:rawActivity.bands,progressRaw:rawProgress});
 }
 return {model,planXp:rounded(planTotal),activityXp:rounded(activityTotal),progressXp:rounded(progressTotal),earnedXp:rounded(planTotal+activityTotal+progressTotal),weeklyMaximum:planBudget!==undefined?planBudget+rules.progressWeekly+rules.activityWeekly:null,rows};
}
