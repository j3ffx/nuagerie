import { useCallback, useSyncExternalStore } from 'react';

/**
 * Small per-device preference store on top of localStorage.
 * Every access is guarded: storage can be unavailable (private mode, blocked
 * site data) and the app must keep working with defaults in that case.
 */

const PREFIX = 'nuagerie.';
const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string | null; value: unknown }>();

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

export function readPersistent<T>(key: string, fallback: T): T {
  const raw = readRaw(key);
  const cached = cache.get(key);
  if (cached && cached.raw === raw) return cached.value as T;

  let value: T = fallback;
  if (raw !== null) {
    try {
      value = JSON.parse(raw) as T;
    } catch {
      value = fallback;
    }
  }
  cache.set(key, { raw, value });
  return value;
}

export function writePersistent<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage unavailable: keep the value for this session only.
    cache.set(key, { raw: null, value });
  }
  listeners.forEach((notify) => notify());
}

export function removePersistent(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // ignore
  }
  cache.delete(key);
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key.startsWith(PREFIX)) notify();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(notify);
    window.removeEventListener('storage', onStorage);
  };
}

/** React state persisted per device. `fallback` must be referentially stable. */
export function usePersistentState<T>(key: string, fallback: T): [T, (value: T) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => readPersistent(key, fallback),
    () => fallback,
  );
  const setValue = useCallback((next: T) => writePersistent(key, next), [key]);
  return [value, setValue];
}
