/**
 * A long press with a finger opens the browser's context menu (copy the
 * link, download the image…): a web page's habit, out of place in an app.
 * It is cancelled for touch, except in text fields, where it serves to
 * paste. A right click with a mouse keeps the browser's menu.
 */
export function initTouch(): void {
  // Chrome sends `contextmenu` as a PointerEvent; older browsers don't say what
  // started it, so the last pointer pressed tells.
  let lastPointer = '';
  window.addEventListener(
    'pointerdown',
    (event) => {
      lastPointer = event.pointerType;
    },
    { capture: true, passive: true },
  );
  window.addEventListener(
    'contextmenu',
    (event) => {
      const pointer = (event as Partial<PointerEvent>).pointerType || lastPointer;
      if (pointer !== 'touch') return;
      if ((event.target as Element | null)?.closest?.('input, textarea, [contenteditable]')) return;
      event.preventDefault();
    },
    { capture: true },
  );
}
