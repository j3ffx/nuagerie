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

  it('replaces a whole file, of any type, when asked to overwrite', async () => {
    const { client, calls } = setup([json({ eTag: '"e1"' })]);
    const blob = new Blob([new Uint8Array([1, 2, 3])]);
    await client.putAppFile('index.json.gz', blob, {
      overwrite: true,
      contentType: 'application/gzip',
    });
    expect(calls[0]?.init?.body).toBe(blob);
    expect(calls[0]?.init?.headers).toMatchObject({ 'Content-Type': 'application/gzip' });
    expect(calls[0]?.init?.headers).not.toHaveProperty('If-Match');
    expect(calls[0]?.init?.headers).not.toHaveProperty('If-None-Match');
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

describe('DriveWriter', () => {
  const base = 'https://graph.microsoft.com/v1.0/me/drive/items/';
  const body = (call: { init: RequestInit | undefined } | undefined) =>
    JSON.parse(String(call?.init?.body)) as unknown;

  it('deletes, moves, renames, creates and restores one item at a time, by its id', async () => {
    const { client, calls } = setup([
      new Response(null, { status: 204 }),
      json({ id: 'A!1' }),
      json({ id: 'F!2' }),
      json({ id: 'N!3' }),
      json({ id: 'A!1' }),
    ]);
    await client.deleteItem('A!1');
    expect(calls[0]).toMatchObject({ url: `${base}A!1`, init: { method: 'DELETE' } });

    await expect(client.updateItem('A!1', { parentId: 'F!9' })).resolves.toEqual({ id: 'A!1' });
    expect(calls[1]?.url.startsWith(`${base}A!1?$select=id,name,parentReference`)).toBe(true);
    expect(calls[1]?.url.endsWith('&@microsoft.graph.conflictBehavior=fail')).toBe(true);
    expect(calls[1]?.init?.method).toBe('PATCH');
    expect(body(calls[1])).toEqual({ parentReference: { id: 'F!9' } });

    await client.updateItem('F!2', { name: 'Vacances' });
    expect(body(calls[2])).toEqual({ name: 'Vacances' });

    await client.createFolder('F!9', 'Nouvel album');
    expect(calls[3]?.url.startsWith(`${base}F!9/children?`)).toBe(true);
    expect(calls[3]?.init?.method).toBe('POST');
    expect(body(calls[3])).toEqual({
      name: 'Nouvel album',
      folder: {},
      '@microsoft.graph.conflictBehavior': 'fail',
    });

    await client.restoreItem('A!1');
    expect(calls[4]?.url.startsWith(`${base}A!1/restore?$select=`)).toBe(true);
    expect(calls[4]?.init?.method).toBe('POST');
  });

  it('deletes only the version it was given, when told', async () => {
    const { client, calls } = setup([new Response(null, { status: 204 })]);
    await client.deleteItem('F!2', { ifMatch: '"e7"' });
    expect(calls[0]?.init?.headers).toMatchObject({ 'If-Match': '"e7"' });
  });

  it('never sends a delete, a new folder or a restore twice, unless Graph said it did nothing', async () => {
    const lost = setup([new TypeError('network'), new Response(null, { status: 204 })]);
    await expect(lost.client.deleteItem('A!1')).rejects.toThrow('network');
    expect(lost.calls).toHaveLength(1);

    const busy = setup([json({ error: { code: 'serviceNotAvailable' } }, 503)]);
    await expect(busy.client.createFolder('F!9', 'X')).rejects.toMatchObject({ status: 503 });
    expect(busy.calls).toHaveLength(1);

    const throttled = setup([json({}, 429, { 'Retry-After': '1' }), json({ id: 'A!1' })]);
    await throttled.client.restoreItem('A!1');
    expect(throttled.calls).toHaveLength(2);

    // A move asked twice ends the same: it is sent again.
    const moved = setup([new TypeError('network'), json({ id: 'A!1' })]);
    await moved.client.updateItem('A!1', { parentId: 'F!9' });
    expect(moved.calls).toHaveLength(2);
  });

  it('never reaches past one item, nor the drive root', async () => {
    const { client, calls } = setup([new Response(null, { status: 204 })]);
    await client.deleteItem('../root/children');
    expect(calls[0]?.url).toBe(`${base}..%2Froot%2Fchildren`);
    for (const id of ['', 'root']) {
      await expect(client.deleteItem(id)).rejects.toThrow(/Not an item id/);
    }
    expect(calls).toHaveLength(1);
  });

  it('reports a name already taken without retrying', async () => {
    const { client, calls } = setup([json({ error: { code: 'nameAlreadyExists' } }, 409)]);
    await expect(client.createFolder('F!9', 'Vacances')).rejects.toMatchObject({
      status: 409,
      code: 'nameAlreadyExists',
    });
    expect(calls).toHaveLength(1);
  });
});

describe('a request that never ends', () => {
  it('gives up, then retries, rather than waiting for ever', async () => {
    let calls = 0;
    const client = createGraphClient({
      getToken: async () => 't',
      // A network that lets nothing through and never says no (a plane's Wi-Fi).
      fetch: ((_url: RequestInfo | URL, init?: RequestInit) => {
        calls++;
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('The operation timed out.', 'TimeoutError')),
          );
        });
      }) as typeof fetch,
      sleep: async () => undefined,
      maxRetries: 2,
      requestTimeoutMs: 20,
    });
    await expect(client.getJson('/me/drive/root')).rejects.toMatchObject({ name: 'TimeoutError' });
    expect(calls).toBe(3);
  });
});

describe('a long answer on a slow network', () => {
  it('is read to the end: only the wait for the answer has a limit', async () => {
    const client = createGraphClient({
      getToken: async () => 't',
      // The answer comes at once, its body slowly (a big delta page on a weak network).
      // As in a browser, cancelling the request also cuts its body.
      fetch: (async (_url: RequestInfo | URL, init?: RequestInit) =>
        new Response(
          new ReadableStream({
            start(controller) {
              init?.signal?.addEventListener('abort', () =>
                controller.error(new DOMException('Cut', 'TimeoutError')),
              );
              setTimeout(() => {
                controller.enqueue(new TextEncoder().encode('{"value":[1,2,3]}'));
                controller.close();
              }, 80);
            },
          }),
          { status: 200 },
        )) as typeof fetch,
      sleep: async () => undefined,
      requestTimeoutMs: 20,
    });
    await expect(client.getJson('/me/drive/root/delta')).resolves.toEqual({ value: [1, 2, 3] });
  });
});
