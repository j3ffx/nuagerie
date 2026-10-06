import type { ThumbnailSize } from '../model.ts';
import { drawDemoThumbnail, type DemoThumbnailInput } from './thumbnails.ts';

/** Draws demo thumbnails off the main thread, as a network would deliver them. */

export interface DemoThumbnailRequest {
  requestId: number;
  item: DemoThumbnailInput;
  size: ThumbnailSize;
}

export type DemoThumbnailResponse =
  { requestId: number; blob: Blob } | { requestId: number; error: string };

// Typed by hand: the app is compiled with the DOM library, not the worker one.
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<DemoThumbnailRequest>) => void) | null;
  postMessage(message: DemoThumbnailResponse): void;
};

scope.onmessage = (event) => {
  const { requestId, item, size } = event.data;
  drawDemoThumbnail(item, size).then(
    (blob) => scope.postMessage({ requestId, blob } satisfies DemoThumbnailResponse),
    (error: unknown) =>
      scope.postMessage({ requestId, error: String(error) } satisfies DemoThumbnailResponse),
  );
};
