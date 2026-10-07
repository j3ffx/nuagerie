import changelog from '../../CHANGELOG.md?raw';
import { parseChangelog, releasesSince, type Release } from '../lib/changelog.ts';
import { readPersistent, usePersistentState, writePersistent } from '../lib/persistent.ts';

/** Every version's notes, most recent first (CHANGELOG.md, bundled at build time). */
export const RELEASES: readonly Release[] = parseChangelog(changelog);

/** Last version whose news the user has seen (or that was installed first). */
const SEEN_KEY = 'seenVersion';

/**
 * A first start has nothing new to tell: the running version counts as seen.
 * Called once at startup, before the first render.
 */
export function initWhatsNew(): void {
  if (readPersistent<string | null>(SEEN_KEY, null) === null) {
    writePersistent(SEEN_KEY, __APP_VERSION__);
  }
}

/** Releases the user has not seen yet (after an update), and a way to mark them seen. */
export function useWhatsNew(): { unseen: readonly Release[]; markSeen: () => void } {
  const [seen, setSeen] = usePersistentState<string | null>(SEEN_KEY, null);
  return {
    unseen: seen === null ? [] : releasesSince(RELEASES, seen, __APP_VERSION__),
    markSeen: () => setSeen(__APP_VERSION__),
  };
}
