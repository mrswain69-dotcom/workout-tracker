// Rules are selected by the recorded activity date, never the edit/claim date.
// 13 October is preserved in full; the first revised day is 14 October 2026.
export const XP_RULES_ACTIVATION_DATE = '2026-10-14';
export const LEGACY_XP_RULE_VERSION = 3;
export const REVISED_XP_RULE_VERSION = 4;
export const XP_PROGRESSION_RULES = Object.freeze({
  repsOrHoldXpPerPercent: 0.5,
  repsOrHoldCap: 5,
  weightedXpPerPercent: 1,
  weightedCap: 15,
  cardioXpPerPercent: 1,
  cardioCap: 10,
  strengthDailyCap: 15,
  personalBestDaily: 15,
  personalBestPriorDates: 3,
});
export function xpRuleVersionForDate(date) {
  return date >= XP_RULES_ACTIVATION_DATE ? REVISED_XP_RULE_VERSION : LEGACY_XP_RULE_VERSION;
}
