import { describe, expect, it } from 'vitest';
import { awayFromCaptures, closest, normalized, toBytes, wantsCaptures } from './rank.ts';

const table = (vectors: Record<string, number[]>) => ({
  ids: Object.keys(vectors),
  bytes: Int8Array.from(Object.values(vectors).flat()),
});

describe('toBytes', () => {
  it('scales a normalized vector and clamps what goes past the range', () => {
    expect([...toBytes(Float32Array.of(0.25, -0.25, 0.9, -0.9, 0))]).toEqual([
      64, -63, 127, -127, 0,
    ]);
  });
});

describe('normalized', () => {
  it('gives a vector of length one', () => {
    expect([...normalized(Float32Array.of(3, 4))].map((v) => +v.toFixed(3))).toEqual([0.6, 0.8]);
  });

  it('leaves a null vector alone', () => {
    expect([...normalized(Float32Array.of(0, 0))]).toEqual([0, 0]);
  });
});

describe('closest', () => {
  const vectors = table({ a: [100, 0], b: [0, 100], c: [70, 70] });
  const all = new Set(['a', 'b', 'c']);

  it('sorts from the closest', () => {
    expect(closest(vectors, Float32Array.of(1, 0), all, 3)).toEqual(['a', 'c', 'b']);
  });

  it('stops at the limit', () => {
    expect(closest(vectors, Float32Array.of(0, 1), all, 1)).toEqual(['b']);
  });

  it('only looks at the items asked for, as a date or an album narrows the search', () => {
    expect(closest(vectors, Float32Array.of(1, 0), new Set(['b', 'c']), 3)).toEqual(['c', 'b']);
  });
});

describe('screenshots', () => {
  const vectors = table({ capture: [80, 60], photo: [70, 0] });
  const query = Float32Array.of(1, 0);
  const capture = Float32Array.of(0, 1);
  const all = new Set(['capture', 'photo']);

  it('come after a photo as close to the words', () => {
    expect(closest(vectors, query, all, 2)).toEqual(['capture', 'photo']);
    expect(closest(vectors, awayFromCaptures(query, capture), all, 2)).toEqual([
      'photo',
      'capture',
    ]);
  });

  it('are not pushed away from who asks for them', () => {
    expect(wantsCaptures('capture d’écran de la météo')).toBe(true);
    expect(wantsCaptures('Screenshot of a map')).toBe(true);
    expect(wantsCaptures('gâteau avec des bougies')).toBe(false);
  });
});
