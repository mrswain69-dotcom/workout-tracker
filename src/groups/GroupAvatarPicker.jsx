import { nativeArtworkSrc } from "../native/artwork.js";
import React, { useState } from "react";
import { resolveAvatarIdentity } from "../config/avatarIdentity";
import { PAIRED_SPORT_AVATAR_ARTWORK_READY } from "../config/sportAvatarArtwork";

export default function GroupAvatarPicker({ membership, avatarIds = [], busy, onSelect }) {
  const [variant, setVariant] = useState(membership?.group_avatar_appearance?.variant || "male");
  const appearance = { edition: "paired_v2", variant };
  const choices = [...new Set(avatarIds)].map(id => resolveAvatarIdentity(id, appearance)).filter(Boolean);
  return <details className="groupCompactDetails groupAvatarPicker">
    <summary>Group avatar <small>{membership?.group_avatar_override ? "Custom" : "Main avatar"}</small></summary>
    <p>Choose an unlocked avatar just for this group.</p>
    <div className="groupAvatarPickerControls">
      <button type="button" className="groupHubSecondary" disabled={busy} onClick={() => onSelect(null, null)}>Use main avatar</button>
      <label>Sport appearance <select aria-label="Group sport appearance" value={variant} onChange={e => setVariant(e.target.value)}><option value="male">Male</option><option value="female">Female</option></select></label>
    </div>
    <div className="groupAvatarPickerGrid">
      {choices.map(avatar => {
        const paired = PAIRED_SPORT_AVATAR_ARTWORK_READY.includes(avatar.unlockSource?.requirement?.sportKey);
        return <button key={avatar.id} type="button" className="groupAvatarChoice" disabled={busy}
          aria-label={`Use ${avatar.label} in this group`}
          aria-pressed={membership?.group_avatar_override === avatar.id && (!paired || membership?.group_avatar_appearance?.variant === variant)}
          onClick={() => onSelect(avatar.id, paired ? appearance : null)}>
          {avatar.imgSrc ? <img src={nativeArtworkSrc(avatar.imgSrc)} alt="" loading="lazy" decoding="async" /> : <span>{avatar.emoji || "🙂"}</span>}
          <span>{avatar.label}</span>
        </button>;
      })}
    </div>
    {!choices.length ? <small>Unlock and claim avatars in Rewards to choose one here.</small> : null}
  </details>;
}
