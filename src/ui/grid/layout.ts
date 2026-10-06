import type { MonthSection } from '../../data/grouping.ts';

/**
 * Geometry of a photo grid: month headers and rows of square cells, every
 * size known in advance. The virtualizer renders only the rows on screen, and
 * the date scrubber can jump to any month without measuring anything.
 * Offsets are in CSS pixels from the top of the grid.
 */

export interface GridMetrics {
  /** Inner width available for the cells. */
  width: number;
  /** Smallest cell; columns are added as long as cells stay at least this wide. */
  minCell: number;
  gap: number;
  headerSize: number;
}

export type GridRow =
  | { kind: 'header'; section: number; start: number; size: number }
  /** Items [from, to) of the section. */
  | { kind: 'cells'; section: number; from: number; to: number; start: number; size: number };

export interface GridLayout {
  sections: readonly MonthSection[];
  rows: GridRow[];
  /** Offset of each section's header. */
  sectionStarts: number[];
  columns: number;
  cellSize: number;
  totalSize: number;
}

export function columnCount(width: number, minCell: number, gap: number): number {
  return Math.max(1, Math.floor((width + gap) / (minCell + gap)));
}

export function buildGridLayout(
  sections: readonly MonthSection[],
  metrics: GridMetrics,
): GridLayout {
  const columns = columnCount(metrics.width, metrics.minCell, metrics.gap);
  const cellSize = Math.max(0, (metrics.width - (columns - 1) * metrics.gap) / columns);
  const rowSize = cellSize + metrics.gap;
  const rows: GridRow[] = [];
  const sectionStarts: number[] = [];
  let offset = 0;

  sections.forEach((section, index) => {
    sectionStarts.push(offset);
    rows.push({ kind: 'header', section: index, start: offset, size: metrics.headerSize });
    offset += metrics.headerSize;
    for (let from = 0; from < section.items.length; from += columns) {
      const to = Math.min(from + columns, section.items.length);
      rows.push({ kind: 'cells', section: index, from, to, start: offset, size: rowSize });
      offset += rowSize;
    }
  });

  return { sections, rows, sectionStarts, columns, cellSize, totalSize: offset };
}

/** Index of the row that covers `offset` (clamped to the first and last rows). */
export function rowIndexAt(layout: GridLayout, offset: number): number {
  const { rows } = layout;
  let low = 0;
  let high = rows.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if ((rows[mid]?.start ?? 0) <= offset) low = mid;
    else high = mid - 1;
  }
  return low;
}

/** Index of the section shown at `offset`, or -1 for an empty grid. */
export function sectionIndexAt(layout: GridLayout, offset: number): number {
  return layout.rows.length === 0 ? -1 : (layout.rows[rowIndexAt(layout, offset)]?.section ?? -1);
}

/** Index of the row holding the item, or -1. */
export function rowIndexOfItem(layout: GridLayout, id: string): number {
  return layout.rows.findIndex((row) => {
    if (row.kind !== 'cells') return false;
    const items = layout.sections[row.section]?.items ?? [];
    for (let i = row.from; i < row.to; i++) if (items[i]?.id === id) return true;
    return false;
  });
}
