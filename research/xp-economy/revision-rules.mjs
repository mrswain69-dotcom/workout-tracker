// Research-only contracts on normalized facts, not a production log adapter.
// Input identities, units, purpose and snapshots must come from trusted capture.
const positive=x=>typeof x==='number'&&Number.isFinite(x)&&x>0?x:0;
const median=a=>{const s=[...a].sort((a,b)=>a-b),i=s.length>>1;return s.length%2?s[i]:(s[i-1]+s[i])/2;};
const stamp=date=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Invalid date');const t=Date.parse(date+'T00:00:00Z');if(!Number.isFinite(t)||new Date(t).toISOString().slice(0,10)!==date)throw Error('Invalid date');return t;};
function unique(facts){
 const map=new Map();
 for(const f of facts){if(!f.id)throw Error('Missing durable work identity');const copy={...f};delete copy.block;delete copy.label;
  const signature=JSON.stringify(Object.keys(copy).sort().map(k=>[k,copy[k]]));
  if(map.has(f.id)&&map.get(f.id).signature!==signature)throw Error('Conflicting duplicate work');
  map.set(f.id,{fact:f,signature});
 }
 return [...map.values()].map(x=>x.fact);
}
export function activityBase(facts){
 let sets=0,min=0,km=0,mobility=0;
 for(const f of unique(facts)){
  if(f.kind==='strength'&&positive(f.reps)+positive(f.seconds)>0)sets++;
  if(f.kind==='cardio'){const factor=f.activity==='walk'?.6:1;min+=positive(f.minutes)*factor;km+=positive(f.km)*factor;}
  if(f.kind==='mobility')mobility+=positive(f.seconds)/60;
 }
 const strength=sets?sets*2+5:0;
 // Round each earned dimension once, after applying its type multiplier.
 const cardio=min+km>0?Math.ceil(min*.5-1e-9)+Math.ceil(km*2-1e-9)+5:0;
 const duration=mobility>0?Math.ceil(mobility*.2-1e-9)+5:0;
 return {strength,cardio,duration,total:strength+cardio+duration};
}
export function completion(snapshot,facts){
 if(!snapshot||!Array.isArray(snapshot.required))return 'unknown';
 const evidence=new Map(unique(facts).map(f=>[f.id,f]));
 const required=snapshot.required.filter(t=>!t.excusedByApprovedAdjustment);
 if(!required.length)return 'none';
 for(const t of required){
  const f=evidence.get(t.id);
  if(!f)return 'partial';
  if(t.kind&&f.kind!==t.kind)return 'partial';
  if(t.unit&&f.unit!==t.unit)return 'unknown';
  if(t.kind==='recovery'){if(!t.eligible||f.confirmed!==true)return 'partial';continue;}
  if(t.evidenceMode==='performed'&&f.completed!==true)return 'partial';
  if(!t.minimums||!Object.keys(t.minimums).length)return 'unknown';
  for(const [metric,target] of Object.entries(t.minimums)){
   if(!positive(target))return 'unknown';
   if(positive(f[metric])+1e-9<target)return 'partial';
  }
 }
 return 'complete';
}
function signature(s){return [s.exercise,s.protocol,s.metric,s.unit].join('|');}
function slots(session){
 const map=new Map();for(const s of session.slots||[]){if(!s.slot||!positive(s.value)||map.has(s.slot))return null;map.set(s.slot,s.value);}return map;
}
export function improvementEvidence(current,history,{windowDays=28,minDates=3}={}){
 const now=stamp(current.date),cur=slots(current);
 if(!cur?.size||!current.exercise||!current.protocol||!current.metric||!current.unit||!['higher','lower'].includes(current.direction))return {eligible:false,reason:'missing comparable evidence',gain:0};
 const matches=history.filter(s=>{const t=stamp(s.date);return t<now&&t>=now-windowDays*86400000&&signature(s)===signature(current)&&s.direction===current.direction;}).sort((a,b)=>a.date.localeCompare(b.date));
 const dates=new Map();for(const s of matches){if(dates.has(s.date))return {eligible:false,reason:'duplicate date requires reconciliation',gain:0};dates.set(s.date,s);}
 if(dates.size<minDates)return {eligible:false,reason:'insufficient recent history',gain:0};
 const baselines=[...dates.values()].map(slots);
 if(baselines.some(x=>!x?.size))return {eligible:false,reason:'invalid baseline',gain:0};
 const keys=[...new Set(baselines.flatMap(m=>[...m.keys()]))];
 // Do not let removing a weaker set manufacture a better average.
 if(keys.some(k=>!cur.has(k)||baselines.some(m=>!m.has(k))))return {eligible:false,reason:'unmatched baseline coverage',gain:0};
 const reference=keys.map(k=>{const prior=baselines.map(m=>m.get(k)),last=prior.at(-1),mid=median(prior);return current.direction==='higher'?Math.max(mid,last):Math.min(mid,last);});
 const sumCurrent=keys.reduce((n,k)=>n+cur.get(k),0),sumBaseline=reference.reduce((a,b)=>a+b,0);
 if(current.direction==='higher'?sumCurrent<sumBaseline:sumCurrent>sumBaseline)return {eligible:false,reason:'matched performance regressed overall',gain:0};
 let gains=0;
 for(const k of keys){const prior=baselines.map(m=>m.get(k)),last=prior.at(-1),mid=median(prior),base=current.direction==='higher'?Math.max(mid,last):Math.min(mid,last);
  const gain=current.direction==='higher'?cur.get(k)/base-1:base/cur.get(k)-1;
  gains+=Math.max(0,Math.min(.2,gain>=.01?gain:0));
 }
 return {eligible:true,reason:'matched evidence',gain:gains/keys.length,matchedSlots:keys.length};
}
export function datedAward(date,activationDate,legacy,revised){return stamp(date)<stamp(activationDate)?structuredClone(legacy):revised();}
