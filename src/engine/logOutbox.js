// A small journal of unsynced day snapshots, separate from XP/reward authority.
// Each record is account scoped. A write acknowledgement removes only its token.
export const LOG_OUTBOX_PREFIX = 'wt_log_outbox_v1:';
const valid = (e) => e?.version === 1 && typeof e.ownerId === 'string' && !!e.ownerId &&
  typeof e.familyId === 'string' && !!e.familyId && typeof e.profileId === 'string' && !!e.profileId &&
  /^\d{4}-\d{2}-\d{2}$/.test(e.dateKey) && typeof e.token === 'string' && !!e.token &&
  e.log && typeof e.log === 'object' && !Array.isArray(e.log);
export const logOutboxKey = (e) => LOG_OUTBOX_PREFIX +
  [e.ownerId, e.familyId, e.profileId, e.dateKey].map(encodeURIComponent).join(':');

export function createLogOutbox(storage) {
  const memory = new Map();
  const volatile = new Set();
  function read(key) {
    if (volatile.has(key)) return memory.get(key) || null;
    try {
      const raw = storage?.getItem(key);
      if (raw) { const entry = JSON.parse(raw); if (valid(entry)) return entry; }
    } catch { /* Corrupt/unavailable storage never blocks an in-memory save. */ }
    return memory.get(key) || null;
  }
  return {
    put(input) {
      const entry = JSON.parse(JSON.stringify({ ...input, version: 1,
        token: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        updatedAt: new Date().toISOString(),
      }));
      if (!valid(entry)) throw new Error('Invalid pending workout identity or payload');
      const key = logOutboxKey(entry);
      memory.set(key, entry);
      try {
        if (!storage) throw new Error('Storage unavailable');
        storage.setItem(key, JSON.stringify(entry));
        volatile.delete(key);
      } catch { volatile.add(key); }
      return entry;
    },
    list(ownerId, familyId, profileIds) {
      if (!ownerId || !familyId) return [];
      const keys = new Set(memory.keys());
      try {
        for (let i = 0; i < (storage?.length || 0); i++) {
          const key = storage.key(i); if (key?.startsWith(LOG_OUTBOX_PREFIX)) keys.add(key);
        }
      } catch {}
      return [...keys].map(read).filter(e => e && e.ownerId === ownerId && e.familyId === familyId &&
        (!profileIds || profileIds.includes(e.profileId)));
    },
    isCurrent(entry) { return read(logOutboxKey(entry))?.token === entry.token; },
    acknowledge(entry) {
      const key = logOutboxKey(entry);
      // Another tab or a later keystroke may have replaced the same day.
      if (read(key)?.token !== entry.token) return false;
      try { storage?.removeItem(key); } catch { return false; }
      memory.delete(key); volatile.delete(key);
      return true;
    },
    isDurable(entry) { return !volatile.has(logOutboxKey(entry)); },
    clearMemory() { memory.clear(); volatile.clear(); },
  };
}
