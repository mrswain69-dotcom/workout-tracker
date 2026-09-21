import React from "react";
import { groupAvatarFrameClass, resolveGroupAvatar } from "./groupIdentity";

export function GroupAvatar({ member, className = "groupXpAvatar" }) {
  const avatar = resolveGroupAvatar(member?.avatar_id);
  const frameClass = groupAvatarFrameClass({
    avatarFrame: member?.avatar_frame,
    avatarFramesEnabled: member?.avatar_frames_enabled,
  });

  return (
    <span className={`${className} ${frameClass}`} aria-hidden="true">
      {avatar.imgSrc ? <img src={avatar.imgSrc} alt="" /> : <span>{avatar.emoji || "🙂"}</span>}
    </span>
  );
}

export default function GroupIdentityTrigger({
  member,
  isSelf = false,
  onOpen,
  className = "",
  role,
}) {
  const label = <strong>{member?.nickname || "Athlete"}{isSelf ? " · You" : ""}</strong>;

  if (!onOpen) {
    const content = (
      <span className={`groupIdentityTriggerStatic ${role ? "groupIdentityCellContent" : className}`}>
        <GroupAvatar member={member} />
        {label}
      </span>
    );
    return role ? <span className={className} role={role}>{content}</span> : content;
  }

  const trigger = (
    <button
      type="button"
      className={`groupIdentityTrigger ${role ? "groupIdentityCellContent" : className}`}
      onClick={() => onOpen(member)}
      aria-label={`Open ${member?.nickname || "athlete"} avatar identity`}
    >
      <GroupAvatar member={member} />
      {label}
    </button>
  );
  return role ? <span className={className} role={role}>{trigger}</span> : trigger;
}
