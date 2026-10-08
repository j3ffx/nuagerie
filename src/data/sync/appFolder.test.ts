import { describe, expect, it } from 'vitest';
import { syncWith, SyncConflict, type AppFolder, type RemoteCopy } from './appFolder.ts';
import { EMPTY_STATE, favoriteIds, withFavorite, type SyncedState } from './state.ts';

/** OneDrive's copy in memory; `meanwhile` changes it once, as another device would. */
function fakeFolder(initial: RemoteCopy | null, meanwhile?: (state: SyncedState) => SyncedState) {
  let copy = initial;
  let version = 0;
  const writes: SyncedState[] = [];
  const folder: AppFolder = {
    async read() {
      return copy;
    },
    async write(state, eTag) {
      if (meanwhile) {
        copy = { state: meanwhile(copy?.state ?? EMPTY_STATE), eTag: `"other"` };
        meanwhile = undefined;
      }
      if ((copy?.eTag ?? null) !== eTag) throw new SyncConflict();
      writes.push(state);
      copy = { state, eTag: `"v${++version}"` };
      return copy.eTag;
    },
  };
  return { folder, writes, copy: () => copy };
}

describe('syncWith', () => {
  it('writes nothing while there is nothing to keep', async () => {
    const { folder, writes } = fakeFolder(null);
    await expect(syncWith(folder, EMPTY_STATE)).resolves.toEqual(EMPTY_STATE);
    expect(writes).toEqual([]);
  });

  it('creates the copy, then only writes when OneDrive misses something', async () => {
    const { folder, writes } = fakeFolder(null);
    const local = withFavorite(EMPTY_STATE, 'a', true, 1);
    await syncWith(folder, local);
    expect(writes).toHaveLength(1);
    await syncWith(folder, local);
    expect(writes).toHaveLength(1);
  });

  it('brings in what another device added, and keeps both sides', async () => {
    const pc = withFavorite(EMPTY_STATE, 'b', true, 2);
    const { folder, copy } = fakeFolder({ state: pc, eTag: '"v0"' });
    const merged = await syncWith(folder, withFavorite(EMPTY_STATE, 'a', true, 1));
    expect([...favoriteIds(merged)].sort()).toEqual(['a', 'b']);
    expect([...favoriteIds(copy()?.state ?? EMPTY_STATE)].sort()).toEqual(['a', 'b']);
  });

  it('merges again when another device wrote in between', async () => {
    const { folder, copy } = fakeFolder(null, (state) => withFavorite(state, 'c', true, 3));
    const merged = await syncWith(folder, withFavorite(EMPTY_STATE, 'a', true, 1));
    expect([...favoriteIds(merged)].sort()).toEqual(['a', 'c']);
    expect([...favoriteIds(copy()?.state ?? EMPTY_STATE)].sort()).toEqual(['a', 'c']);
  });
});
