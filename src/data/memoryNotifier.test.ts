import { describe, expect, it, vi } from 'vitest';
import type { MediaIndex, MediaItem } from './model.ts';
import { isNavigateMessage, notifyMemories, type NotifierDeps } from './memoryNotifier.ts';

const item = (id: string, takenAt: number): MediaItem => ({
  id,
  name: `${id}.jpg`,
  folderId: 'f',
  albumId: 'f',
  kind: 'image',
  mimeType: 'image/jpeg',
  size: 1,
  eTag: 'e',
  takenAt,
  dateSource: 'exif',
  width: null,
  height: null,
  durationMs: null,
  camera: null,
  latitude: null,
  longitude: null,
});
const index: MediaIndex = {
  folders: new Map(),
  items: [item('a', Date.UTC(2023, 9, 28, 12)), item('b', Date.UTC(2020, 9, 28, 12))],
  rootFolderIds: [],
};

function deps(overrides: Partial<NotifierDeps> = {}) {
  let notifiedOn: string | null = null;
  const show = vi.fn(() => Promise.resolve());
  const all: NotifierDeps = {
    loadIndex: () => Promise.resolve(index),
    now: () => Date.UTC(2026, 9, 28, 9),
    readNotifiedOn: () => Promise.resolve(notifiedOn),
    writeNotifiedOn: (day) => {
      notifiedOn = day;
      return Promise.resolve();
    },
    show,
    ...overrides,
  };
  return { all, show };
}

describe('notifyMemories', () => {
  it('tells the memories once a day', async () => {
    const { all, show } = deps();
    expect(await notifyMemories(all)).toBe(true);
    expect(show).toHaveBeenCalledWith(
      '2 souvenirs ce jour-là',
      'Il y a 3 ans, il y a 6 ans. Touche pour les revoir.',
      index.items[0],
    );
    expect(await notifyMemories(all)).toBe(false);
    expect(show).toHaveBeenCalledTimes(1);
  });

  it('reads the index only when a notification could be shown', async () => {
    const loadIndex = vi.fn(() => Promise.resolve(index));
    const early = deps({ loadIndex, now: () => Date.UTC(2026, 9, 28, 3) });
    expect(await notifyMemories(early.all)).toBe(false);
    const told = deps({ loadIndex, readNotifiedOn: () => Promise.resolve('2026-10-28') });
    expect(await notifyMemories(told.all)).toBe(false);
    expect(loadIndex).not.toHaveBeenCalled();
  });

  it('tells nothing without an index on the device, or too early', async () => {
    const none = deps({ loadIndex: () => Promise.resolve(null) });
    expect(await notifyMemories(none.all)).toBe(false);
    const early = deps({ now: () => Date.UTC(2026, 9, 28, 6) });
    expect(await notifyMemories(early.all)).toBe(false);
    expect(early.show).not.toHaveBeenCalled();
  });

  it('tries again on the next wake-up when showing failed', async () => {
    const { all } = deps({ show: () => Promise.reject(new Error('no permission')) });
    await expect(notifyMemories(all)).rejects.toThrow();
    expect(await all.readNotifiedOn()).toBeNull();
  });
});

describe('isNavigateMessage', () => {
  it('takes a screen of the app only', () => {
    expect(isNavigateMessage({ type: 'NAVIGATE', url: '/souvenirs' })).toBe(true);
    expect(isNavigateMessage({ type: 'NAVIGATE', url: 'https://example.com/' })).toBe(false);
    expect(isNavigateMessage({ type: 'NAVIGATE', url: '//example.com/' })).toBe(false);
    expect(isNavigateMessage({ type: 'SKIP_WAITING' })).toBe(false);
    expect(isNavigateMessage(null)).toBe(false);
  });
});
