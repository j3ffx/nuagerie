import { useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from './bubble.module.css';

/** Long enough to read a long album name. */
const SHOWN_MS = 4000;
/** Keeps the bubble this far from the edges of the screen. */
const MARGIN = 16;
const GAP = 8;

/** The bubble itself, placed next to `anchor` (see useBubble). */
export function Bubble({
  text,
  anchor,
  onClose,
}: {
  text: string;
  anchor: HTMLElement;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Under its element, or above it near the bottom of the screen; never past an edge.
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const box = anchor.getBoundingClientRect();
    const { width, height } = element.getBoundingClientRect();
    const below = box.bottom + GAP;
    const top =
      below + height > window.innerHeight - MARGIN
        ? Math.max(MARGIN, box.top - GAP - height)
        : below;
    const centred = box.left + box.width / 2 - width / 2;
    const left = Math.min(Math.max(MARGIN, centred), window.innerWidth - MARGIN - width);
    element.style.top = `${top}px`;
    element.style.left = `${left}px`;
  }, [anchor, text]);

  // Goes after a while, or at the next touch elsewhere, a scroll or a resize.
  useEffect(() => {
    const timer = window.setTimeout(onClose, SHOWN_MS);
    const onPointerDown = (event: PointerEvent) => {
      if (!anchor.contains(event.target as Node)) onClose();
    };
    window.addEventListener('pointerdown', onPointerDown, { capture: true });
    window.addEventListener('scroll', onClose, { capture: true, passive: true });
    window.addEventListener('resize', onClose);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointerdown', onPointerDown, { capture: true });
      window.removeEventListener('scroll', onClose, { capture: true });
      window.removeEventListener('resize', onClose);
    };
  }, [anchor, onClose]);

  return createPortal(
    <div ref={ref} className={styles.bubble} aria-hidden="true" data-bubble="">
      {text}
    </div>,
    document.body,
  );
}
