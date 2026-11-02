import { describe, expect, it } from 'vitest';
import { GraphError, type AppFolderWriter, type GraphClient } from '../graph/client.ts';
import { DIMENSIONS } from './rank.ts';
import {
  createVectorSnapshots,
  decodeVectors,
  encodeVectors,
  VECTORS_FILE,
} from './vectorSnapshot.ts';

const table = () => {
  const bytes = new Int8Array(2 * DIMENSIONS);
  bytes[0] = 12;
  bytes[DIMENSIONS] = -34;
  return { ids: ['a', 'b'], bytes };
};

describe('the vectors file', () => {
  it('comes back as it left', async () => {
    const blob = await encodeVectors(table(), 'webgpu');
    const decoded = await decodeVectors(blob.stream());
    expect(decoded?.ids).toEqual(['a', 'b']);
    expect(decoded?.device).toBe('webgpu');
    expect(decoded?.unreadable).toEqual([]);
    expect(decoded?.bytes[0]).toBe(12);
    expect(decoded?.bytes[DIMENSIONS]).toBe(-34);
    expect(decoded?.bytes.length).toBe(2 * DIMENSIONS);
  });

  it('says which photos its device could not read', async () => {
    const blob = await encodeVectors(table(), 'wasm', ['c']);
    expect((await decodeVectors(blob.stream()))?.unreadable).toEqual(['c']);
  });

  it('is refused when it does not hold what it says', async () => {
    const short = await encodeVectors(
      { ids: ['a', 'b'], bytes: new Int8Array(DIMENSIONS) },
      'webgpu',
    );
    expect(await decodeVectors(short.stream())).toBeNull();
  });
});

describe('the copy in the app folder', () => {
  const client = (over: Partial<GraphClient & AppFolderWriter>) =>
    over as GraphClient & AppFolderWriter;
  const always = { load: () => true, save: () => true };

  it('writes only its own file, when the sync allows it', async () => {
    const written: string[] = [];
    const graph = client({
      putAppFile: (name) => {
        written.push(name);
        return Promise.resolve({ eTag: 'e' });
      },
    });
    expect(
      await createVectorSnapshots(graph, { ...always, save: () => false }).save(
        table(),
        'wasm',
        [],
      ),
    ).toBe(false);
    expect(written).toEqual([]);
    expect(await createVectorSnapshots(graph, always).save(table(), 'wasm', [])).toBe(true);
    expect(written).toEqual([VECTORS_FILE]);
  });

  it('reads the copy from its download address, without credentials', async () => {
    const blob = await encodeVectors(table(), 'wasm');
    const graph = client({
      getJson: <T>() =>
        Promise.resolve({ '@microsoft.graph.downloadUrl': 'https://host/file' } as T),
    });
    let credentials: RequestCredentials | undefined;
    const snapshots = createVectorSnapshots(graph, always, (_url, init) => {
      credentials = init?.credentials;
      return Promise.resolve(new Response(blob));
    });
    expect((await snapshots.load())?.ids).toEqual(['a', 'b']);
    expect(credentials).toBe('omit');
  });

  it('has nothing when there is no copy, or when the sync was turned off here', async () => {
    const missing = client({
      getJson: () => Promise.reject(new GraphError(404, 'itemNotFound', 'not found')),
    });
    expect(await createVectorSnapshots(missing, always).load()).toBeNull();
    expect(
      await createVectorSnapshots(client({}), { ...always, load: () => false }).load(),
    ).toBeNull();
  });
});
