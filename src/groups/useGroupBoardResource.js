import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { groupBoardKey, readGroupBoard, requestGroupBoard, subscribeGroupBoard } from './groupBoardCache';

export default function useGroupBoardResource(type, group, membership, loader, formatError, scope = '') {
  const key = groupBoardKey(type, group?.id, membership?.id, scope);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const subscribe = useCallback(listener => subscribeGroupBoard(key, listener), [key]);
  const snapshot = useCallback(() => readGroupBoard(key), [key]);
  const state = useSyncExternalStore(subscribe, snapshot, snapshot);
  const refresh = useCallback(() => requestGroupBoard(key, () => loaderRef.current(group.id, membership.id), { force: true }), [key, group?.id, membership?.id]);
  useEffect(() => {
    if (key) void requestGroupBoard(key, () => loaderRef.current(group.id, membership.id));
  }, [key, group?.id, membership?.id]);
  return {
    data: state.data,
    loading: !!key && !state.data && (!state.updatedAt && !state.error || state.pending),
    refreshing: state.pending,
    error: state.error ? formatError(state.error) : '',
    refresh,
  };
}
