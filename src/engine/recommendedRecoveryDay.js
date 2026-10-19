import { blockHasRecordedActivity } from './activityCalendarEngine.js';

const TRAINING_TYPES = new Set(['strength', 'hiit', 'box', 'cardio', 'run', 'swim', 'walk', 'row', 'cycle', 'bike', 'duration', 'session']);

// A system-recommended recovery replaces unstarted planned training for this
// date only. Keep recorded work and user-added extras; never edit the Plan.
export function applyRecommendedRecoveryDay(log) {
  if (!log || !Array.isArray(log.blocks)) return log;
  const active = log.blocks.some(block => block?.typeId === 'recovery' && block.systemRecommended && !block.cancelled);
  return { ...log, blocks: log.blocks.map(original => {
    if (!original) return original;
    let block = original;
    if (block.suspendedByRecommendedRecovery) {
      const profileMode = log.meta?.profileRecoveryMode || '';
      block = { ...block, suspendedByRecommendedRecovery: false,
        suspendedByRecoveryMode: !!profileMode,
        suspendedByRecoveryReason: profileMode };
    }
    if (active && !block.isExtra && !block.cancelled && !block.suspendedByRecoveryMode &&
        TRAINING_TYPES.has(block.typeId) && !blockHasRecordedActivity(block)) {
      return { ...block, suspendedByRecommendedRecovery: true,
        suspendedByRecoveryMode: true, suspendedByRecoveryReason: 'recommended-recovery' };
    }
    return block;
  }) };
}
