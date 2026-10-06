import { UNDATED_KEY } from '../../data/grouping.ts';
import { sectionIndexAt, type GridLayout } from './layout.ts';

/**
 * Pure geometry of the date scrubber. The thumb position is the page scroll
 * ratio (like a scrollbar), so dragging it to the bottom always reaches the
 * end; the labels sit where their month comes under the screen header.
 */

export interface PageGeometry {
  /** Document offset of the top of the grid. */
  gridTop: number;
  /** Height covered by the sticky screen header: content under it is hidden. */
  stickyTop: number;
  /** Largest window.scrollY. */
  maxScroll: number;
}

export interface ScrubberMark {
  section: number;
  /** "2023", or "Sans date". */
  label: string;
  /** 0 (top of the track) to 1 (bottom). */
  ratio: number;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Page scroll that brings a grid offset just under the screen header. */
export function scrollForOffset(page: PageGeometry, offset: number): number {
  return Math.min(page.maxScroll, Math.max(0, page.gridTop + offset - page.stickyTop));
}

export function ratioForScroll(page: PageGeometry, scrollY: number): number {
  return page.maxScroll > 0 ? clamp01(scrollY / page.maxScroll) : 0;
}

export function scrollForRatio(page: PageGeometry, ratio: number): number {
  return Math.round(clamp01(ratio) * page.maxScroll);
}

/**
 * Section shown for a page scroll: the one under the header, except at the
 * very bottom where the last section ("Sans date") is the one being reached.
 */
export function sectionForScroll(layout: GridLayout, page: PageGeometry, scrollY: number): number {
  if (layout.sections.length === 0) return -1;
  if (page.maxScroll > 0 && scrollY >= page.maxScroll - 1) return layout.sections.length - 1;
  return sectionIndexAt(layout, Math.max(0, scrollY + page.stickyTop - page.gridTop));
}

/**
 * One mark per year (its first month in display order) and one for "Sans
 * date". Marks closer than `minGap` (ratio) to the previous kept one are
 * dropped, except "Sans date", which always stays as the last mark.
 */
export function scrubberMarks(
  layout: GridLayout,
  page: PageGeometry,
  minGap: number,
): ScrubberMark[] {
  const marks: ScrubberMark[] = [];
  let lastYear = '';
  layout.sections.forEach((section, index) => {
    const undated = section.key === UNDATED_KEY;
    const label = undated ? section.title : section.key.slice(0, 4);
    if (label === lastYear) return;
    lastYear = label;
    const offset = layout.sectionStarts[index] ?? 0;
    const ratio = ratioForScroll(page, scrollForOffset(page, offset));
    if (undated) {
      // Always shown: drop the marks it would overlap instead.
      while (marks.length > 0 && ratio - (marks.at(-1)?.ratio ?? 0) < minGap) marks.pop();
      marks.push({ section: index, label, ratio: Math.max(ratio, 0) });
    } else if (marks.length === 0 || ratio - (marks.at(-1)?.ratio ?? 0) >= minGap) {
      marks.push({ section: index, label, ratio });
    }
  });
  return marks;
}

/** Section to land on with the keyboard: next/previous month, or first month of the next/previous year. */
export function stepSection(layout: GridLayout, from: number, step: 'month' | 'year', dir: 1 | -1) {
  const last = layout.sections.length - 1;
  if (last < 0) return -1;
  if (step === 'month') return Math.min(last, Math.max(0, from + dir));
  const yearOf = (index: number) => layout.sections[index]?.key.slice(0, 4);
  let index = from;
  if (dir > 0) {
    const year = yearOf(from);
    while (index < last && yearOf(index) === year) index++;
    return index;
  }
  // Back to the start of the current year, or of the previous one when already there.
  const startOfYear = (i: number) => {
    const year = yearOf(i);
    while (i > 0 && yearOf(i - 1) === year) i--;
    return i;
  };
  const start = startOfYear(index);
  return start < index ? start : start === 0 ? 0 : startOfYear(start - 1);
}
