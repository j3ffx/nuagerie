import { describe, expect, it, vi } from 'vitest';
import { createGraphClient, GraphError, mapWithConcurrency, retryDelay } from './client.ts';

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

function setup(responses: (Response | Error)[], isOnline = () => true) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const next = responses.shift();
    if (!next) throw new Error('no more responses');
    if (next instanceof Error) throw next;
    return next;
  });
  const sleeps: number[] = [];
  const client = createGraphClient({
    getToken: async () => 'token-123',
    fetch: fetch as unknown as typeof globalThis.fetch,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    maxRetries: 3,
    isOnline,
  });
  return { client, calls, sleeps };
}

describe('createGraphClient', () => {
  it('sends authenticated GET requests to Graph v1.0', async () => {
    const { client, calls } = setup([json({ id: 'root' })]);
    await expect(client.getJson('/me/drive/root')).resolves.toEqual({ id: 'root' });
    expect(calls[0]?.url).toBe('https://graph.microsoft.com/v1.0/me/drive/root');
    expect(calls[0]?.init?.method).toBe('GET');
    expect((calls[0]?.init?.headers as Record<string, string>).Authorization).toBe(
      'Bearer token-123',
    );
  });

  it('batches read requests: one POST to /$batch whose sub-requests are all GETs', async () => {
    const { client, calls } = setup([json({ responses: [{ id: '0', status: 200, body: {} }] })]);
    await expect(client.batch([{ id: '0', url: '/me/drive/items/a/thumbnails' }])).resolves.toEqual(
      [{ id: '0', status: 200, body: {} }],
    );
    expect(calls[0]?.url).toBe('https://graph.microsoft.com/v1.0/$batch');
    expect(calls[0]?.init?.method).toBe('POST');
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      requests: [{ id: '0', method: 'GET', url: '/me/drive/items/a/thumbnails' }],
    });
    await expect(
      client.batch(Array.from({ length: 21 }, (_, i) => ({ id: String(i), url: '/x' }))),
    ).rejects.toThrow();
  });

  it('follows absolute URLs as given (nextLink, deltaLink)', async () => {
    const { client, calls } = setup([json({ value: [] })]);
    await client.getJson('https://graph.microsoft.com/v1.0/me/drive/root/delta?token=abc');
    expect(calls[0]?.url).toBe('https://graph.microsoft.com/v1.0/me/drive/root/delta?token=abc');
  });

  it('waits for Retry-After on 429 and 503, then retries', async () => {
    const { client, sleeps } = setup([
      json({}, 429, { 'Retry-After': '7' }),
      json({}, 503, { 'Retry-After': '2' }),
      json({ ok: true }),
    ]);
    await expect(client.getJson('/x')).resolves.toEqual({ ok: true });
    expect(sleeps).toEqual([7000, 2000]);
  });

  it('retries network errors with backoff', async () => {
    const { client, sleeps } = setup([new TypeError('Failed to fetch'), json({ ok: true })]);
    await expect(client.getJson('/x')).resolves.toEqual({ ok: true });
    expect(sleeps).toHaveLength(1);
  });

  it('does not retry network errors while the device is offline', async () => {
    const { client, calls, sleeps } = setup([new TypeError('Failed to fetch')], () => false);
    await expect(client.getJson('/x')).rejects.toThrow('Failed to fetch');
    expect(calls).toHaveLength(1);
    expect(sleeps).toHaveLength(0);
  });

  it('gives up after maxRetries', async () => {
    const { client } = setup([json({}, 503), json({}, 503), json({}, 503), json({}, 503)]);
    await expect(client.getJson('/x')).rejects.toMatchObject({ status: 503 });
  });

  it('turns Graph errors into GraphError, with the Location of a 410', async () => {
    const { client } = setup([
      json({ error: { code: 'resyncRequired', message: 'Resync' } }, 410, {
        Location: 'https://graph.microsoft.com/v1.0/me/drive/root/delta',
      }),
    ]);
    const error = await client.getJson('/x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GraphError);
    expect(error).toMatchObject({
      status: 410,
      code: 'resyncRequired',
      location: 'https://graph.microsoft.com/v1.0/me/drive/root/delta',
    });
  });

  it('does not retry client errors', async () => {
    const { client, calls } = setup([json({ error: { code: 'itemNotFound' } }, 404)]);
    await expect(client.getJson('/x')).rejects.toMatchObject({ code: 'itemNotFound' });
    expect(calls).toHaveLength(1);
  });
});

describe('retryDelay', () => {
  it('honours Retry-After in seconds, capped at one minute', () => {
    expect(retryDelay(0, '3')).toBe(3000);
    expect(retryDelay(0, '600')).toBe(60_000);
  });

  it('backs off exponentially with jitter otherwise', () => {
    expect(retryDelay(0, null, () => 0)).toBe(500);
    expect(retryDelay(3, null, () => 1)).toBe(8000);
  });
});

describe('mapWithConcurrency', () => {
  it('keeps the order and never exceeds the limit', async () => {
    let inFlight = 0;
    let peak = 0;
    const result = await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return n * 10;
    });
    expect(result).toEqual([10, 20, 30, 40, 50, 60, 70]);
    expect(peak).toBe(3);
  });
});

describe('putAppFile', () => {
  it('writes only into the app folder, never over a newer copy', async () => {
    const { client, calls } = setup([json({ eTag: '"e2"' }), json({ eTag: '"e3"' })]);
    await expect(client.putAppFile('nuagerie.json', '{}', { ifMatch: null })).resolves.toEqual({
      eTag: '"e2"',
    });
    expect(calls[0]?.url).toBe(
      'https://graph.microsoft.com/v1.0/me/drive/special/approot:/nuagerie.json:/content',
    );
    expect(calls[0]?.init?.method).toBe('PUT');
    expect(calls[0]?.init?.body).toBe('{}');
    expect(calls[0]?.init?.headers).toMatchObject({ 'If-None-Match': '*' });

    await client.putAppFile('nuagerie.json', '{}', { ifMatch: '"e2"' });
    expect(calls[1]?.init?.headers).toMatchObject({ 'If-Match': '"e2"' });
  });

  it('refuses any name that could lead out of the app folder', async () => {
    const { client, calls } = setup([]);
    for (const name of ['../photo.jpg', 'a/b.json', '', '.hidden', 'x:y']) {
      await expect(client.putAppFile(name, '{}', { ifMatch: null })).rejects.toThrow(
        /Not an app folder file name/,
      );
    }
    expect(calls).toHaveLength(0);
  });

  it('reports a conflict (newer copy) without retrying', async () => {
    const { client, calls } = setup([json({ error: { code: 'preconditionFailed' } }, 412)]);
    await expect(
      client.putAppFile('nuagerie.json', '{}', { ifMatch: '"old"' }),
    ).rejects.toMatchObject({ status: 412 });
    expect(calls).toHaveLength(1);
  });
});
