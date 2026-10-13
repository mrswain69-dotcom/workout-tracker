const n = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
const ceilXp = value => Math.ceil(value - 1e-9);
const strengthTypes = new Set(['strength', 'hiit', 'box']);
const didSomething = set => ['reps','timeSeconds','count','distanceKm','durationMin'].some(key => n(set?.[key]) > 0);

// Sum measured work first, then round. Splitting the same work into blocks adds no XP.
export function revisedActivityXp(log) {
  let sets = 0, durationMinutes = 0, sessionXp = 0, recoveryXp = 0;
  let walkMinutes = 0, walkKm = 0, otherMinutes = 0, otherKm = 0;
  const seenSets = new Set(), seenBlocks = new Set();
  for (const block of log?.blocks || []) {
    if (!block || block.cancelled || block.suspendedByRecoveryMode) continue;
    if (block.id && seenBlocks.has(block.id)) continue;
    if (block.id) seenBlocks.add(block.id);
    if (strengthTypes.has(block.typeId)) {
      for (const [movementId, entries] of Object.entries(block.sets || {})) {
        for (const set of Array.isArray(entries) ? entries : []) {
          if (!didSomething(set)) continue;
          const identity = set.id ? `${movementId}:${set.id}` : null;
          if (identity && seenSets.has(identity)) continue;
          if (identity) seenSets.add(identity);
          sets += 1;
        }
      }
    } else if (block.typeId === 'cardio') {
      const walk = String(block.cardio?.sport || block.cardioType || 'run').toLowerCase() === 'walk';
      if (walk) { walkMinutes += n(block.cardio?.durationMin); walkKm += n(block.cardio?.distanceKm); }
      else { otherMinutes += n(block.cardio?.durationMin); otherKm += n(block.cardio?.distanceKm); }
    } else if (block.typeId === 'duration') {
      durationMinutes += n(block.duration?.minutes);
    } else if (block.typeId === 'session') {
      if ((block.session || block).completed) sessionXp += 10;
    } else if (block.typeId === 'recovery') {
      const injury = block.isProfileRecoveryBlock && String(block.profileRecoveryMode || '').toLowerCase() === 'injury';
      const done = injury ? n(block.duration?.minutes) > 0 : block.recoveryDone;
      if (done) recoveryXp = Math.max(recoveryXp, injury ? 10 : 5);
    }
  }
  const walkBase = ceilXp(walkMinutes / 2) + ceilXp(walkKm * 2);
  const otherBase = ceilXp(otherMinutes / 2) + ceilXp(otherKm * 2);
  const cardioBaseXp = Math.round(walkBase * 0.6) + otherBase;
  const bonuses = {strength:sets ? 5 : 0, cardio:otherBase ? 5 : walkBase ? 3 : 0, duration:durationMinutes ? 5 : 0};
  return {
    strengthXp: sets * 2 + bonuses.strength,
    cardioXp: cardioBaseXp + bonuses.cardio,
    durationXp: ceilXp(durationMinutes / 5) + bonuses.duration,
    sessionXp, recoveryXp,
    setsXp:sets * 2, setsLogged:sets,
    cardioKm:walkKm + otherKm,
    customMin:walkMinutes + otherMinutes + durationMinutes,
    cardioMode:walkBase && otherBase ? 'mixed' : walkBase ? 'casual' : otherBase ? 'progressive' : null,
    categoryBonuses:bonuses,
  };
}

// Allocate category totals across their contributing blocks for the verification
// breakdown. Largest remainders keep displayed whole XP equal to the daily scorer.
export function revisedPhysicalXpAllocations(log) {
  const totals = revisedActivityXp(log);
  const groups = new Map();
  const seenBlocks = new Set();
  (log?.blocks || []).forEach((block, index) => {
    if (!block || block.cancelled || block.suspendedByRecoveryMode) return;
    if (block.id && seenBlocks.has(block.id)) return;
    if (block.id) seenBlocks.add(block.id);
    let key, work = 0;
    if (strengthTypes.has(block.typeId)) {
      key = 'strengthXp';
      work = Object.values(block.sets || {}).reduce((sum, sets) => sum + (Array.isArray(sets) ? sets.filter(didSomething).length : 0), 0) * 2;
    } else if (block.typeId === 'cardio') {
      key = 'cardioXp';
      const walk = String(block.cardio?.sport || block.cardioType || 'run').toLowerCase() === 'walk';
      work = (n(block.cardio?.durationMin) / 2 + n(block.cardio?.distanceKm) * 2) * (walk ? 0.6 : 1);
    } else if (block.typeId === 'duration') { key = 'durationXp'; work = n(block.duration?.minutes) / 5; }
    else if (block.typeId === 'session') { key = 'sessionXp'; work = (block.session || block).completed ? 10 : 0; }
    if (!key || !work) return;
    const entries = groups.get(key) || [];
    entries.push({index, work, id:String(block.id || index)});
    groups.set(key, entries);
  });
  const allocations = new Map();
  for (const [key, entries] of groups) {
    const work = entries.reduce((sum, entry) => sum + entry.work, 0);
    for (const entry of entries) {
      entry.exact = totals[key] * entry.work / work;
      entry.xp = Math.floor(entry.exact);
    }
    let remaining = totals[key] - entries.reduce((sum, entry) => sum + entry.xp, 0);
    entries.sort((a,b) => (b.exact-b.xp)-(a.exact-a.xp) || a.id.localeCompare(b.id));
    for (const entry of entries) {
      if (remaining > 0) { entry.xp += 1; remaining -= 1; }
      allocations.set(entry.index, entry.xp);
    }
  }
  return allocations;
}
