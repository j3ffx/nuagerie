/// <reference types="vitest/config" />
import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { lanQrCode } from './build/lan-qr.ts';

export default defineConfig(({ mode }) => {
  const lan = mode === 'lan';
  const commit = process.env.CF_PAGES_COMMIT_SHA ?? process.env.GITHUB_SHA ?? '';

  return {
    plugins: [react(), lan && basicSsl({ name: 'nuagerie-dev' }), lan && lanQrCode()],
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
      __APP_COMMIT__: JSON.stringify(commit.slice(0, 7)),
    },
    server: {
      host: lan ? true : 'localhost',
      port: 5173,
      strictPort: true,
    },
    test: {
      include: ['src/**/*.test.ts'],
      environment: 'node',
    },
  };
});
