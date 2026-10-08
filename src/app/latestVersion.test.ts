import { describe, expect, it } from 'vitest';
import { latestLabel } from './latestVersion.ts';

const running = { version: '0.1.2', commit: 'aad1093' };

describe('latestLabel', () => {
  it('names a new release by its number', () => {
    expect(latestLabel({ version: '0.1.3', commit: 'b0c1d2e' }, running)).toBe('0.1.3');
  });

  it('adds the commit when only the build changed', () => {
    expect(latestLabel({ version: '0.1.2', commit: 'b0c1d2e' }, running)).toBe('0.1.2 (b0c1d2e)');
  });

  it('says nothing when unknown, or when it is the running version', () => {
    expect(latestLabel(null, running)).toBeNull();
    expect(latestLabel({ ...running }, running)).toBeNull();
  });
});
