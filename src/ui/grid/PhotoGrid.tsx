import { useWindowVirtualizer } from '@tanstack/react-virtual';
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from 'react';
import { groupByMonth } from '../../data/grouping.ts';
import type { MediaItem } from '../../data/model.ts';
import { describeItem } from '../../lib/format.ts';
import { useMediaQuery } from '../../lib/useMediaQuery.ts';
import { Thumbnail } from '../Thumbnail.tsx';
import { DateScrubber } from './DateScrubber.tsx';
import {
  clampColumns,
  MAX_COLUMNS_NARROW,
  MAX_COLUMNS_WIDE,
  useGridColumns,
  usePinchSteps,
} from './columns.ts';
import { buildGridLayout, rowIndexOfItem, type GridLayout, type GridRow } from './layout.ts';
import { stickyHeaderHeight } from './page.ts';
import { StickyMonth } from './StickyMonth.tsx';
import styles from './PhotoGrid.module.css';

const HEADER_SIZE = 44;
const NARROW = { minCell: 96, gap: 2 };
const WIDE = { minCell: 150, gap: 4 };
const WIDE_QUERY = '(min-width: 900px)';

/**
 * Photos grouped by month ("Octobre 2026"), "Sans date" last, in a window-
 * scrolled virtual list: only the rows near the screen exist in the DOM, so
 * 20 000 items scroll as smoothly as 20. A date scrubber appears on the right
 * while scrolling. Cells are links to the photo (`href`), opened by `onOpen`.
 */
export function PhotoGrid({
  items,
  label,
  href,
  onOpen,
  reveal,
}: {
  items: readonly MediaItem[];
  label: string;
  href: (item: MediaItem) => string;
  onOpen: (item: MediaItem) => void;
  /** Brings this item into view and focuses it (new object = new request). */
  reveal?: { id: string } | null;
}) {
  const sections = useMemo(() => groupByMonth(items), [items]);
  const rowsRef = useRef<HTMLDivElement>(null);
  const { width, gridTop } = useGridPlacement(rowsRef);
  const wide = useMediaQuery(WIDE_QUERY);
  const [chosen, setChosen] = useGridColumns();
  const maxColumns = wide ? MAX_COLUMNS_WIDE : MAX_COLUMNS_NARROW;
  const columns = chosen === null ? null : clampColumns(chosen, maxColumns);

  const layout = useMemo(
    () =>
      buildGridLayout(sections, {
        width,
        headerSize: HEADER_SIZE,
        ...(wide ? WIDE : NARROW),
        ...(columns === null ? {} : { columns }),
      }),
    [sections, width, wide, columns],
  );

  // A pinch adds or removes a column; the photo under the fingers stays where it was.
  const sectionRef = useRef<HTMLElement>(null);
  const anchor = useRef<{ id: string; top: number } | null>(null);
  const current = useRef(layout.columns);
  useEffect(() => {
    current.current = layout.columns;
  }, [layout.columns]);
  const onPinch = useCallback(
    (step: -1 | 1, at: { x: number; y: number }) => {
      const next = clampColumns(current.current + step, maxColumns);
      if (next === current.current) return;
      const cell = document.elementFromPoint(at.x, at.y)?.closest<HTMLElement>('[data-item-id]');
      const id = cell?.dataset.itemId;
      anchor.current = id && cell ? { id, top: cell.getBoundingClientRect().top } : null;
      current.current = next;
      setChosen(next);
    },
    [maxColumns, setChosen],
  );
  usePinchSteps(sectionRef, onPinch);
  useLayoutEffect(() => {
    const kept = anchor.current;
    if (!kept) return;
    anchor.current = null;
    const row = layout.rows[rowIndexOfItem(layout, kept.id)];
    if (row) window.scrollTo({ top: gridTop + row.start - kept.top, behavior: 'instant' });
  }, [layout, gridTop]);

  const virtualizer = useWindowVirtualizer({
    count: layout.rows.length,
    estimateSize: (index) => layout.rows[index]?.size ?? 0,
    // A new identity for each layout makes the virtualizer recompute every offset.
    getItemKey: useCallback((index: number) => index, [layout]), // eslint-disable-line react-hooks/exhaustive-deps
    overscan: 4,
    scrollMargin: gridTop,
  });

  // Back from the viewer: the last photo seen is on screen, and focused.
  useEffect(() => {
    if (!reveal) return;
    const rowIndex = rowIndexOfItem(layout, reveal.id);
    const row = layout.rows[rowIndex];
    if (!row) return;
    const top = gridTop + row.start;
    const visibleTop = window.scrollY + stickyHeaderHeight() + HEADER_SIZE;
    const visibleBottom = window.scrollY + window.innerHeight - 80;
    if (top < visibleTop || top + row.size > visibleBottom) {
      window.scrollTo({ top: top - stickyHeaderHeight() - HEADER_SIZE, behavior: 'instant' });
    }
    // Focus once the row is rendered.
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>(`[data-item-id="${CSS.escape(reveal.id)}"]`)
        ?.focus({ preventScroll: true }),
    );
  }, [reveal]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section ref={sectionRef} aria-label={label} className={styles.grid}>
      <StickyMonth layout={layout} gridTop={gridTop} />
      <div ref={rowsRef} className={styles.rows} style={{ height: layout.totalSize }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const row = layout.rows[virtualRow.index];
          return row ? (
            <Row
              key={virtualRow.key}
              row={row}
              layout={layout}
              top={virtualRow.start - virtualizer.options.scrollMargin}
              href={href}
              onOpen={onOpen}
            />
          ) : null;
        })}
      </div>
      <DateScrubber layout={layout} gridTop={gridTop} />
    </section>
  );
}

const Row = memo(function Row({
  row,
  layout,
  top,
  href,
  onOpen,
}: {
  row: GridRow;
  layout: GridLayout;
  top: number;
  href: (item: MediaItem) => string;
  onOpen: (item: MediaItem) => void;
}) {
  const section = layout.sections[row.section];
  if (!section) return null;
  const style = { transform: `translateY(${top}px)`, height: row.size };
  if (row.kind === 'header') {
    return (
      <h2 className={`${styles.row} ${styles.title}`} style={style}>
        {section.title}
      </h2>
    );
  }
  return (
    <div
      className={`${styles.row} ${styles.cells}`}
      style={{ ...style, gridTemplateColumns: `repeat(${layout.columns}, 1fr)` }}
    >
      {section.items.slice(row.from, row.to).map((item) => (
        <a
          key={item.id}
          href={href(item)}
          className={styles.cell}
          data-item-id={item.id}
          aria-label={describeItem(item)}
          onClick={(event: MouseEvent) => {
            // New tab, new window: let the browser do it.
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
            event.preventDefault();
            onOpen(item);
          }}
        >
          <Thumbnail item={item} decorative />
        </a>
      ))}
    </div>
  );
});

/** Width of the rows and their offset from the top of the document, kept up to date. */
function useGridPlacement(ref: React.RefObject<HTMLDivElement | null>) {
  const [placement, setPlacement] = useState({ width: 0, gridTop: 0 });

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      const width = element.clientWidth;
      const gridTop = Math.round(element.getBoundingClientRect().top + window.scrollY);
      setPlacement((p) => (p.width === width && p.gridTop === gridTop ? p : { width, gridTop }));
    };
    measure();
    // Content above the grid (sub-albums, sort controls) can change height.
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    if (element.parentElement?.parentElement) observer.observe(element.parentElement.parentElement);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [ref]);

  return placement;
}
