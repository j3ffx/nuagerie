import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMediaIndex } from '../../data/dataContext.ts';
import { currentDateContext } from '../../data/dates.ts';
import { dayKey, memoriesOf } from '../../data/memories.ts';
import { usePersistentState } from '../../lib/persistent.ts';

/** Synchronised (src/data/sync/state.ts): closed on one device, closed on all of them. */
export const MEMORIES_CLOSED_KEY = 'memories.closedOn';

const DAY = 86_400_000;
const wallNow = () => currentDateContext().nowWallClock;

/**
 * Today on the device's clock (wall clock, as capture dates), renewed at
 * midnight and when the app comes back to the screen: an app left open
 * overnight shows the next day's memories.
 */
export function useToday(): number {
  const [today, setToday] = useState(wallNow);
  useEffect(() => {
    const renew = () =>
      setToday((previous) => {
        const now = wallNow();
        return dayKey(now) === dayKey(previous) ? previous : now;
      });
    const untilMidnight = DAY - (today % DAY) + 1_000;
    const timer = window.setTimeout(renew, untilMidnight);
    document.addEventListener('visibilitychange', renew);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', renew);
    };
  }, [today]);
  return today;
}

/** The memories of today, and whether the user closed them for the day. */
export function useMemories() {
  const index = useMediaIndex();
  const today = useToday();
  const day = dayKey(today);
  const [closedOn, setClosedOn] = usePersistentState<string | null>(MEMORIES_CLOSED_KEY, null);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- one list per day, not per minute
  const memories = useMemo(() => (index ? memoriesOf(index.items, today) : []), [index, day]);
  const close = useCallback(() => setClosedOn(day), [day, setClosedOn]);
  return { memories, today, closed: closedOn === day, close };
}
