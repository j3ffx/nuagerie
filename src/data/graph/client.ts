import { isOnline } from '../../lib/online.ts';

/**
 * Minimal Microsoft Graph client: bearer token, retries on throttling and
 * transient errors (honouring Retry-After), typed errors. Read-only usage:
 * GET requests, plus POST /$batch, whose sub-requests are GETs too.
 */

export const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

export class GraphError extends Error {
  readonly status: number;
  readonly code: string;
  /** `Location` header, set on 410 Gone (delta resync). */
  readonly location: string | null;

  constructor(status: number, code: string, message: string, location: string | null = null) {
    super(message);
    this.name = 'GraphError';
    this.status = status;
    this.code = code;
    this.location = location;
  }
}

export interface GraphClientOptions {
  getToken: () => Promise<string>;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  /** Retries after the first attempt (throttling, 5xx, network errors). */
  maxRetries?: number;
  /** False when the device is known to be offline: network errors are not retried then. */
  isOnline?: () => boolean;
}

export interface GraphClient {
  getJson<T>(pathOrUrl: string): Promise<T>;
  /** JSON batching: up to 20 read requests in one round trip. */
  batch(requests: BatchRequest[]): Promise<BatchResponse[]>;
}

export interface BatchRequest {
  id: string;
  /** Relative to the API version, e.g. "/me/drive/items/{id}/thumbnails". */
  url: string;
}

export interface BatchResponse {
  id: string;
  status: number;
  headers?: Record<string, string>;
  body?: unknown;
}

export const MAX_BATCH = 20;

const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const MAX_BACKOFF_MS = 60_000;

/** Delay before the next attempt: Retry-After when given, else exponential backoff with jitter. */
export function retryDelay(
  attempt: number,
  retryAfter: string | null,
  random = Math.random,
): number {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.min(seconds * 1000, MAX_BACKOFF_MS);
    const date = Date.parse(retryAfter);
    if (!Number.isNaN(date)) return Math.min(Math.max(date - Date.now(), 0), MAX_BACKOFF_MS);
  }
  const base = Math.min(1000 * 2 ** attempt, MAX_BACKOFF_MS);
  return base / 2 + random() * (base / 2);
}

async function toGraphError(response: Response): Promise<GraphError> {
  let code = `http_${response.status}`;
  let message = response.statusText || code;
  try {
    const body = (await response.json()) as { error?: { code?: string; message?: string } };
    code = body.error?.code ?? code;
    message = body.error?.message ?? message;
  } catch {
    // Not JSON: keep the status.
  }
  return new GraphError(response.status, code, message, response.headers.get('Location'));
}

export function createGraphClient(options: GraphClientOptions): GraphClient {
  const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  const sleep = options.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const maxRetries = options.maxRetries ?? 6;
  const online = options.isOnline ?? isOnline;

  async function send(pathOrUrl: string, body?: unknown): Promise<Response> {
    const url = /^https:\/\//.test(pathOrUrl) ? pathOrUrl : `${GRAPH_BASE}${pathOrUrl}`;
    for (let attempt = 0; ; attempt++) {
      const token = await options.getToken();
      let response: Response;
      try {
        response = await doFetch(
          url,
          body === undefined
            ? {
                method: 'GET',
                headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
              }
            : {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${token}`,
                  Accept: 'application/json',
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
              },
        );
      } catch (error) {
        // Network failure (DNS, flaky link…): retry, then give up with the original error.
        // Offline, waiting is pointless: the app tries again once the connection is back.
        if (attempt >= maxRetries || !online()) throw error;
        await sleep(retryDelay(attempt, null));
        continue;
      }
      if (response.ok) return response;
      if (RETRYABLE.has(response.status) && attempt < maxRetries) {
        await sleep(retryDelay(attempt, response.headers.get('Retry-After')));
        continue;
      }
      throw await toGraphError(response);
    }
  }

  return {
    async getJson<T>(pathOrUrl: string): Promise<T> {
      return (await (await send(pathOrUrl)).json()) as T;
    },

    async batch(requests: BatchRequest[]): Promise<BatchResponse[]> {
      if (requests.length > MAX_BATCH) throw new Error(`At most ${MAX_BATCH} requests per batch`);
      const body = { requests: requests.map(({ id, url }) => ({ id, method: 'GET', url })) };
      const result = (await (await send('/$batch', body)).json()) as {
        responses?: BatchResponse[];
      };
      return result.responses ?? [];
    },
  };
}

/** Runs `task` over `items` with at most `limit` tasks in flight. */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index] as T, index);
    }
  });
  await Promise.all(workers);
  return results;
}
