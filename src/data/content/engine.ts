import { MODEL_CACHE, RUNTIME_CACHE } from './cacheNames.ts';

/** Turns images and words into comparable vectors, on this device. */
export interface ContentEngine {
  /** Downloads the text side once (kept on the device) and loads it. */
  prepareText(onProgress: DownloadProgress): Promise<void>;
  /** The same for the image side. Says where it runs: on the graphics card, or the processor. */
  prepareImages(onProgress: DownloadProgress): Promise<EngineDevice>;
  encodeText(text: string): Promise<Float32Array>;
  encodeImage(image: Blob): Promise<Float32Array>;
  /** Frees the memory of the image side; the search only needs the text side. */
  releaseImages(): void;
  /** Erases the model from the device. */
  erase(): Promise<void>;
}

export type EngineDevice = 'webgpu' | 'wasm';
export type DownloadProgress = (loaded: number, total: number) => void;

/** The vectors of one model are comparable only with its own: stored with each copy. */
export const MODEL_ID = 'siglip2-base-patch16-224';

/** Fixed: a new revision of the model would need every photo analysed again. */
export const MODEL_URL =
  'https://huggingface.co/onnx-community/siglip2-base-patch16-224-ONNX/resolve/ba1f3b0843f24bc5417d38e19c37b287d719b2f4/';

type Request =
  | { kind: 'prepareText' }
  | { kind: 'prepareImages' }
  | { kind: 'encodeText'; text: string }
  | { kind: 'encodeImage'; image: Blob }
  | { kind: 'releaseImages' };

export type EngineRequest = Request & { id: number };

export type EngineReply =
  | { id: number; kind: 'done'; value?: EngineDevice | Float32Array }
  | { id: number; kind: 'failed'; message: string }
  | { id: number; kind: 'progress'; loaded: number; total: number };

/** The model runs in a worker: a search or an analysis must not freeze the screen. */
export function createWorkerEngine(): ContentEngine {
  let worker: Worker | null = null;
  let nextId = 0;
  const pending = new Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
      onProgress?: DownloadProgress | undefined;
    }
  >();

  const started = () => {
    if (worker) return worker;
    worker = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' });
    worker.addEventListener('message', ({ data }: MessageEvent<EngineReply>) => {
      const call = pending.get(data.id);
      if (!call) return;
      if (data.kind === 'progress') {
        call.onProgress?.(data.loaded, data.total);
        return;
      }
      pending.delete(data.id);
      if (data.kind === 'done') call.resolve(data.value);
      else call.reject(new Error(data.message));
    });
    worker.addEventListener('error', (event) => {
      // The worker is gone (out of memory, usually): what it was doing will not end.
      for (const call of pending.values()) call.reject(new Error(event.message || 'Worker error'));
      pending.clear();
      worker?.terminate();
      worker = null;
    });
    return worker;
  };

  const ask = <T>(request: Request, onProgress?: DownloadProgress) =>
    new Promise<T>((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve: resolve as (value: unknown) => void, reject, onProgress });
      started().postMessage({ ...request, id } satisfies EngineRequest);
    });

  return {
    prepareText: (onProgress) => ask<void>({ kind: 'prepareText' }, onProgress),
    prepareImages: (onProgress) => ask<EngineDevice>({ kind: 'prepareImages' }, onProgress),
    encodeText: (text) => ask<Float32Array>({ kind: 'encodeText', text }),
    encodeImage: (image) => ask<Float32Array>({ kind: 'encodeImage', image }),
    releaseImages: () => void ask<void>({ kind: 'releaseImages' }).catch(() => undefined),
    async erase() {
      worker?.terminate();
      worker = null;
      if (typeof caches === 'undefined') return;
      await Promise.all([caches.delete(MODEL_CACHE), caches.delete(RUNTIME_CACHE)]);
    },
  };
}
