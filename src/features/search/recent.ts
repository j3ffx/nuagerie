import { useCallback } from 'react';
import { useData } from '../../data/dataContext.ts';
import { usePersistentState } from '../../lib/persistent.ts';
import { isEmptyTarget, sameTarget, type SearchTarget } from './searchParams.ts';

/** How many searches are remembered. */
export const MAX_RECENT = 5;
const NONE: SearchTarget[] = [];

/** The latest searches first, without the same one twice. */
export function withRecent(list: readonly SearchTarget[], target: SearchTarget): SearchTarget[] {
  if (isEmptyTarget(target)) return [...list];
  return [target, ...list.filter((other) => !sameTarget(other, target))].slice(0, MAX_RECENT);
}

/**
 * The last searches, on this device only (never synchronised). Per data source:
 * demo and OneDrive albums have different ids.
 */
export function useRecentSearches() {
  const { mode } = useData();
  const [recent, setRecent] = usePersistentState<SearchTarget[]>(`search.recent.${mode}`, NONE);
  const remember = useCallback(
    (target: SearchTarget) => setRecent(withRecent(recent, target)),
    [recent, setRecent],
  );
  const forget = useCallback(() => setRecent(NONE), [setRecent]);
  return { recent, remember, forget };
}
