import { isOnline } from '../../lib/online.ts';
import { DELTA_SELECT } from './sync.ts';
import type { GraphDriveItem } from './types.ts';

/**
 * Minimal Microsoft Graph client: bearer token, retries on throttling and
 * transient errors (honouring Retry-After), typed errors. Reads are GET
 * requests, plus POST /$batch, whose sub-requests are GETs too. The writes are
 * here as well, and only here: the app folder's files (AppFolderWriter) and,
 * once the user turned the changes on, the few changes of DriveWriter.
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
  /** For tests: how long one request may last (REQUEST_TIMEOUT_MS). */
  requestTimeoutMs?: number;
}

interface Request {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: string | Blob;
  /**
   * Done twice, it would not do the same (a delete, a new folder, a restore):
   * never sent again once it may have reached Graph, only after a refusal
   * that says it did nothing (429).
   */
  once?: boolean;
}

/** A plain file name: no path, so no way out of the app's folder. */
const APP_FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * The app's only write: a file in its own folder of the drive (Apps/Nuagerie,
 * `special/approot`), with the opt-in `Files.ReadWrite.AppFolder` permission.
 * Photos and every other folder stay read-only.
 */
export interface AppFolderWriter {
  putAppFile(
    name: string,
    content: string | Blob,
    options: AppFileWrite & { contentType?: string },
  ): Promise<{ eTag: string }>;
}

/**
 * Over the copy with that eTag only (null: only if there is none yet), or
 * over whatever is there, for a file any device may replace whole.
 */
export type AppFileWrite = { ifMatch: string | null } | { overwrite: true };

/**
 * The changes the user can make once they turned them on (Réglages →
 * Modifications, `Files.ReadWrite.All`), each on one item by its id. A deleted
 * item goes to OneDrive's recycle bin, from which `restoreItem` brings it back.
 * Which items may be changed is the caller's to check (src/data/edits/).
 */
export interface DriveWriter {
  /** With `ifMatch`, only that version of it (a folder's eTag changes with what it holds). */
  deleteItem(id: string, options?: { ifMatch?: string }): Promise<void>;
  /** Moves (to `parentId`) or renames; fails rather than replace an item of the same name. */
  updateItem(id: string, change: { name?: string; parentId?: string }): Promise<GraphDriveItem>;
  /** A new folder in `parentId`; fails if one of that name is there. */
  createFolder(parentId: string, name: string): Promise<GraphDriveItem>;
  /** Into `parentId` when given: without it, OneDrive puts it back where it was, deleted or not. */
  restoreItem(id: string, parentId?: string): Promise<GraphDriveItem>;
  /** An item as it is now, e.g. to check that a folder is empty before deleting it. */
  getItem(id: string): Promise<GraphDriveItem & { folder?: { childCount?: number } }>;
}

/** The path of one item: its id encoded, so a request never leaves /me/drive/items/{id}. */
function itemPath(id: string): string {
  if (!id || id === 'root') throw new Error(`Not an item id: ${id}`);
  return `/me/drive/items/${encodeURIComponent(id)}`;
}

const FAIL_ON_CONFLICT = { '@microsoft.graph.conflictBehavior': 'fail' };

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
/**
 * A request with no answer from the server after this long gives up: on a
 * network that lets nothing through but never says no (a plane's Wi-Fi), it
 * would otherwise wait for ever. It then counts as a network failure, retried
 * like one. Only the wait for the answer counts, not reading a long one on a
 * slow network; and not an upload, whose answer comes once it is all sent.
 */
const REQUEST_TIMEOUT_MS = 30_000;
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

