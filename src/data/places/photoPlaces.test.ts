import { describe, expect, it, vi } from 'vitest';
import type { MediaItem } from '../model.ts';
import type { Place } from './placeIndex.ts';
import { coordinateKey } from './places.ts';
import { createPhotoPlaces, type PlaceLookup, type PlaceStorage } from './photoPlaces.ts';

const item = (id: string, latitude: number | null, longitude: number | null): MediaItem => ({
  id,
  name: `${id}.jpg`,
  folderId: 'f',
  albumId: 'f',
  kind: 'image',
  mimeType: 'image/jpeg',
  size: 1,
  eTag: 'e',
  takenAt: null,
  dateSource: null,
  width: null,
  height: null,
  durationMs: null,
  camera: null,
  latitude,
  longitude,
});

const town = (latitude: number): Place => ({
  name: `T${latitude}`,
  town: `T${latitude}`,
  country: 'FR',
  km: 0,
});

function memoryStorage(saved: [string, Place | null][] = []) {
  const map = new Map(saved);
  const storage: PlaceStorage = {
    load: vi.fn(() => Promise.resolve(new Map(map))),
    save: vi.fn((entries) => {
      for (const [key, place] of entries) map.set(key, place);
      return Promise.resolve();
    }),
    clear: vi.fn(() => {
      map.clear();
      return Promise.resolve();
    }),
  };
  return { map, storage };
}

const lookupAll: PlaceLookup = (points) =>
  Promise.resolve(points.map(([latitude]) => (latitude > 80 ? null : town(latitude))));

describe('createPhotoPlaces', () => {
  it('looks up each rounded position once, and keeps what it found', async () => {
    const lookup = vi.fn(lookupAll);
    const { map, storage } = memoryStorage();
    const places = createPhotoPlaces(lookup, storage);
    await places.ensure([
      item('a', 45.7641, 4.8357),
      item('b', 45.76412, 4.83571), // same place within 100 m
      item('c', 10, 20),
      item('d', null, null),
      item('e', 85, 0), // the open sea: no place, and remembered as such
    ]);
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(lookup.mock.calls[0]?.[0]).toHaveLength(3);
    const { known, pending, failed } = places.getSnapshot();
    expect(known.get(coordinateKey(45.7641, 4.8357))?.name).toBe('T45.7641');
    expect(known.get(coordinateKey(85, 0))).toBeNull();
    expect(known.has(coordinateKey(85, 0))).toBe(true);
    expect({ pending, failed }).toEqual({ pending: false, failed: false });
    expect(map.size).toBe(3);

    await places.ensure([item('a', 45.7641, 4.8357), item('f', 1, 2)]);
    expect(lookup).toHaveBeenCalledTimes(2);
    expect(lookup.mock.calls[1]?.[0]).toEqual([[1, 2]]);
  });

  it('starts from the places kept on the device, with no lookup for them', async () => {
    const lookup = vi.fn(lookupAll);
    const { storage } = memoryStorage([[coordinateKey(10, 20), town(10)]]);
    const places = createPhotoPlaces(lookup, storage);
    await places.ensure([item('c', 10, 20)]);
    expect(lookup).not.toHaveBeenCalled();
    expect(places.getSnapshot().known.get(coordinateKey(10, 20))?.name).toBe('T10');
  });

  it('says when the lookup fails (no place list offline), and tries again later', async () => {
    const lookup = vi.fn<PlaceLookup>(() => Promise.reject(new Error('offline')));
    const places = createPhotoPlaces(lookup, memoryStorage().storage);
    await places.ensure([item('c', 10, 20)]);
    expect(places.getSnapshot()).toMatchObject({ pending: false, failed: true });

    lookup.mockImplementation(lookupAll);
    await places.ensure([item('c', 10, 20)]);
    expect(places.getSnapshot()).toMatchObject({ pending: false, failed: false });
    expect(places.getSnapshot().known.size).toBe(1);
  });

  it('tells its listeners, and shows that a lookup is under way', async () => {
    let finish: (places: (Place | null)[]) => void = () => undefined;
    const lookup: PlaceLookup = () => new Promise((resolve) => (finish = resolve));
    const places = createPhotoPlaces(lookup, memoryStorage().storage);
    const listener = vi.fn();
    places.subscribe(listener);
    const done = places.ensure([item('c', 10, 20)]);
    await vi.waitFor(() => expect(places.getSnapshot().pending).toBe(true));
    finish([town(10)]);
    await done;
    expect(places.getSnapshot().pending).toBe(false);
    expect(listener).toHaveBeenCalled();
  });

  it('takes in items that come while it is looking up', async () => {
    const lookup = vi.fn(lookupAll);
    const places = createPhotoPlaces(lookup, memoryStorage().storage);
    const first = places.ensure([item('c', 10, 20)]);
    const second = places.ensure([item('c', 10, 20), item('g', 30, 40)]);
    await Promise.all([first, second]);
    expect(places.getSnapshot().known.size).toBe(2);
  });

  it('forgets everything on clear, a lookup still running included', async () => {
    let finish: (places: (Place | null)[]) => void = () => undefined;
    const lookup: PlaceLookup = () => new Promise((resolve) => (finish = resolve));
    const { map, storage } = memoryStorage([[coordinateKey(1, 1), town(1)]]);
    const places = createPhotoPlaces(lookup, storage);
    const done = places.ensure([item('c', 10, 20)]);
    await vi.waitFor(() => expect(places.getSnapshot().pending).toBe(true));
    await places.clear();
    finish([town(10)]);
    await done;
    expect(places.getSnapshot().known.size).toBe(0);
    expect(map.size).toBe(0);
  });
});
