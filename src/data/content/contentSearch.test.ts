import { beforeEach, describe, expect, it } from 'vitest';
import type { MediaItem } from '../model.ts';
import {
  analysisComplete,
  ANALYSED_ELSEWHERE,
  createContentSearch,
  type ContentDeps,
} from './contentSearch.ts';
import { createDemoEngine } from './demoEngine.ts';
import type { ContentEngine, EngineDevice } from './engine.ts';
import { DIMENSIONS, toBytes, type VectorTable } from './rank.ts';
import type { VectorSnapshots } from './vectorSnapshot.ts';
import { createMemoryVectorStore } from './vectorStore.ts';

const photo = (id: string) => ({ id }) as MediaItem;
const items = ['chat', 'chien', 'plage'].map(photo);

function setup(over: Partial<ContentDeps> = {}) {
  const prefs = { enabled: false, analysed: false };
  const engineCalls: string[] = [];
  const engine: ContentEngine = {
    ...createDemoEngine(),
    prepareText: (onProgress) => {
      engineCalls.push('text');
      onProgress(1, 2);
      return Promise.resolve();
    },
    prepareImages: () => {
      engineCalls.push('images');
      return Promise.resolve('webgpu');
    },
    releaseImages: () => void engineCalls.push('release'),
    erase: () => {
      engineCalls.push('erase');
      return Promise.resolve();
    },
  };
  let awake = 0;
  let device: EngineDevice | null = null;
  let unreadable: readonly string[] = [];
  const deps: ContentDeps = {
    engine,
    store: createMemoryVectorStore(),
    snapshots: null,
    image: (item) => Promise.resolve(new Blob([item.id])),
    isOnline: () => true,
    onMobileData: () => false,
    keepAwake: () => {
      awake++;
      return () => void awake--;
    },
    read: (key) => prefs[key],
    write: (key, value) => void (prefs[key] = value),
    readDevice: () => device,
    writeDevice: (next) => void (device = next),
    readUnreadable: () => unreadable,
    writeUnreadable: (ids) => void (unreadable = ids),
    pause: () => Promise.resolve(),
    ...over,
  };
  return {
    deps,
    prefs,
    engineCalls,
    store: deps.store,
    awake: () => awake,
    search: createContentSearch(deps),
  };
}

const settled = () => new Promise((resolve) => setTimeout(resolve, 5));

