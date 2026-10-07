import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { GraphClient } from '../graph/client.ts';
import type { GraphDriveItem } from '../graph/types.ts';
import { IndexStore } from '../store.ts';
import { createOneDriveSource } from './onedriveSource.ts';

let counter = 0;

const folder = (id: string, name: string, parent: string): GraphDriveItem => ({
  id,
  name,
  folder: {},
  parentReference: { id: parent },
});
const photo = (id: string, name: string, parent: string): GraphDriveItem => ({
  id,
  name,
  eTag: `"${id}"`,
  file: { mimeType: 'image/jpeg' },
  parentReference: { id: parent },
});

/** Fake OneDrive with a folder-level delta, and a second batch of changes. */
function fakeOneDrive() {
  const calls: string[] = [];
  let changes: GraphDriveItem[] = [];
  const client: GraphClient = {
    batch: () => Promise.reject(new Error('unexpected batch')),
    async getJson<T>(url: string): Promise<T> {
      calls.push(url);
      if (url.startsWith('/me/drive/root:/Pictures')) return { id: 'pics', name: 'Pictures' } as T;
      if (url.includes('$top=1') && !url.includes('$top=1000')) return { value: [] } as T;
      if (url.startsWith('/me/drive/items/pics/delta')) {
        return {
          value: [
            folder('pics', 'Pictures', 'drive'),
            folder('cam', 'Camera Roll', 'pics'),
            folder('y', '2026', 'cam'),
            folder('m', '10', 'y'),
            photo('p1', '20261006_084759.jpg', 'm'),
            photo('p2', 'IMG_0001.JPG', 'cam'),
          ],
          '@odata.deltaLink': 'https://graph/delta?token=1',
        } as T;
      }
      if (url === 'https://graph/delta?token=1') {
        const value = changes;
        changes = [];
        return { value, '@odata.deltaLink': 'https://graph/delta?token=1' } as T;
      }
      throw new Error(`unexpected ${url}`);
    },
  };
  return { client, calls, setChanges: (items: GraphDriveItem[]) => (changes = items) };
}

describe('createOneDriveSource', () => {
  let store: IndexStore;
  beforeEach(async () => {
    store = await IndexStore.open(`source-${counter++}`);
  });

  const source = (client: GraphClient, accountId: string | null = 'me') =>
    createOneDriveSource({ accountId, getToken: async () => 't', client, store });

  it('enumerates everything on first start and builds the index', async () => {
    const graph = fakeOneDrive();
    const progress: number[] = [];
    const index = await source(graph.client).loadIndex(({ loaded }) => progress.push(loaded));

    expect(index.items.map((i) => i.name)).toEqual(['20261006_084759.jpg', 'IMG_0001.JPG']);
    expect(index.items[0]?.dateSource).toBe('filename');
    expect(index.items[0]?.albumId).toBe('cam');
    expect(index.items[1]?.takenAt).toBeNull();
    expect(progress).toEqual([6]);
  });

  it('starts from the local copy without calling delta again', async () => {
    const graph = fakeOneDrive();
    await source(graph.client).loadIndex();
    graph.calls.length = 0;

    const index = await source(graph.client).loadIndex();

    expect(index.items).toHaveLength(2);
    expect(graph.calls.some((url) => url.includes('delta'))).toBe(false);
  });

  it('applies incremental changes on refresh', async () => {
    const graph = fakeOneDrive();
    const s = source(graph.client);
    await s.loadIndex();

    expect(await s.refresh?.()).toBeNull();

    graph.setChanges([
      { id: 'p2', deleted: { state: 'deleted' } },
      photo('p3', 'Screenshot_20261005_220836_Chrome.jpg', 'cam'),
    ]);
    const updated = await s.refresh?.();
    expect(updated?.items.map((i) => i.id)).toEqual(['p1', 'p3']);
  });

  it('drops the local copy when another account signs in', async () => {
    const graph = fakeOneDrive();
    await source(graph.client, 'me').loadIndex();
    graph.calls.length = 0;

    await source(graph.client, 'someone-else').loadIndex();

    expect(graph.calls.some((url) => url.startsWith('/me/drive/items/pics/delta?'))).toBe(true);
    expect((await store.getMeta())?.accountId).toBe('someone-else');
  });

  it('started offline, shows the local copy of any account and never replaces it', async () => {
    const graph = fakeOneDrive();
    await source(graph.client, 'me').loadIndex();
    graph.calls.length = 0;

    const offline = source(graph.client, null);
    expect((await offline.loadIndex()).items).toHaveLength(2);
    expect(offline.refresh).toBeUndefined();
    expect(offline.reset).toBeUndefined();
    expect(graph.calls).toEqual([]);
    expect((await store.getMeta())?.accountId).toBe('me');
  });

  it('started offline with no local copy, says so', async () => {
    const graph = fakeOneDrive();
    await expect(source(graph.client, null).loadIndex()).rejects.toThrow(/Hors connexion/);
    expect(graph.calls).toEqual([]);
  });

  it('lists the subfolders of a drive folder, page by page, by name', async () => {
    const calls: string[] = [];
    const client: GraphClient = {
      batch: () => Promise.reject(new Error('unexpected batch')),
      async getJson<T>(url: string): Promise<T> {
        calls.push(url);
        if (url === 'https://graph/next') {
          return { value: [{ name: 'Bureau', folder: { childCount: 0 } }] } as T;
        }
        return {
          value: [
            { name: 'Scans', folder: { childCount: 3 } },
            { name: 'notes.txt' },
            { name: 'Années 2000', folder: { childCount: 1 } },
          ],
          '@odata.nextLink': 'https://graph/next',
        } as T;
      },
    };

    const folders = await source(client).listFolders?.('/Mes documents');

    expect(calls[0]).toBe('/me/drive/root:/Mes%20documents:/children?$select=name,folder&$top=999');
    expect(folders).toEqual([
      { name: 'Années 2000', path: '/Mes documents/Années 2000', hasChildren: true },
      { name: 'Bureau', path: '/Mes documents/Bureau', hasChildren: false },
      { name: 'Scans', path: '/Mes documents/Scans', hasChildren: true },
    ]);
    await source(client).listFolders?.('/');
    expect(calls.at(-2)).toBe('/me/drive/root/children?$select=name,folder&$top=999');
  });
});
