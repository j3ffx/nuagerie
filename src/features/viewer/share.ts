import type { MediaItem } from '../../data/model.ts';
import type { DataSource } from '../../data/source.ts';
import type { ThumbnailStore } from '../../data/thumbnails/thumbnailStore.ts';

/** Whether this browser can share files (Android, Windows, macOS…), not just links. */
export function canShareFiles(): boolean {
  return typeof navigator.share === 'function' && typeof navigator.canShare === 'function';
}

/**
 * The file to hand to the share sheet: the original when its host lets the
 * app read it, otherwise, for a photo, the large JPEG version (as on screen).
 * Nothing is written to the phone's Download folder.
 */
export async function shareableFile(
  item: MediaItem,
  source: Pick<DataSource, 'getOriginalUrl'>,
  store: Pick<ThumbnailStore, 'acquire'>,
): Promise<File | null> {
  try {
    const url = await source.getOriginalUrl(item);
    if (url) {
      const response = await fetch(url, { credentials: 'omit' });
      if (response.ok) {
        const blob = await response.blob();
        return new File([blob], item.name, { type: item.mimeType || blob.type });
      }
    }
  } catch {
    // The original's host refuses cross-origin reads: fall back below.
  }
  if (item.kind !== 'image') return null;
  const handle = store.acquire(item, 'large');
  try {
    const blob = await (await fetch(await handle.promise)).blob();
    return new File([blob], item.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return null;
  } finally {
    handle.release();
  }
}
