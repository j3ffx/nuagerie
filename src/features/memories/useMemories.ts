import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMediaIndex } from '../../data/dataContext.ts';
import { currentDateContext } from '../../data/dates.ts';
import { dayKey, memoriesOf } from '../../data/memories.ts';
import { markMemoriesSeen } from '../../data/memoryNotifier.ts';
import { usePersistentState } from '../../lib/persistent.ts';

/** Synchronised (src/data/sync/state.ts): closed on one device, closed on all of them. */
export const MEMORIES_CLOSED_KEY = 'memories.closedOn';

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
    // Armed again at every midnight, on the real clock: a day when clocks change lasts 23 or
    // 25 hours, and a timer that fired early must not be the last one.
    let timer = 0;
    const arm = () => {
      timer = window.setTimeout(() => {
        renew();
        arm();
      }, msUntilMidnight(new Date()));
    };
    arm();
    document.addEventListener('visibilitychange', renew);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', renew);
    };
  }, []);
  return today;
}

/** Real time until a second past the next local midnight, clock changes included. */
export function msUntilMidnight(now: Date): number {
  const next = new Date(now);
  next.setHours(24, 0, 1, 0);
  return Math.max(1_000, next.getTime() - now.getTime());
}

/** The memories of today, and whether the user closed them for the day. */
export function useMemories() {
  const index = useMediaIndex();
  const today = useToday();
  const day = dayKey(today);
  const [closedOn, setClosedOn] = usePersistentState<string | null>(MEMORIES_CLOSED_KEY, null);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- one list per day, not per minute
  const memories = useMemo(() => (index ? memoriesOf(index.items, today) : []), [index, day]);
  // The latest closing wins, from any device: a device in another time zone, still on the day
  // before, would reopen the section here by closing its own day. Accepted (one user, one zone).
  const close = useCallback(() => setClosedOn(day), [day, setClosedOn]);
  const closed = closedOn === day;
  // Closed today, here or on another device: no notification about them any more.
  useMemoriesSeen(closed && memories.length > 0, day);
  return { memories, today, closed, close };
}

/**
 * Always there (src/app/App.tsx): memories closed on another device count as
 * seen here too, whatever the screen, before the browser wakes the app.
 */
export function MemoriesClosedWatcher() {
  useMemories();
  return null;
}

/**
 * Today's memories were seen (on screen, or closed): the morning notification
 * is not sent for them, and goes if it is already there.
 */
export function useMemoriesSeen(seen: boolean, day: string) {
  useEffect(() => {
    if (seen) void markMemoriesSeen(day).catch(() => undefined);
  }, [seen, day]);
}
