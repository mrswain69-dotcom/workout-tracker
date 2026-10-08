// Publish a sport collection only when all eight portrait assets are finished.
// Session progress and historical reward keys remain independent of artwork.
export const SPORT_AVATAR_ARTWORK_READY = ["football", "cricket", "rugby"];

export function hasSportAvatarArtwork(sportKey) {
  return SPORT_AVATAR_ARTWORK_READY.includes(sportKey);
}

export function sportAvatarArtworkSrc(sportKey, tierKey) {
  return hasSportAvatarArtwork(sportKey)
    ? `/avatars/sport/${sportKey}_${tierKey}.png`
    : null;
}
