/// <reference lib="webworker" />
import { Tokenizer } from '@huggingface/tokenizers';
import * as ort from 'onnxruntime-web/webgpu';
import { keepFile, keptFile, MODEL_CACHE } from './cacheNames.ts';
import {
  MODEL_URL,
  type DownloadProgress,
  type EngineDevice,
  type EngineReply,
  type EngineRequest,
} from './engine.ts';
import { normalized } from './rank.ts';

/**
 * SigLIP 2 (B/16, 224): images and words in the same space, in French as in
 * English. The image side as chosen on real photos: half floats on the graphics card (ten
 * times faster than full floats there). Those vectors differ from the processor's, which
 * uses bytes (see ContentDeps.readDevice). The text side: bytes on the processor, always.
 */
const IMAGE_SIZE = 224;
/** The model was trained on lowercased words padded to 64 tokens. */
const TEXT_LENGTH = 64;
const PAD = 0;

// One file of the runtime is too big for the host unless gzipped (build/ort-runtime.ts).
const runtimeReady = (async () => {
  ort.env.wasm.wasmPaths = { mjs: __ORT_GLUE_URL__ };
  const response = await fetch(__ORT_WASM_URL__);
  if (!response.ok || !response.body) throw new Error(`Runtime: HTTP ${response.status}`);
  const stream = response.body.pipeThrough(new DecompressionStream('gzip'));
  ort.env.wasm.wasmBinary = await new Response(stream).arrayBuffer();
})();

/** A model file, from the device once it has been downloaded. */
async function modelFile(path: string, onProgress?: DownloadProgress): Promise<Uint8Array> {
  const cache = await caches.open(MODEL_CACHE);
  const url = MODEL_URL + path;
  const kept = await keptFile(cache, url);
  if (kept) return kept;

  const response = await fetch(url, { credentials: 'omit' });
  if (!response.ok || !response.body) throw new Error(`Model: HTTP ${response.status}`);
  const total = Number(response.headers.get('Content-Length')) || 0;
  const reader = response.body.getReader();
  const parts: Uint8Array<ArrayBuffer>[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    loaded += value.length;
    onProgress?.(loaded, total);
  }
  const file = new Blob(parts);
  // Not kept when the browser refuses (no room): it works, and downloads again next time.
  await keepFile(cache, url, file).catch(() => undefined);
  return new Uint8Array(await file.arrayBuffer());
}

let text: { session: ort.InferenceSession; tokenizer: Tokenizer } | null = null;
let image: ort.InferenceSession | null = null;

async function prepareText(onProgress: DownloadProgress): Promise<void> {
  if (text) return;
  await runtimeReady;
  const decoder = new TextDecoder();
  const json = async (path: string) => JSON.parse(decoder.decode(await modelFile(path))) as object;
  const tokenizer = await json('tokenizer.json');
  const config = await json('tokenizer_config.json');
  const model = await modelFile('onnx/text_model_quantized.onnx', onProgress);
  const session = await ort.InferenceSession.create(model, { executionProviders: ['wasm'] });
  text = { session, tokenizer: new Tokenizer(tokenizer, config) };
}

async function encodeText(words: string): Promise<Float32Array> {
  if (!text) throw new Error('Text side not ready');
  const ids = text.tokenizer.encode(words.toLowerCase()).ids.slice(0, TEXT_LENGTH);
  const padded = new BigInt64Array(TEXT_LENGTH).fill(BigInt(PAD));
  ids.forEach((id, i) => (padded[i] = BigInt(id)));
  const output = await text.session.run({
    input_ids: new ort.Tensor('int64', padded, [1, TEXT_LENGTH]),
  });
  return vectorOf(output);
}

/** An adapter kept and given to the runtime: one it would look for itself is lost otherwise. */
async function graphicsCard(): Promise<boolean> {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
  const adapter = (await gpu?.requestAdapter().catch(() => null)) as {
    features: { has(name: string): boolean };
  } | null;
  // No adapter on some phones that have `navigator.gpu`; half floats need this feature.
  if (!adapter?.features.has('shader-f16')) return false;
  (ort.env.webgpu as { adapter: unknown }).adapter = adapter;
  return true;
}

async function prepareImages(onProgress: DownloadProgress): Promise<EngineDevice> {
  await runtimeReady;
  if (await graphicsCard()) {
    try {
      const model = await modelFile('onnx/vision_model_fp16.onnx', onProgress);
      image = await ort.InferenceSession.create(model, { executionProviders: ['webgpu'] });
      return 'webgpu';
    } catch {
      // The card refuses this model: the processor takes it, more slowly.
    }
  }
  const model = await modelFile('onnx/vision_model_quantized.onnx', onProgress);
  image = await ort.InferenceSession.create(model, { executionProviders: ['wasm'] });
  return 'wasm';
}

async function encodeImage(blob: Blob): Promise<Float32Array> {
  if (!image) throw new Error('Image side not ready');
  const bitmap = await createImageBitmap(blob, {
    resizeWidth: IMAGE_SIZE,
    resizeHeight: IMAGE_SIZE,
    resizeQuality: 'high',
  });
  const canvas = new OffscreenCanvas(IMAGE_SIZE, IMAGE_SIZE);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No canvas');
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  const { data } = context.getImageData(0, 0, IMAGE_SIZE, IMAGE_SIZE);
  // Red, then green, then blue planes, from 0..255 to -1..1.
  const count = IMAGE_SIZE * IMAGE_SIZE;
  const pixels = new Float32Array(3 * count);
  for (let i = 0; i < count; i++) {
    for (let channel = 0; channel < 3; channel++) {
      pixels[channel * count + i] = (data[i * 4 + channel] ?? 0) / 127.5 - 1;
    }
  }
  const output = await image.run({
    pixel_values: new ort.Tensor('float32', pixels, [1, 3, IMAGE_SIZE, IMAGE_SIZE]),
  });
  return vectorOf(output);
}

function vectorOf(output: ort.InferenceSession.ReturnType): Float32Array {
  const tensor = output.pooler_output;
  if (!tensor) throw new Error('No pooler_output');
  return normalized(Float32Array.from(tensor.data as Float32Array));
}

const reply = (message: EngineReply) => self.postMessage(message);

async function answer(request: EngineRequest): Promise<void> {
  const onProgress: DownloadProgress = (loaded, total) =>
    reply({ id: request.id, kind: 'progress', loaded, total });
  switch (request.kind) {
    case 'prepareText':
      await prepareText(onProgress);
      return reply({ id: request.id, kind: 'done' });
    case 'prepareImages':
      return reply({ id: request.id, kind: 'done', value: await prepareImages(onProgress) });
    case 'encodeText':
      return reply({ id: request.id, kind: 'done', value: await encodeText(request.text) });
    case 'encodeImage':
      return reply({ id: request.id, kind: 'done', value: await encodeImage(request.image) });
    case 'releaseImages':
      await image?.release();
      image = null;
      return reply({ id: request.id, kind: 'done' });
  }
}

// One at a time: the model runs one image or one search, in the order asked.
let queue: Promise<unknown> = Promise.resolve();
self.addEventListener('message', ({ data }: MessageEvent<EngineRequest>) => {
  queue = queue.then(() =>
    answer(data).catch((error: unknown) =>
      reply({
        id: data.id,
        kind: 'failed',
        message: error instanceof Error ? error.message : String(error),
      }),
    ),
  );
});
