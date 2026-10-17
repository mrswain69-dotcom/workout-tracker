// Local edits win only while unsaved or when they overlap this particular read.
// A read started after acknowledgement must be allowed to see other devices.
export function hasProtectedLogEdit({ localRevision = 0, persistedRevision = 0,
  revisionAtLoadStart = localRevision, persistedRevisionAtLoadStart = persistedRevision } = {}) {
  return localRevision > persistedRevision || localRevision > revisionAtLoadStart ||
    revisionAtLoadStart > persistedRevisionAtLoadStart;
}

export function selectDayLogSnapshot({ cached, remote, ...revisions }) {
  if (hasProtectedLogEdit(revisions)) return cached ?? remote ?? null;
  // An empty read is not a deletion acknowledgement; retain a known saved day.
  return remote || cached || null;
}

export function sameLogView(view, familyId, profileId, date) {
  return view?.familyId === familyId && view?.profileId === profileId && view?.date === date;
}

export function createKeyedLogWriteQueue() {
  const pending = new Map();
  return (key, write) => {
    const next = (pending.get(key) || Promise.resolve()).catch(() => {}).then(write);
    pending.set(key, next);
    const remove = () => { if (pending.get(key) === next) pending.delete(key); };
    next.then(remove, remove);
    return next;
  };
}
