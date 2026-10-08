import { describe, expect, it } from 'vitest';
import {
  EMPTY_STATE,
  favoriteIds,
  mergeStates,
  parseState,
  sameState,
  withFavorite,
  withPreference,
} from './state.ts';

describe('synced state', () => {
  it('keeps, for each favourite, the most recent change of either copy', () => {
    const phone = withFavorite(withFavorite(EMPTY_STATE, 'a', true, 10), 'b', true, 20);
    // On the PC: "a" taken out of the favourites later, "c" added.
    const pc = withFavorite(withFavorite(EMPTY_STATE, 'a', false, 30), 'c', true, 15);
    const merged = mergeStates(phone, pc);
    expect([...favoriteIds(merged)].sort()).toEqual(['b', 'c']);
    expect(mergeStates(pc, phone)).toEqual(merged);
  });

  it('merges preferences the same way', () => {
    const phone = withPreference(EMPTY_STATE, 'albums.sort', { key: 'name' }, 50);
    const pc = withPreference(EMPTY_STATE, 'albums.sort', { key: 'last' }, 40);
    expect(mergeStates(phone, pc).preferences['albums.sort']?.value).toEqual({ key: 'name' });
  });

  it('tells equal states apart from changed ones', () => {
    const a = withFavorite(EMPTY_STATE, 'a', true, 10);
    expect(sameState(a, mergeStates(EMPTY_STATE, a))).toBe(true);
    expect(sameState(a, withFavorite(a, 'a', false, 11))).toBe(false);
    expect(sameState(a, withPreference(a, 'k', 1, 1))).toBe(false);
  });

  it('reads a stored copy, dropping whatever is not well formed', () => {
    expect(parseState(null)).toEqual(EMPTY_STATE);
    expect(
      parseState({
        favorites: { a: { value: true, at: 1 }, b: { value: 'yes', at: 2 }, c: { at: 3 } },
        preferences: { 'albums.sort': { value: { key: 'name' }, at: 4 } },
      }),
    ).toEqual({
      schema: 1,
      favorites: { a: { value: true, at: 1 } },
      preferences: { 'albums.sort': { value: { key: 'name' }, at: 4 } },
    });
  });
});
