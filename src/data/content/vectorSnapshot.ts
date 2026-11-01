import type { AppFolderWriter, GraphClient } from '../graph/client.ts';
import { MODEL_ID, type EngineDevice } from './engine.ts';
import { DIMENSIONS, type VectorTable } from './rank.ts';

/**
 * The vectors, left in the app folder (Apps/Nuagerie) with the sync: the device
 * that analysed the photos (a computer) hands them to the others (a phone),
 * which then only need the model's text side.
 */
export const VECTORS_FILE = 'vectors.bin.gz';

/** Vectors, and where they were computed: see `ContentDeps.readDevice`. */
export type SharedVectors = VectorTable & { device: EngineDevice };

export interface VectorSnapshots {
  /** The copy another device left, or null (none, not allowed here, unreadable, other model). */
  load(): Promise<SharedVectors | null>;
  /** Leaves a copy; false when this device may not write it (sync off). */
  save(table: VectorTable, device: EngineDevice): Promise<boolean>;
}

interface Header {
  schema: 1;
  model: string;
  dimensions: number;
  device: EngineDevice;
  ids: readonly string[];
}

/** The header's length (4 bytes), the header in JSON, then the vectors; gzipped. */
export async function encodeVectors(table: VectorTable, device: EngineDevice): Promise<Blob> {
  const header: Header = {
    schema: 1,
    model: MODEL_ID,
    dimensions: DIMENSIONS,
    device,
    ids: table.ids,
  };
  const json = new TextEncoder().encode(JSON.stringify(header));
  const length = new Uint8Array(4);
  new DataView(length.buffer).setUint32(0, json.length, true);
  const stream = new Blob([length, json, new Uint8Array(table.bytes)])
    .stream()
    .pipeThrough(new CompressionStream('gzip'));
  return new Response(stream).blob();
}

export async function decodeVectors(
  body: ReadableStream<BufferSource>,
): Promise<SharedVectors | null> {
  const stream = body.pipeThrough(new DecompressionStream('gzip'));
  const data = new Uint8Array(await new Response(stream).arrayBuffer());
  const length = new DataView(data.buffer).getUint32(0, true);
  const header = JSON.parse(new TextDecoder().decode(data.subarray(4, 4 + length))) as Header;
  const bytes = new Int8Array(data.buffer, 4 + length);
  const usable =
    header.schema === 1 &&
    header.model === MODEL_ID &&
    header.dimensions === DIMENSIONS &&
    (header.device === 'webgpu' || header.device === 'wasm') &&
    Array.isArray(header.ids) &&
    bytes.length === header.ids.length * DIMENSIONS;
  return usable ? { ids: header.ids, bytes, device: header.device } : null;
}

/** `may` tells, at each call, whether this device may read or write the copy (its sync choices). */
export function createVectorSnapshots(
  client: GraphClient & AppFolderWriter,
  may: { load: () => boolean; save: () => boolean },
  download: typeof fetch = (input, init) => fetch(input, init),
): VectorSnapshots {
  return {
    async load() {
      if (!may.load()) return null;
      try {
        const item = await client.getJson<{ '@microsoft.graph.downloadUrl'?: string }>(
          `/me/drive/special/approot:/${VECTORS_FILE}`,
        );
        const url = item['@microsoft.graph.downloadUrl'];
        if (!url) return null;
        const response = await download(url, { credentials: 'omit', cache: 'no-store' });
        if (!response.ok || !response.body) return null;
        return await decodeVectors(response.body);
      } catch {
        // No copy yet (404), no permission, or a damaged file: this device analyses instead.
        return null;
      }
    },

    async save(table, device) {
      if (!may.save()) return false;
      await client.putAppFile(VECTORS_FILE, await encodeVectors(table, device), {
        overwrite: true,
        contentType: 'application/gzip',
      });
      return true;
    },
  };
}
