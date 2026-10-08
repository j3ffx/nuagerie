import { lazy, Suspense, useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'wouter';
import { withoutFolders } from '../../data/albums.ts';
import { useMediaIndex } from '../../data/dataContext.ts';
import type { MediaItem } from '../../data/model.ts';
import { describeItem, formatCount, formatItemCount } from '../../lib/format.ts';
import { useOnline } from '../../lib/online.ts';
import { readPersistent, writePersistent } from '../../lib/persistent.ts';
import common from '../../ui/common.module.css';
import { CloudOffIcon, FilterIcon } from '../../ui/icons.tsx';
import { IndexStatus } from '../../ui/IndexStatus.tsx';
import { ScreenHeader } from '../../ui/ScreenHeader.tsx';
import { Thumbnail } from '../../ui/Thumbnail.tsx';
import allStyles from '../all/AllScreen.module.css';
import { useAllFilter } from '../all/useAllFilter.ts';
import { photoHref, useViewer } from '../viewer/useViewer.ts';
import { Viewer } from '../viewer/Viewer.tsx';
import { boundsOf, formatBounds, itemsInBounds, mapsHref, type Bounds } from './clusters.ts';
import type { MapViewState } from './MapView.tsx';
import styles from './MapScreen.module.css';

const MapView = lazy(() => import('./MapView.tsx'));

/** Last view of the map, so coming back to the tab finds it as it was left. */
const VIEW_KEY = 'map.view';
/** The map opens on a photo at zoom 16; below a town's scale, the Maps link goes. */
const MAPS_LINK_MIN_ZOOM = 13;
/** Thumbnails in the strip under the map; the zone's grid shows them all. */
const STRIP = 30;

/**
 * The photos on a world map, grouped by place. A tap on a group zooms in, a
 * tap on a photo opens it. The photos of the zone on screen are listed
 * underneath, with a link to see them all in a grid. Same folder filter as
 * "Tout". Opened from the viewer (`?focus=<id>`), it points at that photo and
 * offers to open the place in the phone's map app.
 */
export function MapScreen() {
  const index = useMediaIndex();
  const { excluded } = useAllFilter();
  const [params] = useSearchParams();
  const { photoId, open, show, close } = useViewer();
  const [zone, setZone] = useState<Bounds | null>(null);
  const [zoom, setZoom] = useState<number | null>(null);
  const online = useOnline();

  const items = useMemo(() => (index ? withoutFolders(index, excluded) : []), [index, excluded]);
  const located = useMemo(() => items.filter((item) => item.latitude !== null), [items]);
  const focusId = params.get('focus');
  const focus = useMemo(
    () => (focusId ? (index?.items.find((item) => item.id === focusId) ?? null) : null),
    [index, focusId],
  );
  const [initial] = useState<MapViewState | Bounds | null>(() =>
    readPersistent<MapViewState | null>(VIEW_KEY, null),
  );
  const zoneItems = useMemo(() => (zone ? itemsInBounds(located, zone) : []), [located, zone]);
  const hiddenCount = index ? [...excluded].filter((id) => index.folders.has(id)).length : 0;

  const onMove = useCallback((view: MapViewState, bounds: Bounds) => {
    writePersistent(VIEW_KEY, view);
    setZone(bounds);
    setZoom(view.zoom);
  }, []);
  const onOpen = useCallback((item: MediaItem) => open(item.id), [open]);

  // The viewer swipes through the zone's photos; a photo outside it (a link) shows alone.
  const viewerItems = useMemo(() => {
    if (photoId === null) return [];
    if (zoneItems.some((item) => item.id === photoId)) return zoneItems;
    const item = index?.items.find((candidate) => candidate.id === photoId);
    return item ? [item] : [];
  }, [photoId, zoneItems, index]);
  const viewerIndex = viewerItems.findIndex((item) => item.id === photoId);

  return (
    <>
      <ScreenHeader
        title="Carte"
        actions={
          <Link
            href="/tout/filtre?retour=carte"
            className={`${common.chip} ${allStyles.filter}`}
            aria-label={
              hiddenCount > 0
                ? `Filtrer par albums (${formatCount(hiddenCount)} masqué${hiddenCount > 1 ? 's' : ''})`
                : 'Filtrer par albums'
            }
          >
            <FilterIcon width={18} height={18} />
            {hiddenCount > 0 ? formatCount(hiddenCount) : 'Filtrer'}
          </Link>
        }
      />
      <IndexStatus />
      {index && (
        <div className={styles.screen}>
          <Suspense fallback={<div className={styles.map} />}>
            <MapView
              items={located}
              initial={initial ?? boundsOf(located)}
              focus={focus}
              onMove={onMove}
              onOpen={onOpen}
            />
          </Suspense>
          {!online && (
            // Tiles seen lately may come from the browser's cache: the rest stays blank.
            <p className={styles.offline} role="status">
              <CloudOffIcon width={18} height={18} />
              Hors connexion · carte incomplète
            </p>
          )}
          <ZonePanel
            items={zoneItems}
            total={located.length}
            zone={zone}
            zoom={zoom}
            focus={focus}
            onOpen={onOpen}
          />
        </div>
      )}
      {viewerIndex >= 0 && (
        <Viewer items={viewerItems} index={viewerIndex} onShow={show} onClose={close} />
      )}
    </>
  );
}

/** The photos of the zone on screen: count, a strip of thumbnails, the full grid. */
function ZonePanel({
  items,
  total,
  zone,
  zoom,
  focus,
  onOpen,
}: {
  items: readonly MediaItem[];
  total: number;
  zone: Bounds | null;
  zoom: number | null;
  focus: MediaItem | null;
  onOpen: (item: MediaItem) => void;
}) {
  // Offered only while the photo it is for is on screen, at the scale of its
  // place: zoomed out to a region or the world, it no longer reads as "this place".
  const focusPosition =
    focus?.latitude != null && focus.longitude != null
      ? { latitude: focus.latitude, longitude: focus.longitude }
      : null;
  const focusShown =
    focus !== null &&
    zone !== null &&
    zoom !== null &&
    zoom >= MAPS_LINK_MIN_ZOOM &&
    itemsInBounds([focus], zone).length > 0;

  return (
    <section className={styles.panel} aria-labelledby="map-zone">
      <div className={styles.panelHeader}>
        <h2 id="map-zone" className={styles.panelTitle}>
          {total === 0
            ? 'Aucune photo géolocalisée'
            : items.length === 0
              ? 'Rien dans cette zone'
              : `${formatItemCount(items.length)} dans cette zone`}
        </h2>
        {zone && items.length > 0 && (
          <Link href={`/carte/zone?b=${formatBounds(zone)}`} className={common.chip}>
            Tout voir
          </Link>
        )}
      </div>
      {/*
        The panel keeps its height whatever the zone holds: a panel that grew or
        shrank would resize the map, and a photo on its edge would come in and
        out of the zone again and again.
      */}
      {total > 0 && items.length === 0 && (
        <p className={`${common.muted} ${styles.stripEmpty}`}>
          Déplace la carte ou dézoome pour voir des photos.
        </p>
      )}
      {items.length > 0 && (
        <ul className={styles.strip}>
          {items.slice(0, STRIP).map((item) => (
            <li key={item.id}>
              <a
                href={photoHref(item.id)}
                className={styles.stripItem}
                aria-label={describeItem(item)}
                onClick={(event) => {
                  event.preventDefault();
                  onOpen(item);
                }}
              >
                <Thumbnail item={item} decorative />
              </a>
            </li>
          ))}
        </ul>
      )}
      {focusPosition && (
        <a
          className={`${common.buttonSoft} ${styles.maps}`}
          href={mapsHref(focusPosition.latitude, focusPosition.longitude)}
          // Offered only while its photo is on screen; its room stays, for the same reason.
          data-hidden={!focusShown || undefined}
          inert={!focusShown}
          aria-hidden={!focusShown || undefined}
        >
          Ouvrir ce lieu dans Maps
        </a>
      )}
    </section>
  );
}
