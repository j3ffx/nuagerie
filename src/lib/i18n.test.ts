import { afterEach, describe, expect, it, vi } from 'vitest';
import { language, localized, plural, resolveLanguage, resolveLocale } from './i18n.ts';

describe('resolveLanguage', () => {
  it('follows the device: the first language we have', () => {
    expect(resolveLanguage('auto', ['fr-FR', 'en-US'])).toBe('fr');
    expect(resolveLanguage('auto', ['fr-CA'])).toBe('fr');
    expect(resolveLanguage('auto', ['de-DE', 'en-GB', 'fr-FR'])).toBe('en');
    expect(resolveLanguage('auto', ['EN-us'])).toBe('en');
  });

  it('speaks English to everyone else', () => {
    expect(resolveLanguage('auto', ['de-DE', 'es-ES'])).toBe('en');
    expect(resolveLanguage('auto', [])).toBe('en');
  });

  it('keeps the chosen language, whatever the device says', () => {
    expect(resolveLanguage('en', ['fr-FR'])).toBe('en');
    expect(resolveLanguage('fr', ['en-US'])).toBe('fr');
  });
});

describe('resolveLocale', () => {
  it('takes the device’s own variant of the language', () => {
    expect(resolveLocale('en', ['fr-FR', 'en-US'])).toBe('en-US');
    expect(resolveLocale('fr', ['fr-CA'])).toBe('fr-CA');
  });

  it('else a common one', () => {
    expect(resolveLocale('en', ['fr-FR'])).toBe('en-GB');
    expect(resolveLocale('fr', ['en-US'])).toBe('fr-FR');
  });
});

describe('in French (the tests’ language)', () => {
  it('picks the French texts', () => {
    expect(language).toBe('fr');
    expect(localized({ fr: 'Albums', en: 'Albums!' })).toBe('Albums');
  });

  it('refuses English texts that miss one, or take other arguments (at compile time)', () => {
    // @ts-expect-error: "settings" is missing in English.
    localized({ fr: { albums: 'Albums', settings: 'Réglages' }, en: { albums: 'Albums' } });
    localized({
      fr: { count: (n: number) => `${n} photos` },
      // @ts-expect-error: a text taking a string where the French one takes a number.
      en: { count: (n: string) => `${n} photos` },
    });
    expect(true).toBe(true);
  });

  it('counts 0 and 1 as singular', () => {
    expect(plural(0, 'photo', 'photos')).toBe('photo');
    expect(plural(1, 'photo', 'photos')).toBe('photo');
    expect(plural(2, 'photo', 'photos')).toBe('photos');
  });
});

describe('in English', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('picks the English texts, and counts only 1 as singular', async () => {
    vi.stubGlobal('navigator', { language: 'en-US', languages: ['en-US'] });
    vi.resetModules();
    const i18n = await import('./i18n.ts');
    expect(i18n.language).toBe('en');
    expect(i18n.locale).toBe('en-US');
    expect(i18n.localized({ fr: 'Réglages', en: 'Settings' })).toBe('Settings');
    expect(i18n.plural(0, 'photo', 'photos')).toBe('photos');
    expect(i18n.plural(1, 'photo', 'photos')).toBe('photo');
  });
});
