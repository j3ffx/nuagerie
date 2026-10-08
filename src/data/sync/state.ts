/**
 * What follows the user from device to device: favourites, and a few
 * preferences about their photos. Every entry carries the time it changed,
 * so two copies (this device, OneDrive's app folder) merge without losing
 * anything: for each entry, the most recent change wins. A favourite taken
 * away stays as a "no" (not removed), so the other copy learns it.
 */

export interface Stamped<T> {
  value: T;
  /** When it changed, in milliseconds. */
  at: number;
}

export interface SyncedState {
  schema: 1;
  /** Item id → favourite or not. */
  favorites: Record<string, Stamped<boolean>>;
  /** Preference key (see SYNCED_PREFERENCES) → its value. */
  preferences: Record<string, Stamped<unknown>>;
}

export const EMPTY_STATE: SyncedState = { schema: 1, favorites: {}, preferences: {} };

/** Preferences about the photos themselves; theme, cache size or root folders stay per device. */
export const SYNCED_PREFERENCES = [
  'albums.selection.onedrive',
  'albums.sort',
  'albums.subSort',
  'albums.photoOrder',
  'all.excluded.onedrive',
  'all.photoOrder',
] as const;

function mergeEntries<T>(
  a: Record<string, Stamped<T>>,
  b: Record<string, Stamped<T>>,
): Record<string, Stamped<T>> {
  const merged = { ...a };
  for (const [key, entry] of Object.entries(b)) {
    const mine = merged[key];
    if (!mine || entry.at > mine.at) merged[key] = entry;
  }
  return merged;
}

/** Both copies together: for each entry, the most recent change. */
export function mergeStates(a: SyncedState, b: SyncedState): SyncedState {
  return {
    schema: 1,
    favorites: mergeEntries(a.favorites, b.favorites),
    preferences: mergeEntries(a.preferences, b.preferences),
  };
}

/** Same content (whatever the order of keys). */
export function sameState(a: SyncedState, b: SyncedState): boolean {
  const same = <T>(x: Record<string, Stamped<T>>, y: Record<string, Stamped<T>>) =>
    Object.keys(x).length === Object.keys(y).length &&
    Object.entries(x).every(([key, entry]) => {
      const other = y[key];
      return (
        other !== undefined &&
        other.at === entry.at &&
        JSON.stringify(other.value) === JSON.stringify(entry.value)
      );
    });
  return same(a.favorites, b.favorites) && same(a.preferences, b.preferences);
}

export function favoriteIds(state: SyncedState): Set<string> {
  return new Set(
    Object.entries(state.favorites)
      .filter(([, entry]) => entry.value)
      .map(([id]) => id),
  );
}

export function withFavorite(
  state: SyncedState,
  id: string,
  value: boolean,
  at: number,
): SyncedState {
  return { ...state, favorites: { ...state.favorites, [id]: { value, at } } };
}

export function withPreference(
  state: SyncedState,
  key: string,
  value: unknown,
  at: number,
): SyncedState {
  return { ...state, preferences: { ...state.preferences, [key]: { value, at } } };
}

/** A state read from storage or from OneDrive, or the empty one when it is not one. */
export function parseState(raw: unknown): SyncedState {
  if (typeof raw !== 'object' || raw === null) return EMPTY_STATE;
  const candidate = raw as Partial<SyncedState>;
  const entries = <T>(value: unknown, check: (v: unknown) => v is T) => {
    const result: Record<string, Stamped<T>> = {};
    if (typeof value !== 'object' || value === null) return result;
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      const stamped = entry as Partial<Stamped<unknown>> | null;
      if (stamped && typeof stamped.at === 'number' && check(stamped.value)) {
        result[key] = { value: stamped.value, at: stamped.at };
      }
    }
    return result;
  };
  return {
    schema: 1,
    favorites: entries(candidate.favorites, (v): v is boolean => typeof v === 'boolean'),
    preferences: entries(candidate.preferences, (v): v is unknown => v !== undefined),
  };
}
