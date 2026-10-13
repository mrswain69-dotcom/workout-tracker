// Evaluation only. Nothing in the production app imports this module.
export const VERSION = 'fairness-lab-1';
export const PURPOSES = ['strength', 'cardio', 'skills', 'mobility', 'walk', 'recovery', 'tasks'];
export const RATES = Object.freeze({ strength: 1, cardio: 1, skills: 1, mobility: 0.4, walk: 0.6 });
const finite = n => Number.isFinite(Number(n)) && Number(n) >= 0;
const number = n => finite(n) ? Number(n) : 0;
const clamp = (n, max) => Math.min(max, Math.max(0, n));
const round = n => Math.round((n + Number.EPSILON) * 100) / 100;
const validDate = n => /^\d{4}-\d{2}-\d{2}$/.test(n || '') && !Number.isNaN(Date.parse(n)) && new Date(n).toISOString().slice(0,10)===n;
const dayMs = 86400000;
function median(values) {
  const sorted = [...values].sort((a,b) => a-b), mid = Math.floor(sorted.length/2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid-1]+sorted[mid])/2;
}

export function validateDay(day) {
  const errors = [];
  if (!validDate(day?.date)) errors.push('Valid scoring date required');
  const seen = new Map();
  const intervals = [];
  let totalMinutes=0;
  for (const event of day?.events || []) {
    if (!event.id) errors.push('Stable event ID required');
    if (!PURPOSES.includes(event.purpose)) errors.push('Explicit activity purpose required');
    for (const field of ['minutes','reps','seconds','distanceKm','taskXp']) {
      if (event[field] !== undefined && !finite(event[field])) errors.push(`Invalid ${field}`);
    }
    const signature = JSON.stringify(Object.fromEntries(Object.entries(event).filter(([k])=>!['blockId','label','format'].includes(k)).sort(([a],[b])=>a.localeCompare(b))));
    if (seen.has(event.id) && seen.get(event.id)!==signature) errors.push('Conflicting duplicate event');
    if (!seen.has(event.id)) {
      totalMinutes+=number(event.minutes)+number(event.seconds)/60;
      if (event.start || event.end) {
        const start=Date.parse(event.start),end=Date.parse(event.end);
        if (!Number.isFinite(start)||!Number.isFinite(end)||end<=start) errors.push('Invalid timer interval');
        else intervals.push({start,end});
      }
    }
    seen.set(event.id, signature);
    if (number(event.minutes) > 1440) errors.push('Impossible duration');
  }
  if (totalMinutes>1440) errors.push('Recorded day exceeds 24 hours');
  intervals.sort((a,b)=>a.start-b.start);
  for(let i=1;i<intervals.length;i++) if(intervals[i].start<intervals[i-1].end) errors.push('Overlapping timer intervals require reconciliation');
  for (const item of [...day?.benchmarks || [], ...day?.history || []]) {
    if (!item.key || !item.protocol || !item.unit || !['higher','lower'].includes(item.direction) || !finite(item.value) || Number(item.value)<=0) errors.push('Invalid benchmark');
    if (item.date && !validDate(item.date)) errors.push('Invalid benchmark date');
  }
  return [...new Set(errors)];
}

export function normalizeEvents(events = []) {
  const unique = new Map();
  for (const e of events) {
    if (!e || e.suspended) continue;
    // Retained data is not proof that cancelled work was performed.
    if (e.cancelled && !e.performedBeforeCancellation) continue;
    if (!unique.has(e.id)) unique.set(e.id, e);
  }
  return [...unique.values()];
}

export function scoreCompletion(requirements = [], events = [], amendment = null) {
  const required = requirements.filter(r => !r.optional && r.purpose!=='tasks');
  if (!required.length) return { eligible:false, fraction:null, complete:false, requirementCount:0 };
  const totals = new Map();
  for (const e of normalizeEvents(events)) {
    if (!e.requirementKey || e.purpose==='tasks') continue;
    const amount = number(e.amount ?? e.reps ?? e.minutes ?? e.seconds ?? (e.completed ? 1 : 0));
    totals.set(e.requirementKey, (totals.get(e.requirementKey)||0)+amount);
  }
  const effective = required.filter(r => !(amendment?.approved && amendment.excludedKeys?.includes(r.key)));
  // An amendment excluding everything is not an automatic completed workout.
  if (!effective.length) return {eligible:false,fraction:null,complete:false,requirementCount:0};
  const done = effective.map(r => {
    const ratio=number(r.target)>0 ? (totals.get(r.key)||0)/r.target : 0;
    return ratio>=1-1e-9 ? 1 : clamp(ratio,1);
  });
  const weight = effective.reduce((sum,r)=>sum+Math.max(1,number(r.weight)),0);
  const fraction = effective.reduce((sum,r,i)=>sum+done[i]*Math.max(1,number(r.weight)),0)/weight;
  return {eligible:true,fraction:round(fraction),complete:done.every(n=>n===1),requirementCount:effective.length};
}

