import { getCurrentWeekWindow } from "./xpEngine.js";

function cleanText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function buildDashboardWeekSummary({
  xpRows = [],
  logs = [],
  referenceDate = "",
} = {}) {
  const window = getCurrentWeekWindow(referenceDate);
  if (!window) {
    return {
      startDate: "",
      endDate: "",
      xp: 0,
      completedDays: 0,
      activeDays: 0,
      recoveryDays: 0,
      bestXpDay: null,
    };
  }

  const rows = (Array.isArray(xpRows) ? xpRows : []).filter((row) => {
    const date = cleanText(row?.date);
    return date >= window.startDate && date <= referenceDate;
  });

  const weekLogs = (Array.isArray(logs) ? logs : []).filter((row) => {
    const date = cleanText(row?.date_ymd || row?.date);
    return date >= window.startDate && date <= referenceDate;
  });

  const xp = rows.reduce((sum, row) => sum + safeNumber(row?.totalXp), 0);
  const completedDays = new Set(
    rows.filter((row) => row?.complete).map((row) => cleanText(row?.date)).filter(Boolean)
  ).size;
  const activeDays = new Set(
    rows
      .filter((row) => safeNumber(row?.totalXp) > 0 || row?.complete)
      .map((row) => cleanText(row?.date))
      .filter(Boolean)
  ).size;

  const recoveryDays = new Set(
    weekLogs
      .filter((row) => {
        const log = row?.log || row?.log_json;
        const mode = cleanText(log?.meta?.profileRecoveryMode).toLowerCase();
        return mode === "injury" || mode === "illness";
      })
      .map((row) => cleanText(row?.date_ymd || row?.date))
      .filter(Boolean)
  ).size;

  const bestXpDay = rows.reduce((best, row) => {
    if (!best || safeNumber(row?.totalXp) > safeNumber(best?.totalXp)) return row;
    return best;
  }, null);

  return {
    startDate: window.startDate,
    endDate: window.endDate,
    xp,
    completedDays,
    activeDays,
    recoveryDays,
    bestXpDay: bestXpDay
      ? { date: cleanText(bestXpDay.date), xp: safeNumber(bestXpDay.totalXp) }
      : null,
  };
}

export function getNextAvatarReward(totalXp = 0, packs = []) {
  const xp = Math.max(0, safeNumber(totalXp));
  const ordered = (Array.isArray(packs) ? packs : [])
    .filter((pack) => safeNumber(pack?.unlockAtXp) > 0)
    .slice()
    .sort((a, b) => safeNumber(a.unlockAtXp) - safeNumber(b.unlockAtXp));

  const next = ordered.find((pack) => safeNumber(pack.unlockAtXp) > xp) || null;
  if (!next) return null;

  const unlockAtXp = safeNumber(next.unlockAtXp);
  return {
    key: cleanText(next.key),
    title: cleanText(next.title, "Avatar reward"),
    unlockAtXp,
    remainingXp: Math.max(0, unlockAtXp - xp),
  };
}

export function buildDashboardCoachInsight({
  recoveryMode = "",
  todayStatus = "amber",
  currentStreak = 0,
  weekXp = 0,
  completedDays = 0,
  todayActionCount = 0,
  planIsBlank = false,
} = {}) {
  const mode = cleanText(recoveryMode).toLowerCase();
  const streak = Math.max(0, safeNumber(currentStreak));
  const xp = Math.max(0, safeNumber(weekXp));
  const completeDays = Math.max(0, safeNumber(completedDays));
  const actions = Math.max(0, safeNumber(todayActionCount));

  if (mode === "injury") {
    return {
      kicker: "PERFORMANCE COACH",
      title: "Recovery work is today’s training.",
      body:
        "Complete today’s physio plan and it will count as following the plan, maintain the streak, and earn recovery XP.",
      tone: "recovery",
    };
  }

  if (mode === "illness") {
    return {
      kicker: "PERFORMANCE COACH",
      title: "Recovery is the target today.",
      body:
        "Respect the illness-recovery plan, confirm it when complete, and the day still counts toward your training habit and streak.",
      tone: "recovery",
    };
  }

  if (todayStatus === "green") {
    return {
      kicker: "PERFORMANCE COACH",
      title: "Today’s plan is complete.",
      body:
        streak > 1
          ? `That keeps a ${streak}-day plan streak moving. This week has produced ${xp} XP so far.`
          : `Today is banked. This week has produced ${xp} XP so far.`,
      tone: "positive",
    };
  }

  if (planIsBlank) {
    return {
      kicker: "GET STARTED",
      title: "Build your first training week.",
      body: "Your schedule is blank by design. Add activities in Plan when you are ready — nothing has been chosen for you.",
      tone: "focus",
    };
  }

  if (actions === 0) {
    return {
      kicker: "REST DAY",
      title: "Nothing is planned today.",
      body: "Rest days do not increase or break your streak. Recover well, or log an extra activity if you choose to do one.",
      tone: "recovery",
    };
  }

  if (streak >= 5) {
    return {
      kicker: "PERFORMANCE COACH",
      title: `Protect the ${streak}-day streak.`,
      body:
        actions > 0
          ? `${actions} active plan block${actions === 1 ? "" : "s"} remain available today. Finish the plan rather than chasing extra work.`
          : "Keep the habit alive by completing the work that is actually planned today.",
      tone: "focus",
    };
  }

  if (completeDays >= 4) {
    return {
      kicker: "PERFORMANCE COACH",
      title: "A strong week is taking shape.",
      body: `${completeDays} plan days are already complete and ${xp} XP has been earned this week. Keep the quality consistent.`,
      tone: "positive",
    };
  }

  return {
    kicker: "PERFORMANCE COACH",
    title: "Today’s opportunity is clear.",
    body: `${actions} active plan block${actions === 1 ? "" : "s"} are scheduled. Focus on completing what is planned before adding more.`,
    tone: "neutral",
  };
}
