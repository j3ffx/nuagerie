/// <reference types="vitest/config" />
import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { minimal2023Preset } from '@vite-pwa/assets-generator/config';
import { VitePWA } from 'vite-plugin-pwa';
import { lanQrCode } from './build/lan-qr.ts';
import { currentCommit, versionFile } from './build/version.ts';

export default defineConfig(({ mode }) => {
  const lan = mode === 'lan';
  const commit = currentCommit();
  const version = process.env.npm_package_version ?? '0.0.0';

  return {
    plugins: [
      react(),
      lan && basicSsl({ name: 'nuagerie-dev' }),
      lan && lanQrCode(),
      versionFile({ version, commit }),
      VitePWA({
        // Custom service worker: the thumbnail cache needs our own logic.
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        // A new version waits until the user chooses to load it (banner, settings).
        registerType: 'prompt',
        injectRegister: false,
        manifest: {
          id: '/',
          name: 'Nuagerie',
          short_name: 'Nuagerie',
          description: 'Les photos OneDrive, rangées par albums, par date et par lieu.',
          lang: 'fr',
          dir: 'ltr',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          background_color: '#f5f9ff',
          theme_color: '#f5f9ff',
          categories: ['photo'],
        },
        // Icons (PNG, maskable, apple-touch) are generated at build time from the SVG logo.
        pwaAssets: {
          image: 'public/logo.svg',
          // Full-bleed sky background behind the padded icons (Android masks, iOS),
          // instead of the default white.
          preset: {
            ...minimal2023Preset,
            maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#5aa7ee' } },
            apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#5aa7ee' } },
          },
          overrideManifestIcons: true,
          includeHtmlHeadLinks: true,
          injectThemeColor: false,
        },
        injectManifest: {
          // Latin subset of the font only; other subsets load on demand if ever needed.
          globPatterns: ['**/*.{js,css,html,svg,png,ico}', '**/*latin-wght-normal*.woff2'],
          globIgnores: ['**/*-ext-*.woff2'],
        },
        devOptions: { enabled: false },
      }),
    ],
    define: {
      __APP_VERSION__: JSON.stringify(version),
      __APP_COMMIT__: JSON.stringify(commit),
    },
    server: {
      host: lan ? true : 'localhost',
      port: 5173,
      strictPort: true,
    },
    preview: {
      port: 4173,
      strictPort: true,
    },
    test: {
      include: ['src/**/*.test.ts'],
      environment: 'node',
    },
  };
});
