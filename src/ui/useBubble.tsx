import { useCallback, useState, type ReactNode } from 'react';
import { Bubble } from './bubble.tsx';

/**
 * A text cut short on screen, shown in full in a small bubble next to it
 * (an album name too long for its place). Visual only: screen readers already
 * read the whole text. `show` again on the same element hides it.
 */
export function useBubble(): {
  show: (text: string, anchor: HTMLElement) => void;
  bubble: ReactNode;
} {
  const [shown, setShown] = useState<{ text: string; anchor: HTMLElement } | null>(null);
  const show = useCallback((text: string, anchor: HTMLElement) => {
    setShown((previous) => (previous?.anchor === anchor ? null : { text, anchor }));
  }, []);
  const hide = useCallback(() => setShown(null), []);
  const bubble = shown ? <Bubble text={shown.text} anchor={shown.anchor} onClose={hide} /> : null;
  return { show, bubble };
}
