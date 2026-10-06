import { formatMonthYear } from '../lib/format.ts';
import type { MediaItem } from './model.ts';

export interface MonthSection {
  /** "2026-10", or "undated". */
  key: string;
  /** "Octobre 2026", or "Sans date". */
  title: string;
  items: MediaItem[];
}

export const UNDATED_KEY = 'undated';

/**
 * Splits items (already in display order) into consecutive month sections.
 * Undated items form the "Sans date" section, which callers keep last.
 */
export function groupByMonth(items: readonly MediaItem[]): MonthSection[] {
  const sections: MonthSection[] = [];
  for (const item of items) {
    const key =
      item.takenAt === null ? UNDATED_KEY : new Date(item.takenAt).toISOString().slice(0, 7);
    const last = sections.at(-1);
    if (last?.key === key) {
      last.items.push(item);
    } else {
      sections.push({
        key,
        title: item.takenAt === null ? 'Sans date' : formatMonthYear(item.takenAt),
        items: [item],
      });
    }
  }
  return sections;
}
