import { describe, expect, it } from 'vitest';
import { dayKey, memoriesOf, memoryNotification, yearsAgoLabel } from './memories.ts';
import type { MediaItem } from './model.ts';

const item = (id: string, takenAt: number | null): MediaItem => ({
  id,
  name: `${id}.jpg`,
  folderId: 'f',
  albumId: 'f',
  kind: 'image',
  mimeType: 'image/jpeg',
  size: 1,
  eTag: 'e',
  takenAt,
  dateSource: takenAt === null ? null : 'exif',
  width: null,
  height: null,
  durationMs: null,
  camera: null,
  latitude: null,
  longitude: null,
});
const at = (year: number, month: number, day: number, hour = 12) =>
  Date.UTC(year, month - 1, day, hour);
const ids = (items: readonly MediaItem[]) => items.map((one) => one.id);

describe('memoriesOf', () => {
  const items = [
    item('today', at(2026, 10, 28, 9)),
    item('y1-late', at(2025, 10, 28, 23)),
    item('y1-early', at(2025, 10, 28, 0)),
    item('y1-next-day', at(2025, 10, 29, 0)),
    item('y3', at(2023, 10, 28)),
    item('y3-other-month', at(2023, 9, 28)),
    item('y10', at(2016, 10, 28)),
    item('undated', null),
  ];

  it('gives the photos of this day in earlier years, the most recent year first', () => {
    const memories = memoriesOf(items, at(2026, 10, 28, 7));
    expect(memories.map((memory) => [memory.year, memory.yearsAgo, ids(memory.items)])).toEqual([
      [2025, 1, ['y1-late', 'y1-early']],
      [2023, 3, ['y3']],
      [2016, 10, ['y10']],
    ]);
  });

  it('has nothing on a day without memories', () => {
    expect(memoriesOf(items, at(2026, 3, 3))).toEqual([]);
  });

  it('brings 29 February back on the 28th in years without a 29th', () => {
    const leap = [item('feb29', at(2024, 2, 29)), item('feb28', at(2024, 2, 28))];
    expect(ids(memoriesOf(leap, at(2025, 2, 28))[0]?.items ?? [])).toEqual(['feb29', 'feb28']);
    // In a leap year, the 29th has its own day.
    expect(ids(memoriesOf(leap, at(2028, 2, 28))[0]?.items ?? [])).toEqual(['feb28']);
    expect(ids(memoriesOf(leap, at(2028, 2, 29))[0]?.items ?? [])).toEqual(['feb29']);
    expect(memoriesOf(leap, at(2025, 3, 1))).toEqual([]);
  });

  it('starts on the 1st of January as on any day', () => {
    const newYear = [item('a', at(2025, 1, 1, 0)), item('b', at(2025, 12, 31, 23))];
    expect(ids(memoriesOf(newYear, at(2026, 1, 1))[0]?.items ?? [])).toEqual(['a']);
  });
});

describe('labels', () => {
  it('says one year or several', () => {
    expect(yearsAgoLabel(1)).toBe('Il y a 1 an');
    expect(yearsAgoLabel(7)).toBe('Il y a 7 ans');
  });

  it('keys a day by its date', () => {
    expect(dayKey(at(2026, 10, 28, 23))).toBe('2026-10-28');
  });
});

describe('memoryNotification', () => {
  const items = [
    item('a', at(2025, 10, 28)),
    item('b', at(2025, 10, 28)),
    item('c', at(2023, 10, 28)),
    item('d', at(2020, 10, 28)),
    item('e', at(2019, 10, 28)),
  ];

  it('tells the memories of the day, three years at most', () => {
    expect(memoryNotification(items, at(2026, 10, 28, 9), null)).toEqual({
      day: '2026-10-28',
      title: '5 souvenirs ce jour-là',
      body: 'Il y a 1 an, il y a 3 ans, il y a 6 ans… Touche pour les revoir.',
    });
    expect(memoryNotification(items.slice(2, 3), at(2026, 10, 28, 9), null)).toMatchObject({
      title: 'Un souvenir ce jour-là',
      body: 'Il y a 3 ans. Touche pour les revoir.',
    });
  });

  it('waits until 8 o’clock, and tells once a day', () => {
    expect(memoryNotification(items, at(2026, 10, 28, 7), null)).toBeNull();
    expect(memoryNotification(items, at(2026, 10, 28, 8), null)).not.toBeNull();
    expect(memoryNotification(items, at(2026, 10, 28, 20), '2026-10-28')).toBeNull();
    expect(memoryNotification(items, at(2026, 10, 29, 9), '2026-10-28')).toBeNull(); // none that day
  });
});
