import { useCallback, useEffect, useRef, type RefObject } from 'react';

/** As long as Android's own long press. */
const LONG_PRESS_MS = 500;
/** A finger that moves further before that is scrolling. */
const SLOP_PX = 10;
/** Near the top or bottom of the screen, a drag scrolls the page. */
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

const idAt = (x: number, y: number) =>
  document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-item-id]')?.dataset.itemId ?? null;

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

    const over = () => {
      const id = idAt(finger.x, finger.y);
      if (id && id !== lastId) {
        lastId = id;
        latest.current.onDrag(id);
      }
    };

    const edgeScroll = () => {
      if (!dragging) return;
      const { y } = finger;
      const step = y < EDGE_PX ? -EDGE_SPEED : y > window.innerHeight - EDGE_PX ? EDGE_SPEED : 0;
      if (step) {
        window.scrollBy(0, step);
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
      const id = idAt(touch.clientX, touch.clientY);
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
