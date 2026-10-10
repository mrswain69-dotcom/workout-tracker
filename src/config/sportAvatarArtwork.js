// Publish a sport collection only when all eight portrait assets are finished.
// Session progress and historical reward keys remain independent of artwork.
export const SPORT_AVATAR_ARTWORK_READY = ["football", "cricket", "rugby"];
export const PAIRED_SPORT_AVATAR_ARTWORK_READY = ["football", "rugby", "cricket", "basketball", "tennis", "badminton", "netball", "hockey", "fencing", "martial_arts", "indoor_rowing", "outdoor_rowing", "yoga"];
// Refined artwork reuses the persisted paired_v2 cosmetic choice and logical reward.
const REFINED_PAIRED_TIERS = { football: ["gold", "platinum", "diamond", "elite", "champion", "unreal"], rugby: ["gold", "platinum", "diamond", "elite", "champion", "unreal"] };
const TIERS = ["bronze", "silver", "gold", "platinum", "diamond", "elite", "champion", "unreal"];

export function sportAvatarAppearance(sportKey, appearance) {
  return PAIRED_SPORT_AVATAR_ARTWORK_READY.includes(sportKey) &&
    appearance?.edition === "paired_v2" && ["male", "female"].includes(appearance?.variant)
    ? { edition: "paired_v2", variant: appearance.variant } : null;
}

export function hasSportAvatarArtwork(sportKey) {
  return SPORT_AVATAR_ARTWORK_READY.includes(sportKey) || PAIRED_SPORT_AVATAR_ARTWORK_READY.includes(sportKey);
}

export function sportAvatarArtworkSrc(sportKey, tierKey, appearance) {
  if (!hasSportAvatarArtwork(sportKey) || !TIERS.includes(tierKey)) return null;
  const paired = sportAvatarAppearance(sportKey, appearance) ||
    (!SPORT_AVATAR_ARTWORK_READY.includes(sportKey) ? { edition: "paired_v2", variant: "male" } : null);
  const revision = REFINED_PAIRED_TIERS[sportKey]?.includes(tierKey) ? "v3" : "v2";
  return paired ? `/avatars/sport/${sportKey}_${tierKey}_${paired.variant}_${revision}.png`
    : `/avatars/sport/${sportKey}_${tierKey}.png`;
}