describe('content search', () => {
  let t: ReturnType<typeof setup>;
  beforeEach(() => {
    t = setup();
    t.search.update(items);
  });

  it('starts off, and needs nothing from the model until turned on', async () => {
    await settled();
    expect(t.search.getSnapshot()).toMatchObject({ enabled: false, done: 0, total: 3 });
    expect(t.engineCalls).toEqual([]);
  });

  it('downloads the text side when turned on, and remembers the choice', async () => {
    await t.search.enable();
    expect(t.prefs.enabled).toBe(true);
    expect(t.engineCalls).toEqual(['text']);
    expect(t.search.getSnapshot()).toMatchObject({ enabled: true, preparing: false });
  });

  it('asks again for a text side that could not be downloaded', async () => {
    let tries = 0;
    t.deps.engine.prepareText = () =>
      tries++ === 0 ? Promise.reject(new Error('offline')) : Promise.resolve();
    await t.search.enable();
    expect(t.search.getSnapshot().error).toBe('offline');
    await t.search.enable();
    expect(t.search.getSnapshot().error).toBeNull();
  });

  it('analyses every photo, then finds them by their words', async () => {
    await t.search.enable();
    await t.search.analyse();
    expect(t.search.getSnapshot()).toMatchObject({ done: 3, total: 3, device: 'webgpu' });
    expect(t.prefs.analysed).toBe(true);
    expect(t.engineCalls).toContain('release');
    expect(t.awake()).toBe(0);
    expect((await t.search.find('plage', items))[0]).toBe('plage');
  });

  it('only searches among the photos given (a date, an album)', async () => {
    await t.search.enable();
    await t.search.analyse();
    expect(await t.search.find('plage', [photo('chat')])).toEqual(['chat']);
  });

  it('picks up an interrupted analysis where it stopped', async () => {
    await t.store.put('chat', new Int8Array(DIMENSIONS));
    const seen: string[] = [];
    const again = setup({
      store: t.store,
      readDevice: () => 'webgpu',
      image: (item) => {
        seen.push(item.id);
        return Promise.resolve(new Blob([item.id]));
      },
    });
    again.search.update(items);
    await again.search.analyse();
    expect(seen.sort()).toEqual(['chien', 'plage']);
  });

  it('tries again what failed, and says what stayed out', async () => {
    let tries = 0;
    const flaky = setup({
      image: (item) => {
        if (item.id === 'plage') return Promise.reject(new Error('no thumbnail'));
        if (item.id === 'chien' && tries++ === 0) return Promise.reject(new Error('throttled'));
        return Promise.resolve(new Blob([item.id]));
      },
    });
    flaky.search.update(items);
    await flaky.search.analyse();
    const state = flaky.search.getSnapshot();
    expect(state).toMatchObject({ done: 2, analysing: false });
    expect(state.unreadable.map((item) => item.id)).toEqual(['plage']);
    expect(analysisComplete(state)).toBe(true);
  });

  it('stops when asked, without calling it done', async () => {
    const stopping: ReturnType<typeof setup> = setup({
      image: (item) => {
        stopping.search.stop();
        return Promise.resolve(new Blob([item.id]));
      },
    });
    stopping.search.update(items);
    await stopping.search.analyse();
    expect(stopping.prefs.analysed).toBe(false);
    expect(stopping.search.getSnapshot().analysing).toBe(false);
  });

  it('reports a model that fails, and lets the screen sleep again', async () => {
    const broken = setup();
    broken.deps.engine.encodeImage = () => Promise.reject(new Error('out of memory'));
    broken.search.update(items);
    await broken.search.analyse();
    expect(broken.search.getSnapshot()).toMatchObject({
      analysing: false,
      error: 'out of memory',
    });
    expect(broken.prefs.analysed).toBe(false);
    expect(broken.awake()).toBe(0);
  });

  it('removes the vectors of photos no longer in the index', async () => {
    await t.search.enable();
    await t.search.analyse();
    t.search.update(items.slice(0, 2));
    await settled();
    await t.search.analyse();
    expect(await t.store.ids()).toEqual(new Set(['chat', 'chien']));
    expect(t.search.getSnapshot()).toMatchObject({ done: 2, total: 2 });
  });

  it('analyses new photos by itself where it analysed before, but not on mobile data', async () => {
    await t.search.enable();
    await t.search.analyse();
    const onMobile = setup({
      store: t.store,
      onMobileData: () => true,
      readDevice: () => 'webgpu',
    });
    onMobile.prefs.enabled = true;
    onMobile.prefs.analysed = true;
    const waiting = createContentSearch(onMobile.deps);
    waiting.update([...items, photo('neuf')]);
    await settled();
    expect(waiting.getSnapshot()).toMatchObject({ done: 3, total: 4, analysing: false });

    const onWifi = setup({ store: t.store, readDevice: () => 'webgpu' });
    onWifi.prefs.enabled = true;
    onWifi.prefs.analysed = true;
    const follows = createContentSearch(onWifi.deps);
    follows.update([...items, photo('neuf')]);
    await settled();
    await settled();
    expect(follows.getSnapshot()).toMatchObject({ done: 4, total: 4 });
  });

  it('does not analyse by itself where it never did (a phone waits for the computer)', async () => {
    t.prefs.enabled = true;
    const phone = createContentSearch(t.deps);
    phone.update(items);
    await settled();
    expect(phone.getSnapshot()).toMatchObject({ done: 0, analysing: false });
  });

  it('does not start over on every launch for a photo it cannot read', async () => {
    let pauses = 0;
    const stuck = setup({
      image: (item) =>
        item.id === 'plage'
          ? Promise.reject(new Error('no thumbnail'))
          : Promise.resolve(new Blob([item.id])),
      pause: () => {
        pauses++;
        return Promise.resolve();
      },
    });
    stuck.search.update(items);
    await stuck.search.analyse();
    // It waits once, in case Microsoft was slowing down, then knows.
    expect(pauses).toBe(1);

    stuck.prefs.enabled = true;
    const prepared: string[] = [];
    const next = createContentSearch({
      ...stuck.deps,
      engine: {
        ...stuck.deps.engine,
        prepareImages: () => {
          prepared.push('images');
          return Promise.resolve('webgpu');
        },
      },
    });
    next.update(items);
    await settled();
    await settled();
    expect(prepared).toEqual([]);
    expect(analysisComplete(next.getSnapshot())).toBe(true);
  });

  it('tries an unreadable photo again when asked, without waiting', async () => {
    let readable = false;
    let pauses = 0;
    const later = setup({
      image: (item) =>
        item.id === 'plage' && !readable
          ? Promise.reject(new Error('no thumbnail'))
          : Promise.resolve(new Blob([item.id])),
      pause: () => {
        pauses++;
        return Promise.resolve();
      },
    });
    later.search.update(items);
    await later.search.analyse();
    pauses = 0;
    await later.search.analyse();
    expect(pauses).toBe(0);
    expect(later.search.getSnapshot().unreadable).toHaveLength(1);
    readable = true;
    await later.search.analyse();
    expect(later.search.getSnapshot()).toMatchObject({ done: 3, unreadable: [] });
  });

  it('does not mix vectors from a graphics card and a processor', async () => {
    await t.store.put('chat', new Int8Array(DIMENSIONS));
    const seen: string[] = [];
    const phone = setup({
      store: t.store,
      readDevice: () => 'wasm',
      image: (item) => {
        seen.push(item.id);
        return Promise.resolve(new Blob([item.id]));
      },
    });
    phone.search.update(items);
    await phone.search.analyse();
    expect(seen).toEqual([]);
    expect(phone.search.getSnapshot()).toMatchObject({
      error: ANALYSED_ELSEWHERE,
      analysing: false,
    });
  });

  it('erases the vectors and the model when turned off', async () => {
    await t.search.enable();
    await t.search.analyse();
    await t.search.disable();
    expect(t.search.getSnapshot()).toMatchObject({ enabled: false, done: 0, total: 3 });
    expect(await t.store.ids()).toEqual(new Set());
    expect(t.engineCalls).toContain('erase');
    expect(t.prefs).toEqual({ enabled: false, analysed: false });
  });
});

