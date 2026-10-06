import { describe, expect, it, vi } from 'vitest';
import { createGraphClient, GraphError, mapWithConcurrency, retryDelay } from './client.ts';

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

function setup(responses: (Response | Error)[]) {
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
