import { resolveAvatarIdentity } from "../config/avatarIdentity";
import { AVATAR_PACKS } from "../config/avatars";

const xpAvatarMap = new Map(
  AVATAR_PACKS.flatMap((pack) => pack.avatars || []).map((avatar) => [avatar.id, avatar])
);

export function resolveGroupAvatar(avatarId, appearance) {
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

  const identity = resolveAvatarIdentity(id, appearance);
  if (identity?.imgSrc) return { id, label: identity.label, emoji: "", imgSrc: identity.imgSrc };

  return { id, label: "Athlete", emoji: "🙂", imgSrc: "" };
}

export function groupAvatarFrameClass({ avatarFrame, avatarFramesEnabled } = {}) {
  if (avatarFramesEnabled === false) return "";
  const frame = typeof avatarFrame === "string" ? avatarFrame.trim() : "";
  return frame ? `avatarFrame-${frame}` : "";
}
