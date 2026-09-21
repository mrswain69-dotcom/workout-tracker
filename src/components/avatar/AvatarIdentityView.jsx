import React, { useEffect, useRef } from "react";
import "./AvatarIdentityView.css";

function formatDate(value) {
  if (!value) return "Not recorded yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded yet";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function formatDuration(ms = 0) {
  const days = Math.floor(Math.max(0, ms) / 86400000);
  if (days >= 365) return `${(days / 365).toFixed(1)} years`;
  if (days >= 30) return `${Math.floor(days / 30)} months, ${days % 30} days`;
  if (days >= 1) return `${days} day${days === 1 ? "" : "s"}`;
  const hours = Math.floor(Math.max(0, ms) / 3600000);
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

function awardLabel(type = "") {
  return String(type)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function AvatarIdentityView({
  mode = "personal",
  identity,
  athleteName = "Athlete",
  stats = null,
  trackedSince,
  loading = false,
  error = "",
  isSelected = false,
  selectionBusy = false,
  onSelect = null,
  onClose,
}) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement;
    closeRef.current?.focus();
    function onKeyDown(event) {
      if (event.key === "Escape") onCloseRef.current?.();
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previous?.focus?.();
    };
  }, []);

  if (!identity) return null;
  const isGroup = mode === "group";
  const awards = Array.isArray(stats?.awards) ? stats.awards : [];

  return (
    <div className="avatarIdentityBackdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}>
      <section
        className="avatarIdentityDialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="avatar-identity-title"
        ref={dialogRef}
      >
        <button ref={closeRef} className="avatarIdentityClose" type="button" onClick={onClose} aria-label="Close avatar identity">×</button>

        <header className="avatarIdentityHero">
          <div className="avatarIdentityArtwork" aria-hidden="true">
            {identity.imgSrc ? <img src={identity.imgSrc} alt="" /> : <span>{identity.emoji || "🙂"}</span>}
          </div>
          <div>
            <span className="avatarIdentityEyebrow">{isGroup ? `${athleteName} · Shared Group view` : `${athleteName} · Avatar identity`}</span>
            <h2 id="avatar-identity-title">{identity.label}</h2>
            <p className="avatarIdentitySubtitle">{identity.subtitle || identity.collection}</p>
            <div className="avatarIdentityTags">
              <span>{identity.collection}</span>
              {!isGroup
                ? (identity.traits || []).map((trait) => <span key={trait}>{trait}</span>)
                : null}
            </div>
          </div>
        </header>

        <div className="avatarIdentityBody">
          {!isGroup ? (
            <section className="avatarIdentitySection">
              <h3>Origin</h3>
              <p>{identity.story}</p>
            </section>
          ) : null}

          <section className="avatarIdentitySection avatarIdentityUnlock">
            <div><span>Earned through</span><strong>{identity.unlockSource?.label || "Avatar reward"}</strong></div>
            {!isGroup && trackedSince ? <div><span>Identity stats</span><strong>Tracked since {formatDate(trackedSince)}</strong></div> : null}
          </section>

          {loading ? <div className="avatarIdentityStatus">Loading identity record…</div> : null}
          {error ? <div className="avatarIdentityStatus error">{error}</div> : null}

          {!isGroup && onSelect ? (
            <div className="avatarIdentityActions">
              <button
                type="button"
                className={isSelected ? "avatarIdentitySelected" : "avatarIdentityApply"}
                disabled={isSelected || selectionBusy}
                onClick={onSelect}
              >
                {isSelected
                  ? "Currently active"
                  : selectionBusy
                    ? "Applying avatar…"
                    : "Use this avatar"}
              </button>
              <span>
                {isSelected
                  ? "This avatar is currently shown on your profile."
                  : "Apply this avatar to your profile when you are ready."}
              </span>
            </div>
          ) : null}

          {!loading && !error && !isGroup ? (
            <>
              <section className="avatarIdentityStats" aria-label="Personal avatar statistics">
                <div><strong>{stats?.firstUnlockedAt ? formatDate(stats.firstUnlockedAt) : "Before tracking"}</strong><span>First unlocked</span></div>
                <div><strong>{formatDate(stats?.firstSelectedAt)}</strong><span>First selected</span></div>
                <div><strong>{formatDuration(stats?.selectedDurationMs)}</strong><span>Time selected</span></div>
                <div><strong>{Number(stats?.xpEarned || 0).toLocaleString("en-GB")}</strong><span>XP while selected</span></div>
                <div><strong>{Number(stats?.workoutsCompleted || 0)}</strong><span>Workouts completed</span></div>
                <div><strong>{Number(stats?.personalRecords || 0)}</strong><span>Personal records</span></div>
                <div><strong>{Number(stats?.competitionAchievements || 0)}</strong><span>Competition achievements</span></div>
                <div><strong>{Number(stats?.selectionCount || 0)}</strong><span>Selection periods</span></div>
              </section>
              <p className="avatarIdentityPrivacyNote">Selection statistics begin with this feature release. Earlier choices are not guessed or backfilled.</p>
            </>
          ) : null}

          {!loading && !error && isGroup ? (
            <>
              <section className="avatarIdentityStats group" aria-label="Shared Group achievements">
                <div><strong>{Number(stats?.weeksWon || 0)}</strong><span>Shared-group weeks won</span></div>
                <div><strong>{Number(stats?.sharedChallengesCompleted || 0)}</strong><span>Team challenges completed</span></div>
                <div><strong>{Number(stats?.challengeRewardsEarned || 0)}</strong><span>Challenge rewards earned</span></div>
                <div><strong>{awards.length}</strong><span>Group titles &amp; badges</span></div>
              </section>
              {awards.length ? (
                <section className="avatarIdentitySection">
                  <h3>Shared Group honours</h3>
                  <ul className="avatarIdentityAwards">
                    {awards.slice(0, 8).map((award, index) => (
                      <li key={`${award.type}-${award.awardedAt}-${index}`}>
                        <strong>{awardLabel(award.type)}</strong>
                        <span>{award.seasonNumber ? `Season ${award.seasonNumber}` : formatDate(award.periodEnd)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              <p className="avatarIdentityPrivacyNote">This view only uses achievements from the Group where you opened it. Personal XP, workout history, other Groups, and avatar usage dates stay private.</p>
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}
