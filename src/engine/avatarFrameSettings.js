export const PRESTIGE_FRAME_UNLOCK_XP = 10_000;

export const PRESTIGE_FRAME_OPTIONS = Object.freeze([
  { key: "prestige_cyan_gold", label: "Cyan / Gold Prestige" },
  { key: "prestige_red_black", label: "Red / Black Power" },
  { key: "prestige_neon_lime", label: "Neon Lime Speed" },
  { key: "prestige_pink_cyan", label: "Pink / Cyan Elite" },
  { key: "prestige_ice_blue", label: "Ice Blue Focus" },
]);

export const DEFAULT_PRESTIGE_FRAME = PRESTIGE_FRAME_OPTIONS[0].key;

export function getPrestigeFrameState(totalXp) {
  const xp = Math.max(0, Number.isFinite(Number(totalXp)) ? Number(totalXp) : 0);
  const remainingXp = Math.max(0, PRESTIGE_FRAME_UNLOCK_XP - xp);

  return {
    earned: xp >= PRESTIGE_FRAME_UNLOCK_XP,
    xp,
    remainingXp,
    progressPct: Math.min(100, Math.round((xp / PRESTIGE_FRAME_UNLOCK_XP) * 100)),
  };
}

export function normalisePrestigeFrameKey(value) {
  return PRESTIGE_FRAME_OPTIONS.some((frame) => frame.key === value)
    ? value
    : DEFAULT_PRESTIGE_FRAME;
}
