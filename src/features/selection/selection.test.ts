import { describe, expect, it } from 'vitest';
import type { MediaItem } from '../../data/model.ts';
import {
  beyondShareLimit,
  rangeIds,
  selectedLabel,
  toggled,
  toggledAll,
  withRange,
} from './selection.ts';

const items = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, size: 1_000_000 }) as MediaItem);

describe('toggled', () => {
  it('adds an item, then takes it out', () => {
    const once = toggled(new Set(), 'b');
    expect([...once]).toEqual(['b']);
    expect([...toggled(once, 'b')]).toEqual([]);
  });
});

describe('rangeIds / withRange', () => {
  it('takes every item between two, in either direction', () => {
    expect(rangeIds(items, 'b', 'd')).toEqual(['b', 'c', 'd']);
    expect(rangeIds(items, 'd', 'b')).toEqual(['b', 'c', 'd']);
    expect(rangeIds(items, 'c', 'c')).toEqual(['c']);
  });

  it('keeps what was selected before the drag', () => {
    expect([...withRange(new Set(['a']), items, 'c', 'e')].sort()).toEqual(['a', 'c', 'd', 'e']);
  });

  it('falls back to the item reached when the anchor is gone', () => {
    expect(rangeIds(items, 'gone', 'c')).toEqual(['c']);
    expect(rangeIds(items, 'a', 'gone')).toEqual([]);
  });
});

describe('toggledAll', () => {
  it('selects a whole month, or clears it when it was all selected', () => {
    const all = toggledAll(new Set(['a']), ['a', 'b', 'c']);
    expect([...all].sort()).toEqual(['a', 'b', 'c']);
    expect([...toggledAll(all, ['a', 'b', 'c'])]).toEqual([]);
  });
});

describe('beyondShareLimit', () => {
  it('asks first above 30 items or 200 MB', () => {
    expect(beyondShareLimit(items)).toBe(false);
    const many = Array.from({ length: 31 }, (_, i) => ({ id: `${i}`, size: 1 }) as MediaItem);
    expect(beyondShareLimit(many)).toBe(true);
    expect(beyondShareLimit([{ id: 'v', size: 250_000_000 } as MediaItem])).toBe(true);
  });
});

describe('selectedLabel', () => {
  it('says how many', () => {
    expect(selectedLabel(1)).toBe('1 sélectionné');
    expect(selectedLabel(12)).toBe('12 sélectionnés');
  });
});
