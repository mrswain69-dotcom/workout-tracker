import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  createGroup,
  createGroupInvite,
  getGroupJoinSettings,
  joinGroupWithCode,
  leaveGroup,
  listGroupDirectory,
  listGroupInvites,
  listGroupJoinRequests,
  listProfileGroups,
  previewGroupJoinCode,
  removeGroupMember,
  reviewGroupJoinRequest,
  revokeGroupInvite,
  rotateGroupJoinCode,
  setGroupJoinMode,
  setGroupMemberRole,
  setGroupXpEvidenceVisibility,
  setGroupCompetitionExclusion,
  updateGroupDetails,
  updateGroupNickname,
} from "./groupDb";
import { groupAvatarFrameClass, resolveGroupAvatar } from "./groupIdentity";
import { resolveAvatarIdentity } from "../config/avatarIdentity";
import { loadGroupAvatarIdentityStats } from "../avatarIdentityDb";
import AvatarIdentityView from "../components/avatar/AvatarIdentityView.jsx";
import GroupWeeklyXp from "./GroupWeeklyXp.jsx";
import GroupConsistency from "./GroupConsistency.jsx";
import GroupChallenges from "./GroupChallenges.jsx";
import "./GroupHub.css";
import "./GroupStage10.css";

const GROUP_JOIN_STORAGE_KEY = "wt_group_join_code";

function errorText(error, fallback = "Something went wrong.") {
  return error?.message || String(error || fallback);
}

function formatShortDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function formatJoinMode(mode) {
  if (mode === "instant") return "Instant join";
  if (mode === "closed") return "Joining closed";
  return "Approval required";
}

function readPendingJoinCode() {
  if (typeof window === "undefined") return "";
  try {
    const fromUrl = new URL(window.location.href).searchParams.get("groupJoin") || "";
    const fromStorage = window.sessionStorage.getItem(GROUP_JOIN_STORAGE_KEY) || "";
    return String(fromUrl || fromStorage).trim();
  } catch {
    return "";
  }
}

function clearPendingJoinCode() {
  if (typeof window === "undefined") return;
  try { window.sessionStorage.removeItem(GROUP_JOIN_STORAGE_KEY); } catch {}
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has("groupJoin")) {
      url.searchParams.delete("groupJoin");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }
  } catch {}
}

export function buildGroupJoinLink(joinCode) {
  if (typeof window === "undefined" || !joinCode) return "";
  try {
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    url.searchParams.set("groupJoin", joinCode);
    return url.toString();
  } catch {
    return "";
  }
}

function MemberIdentity({ member, isSelf = false, onOpen = null }) {
  const avatar = resolveGroupAvatar(member?.avatar_id);
  const frameClass = groupAvatarFrameClass({
    avatarFrame: member?.avatar_frame,
    avatarFramesEnabled: member?.avatar_frames_enabled,
  });
  return (
    <button
      type="button"
      className="groupMemberIdentity"
      onClick={onOpen || undefined}
      disabled={!onOpen}
      aria-label={onOpen ? `Open ${member?.nickname || "athlete"} avatar identity` : undefined}
    >
      <span className={`groupMemberAvatar ${frameClass}`} aria-hidden="true">
        {avatar.imgSrc ? <img src={avatar.imgSrc} alt="" /> : <span>{avatar.emoji || "🙂"}</span>}
      </span>
      <span className="groupMemberText">
        <strong>{member?.nickname || "Athlete"}{isSelf ? " · You" : ""}</strong>
        <span>{member?.role === "admin" ? "Admin" : "Member"}</span>
      </span>
    </button>
  );
}

