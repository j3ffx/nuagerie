import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import { useEffect, useEffectEvent, useMemo, useRef } from 'react';
import { useData } from '../../data/dataContext.ts';
import type { MediaItem } from '../../data/model.ts';
import type { ThumbnailHandle } from '../../data/thumbnails/thumbnailStore.ts';
import { describeItem, formatCount } from '../../lib/format.ts';
import {
  buildClusterIndex,
  canExpand,
  expansionZoom,
  markersInView,
  MAX_ZOOM,
  photosOf,
  type Bounds,
} from './clusters.ts';
import styles from './MapScreen.module.css';

export interface MapViewState {
  latitude: number;
  longitude: number;
  zoom: number;
}

/**
 * The map itself (Leaflet, OpenStreetMap tiles), loaded only when the map
 * screen opens. Groups and photos are redrawn after each move: only the
 * markers inside the view exist, each showing a cached thumbnail.
 */
export default function MapView({
  items,
  initial,
  focus,
  onMove,
  onOpen,
}: {
  /** Photos to place (those without a position are ignored). */
  items: readonly MediaItem[];
  /** Where to start: a remembered view, a focused photo, or all photos (null). */
  initial: MapViewState | Bounds | null;
  /** A photo to point at (coming from the viewer). */
  focus: MediaItem | null;
  onMove: (view: MapViewState, bounds: Bounds) => void;
  onOpen: (item: MediaItem) => void;
}) {
  const { store } = useData().thumbnails;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const handles = useRef<ThumbnailHandle[]>([]);
  /** Set once the map has a view: before that it has no bounds. */
  const placed = useRef(false);
  const clusters = useMemo(() => buildClusterIndex(items), [items]);
  const still = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const releaseThumbnails = () => {
    handles.current.forEach((handle) => handle.release());
    handles.current = [];
  };

  /**
   * A round thumbnail, with the number of photos for a group. The disc is
   * drawn by the marker itself, so it shows while the thumbnail loads.
   */
  const icon = (item: MediaItem, count: number | null, focused: boolean) => {
    const element = document.createElement('div');
    element.className = `${styles.marker ?? ''} ${focused ? (styles.focused ?? '') : ''}`;
    const disc = document.createElement('span');
    disc.className = styles.disc ?? '';
    const image = document.createElement('img');
    image.alt = '';
    image.draggable = false;
    image.onload = () => (image.dataset.loaded = 'true');
    disc.append(image);
    element.append(disc);
    if (count !== null) {
      const badge = document.createElement('span');
      badge.className = styles.count ?? '';
      badge.textContent = formatCount(count);
      element.append(badge);
    }
    const handle = store.acquire(item, 'medium');
    handles.current.push(handle);
    handle.promise.then(
      (url) => {
        image.src = url;
      },
      () => undefined, // no thumbnail: the coloured disc stays
    );
    const size = count === null ? 48 : 56;
    return L.divIcon({ html: element, className: '', iconSize: [size, size] });
  };

  const redraw = useEffectEvent(() => {
    const map = mapRef.current;
    const layer = markersRef.current;
    if (!map || !layer || !placed.current) return;
    const b = map.getBounds();
    const bounds: Bounds = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
    releaseThumbnails();
    layer.clearLayers();
    for (const marker of markersInView(clusters, bounds, map.getZoom())) {
      const position: L.LatLngTuple = [marker.latitude, marker.longitude];
      if (marker.kind === 'cluster') {
        // Photos taken at the same spot never split: the group opens them.
        const expands = canExpand(clusters, marker.id);
        const focused =
          focus !== null && photosOf(clusters, marker.id).some((p) => p.id === focus.id);
        L.marker(position, {
          icon: icon(marker.cover, marker.count, focused),
          title: `${formatCount(marker.count)} éléments, ${expands ? 'agrandir' : 'ouvrir'}`,
          keyboard: true,
        })
          .on('click', () => {
            if (!expands) {
              const first = photosOf(clusters, marker.id)[0];
              if (first) onOpen(first);
              return;
            }
            const zoom = expansionZoom(clusters, marker.id);
            if (still()) map.setView(position, zoom, { animate: false });
            else map.flyTo(position, zoom, { duration: 0.4 });
          })
          .addTo(layer);
      } else {
        L.marker(position, {
          icon: icon(marker.item, null, marker.item.id === focus?.id),
          title: describeItem(marker.item),
          keyboard: true,
        })
          .on('click', () => onOpen(marker.item))
          .addTo(layer);
      }
    }
    const center = map.getCenter();
    onMove({ latitude: center.lat, longitude: center.lng, zoom: map.getZoom() }, bounds);
  });

  // The map is created once; the markers follow the photos and the view.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const map = L.map(container, {
      zoomControl: false,
      attributionControl: true,
      worldCopyJump: true,
      minZoom: 2,
      maxZoom: MAX_ZOOM,
      // The world ends at the poles: no dragging into the blank above or below.
      maxBounds: L.latLngBounds([-85.0511, -1e5], [85.0511, 1e5]),
      maxBoundsViscosity: 1,
      // A little momentum, as in map apps: a flicked map glides a bit further
      // (Leaflet's default stops short)…
      inertiaDeceleration: 2000,
      // …and pinches may end between levels, so their momentum shows.
      zoomSnap: 0.25,
    });
    addPinchMomentum(map);
    map.attributionControl.setPrefix(false);
    L.control
      .zoom({ position: 'topright', zoomInTitle: 'Zoomer', zoomOutTitle: 'Dézoomer' })
      .addTo(map);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxNativeZoom: 19,
      maxZoom: MAX_ZOOM,
      className: styles.tiles,
      // OpenStreetMap asks for a Referer, which the site's policy withholds otherwise.
      referrerPolicy: 'strict-origin-when-cross-origin',
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">contributeurs OpenStreetMap</a>',
    }).addTo(map);
    markersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    map.on('moveend', () => {
      container.dataset.zoom = String(map.getZoom()); // for the tests
      redraw();
    });
    // The container's size changes with the screen (rotation, panel). Never
    // zoom out so far that the world is shorter than the map.
    const observer = new ResizeObserver(() => {
      map.invalidateSize();
      map.setMinZoom(Math.max(2, Math.ceil(Math.log2(container.clientHeight / 256))));
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      releaseThumbnails();
      map.remove();
      mapRef.current = null;
      markersRef.current = null;
      placed.current = false;
    };
  }, []);

  // Starting view (and new targets: a photo from the viewer).
  const place = useEffectEvent(() => {
    const map = mapRef.current;
    if (!map) return;
    placed.current = true;
    if (focus?.latitude != null && focus.longitude != null) {
      map.setView([focus.latitude, focus.longitude], 16);
    } else if (initial && 'zoom' in initial) {
      map.setView([initial.latitude, initial.longitude], initial.zoom);
    } else if (initial) {
      const [west, south, east, north] = initial;
      map.fitBounds(
        [
          [south, west],
          [north, east],
        ],
        { padding: [24, 24], maxZoom: 14 },
      );
    } else {
      map.setView([46.6, 2.4], 5); // France, when no photo has a position
    }
  });
  useEffect(() => place(), [focus?.id]);

  // New photos (filter, sync), or a new photo to point at: redraw in place.
  useEffect(() => redraw(), [clusters, focus?.id]);

  return <div ref={containerRef} className={styles.map} />;
}