describe('sharing the vectors between devices', () => {
  const shared = (over: Partial<VectorSnapshots> = {}) => {
    const saved: VectorTable[] = [];
    const snapshots: VectorSnapshots = {
      load: () => Promise.resolve(null),
      save: (table) => {
        saved.push(table);
        return Promise.resolve(true);
      },
      ...over,
    };
    return { saved, snapshots };
  };

  it('leaves a copy once a whole analysis is done', async () => {
    const { saved, snapshots } = shared();
    const t = setup({ snapshots });
    t.search.update(items);
    await t.search.analyse();
    expect(saved).toHaveLength(1);
    expect(saved[0]?.ids).toHaveLength(3);
  });

  it('a phone takes what the computer left, and needs no image side', async () => {
    const vector = toBytes(new Float32Array(DIMENSIONS).fill(0.03));
    const bytes = new Int8Array(DIMENSIONS * 3);
    bytes.set(vector, 0);
    bytes.set(vector, DIMENSIONS);
    bytes.set(vector, 2 * DIMENSIONS);
    const { snapshots } = shared({
      load: () =>
        Promise.resolve({
          ids: ['chat', 'chien', 'plus là'],
          bytes,
          device: 'webgpu',
          unreadable: ['plage'],
        }),
    });
    const t = setup({ snapshots });
    t.search.update(items);
    await t.search.enable();
    expect(t.search.getSnapshot()).toMatchObject({ done: 2, total: 3 });
    expect(await t.store.ids()).toEqual(new Set(['chat', 'chien']));
    // The photo the computer could not read is not waited for here either.
    expect(analysisComplete(t.search.getSnapshot())).toBe(true);
    expect(t.engineCalls).not.toContain('images');
  });

  it('keeps its own vectors over a copy from another kind of device', async () => {
    const { snapshots } = shared({
      load: () =>
        Promise.resolve({
          ids: ['chien'],
          bytes: new Int8Array(DIMENSIONS),
          device: 'webgpu',
          unreadable: [],
        }),
    });
    const t = setup({ snapshots, readDevice: () => 'wasm' });
    await t.store.put('chat', new Int8Array(DIMENSIONS));
    t.search.update(items);
    await t.search.enable();
    expect(await t.store.ids()).toEqual(new Set(['chat']));
  });

  it('survives a copy that cannot be read', async () => {
    const { snapshots } = shared({ load: () => Promise.reject(new Error('offline')) });
    const t = setup({ snapshots });
    t.search.update(items);
    await t.search.enable();
    expect(t.search.getSnapshot()).toMatchObject({ enabled: true, fetching: false, error: null });
  });
});
