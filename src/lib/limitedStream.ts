/** A stream that fails once more than `maxBytes` came through it: a file can be read whole safely. */
export function limitedTo(maxBytes: number): TransformStream<Uint8Array, Uint8Array> {
  let total = 0;
  return new TransformStream({
    transform(chunk, controller) {
      total += chunk.byteLength;
      if (total > maxBytes) throw new Error(`More than ${maxBytes} bytes`);
      controller.enqueue(chunk);
    },
  });
}

/** Unzips a gzip stream, refusing what would unpack to more than `maxBytes` (a gzip bomb). */
export function gunzipAtMost(
  body: ReadableStream<BufferSource>,
  maxBytes: number,
): ReadableStream<Uint8Array> {
  return body.pipeThrough(new DecompressionStream('gzip')).pipeThrough(limitedTo(maxBytes));
}
