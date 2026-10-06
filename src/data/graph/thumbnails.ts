import { createLimiter } from '../../lib/limiter.ts';
import type { MediaItem, ThumbnailSize } from '../model.ts';
import type { ThumbnailData } from '../source.ts';
import { GraphError, MAX_BATCH, retryDelay, type GraphClient } from './client.ts';

/**
 * Thumbnails from Graph. The pre-authenticated thumbnail URLs are asked for
 * in batches of 20 ($batch): requests made within a few milliseconds of each
 * other (a screen of thumbnails) share round trips, and a request cancelled
 * before its batch leaves (scrolled past) costs nothing. The image bytes are
 * then downloaded so the app can keep them (thumbnail cache).
 * Grids get square crops; "large" keeps the aspect ratio.
 */

export const THUMBNAIL_SELECTORS: Record<ThumbnailSize, string> = {
  small: 'c200x200_crop',
  medium: 'c360x360_crop',
  large: 'c1600x1600',
};

const FLUSH_DELAY_MS = 16;
const MAX_BATCHES_IN_FLIGHT = 3;
const MAX_DOWNLOADS = 8;
const MAX_ATTEMPTS = 4;
const URL_TTL_MS = 45 * 60_000;

interface Pending {
  path: string;
  signal: AbortSignal | undefined;
  attempts: number;
  resolve: (url: string) => void;
  reject: (error: unknown) => void;
}

type ThumbnailSetList = { value?: Record<string, { url?: string } | string | undefined>[] };

export function thumbnailPath(item: Pick<MediaItem, 'id'>, selector: string): string {
  return `/me/drive/items/${encodeURIComponent(item.id)}/thumbnails?select=${selector}`;
}

/** The URL in a thumbnails response, or null when the item has no thumbnail. */
export function thumbnailUrlIn(body: unknown, selector: string): string | null {
  const entry = (body as ThumbnailSetList | undefined)?.value?.[0]?.[selector];
  return typeof entry === 'object' && entry?.url ? entry.url : null;
}

export function createThumbnailUrlLoader(
  client: GraphClient,
  options: { sleep?: (ms: number) => Promise<void> } = {},
) {
  const sleep = options.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const queue: Pending[] = [];
  const urls = new Map<string, { url: string; expires: number }>();
  let inFlight = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const live = (p: Pending) => !p.signal?.aborted;

  function schedule() {
    if (timer !== null) return;
    timer = setTimeout(() => {
      timer = null;
      flush();
    }, FLUSH_DELAY_MS);
  }

  function flush() {
    while (inFlight < MAX_BATCHES_IN_FLIGHT) {
      const batch: Pending[] = [];
      while (batch.length < MAX_BATCH && queue.length > 0) {
        const next = queue.shift();
        if (!next) break;
        if (live(next)) batch.push(next);
        else next.reject(next.signal?.reason);
      }
      if (batch.length === 0) return;
      inFlight++;
      void send(batch).finally(() => {
        inFlight--;
        if (queue.length > 0) flush();
      });
    }
  }

  async function send(batch: Pending[]) {
    let responses;
    try {
      responses = await client.batch(batch.map((p, i) => ({ id: String(i), url: p.path })));
    } catch (error) {
      batch.forEach((p) => p.reject(error));
      return;
    }
    const retries: { pending: Pending; delay: number }[] = [];
    batch.forEach((pending, i) => {
      const response = responses.find((r) => r.id === String(i));
      if (!response) {
        pending.reject(new GraphError(0, 'missingBatchResponse', 'No response in the batch'));
        return;
      }
      if (response.status === 200) {
        const selector = pending.path.slice(pending.path.lastIndexOf('=') + 1);
        const url = thumbnailUrlIn(response.body, selector);
        if (url) pending.resolve(url);
        else pending.reject(new GraphError(404, 'noThumbnail', 'No thumbnail for this item'));
        return;
      }
      const retryable = response.status === 429 || response.status >= 500;
      if (retryable && pending.attempts + 1 < MAX_ATTEMPTS) {
        const retryAfter = response.headers?.['Retry-After'] ?? response.headers?.['retry-after'];
        retries.push({ pending, delay: retryDelay(pending.attempts, retryAfter ?? null) });
        return;
      }
      const error = (response.body as { error?: { code?: string; message?: string } } | undefined)
        ?.error;
      pending.reject(
        new GraphError(
          response.status,
          error?.code ?? `http_${response.status}`,
          error?.message ?? '',
        ),
      );
    });
    if (retries.length > 0) {
      // Throttled: wait as asked, then queue again (ahead of newer requests).
      await sleep(Math.max(...retries.map((r) => r.delay)));
      queue.unshift(
        ...retries.map(({ pending }) => ({ ...pending, attempts: pending.attempts + 1 })),
      );
    }
  }

  return function getThumbnailUrl(
    item: MediaItem,
    size: ThumbnailSize,
    signal?: AbortSignal,
  ): Promise<string> {
    const selector = THUMBNAIL_SELECTORS[size];
    const key = `${item.id}:${selector}:${item.eTag}`;
    const cached = urls.get(key);
    if (cached && cached.expires > Date.now()) return Promise.resolve(cached.url);
    if (signal?.aborted) return Promise.reject(signal.reason);

    return new Promise<string>((resolve, reject) => {
      queue.push({
        path: thumbnailPath(item, selector),
        signal,
        attempts: 0,
        resolve: (url) => {
          urls.set(key, { url, expires: Date.now() + URL_TTL_MS });
          resolve(url);
        },
        reject,
      });
      if (queue.length >= MAX_BATCH) flush();
      else schedule();
    });
  };
}

/**
 * Thumbnail images: the bytes when the thumbnail host allows reading them
 * (CORS), so they can be cached; otherwise the URL itself, shown as is.
 */
export function createThumbnailFetcher(
  client: GraphClient,
  options: { fetch?: typeof fetch } = {},
) {
  const getUrl = createThumbnailUrlLoader(client);
  const download = createLimiter(MAX_DOWNLOADS);
  const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  let bytesReadable: boolean | null = null;

  const fetchThumbnail = async (
    item: MediaItem,
    size: ThumbnailSize,
    signal?: AbortSignal,
  ): Promise<ThumbnailData> => {
    const url = await getUrl(item, size, signal);
    if (bytesReadable === false) return { url };
    return download(async () => {
      // Settled while this download was waiting for its turn.
      if (bytesReadable === false) return { url };
      let response: Response;
      try {
        response = await doFetch(url, { signal: signal ?? null, credentials: 'omit' });
      } catch (error) {
        if (signal?.aborted) throw error;
        // Graph answered a moment ago, so a failure here (before any download
        // succeeded) is the thumbnail host refusing cross-origin reads, or a
        // CSP block: show the URL instead. Downloads started at the same time
        // fail the same way and take the same path.
        if (error instanceof TypeError && bytesReadable !== true) {
          bytesReadable = false;
          return { url };
        }
        throw error;
      }
      if (!response.ok) throw new GraphError(response.status, 'thumbnailDownload', url);
      bytesReadable = true;
      return { blob: await response.blob() };
    }, signal);
  };

  return Object.assign(fetchThumbnail, {
    /** null until the first download; false when the bytes cannot be read (diagnostic). */
    bytesReadable: () => bytesReadable,
    getUrl,
  });
}
