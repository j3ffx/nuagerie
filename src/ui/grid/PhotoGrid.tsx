import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { groupByMonth } from '../../data/grouping.ts';
import type { MediaItem } from '../../data/model.ts';
import { Thumbnail } from '../Thumbnail.tsx';
import { DateScrubber } from './DateScrubber.tsx';
import { buildGridLayout, type GridLayout, type GridRow } from './layout.ts';
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
 * while scrolling.
 */
export function PhotoGrid({ items, label }: { items: readonly MediaItem[]; label: string }) {
  const sections = useMemo(() => groupByMonth(items), [items]);
  const rowsRef = useRef<HTMLDivElement>(null);
  const { width, gridTop } = useGridPlacement(rowsRef);
  const wide = useMediaQuery(WIDE_QUERY);

  const layout = useMemo(
    () => buildGridLayout(sections, { width, headerSize: HEADER_SIZE, ...(wide ? WIDE : NARROW) }),
    [sections, width, wide],
  );

  const virtualizer = useWindowVirtualizer({
    count: layout.rows.length,
    estimateSize: (index) => layout.rows[index]?.size ?? 0,
    // A new identity for each layout makes the virtualizer recompute every offset.
    getItemKey: useCallback((index: number) => index, [layout]), // eslint-disable-line react-hooks/exhaustive-deps
    overscan: 4,
    scrollMargin: gridTop,
  });

  return (
    <section aria-label={label} className={styles.grid}>
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
}: {
  row: GridRow;
  layout: GridLayout;
  top: number;
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
        <Thumbnail key={item.id} item={item} />
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

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useLayoutEffect(() => {
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query]);
  return matches;
}
