import { performanceObservations } from './personalBestBadgeEngine.js';

function recordAtBest(rows, compare) {
  return rows.reduce((best, row) => !best || compare(row, best) > 0 ? row : best, null);
}

function recentStart(todayYmd) {
  const date = new Date(`${todayYmd}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 29);
  return date.toISOString().slice(0,10);
}

const compareWeighted = (a,b) => a.weight-b.weight || a.reps-b.reps;
function movementRecords(rows, weightedMode, unit) {
  const records = [];
  if (weightedMode) {
    const best = recordAtBest(rows.filter(row=>row.kind==='weighted'), compareWeighted);
    if (best) records.push({...best,label:'Heaviest set',unit});
  }
  for (const [kind,label] of [['reps','Most reps in one set'],['hold','Longest hold']]) {
    if (weightedMode && kind === 'reps') continue;
    const best = recordAtBest(rows.filter(row=>row.kind===kind),(a,b)=>a.value-b.value);
    if (best) records.push({...best,label});
  }
  return records;
}

// Display evidence only. The XP and badge engines remain the reward authority.
// Match the same stable movement/protocol/unit identity used for PB awards.
export function buildMovementPersonalBest(allLogs, movement, todayYmd) {
  if (!movement?.id) return { records: [], priorDates: 0, disabled: false };
  const disabled = movement.activityPurpose === 'warmup' || movement.progressionRewards === false;
  if (disabled) return { records: [], priorDates: 0, disabled: true };
  const baseKey = `strength:${movement.performanceKey || movement.id}:${movement.protocolId || 'recorded'}:${movement.weightUnit || 'kg'}`;
  const keys = new Set([baseKey, `${baseKey}:reps`, `${baseKey}:hold`]);
  const observations = [];
  for (const row of Array.isArray(allLogs) ? allLogs : []) {
    const date = row?.date_ymd || row?.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || date > todayYmd) continue;
    for (const observation of performanceObservations(row.log || row.log_json)) {
      if (keys.has(observation.key)) observations.push({ ...observation, date });
    }
  }
  // Earliest recorded date wins a tie, regardless of input order or chart range.
  observations.sort((a,b) => a.date.localeCompare(b.date));
  const weighted = observations.filter(row => row.kind === 'weighted');
  const unit = movement.weightUnit || 'kg';
  const records = movementRecords(observations, weighted.length > 0, unit);
  const currentRecords = [];
  if (weighted.length) {
    const heaviest = records[0];
    // Use the heaviest recorded load on the latest date, independent of set order.
    const latestLoad = recordAtBest(weighted.filter(row=>row.date===weighted.at(-1).date),compareWeighted).weight;
    if (latestLoad !== heaviest.weight) {
      const atLoad = recordAtBest(weighted.filter(row => row.weight === latestLoad), (a,b) => a.reps-b.reps);
      currentRecords.push({ ...atLoad, label: 'Best at your current load', unit });
    }
  }
  const recentRecords = movementRecords(observations.filter(row=>row.date>=recentStart(todayYmd)),weighted.length>0,unit);
  const latestKind = observations.at(-1)?.kind;
  return {
    records,
    currentRecords,
    recentRecords,
    priorDates: new Set(observations.filter(row => row.kind === latestKind && row.date < todayYmd).map(row => row.date)).size,
    disabled: false,
  };
}

export function buildCardioPersonalBest(allLogs, block, todayYmd) {
  const disabled = block?.activityPurpose === 'warmup' || block?.progressionRewards === false;
  if (disabled) return { records:[], priorDates:0, disabled:true, comparison:'cardio' };
  const observations = [];
  for (const row of Array.isArray(allLogs) ? allLogs : []) {
    const date = row?.date_ymd || row?.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || date > todayYmd) continue;
    for (const observation of performanceObservations(row.log || row.log_json)) {
      if (observation.kind === 'cardio') observations.push({...observation,date});
    }
  }
  observations.sort((a,b)=>a.date.localeCompare(b.date));
  // An empty selected day can still show the latest recorded distance for this block.
  const current = performanceObservations({blocks:[block]}).find(row=>row.kind==='cardio');
  const reference = current || observations.filter(row=>row.blockId===block?.id).at(-1);
  if (!reference) return {records:[],priorDates:0,disabled:false,comparison:'cardio'};
  const matching = observations.filter(row=>row.key===reference.key);
  const best = recordAtBest(matching,(a,b)=>b.value-a.value);
  const recent = recordAtBest(matching.filter(row=>row.date>=recentStart(todayYmd)),(a,b)=>b.value-a.value);
  const [,sport,distance] = reference.key.split(':');
  const displayRecord = record => ({...record,distanceKm:Number(distance),sport,label:'Fastest recorded time'});
  return {
    records:best ? [displayRecord(best)] : [],
    recentRecords:recent ? [displayRecord(recent)] : [],
    priorDates:new Set(matching.filter(row=>row.date<todayYmd).map(row=>row.date)).size,
    disabled:false,
    comparison:'cardio',
  };
}
