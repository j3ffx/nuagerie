import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { IndexStore, type IndexMeta } from './store.ts';

let counter = 0;
const openFresh = () => IndexStore.open(`test-${counter++}`);

const meta: IndexMeta = {
  schema: 1,
  accountId: 'account-1',
  rootFolders: [{ path: '/Pictures', id: 'root' }],
  channels: [
    { path: '/Pictures', id: 'root', scope: 'folder', deltaLink: 'link', resumeLink: null },
  ],
  lastSyncAt: 1,
  lastCount: 2,
};

describe('IndexStore', () => {
  it('stores, updates and deletes items in one transaction per page', async () => {
    const store = await openFresh();
    await store.applyChanges(
      [
        { id: 'a', name: 'a.jpg' },
        { id: 'b', name: 'b.jpg' },
      ],
      [],
    );
    await store.applyChanges([{ id: 'a', name: 'renamed.jpg' }], ['b']);
    expect(await store.loadItems()).toEqual([{ id: 'a', name: 'renamed.jpg' }]);
    expect(await store.count()).toBe(1);
  });

  it('keeps the sync metadata', async () => {
    const store = await openFresh();
    expect(await store.getMeta()).toBeNull();
    await store.setMeta(meta);
    expect(await store.getMeta()).toEqual(meta);
  });

  it('clears items and metadata together', async () => {
    const store = await openFresh();
    await store.applyChanges([{ id: 'a' }], []);
    await store.setMeta(meta);
    await store.clear();
    expect(await store.count()).toBe(0);
    expect(await store.getMeta()).toBeNull();
  });
});
