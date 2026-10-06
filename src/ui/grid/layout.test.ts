import { describe, expect, it } from 'vitest';
import type { MonthSection } from '../../data/grouping.ts';
import type { MediaItem } from '../../data/model.ts';
import { buildGridLayout, columnCount, rowIndexAt, sectionIndexAt } from './layout.ts';

const section = (key: string, count: number): MonthSection => ({
  key,
  title: key === 'undated' ? 'Sans date' : key,
  items: Array.from({ length: count }, (_, i) => ({ id: `${key}-${i}` }) as MediaItem),
});

const metrics = { width: 300, minCell: 96, gap: 2, headerSize: 40 };

describe('columnCount', () => {
  it('fits as many cells of at least the minimum width as possible', () => {
    expect(columnCount(360, 96, 2)).toBe(3);
    expect(columnCount(392, 96, 2)).toBe(4);
    expect(columnCount(50, 96, 2)).toBe(1);
  });
});

describe('buildGridLayout', () => {
  it('lays out a header then rows of cells for each month', () => {
    const layout = buildGridLayout([section('2026-10', 7), section('undated', 2)], metrics);
    expect(layout.columns).toBe(3);
    expect(layout.cellSize).toBeCloseTo((300 - 4) / 3);
    const row = layout.cellSize + 2;
    const round = (n: number) => Math.round(n * 1000) / 1000;
    expect(layout.rows.map((r) => [r.kind, r.section, round(r.start)])).toEqual([
      ['header', 0, 0],
      ['cells', 0, 40],
      ['cells', 0, round(40 + row)],
      ['cells', 0, round(40 + 2 * row)],
      ['header', 1, round(40 + 3 * row)],
      ['cells', 1, round(80 + 3 * row)],
    ]);
    expect(layout.rows[3]).toMatchObject({ from: 6, to: 7 });
    expect(layout.sectionStarts.map(round)).toEqual([0, round(40 + 3 * row)]);
    expect(layout.totalSize).toBeCloseTo(80 + 4 * row);
  });

  it('handles 20 000 items quickly', () => {
    const sections = Array.from({ length: 240 }, (_, i) => section(`m${i}`, 84));
    const started = performance.now();
    const layout = buildGridLayout(sections, metrics);
    expect(performance.now() - started).toBeLessThan(50);
    expect(layout.rows.length).toBe(240 + 240 * 28);
  });

  it('finds the row and section at an offset', () => {
    const layout = buildGridLayout([section('a', 3), section('b', 3)], metrics);
    expect(rowIndexAt(layout, -10)).toBe(0);
    expect(rowIndexAt(layout, 39)).toBe(0);
    expect(rowIndexAt(layout, 40)).toBe(1);
    expect(sectionIndexAt(layout, layout.sectionStarts[1] ?? 0)).toBe(1);
    expect(sectionIndexAt(layout, 1e9)).toBe(1);
    expect(sectionIndexAt(buildGridLayout([], metrics), 0)).toBe(-1);
  });
});