export function scoreImprovement(day) {
  // Slots are selected before the competition week. Labels and block count
  // cannot create new slots. Protocol/unit/direction are part of identity.
  const slots = [...new Set(day.benchmarkSlots || [])].slice(0,3);
  const evidence = [];
  const date = Date.parse(day.date);
  for (const key of slots) {
    const attempts = (day.benchmarks || []).filter(x=>x.key===key);
    if (!attempts.length) { evidence.push({key,eligible:false,reason:'No current result'}); continue; }
    const current = attempts[0];
    const compatible = attempts.filter(x=>x.protocol===current.protocol && x.unit===current.unit && x.direction===current.direction);
    if (compatible.length!==attempts.length) {evidence.push({key,eligible:false,reason:'Mixed protocols'});continue;}
    const history = (day.history || []).filter(x=>x.key===key && x.protocol===current.protocol && x.unit===current.unit && x.direction===current.direction && Date.parse(x.date)<date && Date.parse(x.date)>=date-42*dayMs);
    const byDate = new Map();
    for (const h of history) byDate.set(h.date,[...byDate.get(h.date)||[],Number(h.value)]);
    const dates=[...byDate.keys()].sort();
    if (dates.length<3 || Date.parse(dates.at(-1))-Date.parse(dates[0])<7*dayMs) {evidence.push({key,eligible:false,reason:'Three prior dates spanning seven days required'});continue;}
    const baseline=median(dates.map(d=>median(byDate.get(d))));
    const value=median(compatible.map(x=>Number(x.value)));
    // Recent median is less vulnerable to one low entry than last-result comparison.
    // It cannot establish honesty; immutable baseline/audit controls remain necessary.
    const gain=current.direction==='higher' ? value/baseline-1 : baseline/value-1;
    const watermark=(day.rewardedBenchmarks || []).find(x=>x.key===key && x.protocol===current.protocol && x.unit===current.unit && x.direction===current.direction);
    const watermarkGain=watermark ? (current.direction==='higher' ? value/Number(watermark.value)-1 : Number(watermark.value)/value-1) : gain;
    const fresh=gain>=0.01 && watermarkGain>=0.01;
    evidence.push({key,eligible:true,baseline,value,gain:round(gain),fresh,score:gain>=0.01?round(clamp(gain/0.1,1)*100):0,awardScore:fresh?round(clamp(gain/0.1,1)*100):0});
  }
  const eligible=evidence.filter(e=>e.eligible);
  return {eligible:slots.length>0 && eligible.length===slots.length,score:eligible.length?round(eligible.reduce((n,e)=>n+e.score,0)/slots.length):null,awardScore:eligible.length?round(eligible.reduce((n,e)=>n+e.awardScore,0)/slots.length):0,evidence};
}

function activityTotals(events) {
  const totals=Object.fromEntries(PURPOSES.map(p=>[p,{minutes:0,reps:0,seconds:0,km:0,estimated:false}]));
  for (const e of events) {
    const t=totals[e.purpose];
    if (!t) continue;
    t.minutes+=number(e.minutes); t.reps+=number(e.reps); t.seconds+=number(e.seconds); t.km+=number(e.distanceKm);
    if (e.purpose!=='tasks'&&e.purpose!=='recovery'&&(number(e.reps)>0||number(e.distanceKm)>0||e.completed)&&number(e.minutes)===0&&number(e.seconds)===0) t.estimated=true;
  }
  return totals;
}

