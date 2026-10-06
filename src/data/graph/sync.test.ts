import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { IndexStore, type RootSyncState } from '../store.ts';
import { GraphError, type GraphClient } from './client.ts';
import { detectScope, initialDeltaUrl, syncRoot } from './sync.ts';
import type { GraphDriveItem } from './types.ts';

let counter = 0;

/** A fake Graph that answers from a URL → response table, and records calls. */
function fakeGraph(routes: Record<string, unknown | GraphError>) {
  const calls: string[] = [];
  const client: GraphClient = {
    async getJson<T>(url: string): Promise<T> {
      calls.push(url);
      const key = Object.keys(routes).find((prefix) => url.startsWith(prefix));
      if (!key) throw new Error(`unexpected request ${url}`);
      const response = routes[key];
      if (response instanceof GraphError) throw response;
      return response as T;
    },
  };
  return { client, calls };
}

const folder = (id: string, parent: string): GraphDriveItem => ({
  id,
  name: id,
  folder: {},
  parentReference: { id: parent },
});
const photo = (id: string, parent: string): GraphDriveItem => ({
  id,
  name: `${id}.jpg`,
  file: { mimeType: 'image/jpeg' },
  parentReference: { id: parent },
});

const root: RootSyncState = {
  path: '/Pictures',
  id: 'pics',
  scope: 'folder',
  deltaLink: null,
  resumeLink: null,
};

async function setup() {
  const store = await IndexStore.open(`sync-${counter++}`);
  const states: RootSyncState[] = [];
  const progress: number[] = [];
  const callbacks = {
    onRootState: async (state: RootSyncState) => {
      states.push(state);
    },
    onProgress: ({ loaded }: { loaded: number }) => progress.push(loaded),
  };
  return { store, states, progress, callbacks };
}

describe('syncRoot', () => {
  it('enumerates every page, keeps folders and media, and saves the delta link', async () => {
    const { store, states, progress, callbacks } = await setup();
    const { client } = fakeGraph({
      [initialDeltaUrl(root)]: {
        value: [folder('pics', 'drive'), folder('cam', 'pics'), photo('p1', 'cam')],
        '@odata.nextLink': 'https://graph/page2',
      },
      'https://graph/page2': {
        value: [
          photo('p2', 'cam'),
          { id: 'doc', name: 'a.pdf', file: { mimeType: 'application/pdf' } },
        ],
        '@odata.deltaLink': 'https://graph/delta?token=1',
      },
    });

    const outcome = await syncRoot(client, store, root, callbacks);

    expect((await store.loadItems()).map((i) => i.id).sort()).toEqual(['cam', 'p1', 'p2', 'pics']);
    expect(outcome.root.deltaLink).toBe('https://graph/delta?token=1');
    expect(outcome.root.resumeLink).toBeNull();
    expect(states[0]?.resumeLink).toBe('https://graph/page2');
    expect(progress).toEqual([3, 5]);
  });

  it('applies changes and deletions from the delta link', async () => {
    const { store, callbacks } = await setup();
    await store.applyChanges([folder('cam', 'pics'), photo('p1', 'cam'), photo('p2', 'cam')], []);
    const { client } = fakeGraph({
      'https://graph/delta?token=1': {
        value: [{ id: 'p1', deleted: { state: 'deleted' } }, photo('p3', 'cam')],
        '@odata.deltaLink': 'https://graph/delta?token=2',
      },
    });

    const outcome = await syncRoot(
      client,
      store,
      { ...root, deltaLink: 'https://graph/delta?token=1' },
      callbacks,
    );

    expect((await store.loadItems()).map((i) => i.id).sort()).toEqual(['cam', 'p2', 'p3']);
    expect(outcome.changes).toBe(2);
    expect(outcome.root.deltaLink).toBe('https://graph/delta?token=2');
  });

  it('resumes an interrupted enumeration from the saved next link', async () => {
    const { store, callbacks } = await setup();
    const { client, calls } = fakeGraph({
      'https://graph/page2': { value: [photo('p2', 'cam')], '@odata.deltaLink': 'https://graph/d' },
    });
    await syncRoot(client, store, { ...root, resumeLink: 'https://graph/page2' }, callbacks);
    expect(calls).toEqual(['https://graph/page2']);
  });

  it('starts over when the service answers 410 Gone', async () => {
    const { store, callbacks } = await setup();
    await store.applyChanges([photo('stale', 'cam')], []);
    const { client } = fakeGraph({
      'https://graph/delta?token=old': new GraphError(
        410,
        'resyncChangesApplyDifferences',
        'Resync',
        'https://graph/fresh',
      ),
      'https://graph/fresh': {
        value: [folder('cam', 'pics'), photo('p1', 'cam')],
        '@odata.deltaLink': 'https://graph/delta?token=new',
      },
    });

    const outcome = await syncRoot(
      client,
      store,
      { ...root, deltaLink: 'https://graph/delta?token=old' },
      callbacks,
    );

    expect(outcome.resynced).toBe(true);
    expect((await store.loadItems()).map((i) => i.id).sort()).toEqual(['cam', 'p1']);
    expect(outcome.root.deltaLink).toBe('https://graph/delta?token=new');
  });
});

describe('detectScope', () => {
  it('uses the folder delta when the service accepts it', async () => {
    const { client } = fakeGraph({ '/me/drive/items/pics/delta': { value: [] } });
    await expect(detectScope(client, 'pics')).resolves.toBe('folder');
  });

  it('falls back to the whole drive when the folder delta is refused', async () => {
    const { client } = fakeGraph({
      '/me/drive/items/pics/delta': new GraphError(400, 'invalidRequest', 'Not supported'),
    });
    await expect(detectScope(client, 'pics')).resolves.toBe('drive');
  });
});
