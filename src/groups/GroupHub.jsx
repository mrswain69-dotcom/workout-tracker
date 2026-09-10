import React, { useEffect, useMemo, useState } from "react";
import {
  createGroup,
  createGroupInvite,
  joinGroup,
  leaveGroup,
  listGroupDirectory,
  listGroupInvites,
  listProfileGroups,
  previewGroupInvite,
  removeGroupMember,
  revokeGroupInvite,
  setGroupMemberRole,
  updateGroupDetails,
  updateGroupNickname,
} from "./groupDb";
import { groupAvatarFrameClass, resolveGroupAvatar } from "./groupIdentity";
import GroupWeeklyXp from "./GroupWeeklyXp.jsx";
import GroupConsistency from "./GroupConsistency.jsx";
import "./GroupHub.css";

function errorText(error, fallback = "Something went wrong.") {
  return error?.message || String(error || fallback);
}

function formatShortDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function MemberIdentity({ member, isSelf = false }) {
  const avatar = resolveGroupAvatar(member?.avatar_id);
  const frameClass = groupAvatarFrameClass({
    avatarFrame: member?.avatar_frame,
    avatarFramesEnabled: member?.avatar_frames_enabled,
  });
  return (
    <div className="groupMemberIdentity">
      <span className={`groupMemberAvatar ${frameClass}`} aria-hidden="true">
        {avatar.imgSrc ? <img src={avatar.imgSrc} alt="" /> : <span>{avatar.emoji || "🙂"}</span>}
      </span>
      <span className="groupMemberText">
        <strong>{member?.nickname || "Athlete"}{isSelf ? " · You" : ""}</strong>
        <span>{member?.role === "admin" ? "Admin" : "Member"}</span>
      </span>
    </div>
  );
}

