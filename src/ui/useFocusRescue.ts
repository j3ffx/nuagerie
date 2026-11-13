import { useEffect, useRef } from 'react';

/**
 * Keeps the focus in a card whose button is replaced by another (turning a setting on or off):
 * the browser would otherwise drop it to the page's start, and a keyboard or screen reader user
 * would lose their place. The card needs `tabIndex={-1}`.
 */
export function useFocusRescue<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const card = ref.current;
    if (!card) return;
    let inside = false;
    const onIn = () => {
      inside = true;
    };
    const onOut = (event: FocusEvent) => {
      // No next element: the focused one was removed, or the window lost the focus.
      if (event.relatedTarget) inside = card.contains(event.relatedTarget as Node);
    };
    const observer = new MutationObserver(() => {
      const lost = document.activeElement === null || document.activeElement === document.body;
      if (inside && lost) card.focus({ preventScroll: true });
    });
    card.addEventListener('focusin', onIn);
    card.addEventListener('focusout', onOut);
    observer.observe(card, { childList: true, subtree: true });
    return () => {
      card.removeEventListener('focusin', onIn);
      card.removeEventListener('focusout', onOut);
      observer.disconnect();
    };
  }, []);
  return ref;
}
