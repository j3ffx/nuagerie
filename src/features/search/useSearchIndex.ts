import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { useMediaIndex } from '../../data/dataContext.ts';
import { photoPlaces } from '../../data/places/photoPlaces.ts';
import { buildSearchIndex } from '../../data/search/search.ts';
import { useOnline } from '../../lib/online.ts';

/**
 * The search over the current index, with the places of the photos as they
 * are found (kept on the device: the next search has them at once).
 */
export function useSearchIndex() {
  const index = useMediaIndex();
  const store = photoPlaces();
  const places = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const online = useOnline();

  // New photos, and another try once the network is back (the place list was not loaded).
  useEffect(() => {
    if (index) void store.ensure(index.items);
  }, [index, store, online]);

  const search = useMemo(
    () => (index ? buildSearchIndex(index, places.known) : null),
    [index, places.known],
  );
  return { search, places };
}