/** Extra zoom per unit of pinch speed (levels per second), and its cap. */
const PINCH_MOMENTUM_S = 0.2;
const PINCH_MOMENTUM_MAX = 0.5;

/**
 * Leaflet stops a pinch dead where the fingers leave. This carries it on a
 * little, in proportion to the pinch's speed at the end, through Leaflet's
 * own end-of-pinch animation. It wraps a private method of Leaflet 1.9's
 * touch-zoom handler (`_onTouchEnd`, `_zoom`): check it on a major upgrade.
 */
function addPinchMomentum(map: L.Map) {
  const handler = map.touchZoom as unknown as {
    _zooming?: boolean;
    _zoom: number;
    _onTouchEnd: () => void;
  };
  const samples: { time: number; zoom: number }[] = [];
  map.on('zoom', () => {
    if (!handler._zooming) return;
    const time = performance.now();
    samples.push({ time, zoom: handler._zoom });
    while (samples.length > 0 && time - (samples[0]?.time ?? time) > 100) samples.shift();
  });
  const end = handler._onTouchEnd.bind(handler);
  handler._onTouchEnd = () => {
    const first = samples[0];
    const last = samples.at(-1);
    samples.length = 0;
    if (handler._zooming && first && last && last.time - first.time > 16) {
      const speed = (last.zoom - first.zoom) / ((last.time - first.time) / 1000);
      const extra = Math.max(
        -PINCH_MOMENTUM_MAX,
        Math.min(PINCH_MOMENTUM_MAX, speed * PINCH_MOMENTUM_S),
      );
      handler._zoom = last.zoom + extra;
    }
    end();
  };
}
