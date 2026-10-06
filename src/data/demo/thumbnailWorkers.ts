import type { MediaItem, ThumbnailSize } from '../model.ts';
import { drawDemoThumbnail } from './thumbnails.ts';
import type { DemoThumbnailRequest, DemoThumbnailResponse } from './thumbnailWorker.ts';

const WORKERS = Math.min(4, Math.max(2, (navigator.hardwareConcurrency || 4) - 1));

/**
 * Demo thumbnails drawn by a small pool of workers, or on the main thread
 * where workers or OffscreenCanvas are missing.
 */
export function createDemoThumbnailDrawer() {
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') {
    return (item: MediaItem, size: ThumbnailSize) => drawDemoThumbnail(item, size);
  }

  let workers: Worker[] | null = null;
  let nextWorker = 0;
  let nextId = 0;
  const pending = new Map<number, { resolve: (blob: Blob) => void; reject: (e: Error) => void }>();

  const onMessage = (event: MessageEvent<DemoThumbnailResponse>) => {
    const request = pending.get(event.data.requestId);
    if (!request) return;
    pending.delete(event.data.requestId);
    if ('blob' in event.data) request.resolve(event.data.blob);
    else request.reject(new Error(event.data.error));
  };

  const pool = () =>
    (workers ??= Array.from({ length: WORKERS }, () => {
      const worker = new Worker(new URL('./thumbnailWorker.ts', import.meta.url), {
        type: 'module',
      });
      worker.onmessage = onMessage;
      return worker;
    }));

  return (item: MediaItem, size: ThumbnailSize): Promise<Blob> =>
    new Promise((resolve, reject) => {
      const requestId = nextId++;
      pending.set(requestId, { resolve, reject });
      const { id, name, takenAt, width, height } = item;
      const workerList = pool();
      const worker = workerList[nextWorker++ % workerList.length];
      worker?.postMessage({
        requestId,
        item: { id, name, takenAt, width, height },
        size,
      } satisfies DemoThumbnailRequest);
    });
}
