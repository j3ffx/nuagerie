import { PRIVACY_TEXT, PRIVACY_UPDATED } from './privacyText.ts';

/**
 * The privacy statement as plain HTML, in French then English, for the page the build writes
 * at /confidentialite (build/static-pages.ts): a crawler, an AI assistant or any tool that
 * reads the page without running its scripts reads the whole statement there.
 * No imports beyond the texts: Node loads this file on its own at build time.
 */
const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function privacyHtml(): string {
  return (['fr', 'en'] as const)
    .map((language) => {
      const t = PRIVACY_TEXT[language];
      const parts = t.parts
        .map(
          (part) =>
            `<h2>${escape(part.title)}</h2>\n${part.paragraphs.map((p) => `<p>${escape(p)}</p>`).join('\n')}`,
        )
        .join('\n');
      return `<article lang="${language}">\n<h1>${escape(t.title)}</h1>\n<p>${escape(t.intro)}</p>\n${parts}\n<p>${escape(t.updated(PRIVACY_UPDATED))}</p>\n</article>`;
    })
    .join('\n');
}

/** The description given to search engines and link previews. */
export const privacyDescription = (): string => PRIVACY_TEXT.fr.intro;
