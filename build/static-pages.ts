import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Plugin } from 'vite';

/**
 * The privacy statement as a page of its own, `confidentialite.html`, which Cloudflare Pages
 * serves at /confidentialite: the app's own page, with the statement already in it. Whatever
 * reads the page without running its scripts (a crawler, an AI assistant, Microsoft checking
 * the address given as the app's privacy statement) reads the statement; the app then renders
 * the same screen over it.
 */
export function staticPages(): Plugin {
  return {
    name: 'nuagerie-static-pages',
    apply: 'build',
    // After Vite wrote index.html into the bundle, with its scripts and styles.
    enforce: 'post',
    async generateBundle(_options, bundle) {
      const index = bundle['index.html'];
      if (index?.type !== 'asset' || typeof index.source !== 'string') return;
      // Loaded by Node itself (it reads TypeScript): the texts are the screen's own.
      const module = (await import(
        pathToFileURL(join(process.cwd(), 'src/features/privacy/privacyHtml.ts')).href
      )) as typeof import('../src/features/privacy/privacyHtml.ts');
      const html = replaceOnce(
        replaceOnce(
          replaceOnce(
            replaceOnce(
              index.source,
              '<title>Nuagerie</title>',
              '<title>Confidentialité · Nuagerie</title>',
            ),
            '<div id="root"></div>',
            `<div id="root">\n${module.privacyHtml()}\n</div>`,
          ),
          /(<meta\s+name="description"\s+content=")[^"]*(")/,
          `$1${module.privacyDescription()}$2`,
        ),
        /(<link rel="canonical" href=")[^"]*(")/,
        '$1https://nuagerie.app/confidentialite$2',
      ).replace(
        /(<meta property="og:url" content=")[^"]*(")/,
        '$1https://nuagerie.app/confidentialite$2',
      );
      this.emitFile({ type: 'asset', fileName: 'confidentialite.html', source: html });
    },
  };
}

/** Fails the build when the page changed shape, rather than writing a page without its text. */
function replaceOnce(text: string, pattern: string | RegExp, replacement: string): string {
  const found = typeof pattern === 'string' ? text.includes(pattern) : pattern.test(text);
  if (!found) throw new Error(`static-pages: ${String(pattern)} not found in index.html`);
  return text.replace(pattern, replacement);
}
