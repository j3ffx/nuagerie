import { describe, expect, it } from 'vitest';
import { gunzipAtMost } from './limitedStream.ts';

const gzipped = (bytes: Uint8Array) =>
  new Blob([new Uint8Array(bytes)]).stream().pipeThrough(new CompressionStream('gzip'));

describe('gunzipAtMost', () => {
  it('unpacks what stays under the limit', async () => {
    const text = await new Response(
      gunzipAtMost(gzipped(new Uint8Array(1000)), 1000),
    ).arrayBuffer();
    expect(text.byteLength).toBe(1000);
  });

  it('refuses what would unpack to more, however small it is packed', async () => {
    // A megabyte of zeros packs into about a kilobyte.
    const bomb = gzipped(new Uint8Array(1024 * 1024));
    await expect(new Response(gunzipAtMost(bomb, 64 * 1024)).arrayBuffer()).rejects.toThrow();
  });
});
