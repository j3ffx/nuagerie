import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MediaItem } from '../../data/model.ts';
import { PhotoGrid } from '../../ui/grid/PhotoGrid.tsx';
import { photoHref, useViewer } from './useViewer.ts';
import { Viewer } from './Viewer.tsx';

/**
 * A photo grid whose cells open the viewer on the same list: swiping goes
 * through the photos in the grid's order. Closing brings the grid back to
 * the last photo seen.
 */
export function PhotoBrowser({ items, label }: { items: readonly MediaItem[]; label: string }) {
  const { photoId, open, show, close } = useViewer();
  const index = useMemo(
    () => (photoId === null ? -1 : items.findIndex((item) => item.id === photoId)),
    [items, photoId],
  );
  const [reveal, setReveal] = useState<{ id: string } | null>(null);
  const lastSeen = useRef<string | null>(null);

  useEffect(() => {
    if (index >= 0) {
      lastSeen.current = photoId;
    } else if (photoId === null && lastSeen.current) {
      setReveal({ id: lastSeen.current });
      lastSeen.current = null;
    }
  }, [photoId, index]);

  // A photo that is not (or no longer) in this list: back to the grid.
  useEffect(() => {
    if (photoId !== null && index < 0 && items.length > 0) close();
  }, [photoId, index, items.length, close]);

  const href = useCallback((item: MediaItem) => photoHref(item.id), []);
  const onOpen = useCallback((item: MediaItem) => open(item.id), [open]);

  return (
    <>
      <PhotoGrid items={items} label={label} href={href} onOpen={onOpen} reveal={reveal} />
      {index >= 0 && <Viewer items={items} index={index} onShow={show} onClose={close} />}
    </>
  );
}
