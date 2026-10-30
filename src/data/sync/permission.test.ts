import { describe, expect, it } from 'vitest';
import { favoritesShown, syncPaused, whenPermissionMissing } from './permission.ts';

describe('syncPaused', () => {
  it('is paused only while on and waiting for Microsoft’s page', () => {
    expect(syncPaused({ enabled: true, status: 'needs-permission' })).toBe(true);
    for (const status of ['ok', 'syncing', 'offline', 'error', 'off']) {
      expect(syncPaused({ enabled: true, status }), status).toBe(false);
    }
    expect(syncPaused({ enabled: false, status: 'needs-permission' })).toBe(false);
  });
});

describe('favoritesShown', () => {
  const onedrive = { mode: 'onedrive', enabled: true, granted: true } as const;

  it('shows them once the sync is on and granted', () => {
    expect(favoritesShown({ ...onedrive, status: 'ok' })).toBe(true);
  });

  it('shows them offline, and when no session could be restored (sync status off)', () => {
    expect(favoritesShown({ ...onedrive, status: 'offline' })).toBe(true);
    expect(favoritesShown({ ...onedrive, status: 'off' })).toBe(true);
  });

  it('hides them without the sync, before it is granted, or once it was withdrawn', () => {
    expect(favoritesShown({ ...onedrive, enabled: false, status: 'off' })).toBe(false);
    expect(favoritesShown({ ...onedrive, granted: false, status: 'syncing' })).toBe(false);
    expect(favoritesShown({ ...onedrive, status: 'needs-permission' })).toBe(false);
  });

  it('always shows them in the demo, kept on the device', () => {
    expect(favoritesShown({ mode: 'demo', enabled: false, granted: false, status: 'off' })).toBe(
      true,
    );
  });
});

describe('whenPermissionMissing', () => {
  it('turns the sync back off and says so when the user declined Microsoft’s page', () => {
    expect(whenPermissionMissing({ granted: false, asked: true })).toEqual({
      enabled: false,
      status: 'off',
      declined: true,
    });
  });

  it('turns it off quietly when it was never granted nor just asked for', () => {
    // E.g. turned on by a version that did not check the permission first.
    expect(whenPermissionMissing({ granted: false, asked: false })).toEqual({
      enabled: false,
      status: 'off',
      declined: false,
    });
  });

  it('keeps it on, waiting for the permission, when it was withdrawn after being granted', () => {
    expect(whenPermissionMissing({ granted: true, asked: false })).toEqual({
      enabled: true,
      status: 'needs-permission',
      declined: false,
    });
  });
});
