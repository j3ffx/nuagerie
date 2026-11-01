import { describe, expect, it } from 'vitest';
import { keepFile, keptFile } from './cacheNames.ts';

function fakeCache() {
  const entries = new Map<string, Response>();
  return {
    entries,
    match: (key: RequestInfo | URL) =>
      Promise.resolve(entries.get(String(key))?.clone() as Response | undefined),
    put: (key: RequestInfo | URL, response: Response) => {
      entries.set(String(key), response);
      return Promise.resolve();
    },
  };
}

describe('big files in the cache', () => {
  const file = new Blob([Uint8Array.from({ length: 25 }, (_, i) => i)]);

  it('come back whole from several pieces', async () => {
    const cache = fakeCache();
    await keepFile(cache, 'u', file, 10);
    expect([...cache.entries.keys()]).toEqual(['u.0', 'u.1', 'u.2', 'u']);
    expect([...((await keptFile(cache, 'u')) ?? [])]).toEqual(
      Array.from({ length: 25 }, (_, i) => i),
    );
  });

  it('are not there until kept, nor when a piece is missing', async () => {
    const cache = fakeCache();
    expect(await keptFile(cache, 'u')).toBeNull();
    await keepFile(cache, 'u', file, 10);
    cache.entries.delete('u.1');
    expect(await keptFile(cache, 'u')).toBeNull();
  });

  it('do not count as kept when writing stopped halfway', async () => {
    const cache = fakeCache();
    let writes = 0;
    const failing = {
      ...cache,
      put: (key: RequestInfo | URL, response: Response) =>
        writes++ === 1 ? Promise.reject(new Error('no room')) : cache.put(key, response),
    };
    await expect(keepFile(failing, 'u', file, 10)).rejects.toThrow('no room');
    expect(await keptFile(cache, 'u')).toBeNull();
  });
});
