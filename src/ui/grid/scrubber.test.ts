import { describe, expect, it } from 'vitest';
import type { MonthSection } from '../../data/grouping.ts';
import type { MediaItem } from '../../data/model.ts';
import { buildGridLayout } from './layout.ts';
import {
  ratioForScroll,
  scrollForOffset,
  scrollForRatio,
  scrubberMarks,
  sectionForScroll,
  stepSection,
  type PageGeometry,
} from './scrubber.ts';

const section = (key: string, count: number): MonthSection => ({
  key,
  title: key === 'undated' ? 'Sans date' : key,
  items: Array.from({ length: count }, (_, i) => ({ id: `${key}-${i}` }) as MediaItem),
});

const metrics = { width: 300, minCell: 96, gap: 2, headerSize: 40 };

describe('scrubber geometry', () => {
  const sections = [
    section('2026-10', 30),
    section('2026-09', 30),
    section('2025-12', 30),
    section('2016-01', 30),
    section('undated', 3),
  ];
  const layout = buildGridLayout(sections, metrics);
  const page: PageGeometry = { gridTop: 100, stickyTop: 56, maxScroll: layout.totalSize - 500 };

  it('maps scroll positions to ratios and back', () => {
    expect(ratioForScroll(page, 0)).toBe(0);
    expect(ratioForScroll(page, page.maxScroll * 2)).toBe(1);
    expect(scrollForRatio(page, 0.5)).toBe(Math.round(page.maxScroll / 2));
    expect(scrollForOffset(page, 0)).toBe(44);
    expect(scrollForOffset(page, 1e9)).toBe(page.maxScroll);
  });

  it('names the month under the header, and the last section at the very bottom', () => {
    expect(sectionForScroll(layout, page, 0)).toBe(0);
    expect(
      sectionForScroll(layout, page, scrollForOffset(page, layout.sectionStarts[2] ?? 0)),
    ).toBe(2);
    expect(sectionForScroll(layout, page, page.maxScroll)).toBe(4);
  });

  it('marks each year once and always keeps "Sans date" last', () => {
    expect(scrubberMarks(layout, page, 0).map((m) => m.label)).toEqual([
      '2026',
      '2025',
      '2016',
      'Sans date',
    ]);
    const crowded = scrubberMarks(layout, page, 0.3);
    expect(crowded.at(-1)?.label).toBe('Sans date');
    for (let i = 1; i < crowded.length; i++) {
      expect((crowded[i]?.ratio ?? 0) - (crowded[i - 1]?.ratio ?? 0)).toBeGreaterThanOrEqual(0.3);
    }
  });

  it('steps by month and by year', () => {
    expect(stepSection(layout, 0, 'month', 1)).toBe(1);
    expect(stepSection(layout, 0, 'month', -1)).toBe(0);
    expect(stepSection(layout, 0, 'year', 1)).toBe(2);
    expect(stepSection(layout, 2, 'year', 1)).toBe(3);
    expect(stepSection(layout, 1, 'year', -1)).toBe(0);
    expect(stepSection(layout, 3, 'year', -1)).toBe(2);
    expect(stepSection(layout, 2, 'year', -1)).toBe(0);
  });
});
