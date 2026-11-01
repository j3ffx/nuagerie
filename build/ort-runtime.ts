import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import type { Plugin } from 'vite';

/**
 * The model's runtime (src/data/content/engine.worker.ts), served by the site. Its WebAssembly
 * file is above the 25 MiB a Cloudflare Pages file may weigh, and under it once gzipped: the
 * worker unpacks it. Not precached: only who turns the search on downloads it.
 */
const NAME = 'ort-wasm-simd-threaded.asyncify';
const PACKAGE = join(process.cwd(), 'node_modules/onnxruntime-web');

function runtimeFiles() {
  const { version } = JSON.parse(readFileSync(join(PACKAGE, 'package.json'), 'utf8')) as {
    version: string;
  };
  const dist = join(PACKAGE, 'dist');
  return {
    version,
    glue: () => readFileSync(join(dist, `${NAME}.mjs`)),
    wasm: () => gzipSync(readFileSync(join(dist, `${NAME}.wasm`)), { level: 9 }),
  };
}

export function ortRuntimeUrls() {
  const { version } = runtimeFiles();
  return {
    glue: `/assets/ort-${version}.mjs`,
    wasm: `/assets/ort-${version}.wasm.gz`,
    /** The runtime's own bundle without its files inside: it would drag the big one along. */
    entry: join(PACKAGE, 'dist/ort.webgpu.min.mjs'),
  };
}

export function ortRuntime(): Plugin {
  const files = runtimeFiles();
  const urls = ortRuntimeUrls();
  return {
    name: 'nuagerie-ort-runtime',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const path = request.url?.split('?')[0];
        const body =
          path === urls.glue
            ? { type: 'text/javascript', data: files.glue() }
            : path === urls.wasm
              ? { type: 'application/octet-stream', data: files.wasm() }
              : null;
        if (!body) return next();
        response.setHeader('Content-Type', body.type);
        response.end(body.data);
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: urls.glue.slice(1), source: files.glue() });
      this.emitFile({ type: 'asset', fileName: urls.wasm.slice(1), source: files.wasm() });
    },
  };
}
