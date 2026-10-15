// Memory only: no standings or member data is persisted to browser storage.
const entries = new Map();
let sessionGeneration = 0;
const FRESH_MS = 15000;
const MAX_AGE_MS = 10 * 60 * 1000;
const empty = Object.freeze({ data: null, error: null, pending: false, updatedAt: 0 });
export function groupBoardKey(type, groupId, membershipId, scope = '') {
  return groupId && membershipId ? JSON.stringify([type, groupId, membershipId, scope]) : null;
}
function entryFor(key) {
  if (!entries.has(key)) entries.set(key, { snapshot: empty, listeners: new Set(), promise: null });
  return entries.get(key);
}
function publish(entry, snapshot) {
  entry.snapshot = snapshot;
  entry.listeners.forEach(listener => listener());
}
export function readGroupBoard(key) {
  return key ? entryFor(key).snapshot : empty;
}
export function subscribeGroupBoard(key, listener) {
  if (!key) return () => {};
  const entry = entryFor(key);
  entry.listeners.add(listener);
  return () => entry.listeners.delete(listener);
}
export function clearGroupBoardCache() {
  sessionGeneration += 1;
  entries.forEach(entry => publish(entry, empty));
  entries.clear();
}
export function invalidateGroupBoards(groupId) {
  for (const [key, entry] of entries) {
    if (JSON.parse(key)[1] !== groupId) continue;
    entry.generation = (entry.generation || 0) + 1;
    entry.promise = null;
    publish(entry, empty);
    if (entry.listeners.size && entry.loader) void requestGroupBoard(key, entry.loader, { force: true });
  }
}
export function requestGroupBoard(key, loader, { force = false } = {}) {
  if (!key) return Promise.resolve({ data: null, error: null });
  const entry = entryFor(key);
  if (entry.promise) return entry.promise;
  if (!force && entry.snapshot.updatedAt && Date.now() - entry.snapshot.updatedAt < FRESH_MS) {
    return Promise.resolve({ data: entry.snapshot.data, error: null });
  }
  // Prune unused boards so long-running sessions don't accumulate member data.
  for (const [otherKey, other] of entries) {
    if (otherKey !== key && !other.promise && !other.listeners.size && Date.now() - other.snapshot.updatedAt > MAX_AGE_MS) entries.delete(otherKey);
  }
  entry.loader = loader;
  const generation = entry.generation || 0;
  publish(entry, { ...entry.snapshot, pending: true, error: null });
  entry.promise = Promise.resolve().then(loader).catch(error => ({ data: null, error })).then(response => {
    const result = response || { data: null, error: new Error("No board response received") };
    if (entries.get(key) !== entry || generation !== (entry.generation || 0)) return result;
    const previous = entry.snapshot;
    const status = result.error?.context?.status || result.error?.status;
    const accessDenied = status === 401 || status === 403;
    const nextData = accessDenied ? null : result.error ? previous.data : result.data || null;
    // Keep object identity when the response is unchanged.
    const data = JSON.stringify(previous.data) === JSON.stringify(nextData) ? previous.data : nextData;
    entry.promise = null;
    publish(entry, { data, error: result.error || null, pending: false, updatedAt: accessDenied ? 0 : result.error ? previous.updatedAt : Date.now() });
    return result;
  });
  return entry.promise;
}

// Sequential warm-up gives the first visible table priority and avoids a request burst.
export function warmGroupBoards(tasks) {
  let cancelled = false;
  const session = sessionGeneration;
  const done = (async () => {
    for (const task of tasks) {
      if (cancelled || session !== sessionGeneration) break;
      await requestGroupBoard(task.key, task.load);
    }
  })();
  return { cancel: () => { cancelled = true; }, done };
}
