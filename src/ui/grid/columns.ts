import { useEffect, useRef, type RefObject } from 'react';
import { usePersistentState } from '../../lib/persistent.ts';

/**
 * Number of columns of the photo grids, chosen with a pinch (Ctrl + wheel
 * with a mouse) and kept on this device: one setting for every grid, as a
 * phone and a computer are not the same width. Null: as many as fit.
 */

const COLUMNS_KEY = 'grid.columns';
export const MIN_COLUMNS = 3;
export const MAX_COLUMNS_NARROW = 7;
export const MAX_COLUMNS_WIDE = 12;

/** Fingers this much further apart (or closer) since the last change: one column less (or more). */
const SPREAD = 1.25;
const SQUEEZE = 0.8;
/** Wheel distance (with Ctrl) for one column, so a trackpad's many small events make one step. */
const WHEEL_STEP = 100;

export function useGridColumns(): [number | null, (columns: number | null) => void] {
  return usePersistentState<number | null>(COLUMNS_KEY, null);
}

export function clampColumns(columns: number, max: number): number {
  return Math.min(max, Math.max(MIN_COLUMNS, Math.round(columns)));
}

/** -1: one column less (bigger photos), +1: one more, 0: not yet. `scale` = distance now / at the last change. */
export function pinchStep(scale: number): -1 | 0 | 1 {
  if (scale >= SPREAD) return -1;
  if (scale <= SQUEEZE) return 1;
  return 0;
}

interface Point {
  x: number;
  y: number;
}

/**
 * Two fingers spread or squeezed on the element, or Ctrl + wheel: `onStep`
 * gets -1 or +1 and the point the gesture is about. The page itself does not
 * zoom meanwhile (touch-action on the element, and the events are taken).
 */
export function usePinchSteps(
  ref: RefObject<HTMLElement | null>,
  onStep: (step: -1 | 1, at: Point) => void,
): void {
  const handler = useRef(onStep);
  useEffect(() => {
    handler.current = onStep;
  }, [onStep]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let base = 0;
    let wheel = 0;
    const spread = (touches: TouchList) => {
      const [a, b] = [touches[0], touches[1]];
      return a && b ? Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) : 0;
    };
    const middle = (touches: TouchList): Point => {
      const [a, b] = [touches[0], touches[1]];
      return a && b
        ? { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 }
        : { x: 0, y: 0 };
    };

    const onStart = (event: TouchEvent) => {
      base = event.touches.length === 2 ? spread(event.touches) : 0;
    };
    const onMove = (event: TouchEvent) => {
      if (event.touches.length !== 2 || base === 0) return;
      event.preventDefault();
      const distance = spread(event.touches);
      const step = pinchStep(distance / base);
      if (step === 0) return;
      base = distance;
      handler.current(step, middle(event.touches));
    };
    const onEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) base = 0;
    };
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      wheel += event.deltaY;
      if (Math.abs(wheel) < WHEEL_STEP) return;
      handler.current(wheel < 0 ? -1 : 1, { x: event.clientX, y: event.clientY });
      wheel = 0;
    };

    element.addEventListener('touchstart', onStart, { passive: true });
    element.addEventListener('touchmove', onMove, { passive: false });
    element.addEventListener('touchend', onEnd, { passive: true });
    element.addEventListener('touchcancel', onEnd, { passive: true });
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      element.removeEventListener('touchstart', onStart);
      element.removeEventListener('touchmove', onMove);
      element.removeEventListener('touchend', onEnd);
      element.removeEventListener('touchcancel', onEnd);
      element.removeEventListener('wheel', onWheel);
    };
  }, [ref]);
}
