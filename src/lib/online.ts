import { useSyncExternalStore } from 'react';

/**
 * Whether the device has a network connection. `navigator.onLine` false is
 * reliable (airplane mode, no Wi-Fi nor data); true only means "maybe", so
 * requests must still handle failures.
 */
export function isOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

function subscribe(notify: () => void) {
  window.addEventListener('online', notify);
  window.addEventListener('offline', notify);
  return () => {
    window.removeEventListener('online', notify);
    window.removeEventListener('offline', notify);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, isOnline, () => true);
}
