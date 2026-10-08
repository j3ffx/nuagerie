import { useRef, type MouseEvent, type PointerEvent } from 'react';

/** As long as Android's own long press. */
const LONG_PRESS_MS = 500;
/** A finger that moves further is scrolling, not pressing. */
const SLOP_PX = 10;

/**
 * A long press with a finger or a pen (a mouse has its right click) calls
 * `onLongPress`; the tap that would follow is then cancelled, so a link is not
 * opened. Spread the returned handlers on the element.
 */
export function useLongPress(onLongPress: (element: HTMLElement) => void) {
  const timer = useRef(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const cancel = () => {
    window.clearTimeout(timer.current);
    start.current = null;
  };

  return {
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      fired.current = false;
      if (event.pointerType === 'mouse') return;
      start.current = { x: event.clientX, y: event.clientY };
      const element = event.currentTarget;
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        start.current = null;
        fired.current = true;
        onLongPress(element);
      }, LONG_PRESS_MS);
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      const from = start.current;
      if (from && Math.hypot(event.clientX - from.x, event.clientY - from.y) > SLOP_PX) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onClick: (event: MouseEvent<HTMLElement>) => {
      if (!fired.current) return;
      fired.current = false;
      event.preventDefault();
    },
  };
}
