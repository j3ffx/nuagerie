/**
 * The vectors of the content search: one per photo, from the image side of the
 * model (engine.worker.ts), compared with the vector of the words typed. Kept
 * as signed bytes: 768 bytes a photo, 15 MB for 20,000.
 */
export const DIMENSIONS = 768;

/**
 * A normalized vector's values stay well inside ±0.5 (768 dimensions), so this
 * scale keeps more precision than ±1. Values past it are clamped.
 */
const BYTE_SCALE = 254;

export function toBytes(vector: Float32Array): Int8Array {
  const bytes = new Int8Array(vector.length);
  for (let i = 0; i < vector.length; i++) {
    bytes[i] = Math.max(-127, Math.min(127, Math.round((vector[i] ?? 0) * BYTE_SCALE)));
  }
  return bytes;
}

export function normalized(vector: Float32Array): Float32Array {
  let sum = 0;
  for (const value of vector) sum += value * value;
  const norm = Math.sqrt(sum) || 1;
  return vector.map((value) => value / norm);
}

/**
 * Screenshots look like many searches at once. Going away from the words "a
 * screenshot" lowers each photo's score by this much of its likeness to one.
 */
export const CAPTURE_PHRASE = 'a screenshot of a phone screen with text';
const CAPTURE_PENALTY = 0.5;

export function awayFromCaptures(query: Float32Array, capture: Float32Array): Float32Array {
  return query.map((value, i) => value - CAPTURE_PENALTY * (capture[i] ?? 0));
}

/** Who asks for screenshots gets them. */
export const wantsCaptures = (text: string) => /capture|screenshot|[ée]cran|screen/i.test(text);

export interface VectorTable {
  ids: readonly string[];
  /** `ids.length` vectors, one after the other. */
  bytes: Int8Array;
}

/** The ids of the `limit` vectors closest to the query, closest first, among `among`. */
export function closest(
  table: VectorTable,
  query: Float32Array,
  among: ReadonlySet<string>,
  limit: number,
): string[] {
  const dimensions = query.length;
  const found: { id: string; score: number }[] = [];
  table.ids.forEach((id, row) => {
    if (!among.has(id)) return;
    let score = 0;
    const start = row * dimensions;
    for (let d = 0; d < dimensions; d++) score += (table.bytes[start + d] ?? 0) * (query[d] ?? 0);
    found.push({ id, score });
  });
  return found
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((hit) => hit.id);
}
