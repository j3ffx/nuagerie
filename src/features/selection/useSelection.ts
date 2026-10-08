import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MediaItem } from '../../data/model.ts';
import { toggled, toggledAll, withRange, type Selection } from './selection.ts';

/** History entry pushed when a selection starts: Android's back button ends it. */
interface SelectionState {
  selection: true;
}

const isSelectionEntry = (state: unknown) => (state as SelectionState | null)?.selection === true;

const EMPTY: Selection = new Set();

/**
 * On a selection's entry with no selection behind it (back from another
 * screen, or a reload): step over it, or that back press would seem to do
 * nothing. Its state is wiped first, so a second call finds nothing to skip.
 */
function skipDeadEntry(): void {
  if (!isSelectionEntry(window.history.state)) return;
  window.history.replaceState(null, '');
  window.history.back();
}

/**
 * Photos picked in a grid. A long press (or Ctrl / Shift + click) starts the
 * selection; then a tap adds or removes a photo, a drag after the long press
 * takes every photo it passes, and a month's title takes the whole month.
 * The back button, the close button or an empty selection end it.
 */
export function useSelection(items: readonly MediaItem[]) {
  const [picked, setSelected] = useState<Selection>(EMPTY);
  // Only the photos still in the list count (one may leave it: unfavourited, deleted).
  const selected = useMemo<Selection>(() => {
    if (picked.size === 0) return EMPTY;
    const shown = new Set<string>();
    for (const item of items) if (picked.has(item.id)) shown.add(item.id);
    return shown.size === picked.size ? picked : shown;
  }, [picked, items]);
  const active = selected.size > 0;
  /** Where the last long press or click was: the start of a drag or of a Shift + click. */
  const anchor = useRef<string | null>(null);
  /** The selection when the drag began; the drag adds its range to it. */
  const dragBase = useRef<Selection>(EMPTY);
  const pushed = useRef(false);

  // Started: one history entry, so that back ends the selection instead of leaving the screen.
  // Chrome's back button skips entries added without a user gesture, and a long press is not
  // one until the finger lifts: the entry then waits for that lift (or a tap, a key).
  useEffect(() => {
    if (!active || pushed.current) return;
    const push = () => {
      if (pushed.current) return;
      window.history.pushState({ selection: true } satisfies SelectionState, '');
      pushed.current = true;
    };
    if (!navigator.userActivation || navigator.userActivation.isActive) {
      push();
      return;
    }
    const gestures = ['pointerup', 'touchend', 'keydown', 'click'] as const;
    const stop = () =>
      gestures.forEach((name) => window.removeEventListener(name, onGesture, true));
    let timer = 0;
    // Once that event has granted the gesture, not while it is being handed out.
    const onGesture = () => {
      stop();
      timer = window.setTimeout(push, 0);
    };
    gestures.forEach((name) => window.addEventListener(name, onGesture, true));
    return () => {
      stop();
      window.clearTimeout(timer);
    };
  }, [active]);

  useEffect(() => {
    if (!pushed.current) skipDeadEntry();
    const onPop = () => {
      if (!pushed.current) {
        skipDeadEntry();
        return;
      }
      if (isSelectionEntry(window.history.state)) return;
      pushed.current = false;
      setSelected(EMPTY);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const clear = useCallback(() => {
    if (pushed.current && isSelectionEntry(window.history.state)) {
      window.history.back(); // popstate clears it
    } else {
      pushed.current = false;
      setSelected(EMPTY);
    }
  }, []);

  // Escape ends it on a computer (unless a dialog above has it).
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || document.querySelector('dialog[open]')) return;
      event.preventDefault();
      clear();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, clear]);

  // Emptied (by taps, or its photos left the list): the entry goes too, and the popstate that
  // follows clears what is left, so that photos coming back do not bring the selection back.
  useEffect(() => {
    if (!active && pushed.current && isSelectionEntry(window.history.state)) {
      window.history.back();
    }
  }, [active]);

  /** A long press: the photo is selected, and a drag may follow from it. */
  const press = useCallback((item: MediaItem) => {
    anchor.current = item.id;
    setSelected((current) => {
      const next = current.has(item.id) ? current : new Set([...current, item.id]);
      dragBase.current = next;
      return next;
    });
  }, []);

  const toggle = useCallback((item: MediaItem) => {
    anchor.current = item.id;
    setSelected((current) => toggled(current, item.id));
  }, []);

  /** Shift + click: from the last photo touched to this one. */
  const extend = useCallback(
    (item: MediaItem) => {
      const from = anchor.current;
      anchor.current = item.id;
      setSelected((current) =>
        from ? withRange(current, items, from, item.id) : toggled(current, item.id),
      );
    },
    [items],
  );

  /** The finger that long-pressed is now over this photo. */
  const dragTo = useCallback(
    (item: MediaItem) => {
      const from = anchor.current;
      if (!from) return;
      setSelected(withRange(dragBase.current, items, from, item.id));
    },
    [items],
  );

  const toggleAll = useCallback((ids: readonly string[]) => {
    setSelected((current) => toggledAll(current, ids));
  }, []);

  return { selected, active, press, toggle, extend, dragTo, toggleAll, clear };
}
