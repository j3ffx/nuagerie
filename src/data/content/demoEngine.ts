import { normalize } from '../search/query.ts';
import type { ContentEngine } from './engine.ts';
import { DIMENSIONS, normalized } from './rank.ts';

/**
 * The demo's stand-in for the model (no download, no network): an "image" is
 * the words of its album, and a vector says which words it holds. The demo's
 * photos are drawings: there would be nothing for a real model to see.
 */
function vectorOfWords(words: string): Float32Array {
  const vector = new Float32Array(DIMENSIONS);
  for (const word of normalize(words).split(/\s+/).filter(Boolean)) {
    let hash = 7;
    for (const char of word) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % DIMENSIONS;
    vector[hash] = (vector[hash] ?? 0) + 1;
  }
  return normalized(vector);
}

export function createDemoEngine(): ContentEngine {
  return {
    prepareText: () => Promise.resolve(),
    prepareImages: () => Promise.resolve('wasm'),
    encodeText: (text) => Promise.resolve(vectorOfWords(text)),
    encodeImage: async (image) => vectorOfWords(await image.text()),
    releaseImages: () => undefined,
    erase: () => Promise.resolve(),
  };
}
