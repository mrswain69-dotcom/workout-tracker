import { AVATAR_PACKS } from "../config/avatars";

const xpAvatarMap = new Map(
  AVATAR_PACKS.flatMap((pack) => pack.avatars || []).map((avatar) => [avatar.id, avatar])
);

export function resolveGroupAvatar(avatarId) {
  const id = typeof avatarId === "string" ? avatarId : "";
  if (!id) return { id: "", label: "Athlete", emoji: "🙂", imgSrc: "" };

  const xpAvatar = xpAvatarMap.get(id);
  if (xpAvatar) {
    return {
      id,
      label: xpAvatar.label || "Athlete",
      emoji: xpAvatar.emoji || "",
      imgSrc: xpAvatar.imgSrc || "",
    };
  }

  if (id.startsWith("sport_avatar_")) {
    const slug = id.slice("sport_avatar_".length);
    if (slug) {
      return {
        id,
        label: "Sport Mastery avatar",
        emoji: "",
        imgSrc: `/avatars/sport/${slug}.png`,
      };
    }
  }

  return { id, label: "Athlete", emoji: "🙂", imgSrc: "" };
}

export function groupAvatarFrameClass({ avatarFrame, avatarFramesEnabled } = {}) {
  if (avatarFramesEnabled === false) return "";
  const frame = typeof avatarFrame === "string" ? avatarFrame.trim() : "";
  return frame ? `avatarFrame-${frame}` : "";
}
