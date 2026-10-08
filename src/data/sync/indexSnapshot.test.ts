import { describe, expect, it } from 'vitest';
import type { AppFolderWriter, GraphClient } from '../graph/client.ts';
import {
  createIndexSnapshots,
  decodeSnapshot,
  encodeSnapshot,
  INDEX_FILE,
  SNAPSHOT_MAX_AGE_MS,
  snapshotDue,
  usableSnapshot,
  type IndexSnapshot,
} from './indexSnapshot.ts';

const ROOTS = [{ path: '/Pictures', id: 'pics' }];

const snapshot = (overrides: Partial<IndexSnapshot> = {}): IndexSnapshot => ({
  schema: 1,
  savedAt: 1_000,
  accountId: 'me',
  rootFolders: ROOTS,
  channels: [
    {
      path: '/Pictures',
      id: 'pics',
      scope: 'folder',
      deltaLink: 'https://d?t=1',
      resumeLink: null,
    },
  ],
  items: [{ id: 'p1', name: 'IMG_0001.JPG', file: { mimeType: 'image/jpeg' } }],
  ...overrides,
});

describe('encodeSnapshot / decodeSnapshot', () => {
  it('gives back the same index, gzipped', async () => {
    const original = snapshot();
    const blob = await encodeSnapshot(original);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect([bytes[0], bytes[1]]).toEqual([0x1f, 0x8b]); // gzip magic number
    expect(await decodeSnapshot(blob.stream())).toEqual(original);
  });
});

describe('usableSnapshot', () => {
  it('accepts a complete copy of the same account and folders', () => {
    expect(usableSnapshot(snapshot(), 'me', ROOTS)).toBe(true);
  });

  it('refuses another account, other folders, an unfinished feed or garbage', () => {
    expect(usableSnapshot(snapshot(), 'someone else', ROOTS)).toBe(false);
    expect(usableSnapshot(snapshot(), 'me', [{ path: '/Documents', id: 'docs' }])).toBe(false);
    expect(usableSnapshot(snapshot(), 'me', [...ROOTS, { path: '/Scans', id: 's' }])).toBe(false);
    const unfinished = snapshot();
    unfinished.channels = unfinished.channels.map((c) => ({ ...c, resumeLink: 'https://next' }));
    expect(usableSnapshot(unfinished, 'me', ROOTS)).toBe(false);
    expect(usableSnapshot(snapshot({ channels: [] }), 'me', ROOTS)).toBe(false);
    expect(usableSnapshot(null, 'me', ROOTS)).toBe(false);
    expect(usableSnapshot({ schema: 2 }, 'me', ROOTS)).toBe(false);
  });
});

describe('snapshotDue', () => {
  const now = 10 * SNAPSHOT_MAX_AGE_MS;
  it('is due when no copy is known, or a stale one is a day old', () => {
    expect(snapshotDue(null, now)).toBe(true);
    expect(snapshotDue({ savedAt: now - SNAPSHOT_MAX_AGE_MS, stale: true }, now)).toBe(true);
  });

  it('waits while the copy is fresh, or up to date', () => {
    expect(snapshotDue({ savedAt: now - 1000, stale: true }, now)).toBe(false);
    expect(snapshotDue({ savedAt: 0, stale: false }, now)).toBe(false);
  });
});

describe('createIndexSnapshots', () => {
  function fakeClient(file: Blob | null) {
    const puts: { name: string; content: unknown; options: unknown }[] = [];
    const client: GraphClient & AppFolderWriter = {
      batch: () => Promise.reject(new Error('unexpected batch')),
      async getJson<T>(url: string): Promise<T> {
        expect(url).toBe(`/me/drive/special/approot:/${INDEX_FILE}`);
        if (!file) throw new Error('404');
        return { '@microsoft.graph.downloadUrl': 'https://download/index' } as T;
      },
      async putAppFile(name, content, options) {
        puts.push({ name, content, options });
        return { eTag: '"e"' };
      },
    };
    const download = (async () => new Response(file)) as typeof fetch;
    return { client, puts, download };
  }

  it('reads the copy left in the app folder', async () => {
    const { client, download } = fakeClient(await encodeSnapshot(snapshot()));
    const snapshots = createIndexSnapshots(
      client,
      { load: () => true, save: () => true },
      download,
    );
    expect(await snapshots.load()).toEqual(snapshot());
  });

  it('has nothing when there is no copy, or when this device may not read it', async () => {
    const none = fakeClient(null);
    expect(
      await createIndexSnapshots(none.client, { load: () => true, save: () => true }).load(),
    ).toBeNull();
    const some = fakeClient(await encodeSnapshot(snapshot()));
    expect(
      await createIndexSnapshots(
        some.client,
        { load: () => false, save: () => true },
        some.download,
      ).load(),
    ).toBeNull();
  });

  it('writes the whole file over the previous one, only where the sync is on', async () => {
    const { client, puts } = fakeClient(null);
    expect(
      await createIndexSnapshots(client, { load: () => true, save: () => false }).save(snapshot()),
    ).toBe(false);
    expect(puts).toHaveLength(0);

    expect(
      await createIndexSnapshots(client, { load: () => true, save: () => true }).save(snapshot()),
    ).toBe(true);
    expect(puts[0]?.name).toBe(INDEX_FILE);
    expect(puts[0]?.options).toEqual({ overwrite: true, contentType: 'application/gzip' });
    expect(await decodeSnapshot((puts[0]?.content as Blob).stream())).toEqual(snapshot());
  });
});
