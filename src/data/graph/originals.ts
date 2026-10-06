import type { MediaItem } from '../model.ts';
import type { GraphClient } from './client.ts';

/** Pre-authenticated download URLs last about an hour; reuse them well within that. */
const URL_TTL_MS = 30 * 60_000;

/**
 * Download URL of an original file (`@microsoft.graph.downloadUrl`), for video
 * playback and "Ouvrir l'original". Reading it needs no write permission.
 */
export function createOriginalUrlLoader(client: GraphClient) {
  const urls = new Map<string, { url: string; expires: number }>();

  return async function getOriginalUrl(item: MediaItem): Promise<string | null> {
    const key = `${item.id}:${item.eTag}`;
    const cached = urls.get(key);
    if (cached && cached.expires > Date.now()) return cached.url;
    const result = await client.getJson<{ '@microsoft.graph.downloadUrl'?: string }>(
      `/me/drive/items/${encodeURIComponent(item.id)}`,
    );
    const url = result['@microsoft.graph.downloadUrl'] ?? null;
    if (url) urls.set(key, { url, expires: Date.now() + URL_TTL_MS });
    return url;
  };
}
