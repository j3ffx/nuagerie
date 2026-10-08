import { memo, useEffect, useRef } from 'react';
import type { MediaItem } from '../../data/model.ts';
import { sectionIndexAt, type GridLayout } from './layout.ts';
import { monthState, type MonthState } from './monthState.ts';
import { stickyHeaderHeight } from './page.ts';
import styles from './PhotoGrid.module.css';

/**
 * The month being scrolled stays visible under the screen header; the next
 * month's header pushes it up. Updated straight from the scroll events, with
 * no React render, so it follows the scroll frame by frame. While photos are
 * picked, it carries the month's round box too, and a tap takes the month.
 */
export const StickyMonth = memo(function StickyMonth({
  layout,
  gridTop,
  selected,
  onMonth,
}: {
  layout: GridLayout;
  gridTop: number;
  /** Photos picked, or null when not picking. */
  selected: ReadonlySet<string> | null;
  onMonth: ((items: readonly MediaItem[]) => void) | null;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const checkRef = useRef<HTMLSpanElement>(null);
  const current = useRef(-1);

  useEffect(() => {
    const host = hostRef.current;
    const title = titleRef.current;
    const text = textRef.current;
    const check = checkRef.current;
    if (!host || !title || !text || !check) return;

    const update = () => {
      const top = stickyHeaderHeight();
      host.style.top = `${top}px`;
      const offset = window.scrollY + top - gridTop;
      const index = sectionIndexAt(layout, offset);
      const start = layout.sectionStarts[index];
      // Hidden while the month's own header is still in place.
      if (start === undefined || offset <= start) {
        title.hidden = true;
        current.current = -1;
        return;
      }
      current.current = index;
      const next = layout.sectionStarts[index + 1] ?? Infinity;
      const push = Math.min(0, next - offset - title.offsetHeight);
      const section = layout.sections[index];
      const label = section?.title ?? '';
      if (text.textContent !== label) text.textContent = label;
      const state: MonthState | null =
        selected && section ? monthState(section.items, selected) : null;
      check.hidden = state === null;
      check.dataset.state = state === null ? '' : String(state);
      title.style.transform = push < 0 ? `translateY(${push}px)` : '';
      title.hidden = false;
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [layout, gridTop, selected]);

  // The month's own header (in the grid) is the one for screen readers and the keyboard.
  return (
    <div ref={hostRef} className={styles.stickyHost} aria-hidden="true">
      <div
        ref={titleRef}
        className={`${styles.title} ${styles.stickyTitle}`}
        data-picking={onMonth ? '' : undefined}
        onClick={() => {
          const section = layout.sections[current.current];
          if (onMonth && section) onMonth(section.items);
        }}
        hidden
      >
        <span ref={checkRef} className={styles.monthCheck} hidden />
        <span ref={textRef} />
      </div>
    </div>
  );
});
