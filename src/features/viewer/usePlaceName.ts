import { useEffect, useState } from 'react';
import { lookupPlace } from '../../data/places/places.ts';
import type { MediaItem } from '../../data/model.ts';
import { formatPlace } from '../../lib/format.ts';

/** "Annecy, France" for a geotagged photo, once the place list is loaded; null otherwise. */
export function usePlaceName(item: MediaItem): string | null {
  const [found, setFound] = useState<{ id: string; name: string | null } | null>(null);
  const { latitude, longitude } = item;
  useEffect(() => {
    if (latitude === null || longitude === null) return;
    let cancelled = false;
    lookupPlace(latitude, longitude).then(
      (place) => {
        if (!cancelled) setFound({ id: item.id, name: place ? formatPlace(place) : null });
      },
      () => undefined, // no place list (offline before it was ever loaded): no name
    );
    return () => {
      cancelled = true;
    };
  }, [item.id, latitude, longitude]);
  return found?.id === item.id ? found.name : null;
}
