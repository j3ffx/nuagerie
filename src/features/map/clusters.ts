import Supercluster from 'supercluster';
import type { MediaItem } from '../../data/model.ts';

/**
 * Groups of photos on the map. Supercluster indexes every located photo once;
 * each view then asks only for the groups inside it, so 8 000 points cost a
 * few dozen markers. A group shows its most recent photo.
 */

/** West, south, east, north, in degrees. */
export type Bounds = [number, number, number, number];

interface PointProps {
  /** Index in the located items. */
  index: number;
  /** Capture date; undated photos rank last for the cover. */
  takenAt: number;
}

interface ClusterProps {
  cover: number;
  takenAt: number;
}

export type MapMarker =
  | {
      kind: 'cluster';
      id: number;
      latitude: number;
      longitude: number;
      count: number;
      cover: MediaItem;
    }
  | { kind: 'photo'; latitude: number; longitude: number; item: MediaItem };

export interface ClusterIndex {
  located: MediaItem[];
  index: Supercluster<PointProps, ClusterProps>;
}

const isLocated = (item: MediaItem): item is MediaItem & { latitude: number; longitude: number } =>
  item.latitude !== null && item.longitude !== null;

export function buildClusterIndex(items: readonly MediaItem[]): ClusterIndex {
  const located = items.filter(isLocated);
  const index = new Supercluster<PointProps, ClusterProps>({
    // In 512-pixel tile units: about 65 screen pixels on Leaflet's 256-pixel
    // tiles, a bit more than a marker, so groups don't overlap.
    radius: 130,
    maxZoom: 18,
    map: (props) => ({ cover: props.index, takenAt: props.takenAt }),
    reduce: (accumulated, props) => {
      if (props.takenAt > accumulated.takenAt) {
        accumulated.cover = props.cover;
        accumulated.takenAt = props.takenAt;
      }
    },
  });
  index.load(
    located.map((item, i) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [item.longitude ?? 0, item.latitude ?? 0] },
      properties: { index: i, takenAt: item.takenAt ?? -Infinity },
    })),
  );
  return { located, index };
}

/** Markers for the view: groups, and photos standing alone. */
export function markersInView(clusters: ClusterIndex, bounds: Bounds, zoom: number): MapMarker[] {
  const markers: MapMarker[] = [];
  for (const feature of clusters.index.getClusters(bounds, Math.round(zoom))) {
    const [longitude = 0, latitude = 0] = feature.geometry.coordinates;
    const props = feature.properties;
    if ('cluster' in props && props.cluster) {
      const cover = clusters.located[props.cover];
      if (cover) {
        markers.push({
          kind: 'cluster',
          id: props.cluster_id,
          latitude,
          longitude,
          count: props.point_count,
          cover,
        });
      }
    } else {
      const item = clusters.located[(props as PointProps).index];
      if (item) markers.push({ kind: 'photo', latitude, longitude, item });
    }
  }
  return markers;
}

/** Zoom level at which a group splits into smaller ones. */
export function expansionZoom(clusters: ClusterIndex, clusterId: number): number {
  return clusters.index.getClusterExpansionZoom(clusterId);
}

/**
 * Located photos inside the bounds, in their original order (most recent
 * first). Bounds crossing the date line have west > east.
 */
export function itemsInBounds(items: readonly MediaItem[], bounds: Bounds): MediaItem[] {
  const [west, south, east, north] = bounds;
  const crosses = west > east;
  return items.filter((item) => {
    if (!isLocated(item)) return false;
    if (item.latitude < south || item.latitude > north) return false;
    return crosses
      ? item.longitude >= west || item.longitude <= east
      : item.longitude >= west && item.longitude <= east;
  });
}

/** Bounds of the located photos, or null when none has a position. */
export function boundsOf(items: readonly MediaItem[]): Bounds | null {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const item of items) {
    if (!isLocated(item)) continue;
    west = Math.min(west, item.longitude);
    east = Math.max(east, item.longitude);
    south = Math.min(south, item.latitude);
    north = Math.max(north, item.latitude);
  }
  return west === Infinity ? null : [west, south, east, north];
}

/** "b=w,s,e,n" in a URL, for the zone's grid. */
export function formatBounds(bounds: Bounds): string {
  return bounds.map((value) => value.toFixed(5)).join(',');
}

export function parseBounds(text: string | null): Bounds | null {
  const values = (text ?? '').split(',').map(Number);
  if (values.length !== 4 || values.some((value) => !Number.isFinite(value))) return null;
  return values as Bounds;
}

/** Link that opens a position in the phone's map app (Google Maps on Android). */
export function mapsHref(latitude: number, longitude: number): string {
  return `geo:${latitude},${longitude}?q=${latitude},${longitude}`;
}