export default function GroupHub({ profiles = [], activeProfileId, onClose }) {
  const activeProfile = useMemo(
    () => profiles.find((profile) => profile.id === activeProfileId) || profiles[0] || null,
    [profiles, activeProfileId]
  );
  const profileId = activeProfile?.id || "";

  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [directory, setDirectory] = useState([]);
  const [invites, setInvites] = useState([]);
  const [view, setView] = useState("groups");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [newInviteCode, setNewInviteCode] = useState("");

  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createType, setCreateType] = useState("private");
  const [createNickname, setCreateNickname] = useState(activeProfile?.name || "");

  const [joinCode, setJoinCode] = useState("");
  const [joinPreview, setJoinPreview] = useState(null);
  const [joinNickname, setJoinNickname] = useState(activeProfile?.name || "");

  const selectedGroup = groups.find((group) => group.id === selectedGroupId) || null;
  const ownMembership = selectedGroup?.membership || null;
  const isAdmin = ownMembership?.role === "admin";

  async function refreshGroups(preferredGroupId = "") {
    if (!profileId) {
      setGroups([]);
      setSelectedGroupId("");
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: loadError } = await listProfileGroups(profileId);
    setLoading(false);
    if (loadError) {
      setError(errorText(loadError, "Could not load Groups."));
      return;
    }
    const next = data || [];
    setGroups(next);
    const wanted = preferredGroupId || selectedGroupId;
    setSelectedGroupId(
      next.some((group) => group.id === wanted) ? wanted : next[0]?.id || ""
    );
  }

  async function refreshSelected(group = selectedGroup) {
    if (!group?.id) {
      setDirectory([]);
      setInvites([]);
      return;
    }
    const [{ data: members, error: memberError }, inviteResult] = await Promise.all([
      listGroupDirectory(group.id),
      group.membership?.role === "admin" ? listGroupInvites(group.id) : Promise.resolve({ data: [], error: null }),
    ]);
    if (memberError) setError(errorText(memberError, "Could not load Group members."));
    else setDirectory(members || []);
    if (inviteResult.error) setError(errorText(inviteResult.error, "Could not load invites."));
    else setInvites(inviteResult.data || []);
  }

  useEffect(() => {
    setCreateNickname(activeProfile?.name || "");
    setJoinNickname(activeProfile?.name || "");
    setJoinPreview(null);
    setJoinCode("");
    setError("");
    setNotice("");
    setView("groups");
    refreshGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  useEffect(() => {
    refreshSelected();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroupId, ownMembership?.role]);

  async function run(action, successText = "") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await action();
      if (result?.error) throw result.error;
      if (successText) setNotice(successText);
      return result?.data;
    } catch (err) {
      setError(errorText(err));
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate(event) {
    event.preventDefault();
    const created = await run(() => createGroup({
      profileId,
      name: createName,
      nickname: createNickname,
      description: createDescription,
      groupType: createType,
    }), "Group created.");
    if (!created?.group_id) return;
    setCreateName("");
    setCreateDescription("");
    setView("groups");
    await refreshGroups(created.group_id);
  }

  async function handlePreview(event) {
    event.preventDefault();
    setJoinPreview(null);
    const preview = await run(() => previewGroupInvite(joinCode));
    if (!preview) {
      if (!error) setError("That invite is invalid, expired, revoked or fully used.");
      return;
    }
    setJoinPreview(preview);
  }

  async function handleJoin() {
    const joined = await run(() => joinGroup({
      profileId,
      inviteCode: joinCode,
      nickname: joinNickname,
    }), "Group joined.");
    if (!joined?.group_id) return;
    setJoinCode("");
    setJoinPreview(null);
    setView("groups");
    await refreshGroups(joined.group_id);
  }

  async function handleNicknameSave() {
    const nickname = window.prompt("Group nickname / pseudonym:", ownMembership?.nickname || "");
    if (nickname === null) return;
    const result = await run(() => updateGroupNickname(selectedGroup.id, profileId, nickname), "Nickname updated.");
    if (result === null && error) return;
    await refreshGroups(selectedGroup.id);
    await refreshSelected(selectedGroup);
  }

  async function handleLeave() {
    if (!window.confirm(`Leave ${selectedGroup.name}?`)) return;
    const result = await run(() => leaveGroup(selectedGroup.id, profileId), "Group left.");
    if (result === null && error) return;
    setSelectedGroupId("");
    await refreshGroups();
  }

  async function handleCreateInvite() {
    const created = await run(() => createGroupInvite(selectedGroup.id, { expiresInDays: 7, maxUses: 1 }), "Invite created.");
    if (!created?.invite_code) return;
    setNewInviteCode(created.invite_code);
    await refreshSelected(selectedGroup);
  }

  async function copyInvite() {
    if (!newInviteCode) return;
    try {
      await navigator.clipboard.writeText(newInviteCode);
      setNotice("Invite code copied.");
    } catch {
      setNotice("Select and copy the invite code below.");
    }
  }

  async function handleMemberRole(member) {
    const nextRole = member.role === "admin" ? "member" : "admin";
    if (!window.confirm(`${nextRole === "admin" ? "Make" : "Change"} ${member.nickname} ${nextRole === "admin" ? "an Admin" : "to Member"}?`)) return;
    await run(() => setGroupMemberRole(selectedGroup.id, member.membership_id, nextRole), `${member.nickname} updated.`);
    await refreshGroups(selectedGroup.id);
    await refreshSelected(selectedGroup);
  }

  async function handleRemoveMember(member) {
    if (!window.confirm(`Remove ${member.nickname} from ${selectedGroup.name}?`)) return;
    await run(() => removeGroupMember(selectedGroup.id, member.membership_id), `${member.nickname} removed.`);
    await refreshSelected(selectedGroup);
  }

  async function handleRevokeInvite(invite) {
    await run(() => revokeGroupInvite(invite.id), "Invite revoked.");
    await refreshSelected(selectedGroup);
  }

  async function handleEditGroup() {
    const name = window.prompt("Group name:", selectedGroup.name);
    if (name === null) return;
    const description = window.prompt("Group description:", selectedGroup.description || "");
    if (description === null) return;
    await run(() => updateGroupDetails(selectedGroup.id, { name, description }), "Group details updated.");
    await refreshGroups(selectedGroup.id);
  }

  const activeInvites = invites.filter((invite) => !invite.revoked_at && new Date(invite.expires_at).getTime() > Date.now() && invite.use_count < invite.max_uses);

  return (
    <div className="groupHubBackdrop" role="dialog" aria-modal="true" aria-label="Groups">
      <section className="groupHubShell">
        <header className="groupHubHeader">
          <div>
            <div className="groupHubEyebrow">GROUPS & TEAMS</div>
            <h2>Train together. Improve together.</h2>
            <p>{activeProfile ? `Group identity for ${activeProfile.name}` : "Choose an athlete profile first."}</p>
          </div>
          <button className="groupHubClose" type="button" onClick={onClose} aria-label="Close Groups">×</button>
        </header>

        <nav className="groupHubTabs" aria-label="Group actions">
          <button className={view === "groups" ? "active" : ""} onClick={() => setView("groups")}>My Groups</button>
          <button className={view === "join" ? "active" : ""} onClick={() => setView("join")}>Join</button>
          <button className={view === "create" ? "active" : ""} onClick={() => setView("create")}>Create</button>
        </nav>

        {error ? <div className="groupHubMessage error" role="alert">{error}</div> : null}
        {notice ? <div className="groupHubMessage success">{notice}</div> : null}

        {!profileId ? (
          <div className="groupHubEmpty">Choose an athlete profile before using Groups.</div>
        ) : view === "create" ? (
          <form className="groupHubForm" onSubmit={handleCreate}>
            <h3>Create a Group</h3>
            <label>Group name<input value={createName} maxLength={80} onChange={(e) => setCreateName(e.target.value)} placeholder="e.g. Falcons Performance Squad" required /></label>
            <label>Your Group nickname<input value={createNickname} maxLength={32} onChange={(e) => setCreateNickname(e.target.value)} placeholder="Shown to this Group" required /></label>
            <label>Type<select value={createType} onChange={(e) => setCreateType(e.target.value)}><option value="private">Private group</option><option value="squad">Squad / team</option><option value="club">Club</option></select></label>
            <label>Description<textarea value={createDescription} maxLength={500} onChange={(e) => setCreateDescription(e.target.value)} placeholder="Optional purpose or team description" /></label>
            <div className="groupHubPrivacyNote">Members see your Group nickname, selected avatar and selected cosmetic frame/glow — not your private profile name, plan, logs or Assessment details.</div>
            <button className="groupHubPrimary" disabled={busy} type="submit">{busy ? "Creating…" : "Create Group"}</button>
          </form>
        ) : view === "join" ? (
          <div className="groupHubForm">
            <h3>Join with an invite</h3>
            <form onSubmit={handlePreview}>
              <label>Invite code<input value={joinCode} onChange={(e) => setJoinCode(e.target.value.trim())} placeholder="Paste invite code" autoCapitalize="none" autoCorrect="off" required /></label>
              <button className="groupHubSecondary" disabled={busy || !joinCode} type="submit">Check invite</button>
            </form>
            {joinPreview ? (
              <div className="groupInvitePreview">
                <strong>{joinPreview.group_name}</strong>
                <span>{joinPreview.group_type === "squad" ? "Squad / team" : joinPreview.group_type === "club" ? "Club" : "Private group"}</span>
                <span>Invite valid until {formatShortDate(joinPreview.expires_at)}</span>
                <label>Your nickname in this Group<input value={joinNickname} maxLength={32} onChange={(e) => setJoinNickname(e.target.value)} /></label>
                <button className="groupHubPrimary" disabled={busy || !joinNickname.trim()} type="button" onClick={handleJoin}>Join Group</button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="groupHubWorkspace">
            <aside className="groupHubGroupList">
              <div className="groupHubSectionTitle">My Groups</div>
              {loading ? <div className="groupHubMuted">Loading…</div> : groups.length ? groups.map((group) => (
                <button key={group.id} className={group.id === selectedGroupId ? "selected" : ""} onClick={() => setSelectedGroupId(group.id)}>
                  <strong>{group.name}</strong>
                  <span>{group.membership.nickname} · {group.membership.role === "admin" ? "Admin" : "Member"}</span>
                </button>
              )) : (
                <div className="groupHubEmpty compact">No Groups yet. Create one or join with an invite.</div>
              )}
            </aside>

            <main className="groupHubDetail">
              {!selectedGroup ? (
                <div className="groupHubEmpty">Your Groups will appear here.</div>
              ) : (
                <>
                  <div className="groupHubGroupHeading">
                    <div><span className="groupHubType">{selectedGroup.group_type === "squad" ? "SQUAD" : selectedGroup.group_type === "club" ? "CLUB" : "PRIVATE"}</span><h3>{selectedGroup.name}</h3><p>{selectedGroup.description || "Private performance group."}</p></div>
                    {isAdmin ? <button className="groupHubSecondary" onClick={handleEditGroup} disabled={busy}>Edit Group</button> : null}
                  </div>

                  <div className="groupHubOwnIdentity">
                    <MemberIdentity member={{ ...ownMembership, membership_id: ownMembership.id }} isSelf />
                    <button className="groupHubSecondary" onClick={handleNicknameSave} disabled={busy}>Edit nickname</button>
                  </div>

                  <GroupWeeklyXp
                    group={selectedGroup}
                    membership={ownMembership}
                    isAdmin={isAdmin}
                    onGroupChanged={refreshGroups}
                  />

                  <GroupConsistency
                    group={selectedGroup}
                    membership={ownMembership}
                  />

                  <section className="groupHubPanel">
                    <div className="groupHubPanelHeading"><div><h4>Members</h4><span>{directory.length} / {selectedGroup.max_members}</span></div>{isAdmin ? <button className="groupHubPrimary small" onClick={handleCreateInvite} disabled={busy || directory.length >= selectedGroup.max_members}>Create invite</button> : null}</div>
                    <div className="groupMemberList">
                      {directory.map((member) => {
                        const self = member.membership_id === ownMembership.id;
                        return <div key={member.membership_id} className={`groupMemberRow ${self ? "self" : ""}`}><MemberIdentity member={member} isSelf={self} />{isAdmin && !self ? <div className="groupMemberActions"><button onClick={() => handleMemberRole(member)} disabled={busy}>{member.role === "admin" ? "Make member" : "Make admin"}</button><button onClick={() => handleRemoveMember(member)} disabled={busy}>Remove</button></div> : null}</div>;
                      })}
                    </div>
                  </section>

                  {isAdmin ? (
                    <section className="groupHubPanel">
                      <div className="groupHubPanelHeading"><div><h4>Invites</h4><span>Share privately</span></div></div>
                      {newInviteCode ? <div className="groupInviteSecret"><div><strong>New invite code</strong><span>Shown in full only now. The database stores only its hash.</span></div><code>{newInviteCode}</code><button className="groupHubSecondary" onClick={copyInvite}>Copy</button></div> : null}
                      {activeInvites.length ? <div className="groupInviteList">{activeInvites.map((invite) => <div key={invite.id}><span><strong>{invite.code_hint}</strong> · {invite.use_count}/{invite.max_uses} used · expires {formatShortDate(invite.expires_at)}</span><button onClick={() => handleRevokeInvite(invite)} disabled={busy}>Revoke</button></div>)}</div> : <div className="groupHubMuted">No active invites.</div>}
                    </section>
                  ) : null}

                  <div className="groupHubFooterActions"><button className="groupHubDanger" onClick={handleLeave} disabled={busy}>Leave Group</button>{isAdmin ? <span>Last Admins must promote another Admin before leaving.</span> : null}</div>
                </>
              )}
            </main>
          </div>
        )}
      </section>
    </div>
  );
}
