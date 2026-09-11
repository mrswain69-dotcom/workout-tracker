function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function validYmd(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function normaliseChallengeXpRewards(rewards = []) {
  return (Array.isArray(rewards) ? rewards : [])
    .map((reward) => ({
      challengeId: String(reward?.challengeId || reward?.challenge_id || ""),
      date: String(reward?.awardedOn || reward?.awarded_on || ""),
      xp: Math.max(0, Math.floor(safeNumber(reward?.xpAwarded ?? reward?.xp_awarded))),
      title: String(reward?.title || "Group Challenge"),
    }))
    .filter((reward) => reward.challengeId && validYmd(reward.date) && reward.xp > 0)
    .sort((a, b) => a.date.localeCompare(b.date) || a.challengeId.localeCompare(b.challengeId));
}

export function sumChallengeXpRewards(rewards = [], startDate = "", endDate = "") {
  return normaliseChallengeXpRewards(rewards).reduce((sum, reward) => {
    if (startDate && reward.date < startDate) return sum;
    if (endDate && reward.date > endDate) return sum;
    return sum + reward.xp;
  }, 0);
}

export function mergeChallengeXpDebugRows(baseRows = [], rewards = []) {
  const rows = (Array.isArray(baseRows) ? baseRows : []).map((row) => ({ ...row }));
  for (const reward of normaliseChallengeXpRewards(rewards)) {
    rows.push({
      date: reward.date,
      weekday: new Date(`${reward.date}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" }),
      kind: "group_challenge_reward",
      label: reward.title,
      complete: false,
      totalXp: reward.xp,
      challengeRewardXp: reward.xp,
      nonBonusXp: 0,
      strengthXp: 0,
      cardioXp: 0,
      durationXp: 0,
      sessionXp: 0,
      recoveryXp: 0,
      tasksXp: 0,
      dayCompleteXp: 0,
      strengthProgressXp: 0,
      cardioProgressXp: 0,
      streakXp: 0,
      dailyBonusXp: 0,
      badgeClaimXp: 0,
    });
  }

  rows.sort((a, b) => String(b?.date || "").localeCompare(String(a?.date || "")) || String(a?.kind || "").localeCompare(String(b?.kind || "")));
  let running = rows.reduce((sum, row) => sum + safeNumber(row?.totalXp), 0);
  for (const row of rows) {
    row.runningTotalXp = running;
    running -= safeNumber(row?.totalXp);
  }
  return rows;
}
