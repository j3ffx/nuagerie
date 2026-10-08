import { useCallback, useEffect, useRef, useState } from 'react';
import type { MediaItem } from '../../data/model.ts';
import { toggled, toggledAll, withRange, type Selection } from './selection.ts';

/** History entry pushed when a selection starts: Android's back button ends it. */
interface SelectionState {
  selection: true;
}

const isSelectionEntry = (state: unknown) => (state as SelectionState | null)?.selection === true;

const EMPTY: Selection = new Set();

/**
 * Photos picked in a grid. A long press (or Ctrl / Shift + click) starts the
 * selection; then a tap adds or removes a photo, a drag after the long press
 * takes every photo it passes, and a month's title takes the whole month.
 * The back button, the close button or an empty selection end it.
 */
export function useSelection(items: readonly MediaItem[]) {
  const [selected, setSelected] = useState<Selection>(EMPTY);
  const active = selected.size > 0;
  /** Where the last long press or click was: the start of a drag or of a Shift + click. */
  const anchor = useRef<string | null>(null);
  /** The selection when the drag began; the drag adds its range to it. */
  const dragBase = useRef<Selection>(EMPTY);
  const pushed = useRef(false);

  // Started: one history entry, so that back ends the selection instead of leaving the screen.
  useEffect(() => {
    if (active && !pushed.current) {
      window.history.pushState({ selection: true } satisfies SelectionState, '');
      pushed.current = true;
    }
  }, [active]);

  useEffect(() => {
    const onPop = () => {
      if (!pushed.current || isSelectionEntry(window.history.state)) return;
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

  // Emptied by taps: the entry goes too.
  useEffect(() => {
    if (!active && pushed.current && isSelectionEntry(window.history.state)) {
      pushed.current = false;
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
