import {
  memo,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import type { GridLayout } from './layout.ts';
import { stickyHeaderHeight } from './page.ts';
import {
  ratioForScroll,
  scrollForOffset,
  scrollForRatio,
  scrubberMarks,
  sectionForScroll,
  stepSection,
  type PageGeometry,
  type ScrubberMark,
} from './scrubber.ts';
import styles from './DateScrubber.module.css';

const HIDE_AFTER_MS = 1500;
const THUMB_SIZE = 52;
const MARK_MIN_GAP_PX = 26;
/** Below this many screens of content, the native scroll is enough. */
const MIN_SCREENS = 4;

function pageGeometry(gridTop: number): PageGeometry {
  return {
    gridTop,
    stickyTop: stickyHeaderHeight(),
    maxScroll: Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
  };
}

/**
 * Fast-scroll handle on the right edge, like Google Photos: it shows up as
 * soon as the page scrolls and fades out when it stops. Dragging it jumps
 * through the whole grid, with the years along the track and a bubble naming
 * the month ("Mars 2023"); "Sans date" is the last mark. With the keyboard it
 * is a slider: arrows move by month, Page Up/Down by year.
 * Position and labels are updated straight from the events (no React render
 * per frame); React only renders the year marks when a drag starts.
 */
export const DateScrubber = memo(function DateScrubber({
  layout,
  gridTop,
}: {
  layout: GridLayout;
  gridTop: number;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ grab: number } | null>(null);
  const hideTimer = useRef(0);
  const [marks, setMarks] = useState<(ScrubberMark & { top: number })[] | null>(null);
  const enabled = layout.sections.length > 1 && layout.totalSize > MIN_SCREENS * window.innerHeight;

  const travel = () => Math.max(1, (rootRef.current?.clientHeight ?? 0) - THUMB_SIZE);

  /** Moves the thumb and refreshes the texts for the current scroll. */
  const sync = (scrollY = window.scrollY) => {
    const thumb = thumbRef.current;
    const bubble = bubbleRef.current;
    if (!thumb || !bubble) return;
    const page = pageGeometry(gridTop);
    const ratio = ratioForScroll(page, scrollY);
    const title = layout.sections[sectionForScroll(layout, page, scrollY)]?.title ?? '';
    thumb.style.transform = `translateY(${ratio * travel()}px)`;
    thumb.setAttribute('aria-valuenow', String(Math.round(ratio * 100)));
    thumb.setAttribute('aria-valuetext', title);
    if (bubble.textContent !== title) bubble.textContent = title;
  };

  const show = () => {
    const root = rootRef.current;
    if (!root) return;
    root.dataset.visible = 'true';
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      if (!drag.current) delete root.dataset.visible;
    }, HIDE_AFTER_MS);
  };

  // One subscription for the life of the grid, reading the latest props.
  const onScroll = useEffectEvent(() => {
    if (!drag.current) sync();
    show();
  });
  const onLayout = useEffectEvent(() => sync());
  useEffect(() => {
    if (!enabled) return;
    const listener = () => onScroll();
    window.addEventListener('scroll', listener, { passive: true });
    return () => {
      window.removeEventListener('scroll', listener);
      window.clearTimeout(hideTimer.current);
    };
  }, [enabled]);
  useEffect(() => {
    if (enabled) onLayout();
  }, [enabled, layout, gridTop]);

  if (!enabled) return null;

  const scrollTo = (y: number) => {
    window.scrollTo({ top: y, behavior: 'instant' });
    sync(y);
    show();
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const thumb = thumbRef.current;
    if (!thumb || event.button !== 0) return;
    event.preventDefault();
    thumb.setPointerCapture(event.pointerId);
    drag.current = { grab: event.clientY - thumb.getBoundingClientRect().top };
    rootRef.current?.setAttribute('data-dragging', 'true');
    const minGap = MARK_MIN_GAP_PX / travel();
    setMarks(
      scrubberMarks(layout, pageGeometry(gridTop), minGap).map((mark) => ({
        ...mark,
        top: mark.ratio * travel() + THUMB_SIZE / 2,
      })),
    );
    sync();
    show();
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const root = rootRef.current;
    if (!drag.current || !root) return;
    const ratio = (event.clientY - drag.current.grab - root.getBoundingClientRect().top) / travel();
    scrollTo(scrollForRatio(pageGeometry(gridTop), ratio));
  };

  const endDrag = () => {
    if (!drag.current) return;
    drag.current = null;
    rootRef.current?.removeAttribute('data-dragging');
    setMarks(null);
    show();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const page = pageGeometry(gridTop);
    const current = sectionForScroll(layout, page, window.scrollY);
    const target = (step: 'month' | 'year', dir: 1 | -1) =>
      scrollForOffset(page, layout.sectionStarts[stepSection(layout, current, step, dir)] ?? 0);
    const moves: Record<string, () => number> = {
      ArrowDown: () => target('month', 1),
      ArrowRight: () => target('month', 1),
      ArrowUp: () => target('month', -1),
      ArrowLeft: () => target('month', -1),
      PageDown: () => target('year', 1),
      PageUp: () => target('year', -1),
      Home: () => 0,
      End: () => page.maxScroll,
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    scrollTo(move());
  };

  return (
    <div ref={rootRef} className={styles.scrubber}>
      {marks && (
        <ol className={styles.marks} aria-hidden="true">
          {marks.map((mark) => (
            <li key={mark.section} className={styles.mark} style={{ top: mark.top }}>
              {mark.label}
            </li>
          ))}
        </ol>
      )}
      <div
        ref={thumbRef}
        className={styles.thumb}
        role="slider"
        tabIndex={0}
        aria-label="Frise des dates"
        aria-orientation="vertical"
        aria-valuemin={0}
        aria-valuemax={100}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
        onKeyDown={onKeyDown}
        onFocus={show}
      >
        <div ref={bubbleRef} className={styles.bubble} aria-hidden="true" />
        <svg className={styles.grip} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 10l5-5 5 5M7 14l5 5 5-5" />
        </svg>
      </div>
    </div>
  );
});