export function evaluateDay(day, strategy='recorded-time') {
  const errors=validateDay(day);
  if (errors.length) return {version:VERSION,valid:false,errors};
  const events=normalizeEvents(day.events), totals=activityTotals(events);
  let credits=0, provisional=false;
  for (const [purpose,t] of Object.entries(totals)) {
    if (!RATES[purpose]) continue;
    let minutes=t.minutes+t.seconds/60;
    if (strategy==='work-units' && purpose==='strength') {
      // Label/split invariant, but ignores the difficulty of a repetition.
      minutes=t.reps/20+t.seconds/60;
      provisional ||= t.reps>0;
    } else if (purpose==='strength'&&t.estimated&&t.reps>0) {
      // Interim estimate can inform personal progression, not strict competition.
      minutes+=t.reps/20; provisional=true;
    } else if (t.estimated) provisional=true;
    credits+=minutes*RATES[purpose];
  }
  const completion=scoreCompletion(day.requirements,events,day.amendment);
  const improvement=credits>0 ? scoreImprovement(day) : {eligible:false,score:null,evidence:[]};
  // Candidate calibration, NOT an exercise prescription or validated effort model.
  const activityScore=round(clamp((Math.min(credits,30)+Math.max(0,Math.min(credits,60)-30)*0.5)/45,1)*100);
  const physical=credits>0;
  const recovery=events.some(e=>e.purpose==='recovery' && e.completed);
  const taskXp=clamp(events.filter(e=>e.purpose==='tasks'&&e.completed).reduce((n,e)=>n+number(e.taskXp || 5),0),15);
  const activityXp=Math.min(150,Math.round(activityScore*1.2)+(physical||recovery?5:0)+(completion.complete?10:0)+taskXp+(recovery?5:0));
  const improvementXp=improvement.eligible?Math.min(100,Math.round(improvement.awardScore)):0;
  const earnedXp=activityXp+improvementXp;
  const overallEligible=!provisional&&improvement.eligible&&completion.eligible;
  return {version:VERSION,valid:true,strategy,credits:round(credits),activityScore,improvementScore:improvement.score,consistencyScore:completion.eligible?round(completion.fraction*100):null,competitionEligible:!provisional,overallEligible,overallScore:overallEligible?round(activityScore*0.5+improvement.score*0.25+completion.fraction*100*0.25):null,activityXp,improvementXp,earnedXp,rewardXp:number(day.rewardXp),totalXp:earnedXp+number(day.rewardXp),provisional,completion,improvement,totals};
}

export function evaluateVersionedDay(day, {activationDate,legacyScore,strategy='recorded-time'} = {}) {
  if (!validDate(activationDate)) throw new Error('Explicit activation date required');
  if (day.date<activationDate) {
    if (!legacyScore) throw new Error('Historical scorer required');
    return legacyScore(day);
  }
  return evaluateDay(day,strategy);
}

// Require a unique day per profile to prevent duplicated rows inflating a week.
export function evaluateWeek(days, {weekStart, frozenRequirements} = {}) {
  if (!validDate(weekStart) || !frozenRequirements) throw new Error("Frozen weekly schedule required");
  const expected=Array.from({length:7},(_,i)=>new Date(Date.parse(weekStart)+i*dayMs).toISOString().slice(0,10));
  if (days.some(d=>!expected.includes(d.date))) throw new Error("Date outside competition week");
  const seen=new Set(), valid=[];
  for (const day of days) {
    if (seen.has(day.date)) throw new Error('Duplicate scoring day');
    seen.add(day.date); const result=evaluateDay(day);
    if (!result.valid) throw new Error('Invalid scoring day');
    valid.push(result);
  }
  if (valid.length>7) throw new Error('A weekly score cannot contain more than seven days');
  const completeWeek=expected.map(date=>{
    const supplied=days.find(d=>d.date===date);
    return evaluateDay({...supplied,date,events:supplied?.events || [],requirements:frozenRequirements[date] || []});
  });
  valid.splice(0,valid.length,...completeWeek);
  const weightedMinutes=valid.reduce((n,r)=>n+Math.min(r.credits,30)+Math.max(0,Math.min(r.credits,60)-30)*0.5,0);
  const activity=round(clamp(weightedMinutes/150,1)*100);
  const improvements=valid.filter(r=>r.improvement.eligible);
  // Weeks use each benchmark's median result, not a bonus for practising it more.
  const benchmarkResults=new Map();
  for (const r of improvements) for(const e of r.improvement.evidence.filter(e=>e.eligible)) benchmarkResults.set(e.key,[...benchmarkResults.get(e.key)||[],e.score]);
  const benchmarkScores=[...benchmarkResults.values()].map(median);
  const improvement=benchmarkScores.length?round(benchmarkScores.reduce((n,s)=>n+s,0)/benchmarkScores.length):null;
  const scheduled=valid.filter(r=>r.completion.eligible);
  const consistency=scheduled.length?round(scheduled.reduce((n,r)=>n+r.consistencyScore,0)/scheduled.length):null;
  const eligible=valid.every(r=>r.competitionEligible);
  return {activity,improvement,consistency,competitionEligible:eligible,overallScore:eligible&&improvement!==null&&consistency!==null?round(activity*.5+improvement*.25+consistency*.25):null,earnedXp:valid.reduce((n,r)=>n+r.earnedXp,0)};
}
