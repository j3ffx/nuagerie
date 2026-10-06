import { describe, expect, it } from 'vitest';
import { groupByMonth } from './grouping.ts';
import type { MediaItem } from './model.ts';

const item = (id: string, takenAt: number | null) => ({ id, takenAt }) as MediaItem;

describe('groupByMonth', () => {
  it('makes one section per month in display order, "Sans date" for undated items', () => {
    const sections = groupByMonth([
      item('a', Date.UTC(2026, 9, 6)),
      item('b', Date.UTC(2026, 9, 1)),
      item('c', Date.UTC(2023, 2, 31, 23, 59)),
      item('d', null),
      item('e', null),
    ]);
    expect(sections.map((s) => [s.key, s.title, s.items.map((i) => i.id)])).toEqual([
      ['2026-10', 'Octobre 2026', ['a', 'b']],
      ['2023-03', 'Mars 2023', ['c']],
      ['undated', 'Sans date', ['d', 'e']],
    ]);
  });
});
