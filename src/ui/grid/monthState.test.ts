import { describe, expect, it } from 'vitest';
import type { MediaItem } from '../../data/model.ts';
import { monthState } from './monthState.ts';

const items = ['a', 'b', 'c'].map((id) => ({ id }) as MediaItem);

describe('monthState', () => {
  it('says whether none, some or all of a month is picked', () => {
    expect(monthState(items, new Set())).toBe(false);
    expect(monthState(items, new Set(['b', 'other']))).toBe('mixed');
    expect(monthState(items, new Set(['a', 'b', 'c']))).toBe(true);
  });
});