export default function GroupHub({ profiles = [], activeProfileId, onClose }) {
  const pendingJoinCodeRef = useRef(readPendingJoinCode());
  const deepLinkPreviewedRef = useRef(false);
  const activeProfile = useMemo(
    () => profiles.find((profile) => profile.id === activeProfileId) || profiles[0] || null,
    [profiles, activeProfileId]
  );
  const profileId = activeProfile?.id || "";

  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [directory, setDirectory] = useState([]);
  const [invites, setInvites] = useState([]);
  const [joinSettings, setJoinSettings] = useState(null);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [view, setView] = useState(() => pendingJoinCodeRef.current ? "join" : "groups");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [privateInviteSecrets, setPrivateInviteSecrets] = useState({});
  const [latestPrivateInviteId, setLatestPrivateInviteId] = useState("");
  const [memberIdentity, setMemberIdentity] = useState(null);

  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createType, setCreateType] = useState("private");
  const [createNickname, setCreateNickname] = useState(activeProfile?.name || "");

  const [joinCode, setJoinCode] = useState(() => pendingJoinCodeRef.current);
  const [joinPreview, setJoinPreview] = useState(null);
  const [joinNickname, setJoinNickname] = useState(activeProfile?.name || "");

  const selectedGroup = groups.find((group) => group.id === selectedGroupId) || null;
  const ownMembership = selectedGroup?.membership || null;
  const isAdmin = ownMembership?.role === "admin";

  async function openMemberIdentity(member) {
    const directoryMember = directory.find((entry) => entry.membership_id === member?.membership_id);
    const resolvedMember = { ...directoryMember, ...member };
    if (!resolvedMember.avatar_id && directoryMember?.avatar_id) {
      resolvedMember.avatar_id = directoryMember.avatar_id;
    }
    const identity = resolveAvatarIdentity(resolvedMember.avatar_id);
    if (!identity || !selectedGroup?.id || !resolvedMember.membership_id) return;
    setMemberIdentity({ member: resolvedMember, identity, loading: true, stats: null, error: "" });
    const { data, error: statsError } = await loadGroupAvatarIdentityStats(
      selectedGroup.id,
      resolvedMember.membership_id
    );
    setMemberIdentity({
      member: resolvedMember,
      identity,
      loading: false,
      stats: data || null,
      error: statsError?.message || "",
    });
  }

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
    setSelectedGroupId(next.some((group) => group.id === wanted) ? wanted : next[0]?.id || "");
  }

  async function refreshSelected(group = selectedGroup) {
    if (!group?.id) {
      setDirectory([]);
      setInvites([]);
      setJoinSettings(null);
      setPendingRequests([]);
      return;
    }

    const admin = group.membership?.role === "admin";
    const [directoryResult, inviteResult, settingsResult, requestsResult] = await Promise.all([
      listGroupDirectory(group.id),
      admin ? listGroupInvites(group.id) : Promise.resolve({ data: [], error: null }),
      admin ? getGroupJoinSettings(group.id) : Promise.resolve({ data: null, error: null }),
      admin ? listGroupJoinRequests(group.id) : Promise.resolve({ data: [], error: null }),
    ]);

    if (directoryResult.error) setError(errorText(directoryResult.error, "Could not load Group members."));
    else setDirectory(directoryResult.data || []);
    if (inviteResult.error) setError(errorText(inviteResult.error, "Could not load private invites."));
    else setInvites(inviteResult.data || []);
    if (settingsResult.error) setError(errorText(settingsResult.error, "Could not load join settings."));
    else setJoinSettings(settingsResult.data || null);
    if (requestsResult.error) setError(errorText(requestsResult.error, "Could not load pending requests."));
    else setPendingRequests(requestsResult.data || []);
  }

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

  async function previewJoinCode(code = joinCode) {
    const normalized = String(code || "").trim();
    if (!normalized) return null;
    setJoinPreview(null);
    const preview = await run(() => previewGroupJoinCode(normalized));
    if (!preview) {
      setError((current) => current || "That Group code or invite is invalid, expired, revoked or fully used.");
      return null;
    }
    setJoinPreview(preview);
    return preview;
  }

  useEffect(() => {
    setCreateNickname(activeProfile?.name || "");
    setJoinNickname(activeProfile?.name || "");
    setError("");
    setNotice("");
    setPrivateInviteSecrets({});
    setLatestPrivateInviteId("");
    if (!pendingJoinCodeRef.current) {
      setJoinPreview(null);
      setJoinCode("");
      setView("groups");
    } else {
      setView("join");
      setJoinCode(pendingJoinCodeRef.current);
    }
    refreshGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  useEffect(() => {
    refreshSelected();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroupId, ownMembership?.role]);

  useEffect(() => {
    if (!profileId || !pendingJoinCodeRef.current || deepLinkPreviewedRef.current) return;
    deepLinkPreviewedRef.current = true;
    const code = pendingJoinCodeRef.current;
    previewJoinCode(code).finally(() => {
      pendingJoinCodeRef.current = "";
      clearPendingJoinCode();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

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
    await previewJoinCode();
  }

  async function handleJoin() {
    const result = await run(() => joinGroupWithCode({
      profileId,
      joinCode,
      nickname: joinNickname,
    }));
    if (!result?.group_id) return;

    if (result.join_status === "pending") {
      setNotice("Request sent. A Group Admin needs to approve this athlete before they join.");
      setJoinPreview(null);
      setJoinCode("");
      return;
    }

    setNotice("Group joined.");
    setJoinCode("");
    setJoinPreview(null);
    setView("groups");
    await refreshGroups(result.group_id);
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

  async function handleCreatePrivateInvite() {
    const created = await run(
      () => createGroupInvite(selectedGroup.id, { expiresInDays: 7, maxUses: 1 }),
      "Private one-use invite created."
    );
    if (!created?.invite_code || !created?.invite_id) return;
    setPrivateInviteSecrets((current) => ({ ...current, [created.invite_id]: created.invite_code }));
    setLatestPrivateInviteId(created.invite_id);
    await refreshSelected(selectedGroup);
  }

  async function copyText(value, successText) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setNotice(successText);
    } catch {
      setNotice("Select and copy the value shown.");
    }
  }

  async function handleMemberRole(member) {
    const nextRole = member.role === "admin" ? "member" : "admin";
    if (!window.confirm(`${nextRole === "admin" ? "Make" : "Change"} ${member.nickname} ${nextRole === "admin" ? "an Admin" : "to Member"}?`)) return;
    await run(() => setGroupMemberRole(selectedGroup.id, member.membership_id, nextRole), `${member.nickname} updated.`);
    await refreshGroups(selectedGroup.id);
    await refreshSelected(selectedGroup);
  }

  async function handleEvidenceVisibility(nextVisible) {
    if (!ownMembership?.id || !selectedGroup?.id) return;
    const updated = await run(
      () =>
        setGroupXpEvidenceVisibility(
          selectedGroup.id,
          ownMembership.id,
          nextVisible
        ),
      nextVisible
        ? "XP evidence is now visible to this Group."
        : "XP evidence is now private."
    );
    if (!updated) return;
    await refreshGroups(selectedGroup.id);
    await refreshSelected(selectedGroup);
  }

  async function handleCompetitionExclusion(member) {
    if (!isAdmin || !member?.membership_id) return;
    const nextExcluded = !member.competition_excluded;
    const prompt = nextExcluded
      ? `Exclude ${member.nickname} from all Group competition tables? Their personal XP is unchanged and they will appear below ranked members as Gamed XP until restored.`
      : `Restore ${member.nickname} to Group competition?`;
    if (!window.confirm(prompt)) return;

    const updated = await run(
      () =>
        setGroupCompetitionExclusion(
          selectedGroup.id,
          member.membership_id,
          nextExcluded,
          "Gamed XP"
        ),
      nextExcluded
        ? `${member.nickname} excluded from Group competition.`
        : `${member.nickname} restored to Group competition.`
    );
    if (!updated) return;

    await refreshGroups(selectedGroup.id);
    await refreshSelected(selectedGroup);
  }

  async function handleRemoveMember(member) {
    if (!window.confirm(`Remove ${member.nickname} from ${selectedGroup.name}?`)) return;
    await run(() => removeGroupMember(selectedGroup.id, member.membership_id), `${member.nickname} removed.`);
    await refreshSelected(selectedGroup);
  }

  async function handleReviewRequest(request, decision) {
    const verb = decision === "approve" ? "Approve" : "Decline";
    if (!window.confirm(`${verb} ${request.nickname}'s request to join ${selectedGroup.name}?`)) return;
    await run(
      () => reviewGroupJoinRequest(selectedGroup.id, request.request_id, decision),
      decision === "approve" ? `${request.nickname} added to the Group.` : `${request.nickname}'s request declined.`
    );
    await refreshGroups(selectedGroup.id);
    await refreshSelected(selectedGroup);
  }

  async function handleJoinModeChange(nextMode) {
    const updated = await run(() => setGroupJoinMode(selectedGroup.id, nextMode), "Join settings updated.");
    if (!updated) return;
    setJoinSettings((current) => current ? { ...current, join_mode: updated.join_mode } : current);
    await refreshGroups(selectedGroup.id);
  }

  async function handleRotateJoinCode() {
    if (!window.confirm("Generate a new Group code? The current shared code/link will stop working immediately.")) return;
    const rotated = await run(() => rotateGroupJoinCode(selectedGroup.id), "New Group code generated.");
    if (!rotated?.join_code) return;
    setJoinSettings((current) => current ? { ...current, join_code: rotated.join_code, rotated_at: rotated.rotated_at } : current);
  }

  async function handleRevokeInvite(invite) {
    if (!window.confirm("Revoke this one-use private invite? It will stop working immediately.")) return;
    await run(() => revokeGroupInvite(invite.id), "Private invite revoked.");
    setPrivateInviteSecrets((current) => {
      const next = { ...current };
      delete next[invite.id];
      return next;
    });
    setLatestPrivateInviteId((current) => current === invite.id ? "" : current);
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
  const latestPrivateInvite = activeInvites.find((invite) => invite.id === latestPrivateInviteId) || null;
  const latestPrivateInviteCode = latestPrivateInvite ? privateInviteSecrets[latestPrivateInvite.id] || "" : "";
  const listedPrivateInvites = activeInvites.filter((invite) => invite.id !== latestPrivateInvite?.id);
  const shareLink = joinSettings?.join_code ? buildGroupJoinLink(joinSettings.join_code) : "";

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
        {notice ? <div className="groupHubMessage success" role="status">{notice}</div> : null}

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
            <h3>Join a Group</h3>
            <p className="groupHubMuted">Enter the reusable Group code from your coach/Admin, or a private invite code.</p>
            <form onSubmit={handlePreview}>
              <label>Group code or invite code<input value={joinCode} onChange={(e) => setJoinCode(e.target.value.trim())} placeholder="Enter Group code" autoCapitalize="characters" autoCorrect="off" required /></label>
              <button className="groupHubSecondary" disabled={busy || !joinCode} type="submit">Check Group</button>
            </form>
            {joinPreview ? (
              <div className="groupInvitePreview groupJoinPreview">
                <strong>{joinPreview.group_name}</strong>
                <span>{joinPreview.group_type === "squad" ? "Squad / team" : joinPreview.group_type === "club" ? "Club" : "Private group"}</span>
                <span>{joinPreview.active_members} / {joinPreview.max_members} members</span>
                {joinPreview.code_kind === "private_invite" ? (
                  <span>Private invite · valid until {formatShortDate(joinPreview.expires_at)}</span>
                ) : (
                  <span>{formatJoinMode(joinPreview.join_mode)}</span>
                )}
                <label>Your nickname in this Group<input value={joinNickname} maxLength={32} onChange={(e) => setJoinNickname(e.target.value)} /></label>
                <button
                  className="groupHubPrimary"
                  disabled={busy || !joinNickname.trim() || joinPreview.join_mode === "closed" || joinPreview.active_members >= joinPreview.max_members}
                  type="button"
                  onClick={handleJoin}
                >
                  {joinPreview.join_mode === "approval" && joinPreview.code_kind === "shared" ? "Request to join" : joinPreview.join_mode === "closed" ? "Joining closed" : "Join Group"}
                </button>
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
                <div className="groupHubEmpty compact">No Groups yet. Create one or join with a Group code.</div>
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
                    <MemberIdentity
                      member={{ ...ownMembership, membership_id: ownMembership.id }}
                      isSelf
                      onOpen={() => openMemberIdentity({ ...ownMembership, membership_id: ownMembership.id })}
                    />
                    <button className="groupHubSecondary" onClick={handleNicknameSave} disabled={busy}>Edit nickname</button>
                  </div>

                  <div className="groupXpEvidencePrivacySetting">
                    <label>
                      <input
                        type="checkbox"
                        checked={ownMembership?.xp_evidence_visible === true}
                        disabled={busy}
                        onChange={(event) =>
                          handleEvidenceVisibility(event.target.checked)
                        }
                      />
                      <span>
                        <strong>Show XP evidence to this Group</strong>
                        <small>
                          Lets Group members open a privacy-safe XP breakdown and
                          see which eligible activities were verified. Reps,
                          weights, notes, health data and raw provider data stay private.
                        </small>
                      </span>
                    </label>
                  </div>

                  <GroupWeeklyXp group={selectedGroup} membership={ownMembership} isAdmin={isAdmin} onGroupChanged={refreshGroups} onOpenIdentity={openMemberIdentity} />
                  <GroupConsistency group={selectedGroup} membership={ownMembership} onOpenIdentity={openMemberIdentity} />
                  <GroupChallenges group={selectedGroup} membership={ownMembership} isAdmin={isAdmin} />

                  {isAdmin ? (
                    <section className="groupHubPanel groupJoinAdminPanel">
                      <div className="groupHubPanelHeading">
                        <div><h4>Invite people</h4><span>{pendingRequests.length ? `${pendingRequests.length} pending` : formatJoinMode(joinSettings?.join_mode)}</span></div>
                      </div>

                      {joinSettings ? (
                        <>
                          <div className="groupJoinCodeCard">
                            <div>
                              <span className="groupHubMuted">Reusable Group code</span>
                              <code>{joinSettings.join_code}</code>
                              <small>{joinSettings.join_mode === "approval" ? "Anyone with this code/link can request access. You approve who joins." : joinSettings.join_mode === "instant" ? "Anyone with this code/link joins immediately." : "The code is retained, but new joining is currently closed."}</small>
                            </div>
                            <div className="groupJoinCodeActions">
                              <button className="groupHubSecondary" type="button" onClick={() => copyText(joinSettings.join_code, "Group code copied.")}>Copy code</button>
                              <button className="groupHubPrimary small" type="button" onClick={() => copyText(shareLink, "Invite link copied.")}>Copy invite link</button>
                            </div>
                          </div>

                          {pendingRequests.length ? (
                            <div className="groupPendingRequests">
                              <div className="groupHubSectionTitle">Pending approval</div>
                              {pendingRequests.map((request) => (
                                <div className="groupPendingRequestRow" key={request.request_id}>
                                  <MemberIdentity member={{ ...request, role: "member" }} />
                                  <span className="groupPendingWhen">Requested {formatShortDate(request.requested_at)}</span>
                                  <div className="groupPendingActions">
                                    <button className="groupHubPrimary small" disabled={busy || directory.length >= selectedGroup.max_members} onClick={() => handleReviewRequest(request, "approve")}>Approve</button>
                                    <button className="groupHubSecondary" disabled={busy} onClick={() => handleReviewRequest(request, "decline")}>Decline</button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : null}

                          <details className="groupJoinSettingsDetails">
                            <summary>Invite settings</summary>
                            <div className="groupJoinSettingsBody">
                              <label>Who can join?
                                <select value={joinSettings.join_mode || "approval"} disabled={busy} onChange={(event) => handleJoinModeChange(event.target.value)}>
                                  <option value="approval">Approval required</option>
                                  <option value="instant">Instant join</option>
                                  <option value="closed">Joining closed</option>
                                </select>
                              </label>
                              <button className="groupHubSecondary" type="button" onClick={handleRotateJoinCode} disabled={busy}>Generate new Group code</button>

                              <div className="groupPrivateInviteBlock">
                                <strong>Individual private invite</strong>
                                <span>Optional one-use code for a specific person. It expires after 7 days.</span>
                                <button className="groupHubSecondary" type="button" onClick={handleCreatePrivateInvite} disabled={busy || directory.length >= selectedGroup.max_members}>Create one-use invite</button>
                                {latestPrivateInvite && latestPrivateInviteCode ? (
                                  <div className="groupInviteSecret">
                                    <div><strong>New private invite</strong><span>Shown in full only now. The database stores only its hash.</span></div>
                                    <code>{latestPrivateInviteCode}</code>
                                    <div className="groupPrivateInviteActions">
                                      <button className="groupHubSecondary" type="button" onClick={() => copyText(latestPrivateInviteCode, "Private invite copied.")}>Copy</button>
                                      <button className="groupHubDanger" type="button" onClick={() => handleRevokeInvite(latestPrivateInvite)} disabled={busy}>Revoke</button>
                                    </div>
                                  </div>
                                ) : null}
                                <small className="groupPrivateInviteHelp">Codes generated while this Groups window is open remain copyable below. After it closes, only the non-secret hint is retained; any invite can still be revoked.</small>
                                {listedPrivateInvites.length ? (
                                  <div className="groupInviteList">
                                    {listedPrivateInvites.map((invite) => {
                                      const generatedCode = privateInviteSecrets[invite.id] || "";
                                      return (
                                        <div key={invite.id} className="groupPrivateInviteRow">
                                          <span>
                                            <strong>{generatedCode || invite.code_hint}</strong>
                                            <small>{invite.use_count}/{invite.max_uses} used · expires {formatShortDate(invite.expires_at)}</small>
                                          </span>
                                          <div className="groupPrivateInviteActions">
                                            {generatedCode ? <button type="button" onClick={() => copyText(generatedCode, "Private invite copied.")}>Copy</button> : null}
                                            <button type="button" onClick={() => handleRevokeInvite(invite)} disabled={busy}>Revoke</button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : activeInvites.length ? null : <div className="groupHubMuted">No active private invites.</div>}
                              </div>
                            </div>
                          </details>
                        </>
                      ) : <div className="groupHubMuted">Loading invite settings…</div>}
                    </section>
                  ) : null}

                  <section className="groupHubPanel">
                    <div className="groupHubPanelHeading"><div><h4>Members</h4><span>{directory.length} / {selectedGroup.max_members}</span></div></div>
                    <div className="groupMemberList">
                      {directory.map((member) => {
                        const self = member.membership_id === ownMembership.id;
                        return (
                          <div
                            key={member.membership_id}
                            className={`groupMemberRow ${self ? "self" : ""} ${member.competition_excluded ? "competitionExcluded" : ""}`}
                          >
                            <MemberIdentity member={member} isSelf={self} onOpen={() => openMemberIdentity(member)} />
                            <div className="groupMemberIntegrityMeta">
                              {member.xp_evidence_visible ? (
                                <span className="groupMemberEvidenceOn">XP evidence on</span>
                              ) : (
                                <span className="groupMemberEvidenceOff">XP evidence private</span>
                              )}
                              {member.competition_excluded ? (
                                <span className="groupMemberExcludedLabel">
                                  {member.competition_exclusion_label || "Gamed XP"}
                                </span>
                              ) : null}
                            </div>
                            {isAdmin && !self ? (
                              <details className="groupMemberManage">
                                <summary>Manage</summary>
                                <div className="groupMemberActions">
                                  <button onClick={() => handleMemberRole(member)} disabled={busy}>{member.role === "admin" ? "Make member" : "Make admin"}</button>
                                  <button
                                    onClick={() => handleCompetitionExclusion(member)}
                                    disabled={busy}
                                  >
                                    {member.competition_excluded
                                      ? "Restore to competition"
                                      : "Exclude from competition"}
                                  </button>
                                  <button onClick={() => handleRemoveMember(member)} disabled={busy}>Remove</button>
                                </div>
                              </details>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  <div className="groupHubFooterActions"><button className="groupHubDanger" onClick={handleLeave} disabled={busy}>Leave Group</button>{isAdmin ? <span>Last Admins must promote another Admin before leaving.</span> : null}</div>
                </>
              )}
            </main>
          </div>
        )}
      </section>
      {memberIdentity ? (
        <AvatarIdentityView
          mode="group"
          identity={memberIdentity.identity}
          athleteName={memberIdentity.member?.nickname || "Athlete"}
          stats={memberIdentity.stats}
          loading={memberIdentity.loading}
          error={memberIdentity.error}
          onClose={() => setMemberIdentity(null)}
        />
      ) : null}
    </div>
  );
}
