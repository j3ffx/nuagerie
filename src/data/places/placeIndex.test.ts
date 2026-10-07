import { describe, expect, it } from 'vitest';
import { buildPlaceIndex, nearestPlace } from './placeIndex.ts';

const index = buildPlaceIndex(
  [
    'Lyon\t45.748\t4.847\tFR',
    'Villeurbanne\t45.767\t4.880\tFR',
    'Genève\t46.202\t6.146\tCH',
    'Annecy\t45.899\t6.129\tFR',
    'Reykjavík\t64.135\t-21.895\tIS',
    'Suva\t-18.142\t178.441\tFJ',
    '',
  ].join('\n'),
);

describe('nearestPlace', () => {
  it('names the nearest place, with its country and distance', () => {
    expect(nearestPlace(index, 45.764, 4.836)).toMatchObject({ name: 'Lyon', country: 'FR' });
    expect(nearestPlace(index, 45.77, 4.88)?.name).toBe('Villeurbanne');
    expect(nearestPlace(index, 46.21, 6.15)).toMatchObject({ name: 'Genève', country: 'CH' });
  });

  it('looks across cell edges: the nearest place may be in the next degree', () => {
    // 45.999 is in the 45° cell, Genève in the 46° one, Annecy further away.
    const place = nearestPlace(index, 45.999, 6.14);
    expect(place?.name).toBe('Annecy');
    expect(nearestPlace(index, 46.1, 6.14)?.name).toBe('Genève');
  });

  it('finds places far from the photo, and across the date line', () => {
    expect(nearestPlace(index, 63, -21)).toMatchObject({ name: 'Reykjavík' });
    expect(nearestPlace(index, -18.2, -179.9)?.name).toBe('Suva');
  });

  it('gives nothing in the open sea', () => {
    expect(nearestPlace(index, 0, -30)).toBeNull();
  });

  it('measures distances in kilometres', () => {
    const km = nearestPlace(index, 45.899, 6.229)?.km ?? 0;
    expect(km).toBeGreaterThan(7);
    expect(km).toBeLessThan(8.5);
  });
});
