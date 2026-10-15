import { beforeEach, expect, it, vi } from 'vitest';
import { clearGroupBoardCache, groupBoardKey, invalidateGroupBoards, readGroupBoard, requestGroupBoard, subscribeGroupBoard, warmGroupBoards } from './groupBoardCache';
const key = groupBoardKey('xp', 'g1', 'm1');
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
beforeEach(() => { clearGroupBoardCache(); vi.restoreAllMocks(); });
it('deduplicates prefetch and visible requests, then reuses fresh data', async () => {
 const pending = deferred(); const load = vi.fn(() => pending.promise);
 const first = requestGroupBoard(key, load);
 expect(requestGroupBoard(key, load)).toBe(first);
 pending.resolve({ data: { score: 10 }, error: null }); await first;
 await requestGroupBoard(key, load);
 expect(load).toHaveBeenCalledTimes(1);
 expect(readGroupBoard(key).data.score).toBe(10);
});
it('retains standings during refresh, preserves unchanged object identity, and keeps data on network failure', async () => {
 const data = { rows: [{ score: 10 }] };
 await requestGroupBoard(key, () => ({ data }));
 const pending = deferred(); const refreshing = requestGroupBoard(key, () => pending.promise, { force: true });
 expect(readGroupBoard(key).data).toBe(data); expect(readGroupBoard(key).pending).toBe(true);
 pending.resolve({ data: structuredClone(data) }); await refreshing;
 expect(readGroupBoard(key).data).toBe(data);
 await requestGroupBoard(key, () => Promise.reject(new Error('Offline')), { force: true });
 expect(readGroupBoard(key).data).toBe(data); expect(readGroupBoard(key).error.message).toBe('Offline');
 await requestGroupBoard(key, () => ({ data: { rows: [{ score: 20 }] } }), { force: true });
 expect(readGroupBoard(key).data.rows[0].score).toBe(20);
});
it('refreshes stale data and isolates group, membership, metric and history scope', async () => {
 let now = 100000; vi.spyOn(Date, 'now').mockImplementation(() => now);
 const load = vi.fn(() => ({ data: { score: now } }));
 await requestGroupBoard(key, load); now += 16000; await requestGroupBoard(key, load);
 expect(load).toHaveBeenCalledTimes(2);
 for (const other of [groupBoardKey('xp','g2','m1'),groupBoardKey('xp','g1','m2'),groupBoardKey('consistency','g1','m1'),groupBoardKey('xp','g1','m1','all_history')]) expect(readGroupBoard(other).data).toBeNull();
});
it('loads boards sequentially and cancels queued work when leaving or signing out', async () => {
 const first = deferred(); const second = vi.fn(() => ({ data: {} }));
 const warm = warmGroupBoards([{ key, load: () => first.promise }, { key: groupBoardKey('seasons','g1','m1'), load: second }]);
 await Promise.resolve(); expect(second).not.toHaveBeenCalled();
 clearGroupBoardCache(); first.resolve({ data: { private: true } }); await warm.done;
 expect(second).not.toHaveBeenCalled(); expect(readGroupBoard(key).data).toBeNull();
 const next = deferred(); const cancelled = warmGroupBoards([{ key, load: () => next.promise }, {key:'other',load:second}]);
 cancelled.cancel(); next.resolve({data:{}}); await cancelled.done; expect(second).not.toHaveBeenCalled();
});
it('invalidates changed group data, refreshes subscribers and rejects older responses', async () => {
 const old = deferred(); const fresh = deferred();
 const load = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
 const unsubscribe = subscribeGroupBoard(key, vi.fn());
 const pending = requestGroupBoard(key, load); await Promise.resolve();
 invalidateGroupBoards('g1'); await Promise.resolve();
 fresh.resolve({data:{score:20}}); await requestGroupBoard(key,load);
 old.resolve({data:{score:10}}); await pending;
 expect(readGroupBoard(key).data.score).toBe(20); unsubscribe();
});
it('drops cached standings when server access is revoked', async () => {
 await requestGroupBoard(key, () => ({data:{score:10}}));
 await requestGroupBoard(key, () => ({error:{context:{status:403}}}), {force:true});
 expect(readGroupBoard(key).data).toBeNull();
});
