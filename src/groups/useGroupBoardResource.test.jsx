// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import useGroupBoardResource from './useGroupBoardResource';
import { clearGroupBoardCache, groupBoardKey, requestGroupBoard } from './groupBoardCache';
beforeEach(clearGroupBoardCache);
afterEach(cleanup);
const format = error => error.message;
it('shows prefetched data immediately and never blanks it during refresh', async () => {
 const data = {rows:[{score:10}]};
 await requestGroupBoard(groupBoardKey('xp','g','m'), () => ({data}));
 let resolve; const load = vi.fn(() => new Promise(r => { resolve = r; }));
 const {result,unmount} = renderHook(() => useGroupBoardResource('xp',{id:'g'},{id:'m'},load,format));
 expect(result.current.data).toBe(data); expect(result.current.loading).toBe(false); expect(load).not.toHaveBeenCalled();
 let refreshing; act(() => { refreshing = result.current.refresh(); });
 expect(result.current.data).toBe(data); expect(result.current.loading).toBe(false); expect(result.current.refreshing).toBe(true);
 await act(async () => { await Promise.resolve(); resolve({data:{rows:[{score:20}]}}); await refreshing; });
 expect(result.current.data.rows[0].score).toBe(20); unmount();
 const again = renderHook(() => useGroupBoardResource('xp',{id:'g'},{id:'m'},load,format));
 expect(again.result.current.data.rows[0].score).toBe(20); expect(again.result.current.loading).toBe(false);
});
it('switches membership safely while old requests finish', async () => {
 let resolveOld; const load = vi.fn((g,m) => m==='old' ? new Promise(r => {resolveOld=r;}) : Promise.resolve({data:{member:m}}));
 const {result,rerender} = renderHook(({member}) => useGroupBoardResource('xp',{id:'g'},{id:member},load,format),{initialProps:{member:'old'}});
 await act(async () => { await Promise.resolve(); });
 rerender({member:'new'}); await waitFor(() => expect(result.current.data?.member).toBe('new'));
 await act(async () => { resolveOld({data:{member:'old'}}); });
 expect(result.current.data.member).toBe('new');
});
