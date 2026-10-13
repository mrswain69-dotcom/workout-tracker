import { performanceObservations } from './personalBestBadgeEngine.js';
import { XP_PROGRESSION_RULES as rules } from './xpRuleVersions.js';

const percentGain = (value, baseline) => baseline > 0 ? Math.max(0, (value / baseline - 1) * 100) : 0;
const wholeXp = (percent, rate, cap) => Math.min(cap, Math.floor(percent * rate + 1e-7));

function bestWeighted(sets) {
  // Compare actual paired sets, not independent maximum weight and repetitions.
  return sets.reduce((best, set) => !best || set.weight * set.reps > best.weight * best.reps ||
    (set.weight * set.reps === best.weight * best.reps && set.weight > best.weight) ? set : best, null);
}

export function buildProgressionXpByDate(records) {
  const observationsByDate = new Map();
  for (const row of records) {
    const observations = performanceObservations(row.log);
    observationsByDate.set(row.date_ymd, [...(observationsByDate.get(row.date_ymd) || []), ...observations]);
  }
  const previous = new Map();
  const result = new Map();
  for (const [date, observations] of [...observationsByDate].sort(([a], [b]) => a.localeCompare(b))) {
    const byKey = new Map();
    for (const observation of observations) {
      const sets = byKey.get(observation.key) || [];
      sets.push(observation);
      byKey.set(observation.key, sets);
    }
    const details = [];
    let strengthComparableCount = 0;
    let cardioComparableCount = 0;
    for (const [key, current] of byKey) {
      const baseline = previous.get(key);
      const kind = current[0].kind;
      if (baseline) {
        if (kind === 'cardio') cardioComparableCount += 1;
        else strengthComparableCount += 1;
        let percent = 0;
        if (kind === 'weighted') {
          const before = bestWeighted(baseline);
          const after = bestWeighted(current);
          // Lowering either reps or load changes the test rather than proving an improvement.
          if (after.weight >= before.weight && after.reps >= before.reps) {
            percent = percentGain(after.weight * after.reps, before.weight * before.reps);
          }
        } else if (kind === 'cardio') {
          const before = Math.min(...baseline.map(s => s.value));
          const after = Math.min(...current.map(s => s.value));
          // Faster over the same sport/distance: percentage reduction in time.
          percent = Math.max(0, (before - after) / before * 100);
        } else {
          percent = percentGain(Math.max(...current.map(s => s.value)), Math.max(...baseline.map(s => s.value)));
        }
        const rate = kind === 'weighted' ? rules.weightedXpPerPercent : kind === 'cardio' ? rules.cardioXpPerPercent : rules.repsOrHoldXpPerPercent;
        const cap = kind === 'weighted' ? rules.weightedCap : kind === 'cardio' ? rules.cardioCap : rules.repsOrHoldCap;
        const xp = wholeXp(percent, rate, cap);
        if (percent > 1e-7) details.push({key, kind, label:current[0].label, percent, xp});
      }
      // Keep the last comparable day; entries from today never compare with each other.
      previous.set(key, current);
    }
    const strength = details.filter(d => d.kind !== 'cardio').sort((a,b) => b.xp-a.xp || b.percent-a.percent || a.key.localeCompare(b.key))[0];
    const cardio = details.filter(d => d.kind === 'cardio').sort((a,b) => b.xp-a.xp || b.percent-a.percent || a.key.localeCompare(b.key))[0];
    result.set(date, {
      strengthProgressXp: strength?.xp || 0,
      cardioProgressXp: cardio?.xp || 0,
      strengthComparableCount,
      cardioComparable: cardioComparableCount > 0,
      progressComparableCount: strengthComparableCount + cardioComparableCount,
      progressionWins: Number((strength?.xp || 0) > 0) + Number((cardio?.xp || 0) > 0),
      progressionDetails: [strength, cardio].filter(Boolean),
    });
  }
  return result;
}
