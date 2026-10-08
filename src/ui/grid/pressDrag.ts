import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { bottomBarTop, stickyHeaderHeight } from './page.ts';

/** As long as Android's own long press. */
const LONG_PRESS_MS = 500;
/** A finger that moves further before that is scrolling. */
const SLOP_PX = 10;
/** Near the top or bottom of the visible grid, a drag scrolls the page; faster beyond it. */
const EDGE_PX = 72;
const EDGE_SPEED = 14;
/** A click this soon after the long-pressing finger lifts, on the same photo, is that finger's. */
const CLICK_AFTER_LIFT_MS = 400;

export interface PressDragHandlers {
  /** A finger held on the photo with this id. */
  onLongPress: (id: string) => void;
  /** That finger, still down, is now over this photo. */
  onDrag: (id: string) => void;
}

/** The part of the screen where the grid's photos show: below the header, above the bottom bar. */
export interface VisibleArea {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/**
 * Where a dragging finger points in the grid, kept inside the visible area
 * (a finger over the bottom bar points at the last row on screen), and how
 * much to scroll: near an edge, and twice as fast past it.
 */
export function dragPoint(
  finger: { x: number; y: number },
  area: VisibleArea,
): { x: number; y: number; scroll: number } {
  const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), Math.max(min, max));
  const x = clamp(finger.x, area.left + 1, area.right - 1);
  const y = clamp(finger.y, area.top + 1, area.bottom - 1);
  let scroll = 0;
  if (finger.y < area.top + EDGE_PX) scroll = finger.y < area.top ? -2 * EDGE_SPEED : -EDGE_SPEED;
  else if (finger.y > area.bottom - EDGE_PX)
    scroll = finger.y > area.bottom ? 2 * EDGE_SPEED : EDGE_SPEED;
  return { x, y, scroll };
}

/** The photo at a point of the grid, even under what floats over it (bars, date scrubber). */
const idAt = (grid: HTMLElement, x: number, y: number): string | null => {
  for (const element of document.elementsFromPoint(x, y)) {
    const cell = element.closest<HTMLElement>('[data-item-id]');
    if (cell && grid.contains(cell)) return cell.dataset.itemId ?? null;
  }
  return null;
};

/**
 * Long press on a photo of the grid, then drag across others (one finger):
 * the page does not scroll meanwhile, except near the edges of the screen,
 * where it scrolls on its own. Returns `swallowClick(id)`, true for the
 * click the browser may send when that finger lifts, so it does not count as
 * a tap; any other tap goes through.
 */
export function usePressDrag(
  ref: RefObject<HTMLElement | null>,
  handlers: PressDragHandlers,
): (id: string) => boolean {
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  }, [handlers]);
  /** The photo long-pressed, and when its finger lifted. */
  const pressed = useRef<{ id: string; liftedAt: number } | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let timer = 0;
    let start: { x: number; y: number } | null = null;
    let dragging = false;
    let finger = { x: 0, y: 0 };
    let lastId: string | null = null;
    let frame = 0;

    const stop = () => {
      if (dragging && pressed.current) pressed.current.liftedAt = Date.now();
      window.clearTimeout(timer);
      window.cancelAnimationFrame(frame);
      start = null;
      dragging = false;
      lastId = null;
    };

    const area = (): VisibleArea => {
      const box = element.getBoundingClientRect();
      return {
        top: stickyHeaderHeight(),
        bottom: bottomBarTop(),
        left: box.left,
        right: box.right,
      };
    };

    const over = () => {
      const point = dragPoint(finger, area());
      const id = idAt(element, point.x, point.y);
      if (id && id !== lastId) {
        lastId = id;
        latest.current.onDrag(id);
      }
    };

    const edgeScroll = () => {
      if (!dragging) return;
      const { scroll } = dragPoint(finger, area());
      if (scroll) {
        window.scrollBy(0, scroll);
        over();
      }
      frame = window.requestAnimationFrame(edgeScroll);
    };

    const onStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (event.touches.length !== 1 || !touch) {
        stop();
        return;
      }
      // Only a photo of this grid, not a bar over it.
      const target = event.target instanceof Element ? event.target : null;
      const cell = target?.closest<HTMLElement>('[data-item-id]');
      const id = cell && element.contains(cell) ? (cell.dataset.itemId ?? null) : null;
      if (!id) return;
      start = { x: touch.clientX, y: touch.clientY };
      finger = { ...start };
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        dragging = true;
        lastId = id;
        pressed.current = { id, liftedAt: Infinity };
        latest.current.onLongPress(id);
        frame = window.requestAnimationFrame(edgeScroll);
      }, LONG_PRESS_MS);
    };

    const onMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch || event.touches.length !== 1) {
        stop();
        return;
      }
      finger = { x: touch.clientX, y: touch.clientY };
      if (dragging) {
        event.preventDefault(); // selecting, not scrolling
        over();
      } else if (start && Math.hypot(finger.x - start.x, finger.y - start.y) > SLOP_PX) {
        stop(); // a scroll
      }
    };

    element.addEventListener('touchstart', onStart, { passive: true });
    element.addEventListener('touchmove', onMove, { passive: false });
    element.addEventListener('touchend', stop, { passive: true });
    element.addEventListener('touchcancel', stop, { passive: true });
    return () => {
      stop();
      element.removeEventListener('touchstart', onStart);
      element.removeEventListener('touchmove', onMove);
      element.removeEventListener('touchend', stop);
      element.removeEventListener('touchcancel', stop);
    };
  }, [ref]);

  return useCallback((id: string) => {
    const last = pressed.current;
    if (!last || last.id !== id || Date.now() - last.liftedAt > CLICK_AFTER_LIFT_MS) return false;
    pressed.current = null;
    return true;
  }, []);
}
