import { describe, expect, it } from 'vitest';
import { privacyHtml } from './privacyHtml.ts';
import { PRIVACY_TEXT } from './privacyText.ts';

describe('privacyHtml', () => {
  const html = privacyHtml();

  it('holds the whole statement, in both languages', () => {
    for (const language of ['fr', 'en'] as const) {
      const t = PRIVACY_TEXT[language];
      expect(html).toContain(`<article lang="${language}">`);
      for (const part of t.parts) expect(html).toContain(part.title);
    }
  });

  it('escapes what would be read as markup', () => {
    expect(html).not.toMatch(/<(?!\/?(article|h1|h2|p)\b)/);
  });
});
