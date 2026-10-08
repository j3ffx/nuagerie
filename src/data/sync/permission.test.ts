import { describe, expect, it } from 'vitest';
import { whenPermissionMissing } from './permission.ts';

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
