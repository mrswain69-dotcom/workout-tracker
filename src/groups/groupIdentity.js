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


// Live rows use the current group identity; final results retain their recorded avatar.
export function withGroupCosmetics(rows = [], directory = [], frozen = false) {
  const members = new Map(directory.map(member => [member.membership_id, member]));
  return rows.map(row => {
    const member = members.get(row.membership_id);
    if (!member) return row;
    if (frozen) return { ...row, sport_avatar_appearance: row.sport_avatar_appearance || (member.avatar_id === row.avatar_id ? member.sport_avatar_appearance : null) };
    return { ...row, avatar_id: member.avatar_id, sport_avatar_appearance: member.sport_avatar_appearance, avatar_frame: member.avatar_frame, avatar_frames_enabled: member.avatar_frames_enabled };
  });
}
