import { consistencyLogBlockCompletedOnDay } from './consistencyEngine.js';

export const GROUP_BLOCK_COUNT_COLUMNS = Object.freeze([
  { key: 'strength', label: 'Strength' },
  { key: 'cardio', label: 'Cardio' },
  { key: 'duration', label: 'Duration' },
  { key: 'session', label: 'Sessions' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'total', label: 'Total blocks' },
]);
const cardioTypes = new Set(['cardio', 'run', 'swim', 'walk', 'row', 'cycle', 'bike']);
const strengthTypes = new Set(['strength', 'hiit', 'box']);

// Group-safe aggregate activity totals; never return block labels or health details.
// Completion follows the existing recorded-block rules, rather than target attainment.
export function countCompletedGroupBlocks(logs = [], startDate, endDate) {
  const counts = { strength: 0, cardio: 0, duration: 0, session: 0, tasks: 0, total: 0 };
  const seen = new Set();
  for (const row of logs) {
    const date = String(row?.date_ymd || row?.date || '');
    if (!date || date < startDate || date > endDate) continue;
    for (const [index, block] of (Array.isArray(row?.log_json?.blocks) ? row.log_json.blocks : []).entries()) {
      if (!block || block.cancelled || block.suspendedByRecoveryMode) continue;
      const type = String(block.typeId || '').toLowerCase();
      const category = strengthTypes.has(type) ? 'strength' : cardioTypes.has(type) ? 'cardio' : ['duration','session','tasks'].includes(type) ? type : null;
      if (!category) continue;
      const key = `${date}:${block.id || `row-${row.id || ''}-${index}`}`;
      if (seen.has(key)) continue;
      const tasks = Array.isArray(block.tasks) ? block.tasks : [];
      const complete = category === 'tasks'
        ? tasks.length > 0 && tasks.every(task => task?.id && block.tasksDone?.[task.id] === true)
        : consistencyLogBlockCompletedOnDay(block, date);
      if (!complete) continue;
      seen.add(key);
      counts[category] += 1;
      counts.total += 1;
    }
  }
  return counts;
}

export function attachGroupBlockCounts(period, memberships = [], logs = [], boundsForMember) {
  if (!period || !Array.isArray(period.rows)) return period;
  const members = new Map(memberships.map(member => [member.id, member]));
  const byProfile = new Map();
  for (const log of logs) {
    const rows = byProfile.get(log.profile_id) || [];
    rows.push(log); byProfile.set(log.profile_id, rows);
  }
  return { ...period, rows: period.rows.map(row => {
    const member = members.get(row.membership_id);
    if (!member) return { ...row, completedBlocks: null };
    const bounds = boundsForMember(member, period);
    const start = bounds?.eligibleFrom || period.startDate;
    const end = bounds?.eligibleThrough || period.endDate;
    return { ...row, completedBlocks: countCompletedGroupBlocks(byProfile.get(member.profile_id) || [], start, end) };
  }) };
}
