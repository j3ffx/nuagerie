import { describe, expect, it, vi } from 'vitest';
import type { MediaItem } from '../model.ts';
import type { BatchRequest, BatchResponse, GraphClient } from './client.ts';
import { createThumbnailFetcher, createThumbnailUrlLoader } from './thumbnails.ts';

const item = (id: string) => ({ id, eTag: `"${id}"` }) as MediaItem;

const ok = (request: BatchRequest): BatchResponse => {
  const id = decodeURIComponent(request.url.split('/')[4] ?? '');
  const selector = request.url.split('select=')[1] ?? '';
  return {
    id: request.id,
    status: 200,
    body: { value: [{ [selector]: { url: `https://thumbs.test/${id}/${selector}` } }] },
  };
};

function fakeClient(answer: (request: BatchRequest) => BatchResponse = ok) {
  const batches: BatchRequest[][] = [];
  const client: GraphClient = {
    getJson: () => Promise.reject(new Error('unexpected GET')),
    batch: vi.fn(async (requests: BatchRequest[]) => {
      batches.push(requests);
      return requests.map(answer);
    }),
  };
  return { client, batches };
}

describe('createThumbnailUrlLoader', () => {
  it('groups requests made together into batches of 20', async () => {
    const { client, batches } = fakeClient();
    const getUrl = createThumbnailUrlLoader(client);
    const urls = await Promise.all(
      Array.from({ length: 45 }, (_, i) => getUrl(item(`i${i}`), 'medium')),
    );
    expect(urls[44]).toBe('https://thumbs.test/i44/c360x360_crop');
    expect(batches.map((b) => b.length)).toEqual([20, 20, 5]);
    expect(batches[0]?.[0]?.url).toBe('/me/drive/items/i0/thumbnails?select=c360x360_crop');
  });

  it('remembers URLs, and drops requests cancelled before their batch leaves', async () => {
    const { client, batches } = fakeClient();
    const getUrl = createThumbnailUrlLoader(client);
    await getUrl(item('a'), 'medium');
    await getUrl(item('a'), 'medium');
    const controller = new AbortController();
    const cancelled = getUrl(item('b'), 'medium', controller.signal);
    controller.abort();
    await expect(cancelled).rejects.toBeDefined();
    await getUrl(item('c'), 'medium');
    expect(batches.flat().map((r) => r.url.split('/')[4])).toEqual(['a', 'c']);
  });

  it('retries throttled requests after Retry-After, and reports missing thumbnails', async () => {
    let throttled = true;
    const { client } = fakeClient((request) => {
      if (request.url.includes('/none/'))
        return { id: request.id, status: 200, body: { value: [] } };
      if (throttled) {
        throttled = false;
        return { id: request.id, status: 429, headers: { 'Retry-After': '2' } };
      }
      return ok(request);
    });
    const sleeps: number[] = [];
    const getUrl = createThumbnailUrlLoader(client, {
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    });
    await expect(getUrl(item('a'), 'medium')).resolves.toContain('/a/');
    expect(sleeps).toEqual([2000]);
    await expect(getUrl(item('none'), 'medium')).rejects.toMatchObject({ code: 'noThumbnail' });
  });
});

describe('createThumbnailFetcher', () => {
  it('downloads the bytes so they can be cached', async () => {
    const { client } = fakeClient();
    const fetch = vi.fn(async () => new Response(new Blob(['jpeg'], { type: 'image/jpeg' })));
    const fetchThumbnail = createThumbnailFetcher(client, { fetch });
    const data = await fetchThumbnail(item('a'), 'medium');
    expect('blob' in data && data.blob.size).toBe(4);
    expect(fetchThumbnail.bytesReadable()).toBe(true);
  });

  it('falls back to the URL when the thumbnail host refuses cross-origin reads', async () => {
    const { client } = fakeClient();
    const fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    const fetchThumbnail = createThumbnailFetcher(client, { fetch });
    await expect(fetchThumbnail(item('a'), 'medium')).resolves.toEqual({
      url: 'https://thumbs.test/a/c360x360_crop',
    });
    await fetchThumbnail(item('b'), 'medium');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetchThumbnail.bytesReadable()).toBe(false);
  });
});
