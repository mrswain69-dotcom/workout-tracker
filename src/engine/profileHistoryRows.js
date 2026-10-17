import { hasProtectedLogEdit } from "./dayLogLifecycle.js";

// History consumers require an explicit athlete identity on every row.
export function mapProfileHistoryRows(rows, profileId) {
  return (rows || [])
    .filter((row) => !row.profile_id || row.profile_id === profileId)
    .map((row) => ({
      id: row.id || null,
      profile_id: profileId,
      date_ymd: row.date_ymd,
      log: row.log_json || row.log || null,
      created_at: row.created_at || null,
      updated_at: row.updated_at || null,
    }))
    .filter((row) => row.log);
}

// Only unsaved edits and edits overlapping this read may overlay server history.
export function mergeProfileHistoryWithCache(rows, { familyId, profileId, cache = {},
  revisions = new Map(), persisted = new Map(), revisionsAtStart = new Map(),
  persistedAtStart = new Map() } = {}) {
  const next = mapProfileHistoryRows(rows, profileId);
  const prefix = `${familyId}:${profileId}:`;
  for (const [key, log] of Object.entries(cache)) {
    if (!key.startsWith(prefix) || !log) continue;
    const date = key.slice(prefix.length);
    const index = next.findIndex((row) => row.date_ymd === date);
    if (index >= 0 && !hasProtectedLogEdit({
      localRevision: revisions.get(key) || 0,
      persistedRevision: persisted.get(key) || 0,
      revisionAtLoadStart: revisionsAtStart.get(key) || 0,
      persistedRevisionAtLoadStart: persistedAtStart.get(key) || 0,
    })) continue;
    // A history query may be bounded; absence alone is not a deletion signal.
    if (index < 0) next.push({ profile_id: profileId, date_ymd: date, log });
    else next[index] = { ...next[index], log };
  }
  return next;
}
