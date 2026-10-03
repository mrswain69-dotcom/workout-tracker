const KEY = "wt_log_navigation_v1";
const TABS = new Set(["dashboard", "log", "stats", "rewards", "settings", "plan", "assessments", "connections", "appsettings"]);

export function readLogNavigation(storage, today) {
  try {
    const saved = JSON.parse(storage.getItem(KEY));
    const date = saved?.date;
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date || "") &&
      new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date;
    return { tab: TABS.has(saved?.tab) ? saved.tab : "dashboard", date: validDate ? date : today };
  } catch { return { tab: "dashboard", date: today }; }
}

export function writeLogNavigation(storage, tab, date) {
  try { storage.setItem(KEY, JSON.stringify({ tab, date })); } catch {}
}

export function clearLogNavigation(storage) {
  try { storage.removeItem(KEY); } catch {}
}
