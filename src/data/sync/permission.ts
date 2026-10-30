import type { DataMode } from '../source.ts';

/** What becomes of the sync when Microsoft does not grant its permission. */
export interface PermissionOutcome {
  /** The sync stays on. */
  enabled: boolean;
  status: 'off' | 'needs-permission';
  /** The user was just sent to Microsoft's page and came back without it: tell them. */
  declined: boolean;
}

/**
 * Never granted on this device: the user declined Microsoft's page (or left
 * it), so the sync goes back off, and says so if it had just asked. Granted
 * before: the user withdrew it at Microsoft, so the sync stays on and waits
 * for it to be given again (Réglages, or the heart).
 */
export function whenPermissionMissing({
  granted,
  asked,
}: {
  granted: boolean;
  asked: boolean;
}): PermissionOutcome {
  if (granted) return { enabled: true, status: 'needs-permission', declined: false };
  return { enabled: false, status: 'off', declined: asked };
}

/**
 * The sync is on but Microsoft wants its page again (a session that ran out, a
 * permission withdrawn): favourites are hidden until the user goes through it.
 */
export function syncPaused({ enabled, status }: { enabled: boolean; status: string }): boolean {
  return enabled && status === 'needs-permission';
}

/**
 * Whether favourites show. The demo keeps them on the device. In OneDrive mode
 * they need the sync turned on and granted, but no Microsoft session: started
 * with no network, the app shows the copy kept on the device, and hearts
 * touched meanwhile go out with the next sync.
 */
export function favoritesShown({
  mode,
  enabled,
  granted,
  status,
}: {
  mode: DataMode;
  /** The setting on this device, whether or not a session could be restored. */
  enabled: boolean;
  granted: boolean;
  status: string;
}): boolean {
  return mode === 'demo' || (enabled && granted && status !== 'needs-permission');
}
