/** Where the device keeps the model, and the runtime that runs it (src/sw.ts). */
export const MODEL_CACHE = 'nuagerie-content-model';
export const RUNTIME_CACHE = 'nuagerie-content-runtime';

/** Chrome refuses a Cache Storage entry above about 256 MiB: a big file is kept in pieces. */
const PIECE_BYTES = 64 * 1024 * 1024;

type Pieces = Pick<Cache, 'match' | 'put'>;

export async function keptFile(cache: Pieces, url: string): Promise<Uint8Array | null> {
  const marker = await cache.match(url);
  if (!marker) return null;
  const count = Number(await marker.text());
  const pieces: Blob[] = [];
  for (let i = 0; i < count; i++) {
    const piece = await cache.match(`${url}.${i}`);
    if (!piece) return null;
    pieces.push(await piece.blob());
  }
  return new Uint8Array(await new Blob(pieces).arrayBuffer());
}

export async function keepFile(
  cache: Pieces,
  url: string,
  file: Blob,
  pieceBytes = PIECE_BYTES,
): Promise<void> {
  const count = Math.ceil(file.size / pieceBytes);
  for (let i = 0; i < count; i++) {
    const piece = file.slice(i * pieceBytes, (i + 1) * pieceBytes);
    await cache.put(`${url}.${i}`, new Response(piece));
  }
  // Last: a file only counts as kept once every piece is there.
  await cache.put(url, new Response(String(count)));
}
