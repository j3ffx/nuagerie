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
