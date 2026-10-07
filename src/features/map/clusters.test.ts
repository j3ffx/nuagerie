import { describe, expect, it } from 'vitest';
import type { MediaItem } from '../../data/model.ts';
import {
  boundsOf,
  buildClusterIndex,
  expansionZoom,
  formatBounds,
  itemsInBounds,
  markersInView,
  parseBounds,
  type Bounds,
} from './clusters.ts';

const photo = (
  id: string,
  latitude: number | null,
  longitude: number | null,
  takenAt: number | null,
) => ({ id, latitude, longitude, takenAt }) as MediaItem;

// Two outings in Lyon (one older), one photo in Annecy, one without position.
const items = [
  photo('lyon-new', 45.764, 4.835, Date.UTC(2026, 5, 1)),
  photo('annecy', 45.899, 6.129, Date.UTC(2025, 0, 1)),
  photo('lyon-old', 45.765, 4.836, Date.UTC(2020, 0, 1)),
  photo('lyon-undated', 45.766, 4.837, null),
  photo('nowhere', null, null, Date.UTC(2026, 0, 1)),
];
const world: Bounds = [-180, -85, 180, 85];

describe('map clusters', () => {
  const clusters = buildClusterIndex(items);

  it('indexes only located photos', () => {
    expect(clusters.located.map((item) => item.id)).not.toContain('nowhere');
    expect(clusters.located).toHaveLength(4);
  });

  it('groups nearby photos when zoomed out, covered by the most recent one', () => {
    const markers = markersInView(clusters, world, 3);
    expect(markers).toHaveLength(1);
    expect(markers[0]).toMatchObject({ kind: 'cluster', count: 4 });
    expect(markers[0]?.kind === 'cluster' && markers[0].cover.id).toBe('lyon-new');
  });

  it('separates towns, then single photos, as the zoom grows', () => {
    const towns = markersInView(clusters, world, 9);
    expect(towns.map((m) => (m.kind === 'cluster' ? m.count : m.item.id)).sort()).toEqual([
      3,
      'annecy',
    ]);
    const streets = markersInView(clusters, world, 18);
    expect(streets.filter((m) => m.kind === 'photo')).toHaveLength(4);
  });

  it('tells the zoom at which a group splits', () => {
    const group = markersInView(clusters, world, 3)[0];
    if (group?.kind !== 'cluster') throw new Error('expected a group');
    expect(expansionZoom(clusters, group.id)).toBeGreaterThan(3);
  });

  it('lists the photos of a zone in their order, across the date line too', () => {
    expect(itemsInBounds(items, [4.8, 45.7, 4.9, 45.8]).map((i) => i.id)).toEqual([
      'lyon-new',
      'lyon-old',
      'lyon-undated',
    ]);
    const pacific = [photo('fiji', -18.1, 178.4, 1), photo('samoa', -13.8, -171.8, 2)];
    expect(itemsInBounds(pacific, [170, -20, -170, -10])).toHaveLength(2);
  });

  it('frames all the located photos', () => {
    expect(boundsOf(items)).toEqual([4.835, 45.764, 6.129, 45.899]);
    expect(boundsOf([photo('x', null, null, null)])).toBeNull();
  });

  it('writes and reads zone bounds in URLs', () => {
    expect(parseBounds(formatBounds([4.8, 45.7, 4.9, 45.8]))).toEqual([4.8, 45.7, 4.9, 45.8]);
    expect(parseBounds('1,2,3')).toBeNull();
    expect(parseBounds(null)).toBeNull();
  });
});