export function createGraphClient(
  options: GraphClientOptions,
): GraphClient & AppFolderWriter & DriveWriter {
  const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  const sleep = options.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const maxRetries = options.maxRetries ?? 6;
  const online = options.isOnline ?? isOnline;

  async function send(pathOrUrl: string, request: Request = { method: 'GET' }): Promise<Response> {
    const url = /^https:\/\//.test(pathOrUrl) ? pathOrUrl : `${GRAPH_BASE}${pathOrUrl}`;
    for (let attempt = 0; ; attempt++) {
      const token = await options.getToken();
      let response: Response;
      const controller = new AbortController();
      const timer =
        request.method === 'PUT'
          ? 0
          : setTimeout(
              () => controller.abort(new DOMException('No answer in time', 'TimeoutError')),
              options.requestTimeoutMs ?? REQUEST_TIMEOUT_MS,
            );
      try {
        response = await doFetch(url, {
          method: request.method,
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            ...request.headers,
          },
          ...(request.body === undefined ? {} : { body: request.body }),
          signal: controller.signal,
        });
      } catch (error) {
        // Network failure (DNS, flaky link…): retry, then give up with the original error.
        // Offline, waiting is pointless: the app tries again once the connection is back.
        if (attempt >= maxRetries || !online() || request.once) throw error;
        await sleep(retryDelay(attempt, null));
        continue;
      } finally {
        clearTimeout(timer);
      }
      if (response.ok) return response;
      if (
        RETRYABLE.has(response.status) &&
        attempt < maxRetries &&
        (!request.once || response.status === 429)
      ) {
        await sleep(retryDelay(attempt, response.headers.get('Retry-After')));
        continue;
      }
      throw await toGraphError(response);
    }
  }

  const sendJson = async (path: string, method: Request['method'], body: unknown) =>
    (await (
      await send(path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        once: method !== 'PATCH',
      })
    ).json()) as GraphDriveItem;
  const selected = `?$select=${DELTA_SELECT}`;

  return {
    async getJson<T>(pathOrUrl: string): Promise<T> {
      return (await (await send(pathOrUrl)).json()) as T;
    },

    async deleteItem(id, { ifMatch } = {}) {
      await send(itemPath(id), {
        method: 'DELETE',
        once: true,
        ...(ifMatch ? { headers: { 'If-Match': ifMatch } } : {}),
      });
    },

    updateItem(id, { name, parentId }) {
      // For a PATCH, Graph reads the conflict rule from the query.
      return sendJson(
        `${itemPath(id)}${selected}&@microsoft.graph.conflictBehavior=fail`,
        'PATCH',
        {
          ...(name === undefined ? {} : { name }),
          ...(parentId === undefined ? {} : { parentReference: { id: parentId } }),
        },
      );
    },

    createFolder(parentId, name) {
      return sendJson(`${itemPath(parentId)}/children${selected}`, 'POST', {
        name,
        folder: {},
        ...FAIL_ON_CONFLICT,
      });
    },

    restoreItem(id, parentId) {
      return sendJson(
        `${itemPath(id)}/restore${selected}`,
        'POST',
        parentId === undefined ? {} : { parentReference: { id: parentId } },
      );
    },

    async getItem(id) {
      return (await send(`${itemPath(id)}${selected}`)).json() as Promise<GraphDriveItem>;
    },

    async batch(requests: BatchRequest[]): Promise<BatchResponse[]> {
      if (requests.length > MAX_BATCH) throw new Error(`At most ${MAX_BATCH} requests per batch`);
      const body = { requests: requests.map(({ id, url }) => ({ id, method: 'GET', url })) };
      const result = (await (
        await send('/$batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      ).json()) as {
        responses?: BatchResponse[];
      };
      return result.responses ?? [];
    },

    async putAppFile(name, content, options) {
      // The path is built here, and only ever points into the app's own folder.
      if (!APP_FILE_NAME.test(name)) throw new Error(`Not an app folder file name: ${name}`);
      const condition: Record<string, string> =
        'overwrite' in options
          ? {}
          : // Never overwrite a newer copy: a changed eTag answers 412, the caller merges again.
            options.ifMatch
            ? { 'If-Match': options.ifMatch }
            : { 'If-None-Match': '*' };
      const response = await send(`/me/drive/special/approot:/${name}:/content`, {
        method: 'PUT',
        headers: { 'Content-Type': options.contentType ?? 'application/json', ...condition },
        body: content,
      });
      const item = (await response.json()) as { eTag?: string };
      return { eTag: item.eTag ?? '' };
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
