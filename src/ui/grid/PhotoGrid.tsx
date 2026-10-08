import { defaultRangeExtractor, useWindowVirtualizer, type Range } from '@tanstack/react-virtual';
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
import { CheckIcon } from '../icons.tsx';
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
import { monthState } from './monthState.ts';
import { usePressDrag } from './pressDrag.ts';
import { stickyHeaderHeight } from './page.ts';
import { StickyMonth } from './StickyMonth.tsx';
import styles from './PhotoGrid.module.css';

const HEADER_SIZE = 44;

/** Photos picked in the grid, and what touching them does (src/features/selection/). */
export interface GridSelection {
  active: boolean;
  selected: ReadonlySet<string>;
  onLongPress: (item: MediaItem) => void;
  onDrag: (item: MediaItem) => void;
  onToggle: (item: MediaItem) => void;
  /** Shift + click: from the last photo touched to this one. */
  onExtend: (item: MediaItem) => void;
  /** A month's title touched while selecting. */
  onMonth: (items: readonly MediaItem[]) => void;
}

type CellClick = (item: MediaItem, event: MouseEvent) => void;
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
  selection = null,
}: {
  items: readonly MediaItem[];
  label: string;
  href: (item: MediaItem) => string;
  onOpen: (item: MediaItem) => void;
  /** Brings this item into view and focuses it (new object = new request). */
  reveal?: { id: string } | null;
  /** Lets photos be picked (long press, Ctrl / Shift + click); null: a tap only opens. */
  selection?: GridSelection | null;
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

  // While a finger drags to pick photos, the row it started on stays rendered even far off
  // screen: the browser sends that finger's moves and lift to the element it first touched,
  // and a row taken out of the page would take them away with it. The photo is kept, not its
  // row's number: the rows may move meanwhile (the index updated, a month added on top).
  const pinnedId = useRef<string | null>(null);
  const latestLayout = useRef(layout);
  // Before the virtualizer reads it on screen, not after.
  useLayoutEffect(() => {
    latestLayout.current = layout;
  }, [layout]);
  const pinnedRow = useRef<{ id: string; layout: GridLayout; row: number } | null>(null);
  const rangeExtractor = useCallback((range: Range) => {
    const rows = defaultRangeExtractor(range);
    const id = pinnedId.current;
    if (id === null) return rows;
    let found = pinnedRow.current;
    if (!found || found.id !== id || found.layout !== latestLayout.current) {
      found = { id, layout: latestLayout.current, row: rowIndexOfItem(latestLayout.current, id) };
      pinnedRow.current = found;
    }
    const pinned = found.row;
    return pinned < 0 || rows.includes(pinned) ? rows : [...rows, pinned].sort((a, b) => a - b);
  }, []);

  // Long press then drag (finger), clicks with Ctrl or Shift: picking photos.
  const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const pressHandlers = useMemo(
    () => ({
      onLongPress: (id: string) => {
        const item = byId.get(id);
        if (!item) return;
        pinnedId.current = id;
        selection?.onLongPress(item);
      },
      onDragEnd: () => {
        pinnedId.current = null;
      },
      onDrag: (id: string) => {
        const item = byId.get(id);
        if (item) selection?.onDrag(item);
      },
    }),
    [byId, selection],
  );
  const swallowClick = usePressDrag(sectionRef, pressHandlers);
  const onCell = useCallback<CellClick>(
    (item, event) => {
      if (event.button !== 0) return;
      // The finger that long-pressed is lifted: that is not a tap.
      if (swallowClick(item.id)) {
        event.preventDefault();
        return;
      }
      const modified = event.metaKey || event.ctrlKey || event.shiftKey;
      if (selection && (selection.active || modified)) {
        event.preventDefault();
        if (event.shiftKey) selection.onExtend(item);
        else selection.onToggle(item);
        return;
      }
      // New tab, new window: let the browser do it.
      if (modified) return;
      event.preventDefault();
      onOpen(item);
    },
    [selection, onOpen, swallowClick],
  );
  useLayoutEffect(() => {
    const kept = anchor.current;
    if (!kept) return;
    anchor.current = null;
    const row = layout.rows[rowIndexOfItem(layout, kept.id)];
    if (row) window.scrollTo({ top: gridTop + row.start - kept.top, behavior: 'instant' });
  }, [layout, gridTop]);

  const virtualizer = useWindowVirtualizer({
    count: layout.rows.length,
    rangeExtractor,
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
      <StickyMonth
        layout={layout}
        gridTop={gridTop}
        selected={selection?.active ? selection.selected : null}
        onMonth={selection?.active ? selection.onMonth : null}
      />
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
              onCell={onCell}
              selecting={selection?.active ?? false}
              selected={selection?.selected ?? null}
              onMonth={selection?.onMonth ?? null}
              onSpace={selection?.onToggle ?? null}
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
  onCell,
  selecting,
  selected,
  onMonth,
  onSpace,
}: {
  row: GridRow;
  layout: GridLayout;
  top: number;
  href: (item: MediaItem) => string;
  onCell: CellClick;
  selecting: boolean;
  selected: ReadonlySet<string> | null;
  onMonth: ((items: readonly MediaItem[]) => void) | null;
  /** Space on a photo while picking. */
  onSpace: ((item: MediaItem) => void) | null;
}) {
  const section = layout.sections[row.section];
  if (!section) return null;
  const style = { transform: `translateY(${top}px)`, height: row.size };
  if (row.kind === 'header') {
    return (
      <h2 className={`${styles.row} ${styles.title}`} style={style}>
        {selecting && onMonth && selected ? (
          <button
            type="button"
            role="checkbox"
            aria-checked={monthState(section.items, selected)}
            className={styles.titleButton}
            onClick={() => onMonth(section.items)}
            aria-label={`Tout le mois : ${section.title}`}
          >
            <span
              className={styles.monthCheck}
              data-state={String(monthState(section.items, selected))}
            />
            {section.title}
          </button>
        ) : (
          section.title
        )}
      </h2>
    );
  }
  return (
    <div
      className={`${styles.row} ${styles.cells}`}
      style={{ ...style, gridTemplateColumns: `repeat(${layout.columns}, 1fr)` }}
    >
      {section.items.slice(row.from, row.to).map((item) => {
        const picked = selected?.has(item.id) ?? false;
        return (
          <a
            key={item.id}
            href={href(item)}
            className={styles.cell}
            data-item-id={item.id}
            data-selected={picked || undefined}
            aria-label={describeItem(item)}
            // Held, a link could be dragged by the browser, which would end the long press.
            draggable={false}
            {...(selecting ? { role: 'checkbox', 'aria-checked': picked } : {})}
            onClick={(event: MouseEvent) => onCell(item, event)}
            onKeyDown={(event) => {
              // A checkbox ticks with Space; a link would scroll the page.
              if (selecting && event.key === ' ') {
                event.preventDefault();
                onSpace?.(item);
              }
            }}
          >
            <Thumbnail item={item} decorative />
            {selecting && (
              <span className={styles.check} aria-hidden="true">
                {picked && <CheckIcon width={16} height={16} />}
              </span>
            )}
          </a>
        );
      })}
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
