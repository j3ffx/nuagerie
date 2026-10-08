import type { MediaItem } from '../../data/model.ts';
import type { DataSource } from '../../data/source.ts';
import type { ThumbnailStore } from '../../data/thumbnails/thumbnailStore.ts';

/** Whether this browser can share files (Android, Windows, macOS…), not just links. */
export function canShareFiles(): boolean {
  return typeof navigator.share === 'function' && typeof navigator.canShare === 'function';
}

const DOWNLOAD_TIMEOUT_MS = 60_000;

/**
 * The file to hand to the share sheet: the original when its host lets the
 * app read it and the share sheet takes its type, otherwise, for a photo,
 * the large JPEG version (as on screen; also what HEIC becomes). Nothing is
 * written to the phone's Download folder.
 */
export async function shareableFile(
  item: MediaItem,
  source: Pick<DataSource, 'getOriginalUrl'>,
  store: Pick<ThumbnailStore, 'acquire'>,
  accepts: (file: File) => boolean,
  /** Stops the download (the user cancelled): the result is then null. */
  cancel?: AbortSignal,
): Promise<File | null> {
  const timeout = AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS);
  // AbortSignal.any is recent (Chrome 116): without it, the timeout alone.
  const signal =
    cancel && typeof AbortSignal.any === 'function' ? AbortSignal.any([cancel, timeout]) : timeout;
  try {
    const url = await source.getOriginalUrl(item);
    if (cancel?.aborted) return null;
    if (url) {
      const response = await fetch(url, { credentials: 'omit', signal });
      if (response.ok) {
        const blob = await response.blob();
        const file = new File([blob], item.name, { type: item.mimeType || blob.type });
        if (accepts(file)) return file;
      }
    }
  } catch {
    // Unreadable original (host, network, timeout): fall back below.
  }
  if (item.kind !== 'image' || cancel?.aborted) return null;
  const handle = store.acquire(item, 'large');
  try {
    const blob = await (await fetch(await handle.promise)).blob();
    const file = new File([blob], `${item.name.replace(/\.[^.]+$/, '')}.jpg`, {
      type: 'image/jpeg',
    });
    return accepts(file) ? file : null;
  } catch {
    return null;
  } finally {
    handle.release();
  }
}
