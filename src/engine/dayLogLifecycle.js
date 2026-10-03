// A local revision stays authoritative throughout this app session, including
// after its write finishes: an overlapping read can still be an older snapshot.
export function selectDayLogSnapshot({ cached, remote, localRevision = 0 }) {
  return localRevision > 0 && cached ? cached : remote || cached || null;
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
