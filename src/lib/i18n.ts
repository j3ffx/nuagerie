/**
 * The language of the interface: French or English, the device's by default,
 * or the one chosen in Réglages → Apparence (per device, not synced).
 *
 * It is settled once, as the app starts: texts are picked at module load
 * (`localized`) and formatters are built for it, so changing it reloads the
 * page. Each file keeps its own texts next to the code that shows them; the
 * English ones must have the same shape as the French ones, so a missing
 * text does not compile.
 */

export type Language = 'fr' | 'en';
export type LanguagePreference = 'auto' | Language;

export const LANGUAGES: readonly Language[] = ['fr', 'en'];
/** Under the key of src/lib/persistent.ts (read here without it: the service worker uses this file). */
export const LANGUAGE_KEY = 'language';

function storedPreference(): LanguagePreference {
  try {
    // No localStorage in the service worker: the device's language there.
    const storage = (globalThis as { localStorage?: { getItem(key: string): string | null } })
      .localStorage;
    const raw = storage?.getItem(`nuagerie.${LANGUAGE_KEY}`);
    const value: unknown = raw ? JSON.parse(raw) : 'auto';
    return value === 'fr' || value === 'en' ? value : 'auto';
  } catch {
    return 'auto';
  }
}

/** The device's languages, most wanted first ("fr-FR", "en-GB"…). */
export function deviceLanguages(): readonly string[] {
  const nav = (globalThis as { navigator?: { language: string; languages: readonly string[] } })
    .navigator;
  if (!nav) return [];
  return nav.languages.length > 0 ? nav.languages : [nav.language];
}

/** The language to show: the chosen one, else the first of the device's we have, else English. */
export function resolveLanguage(
  preference: LanguagePreference,
  wanted: readonly string[],
): Language {
  if (preference !== 'auto') return preference;
  for (const tag of wanted) {
    const base = tag.toLowerCase().split('-')[0];
    if (base === 'fr' || base === 'en') return base;
  }
  return 'en';
}

/**
 * The locale for dates and numbers: the device's own variant of the language
 * ("en-GB" writes 06/10/2026, "en-US" 10/06/2026), else a common one.
 */
export function resolveLocale(language: Language, wanted: readonly string[]): string {
  const own = wanted.find((tag) => tag.toLowerCase().split('-')[0] === language);
  if (own) {
    try {
      return Intl.getCanonicalLocales(own)[0] ?? own;
    } catch {
      // An invalid tag: the common one below.
    }
  }
  return language === 'fr' ? 'fr-FR' : 'en-GB';
}

export const language: Language = resolveLanguage(storedPreference(), deviceLanguages());
export const locale: string = resolveLocale(language, deviceLanguages());

/** The shape of a set of texts, without the French literals: strings, functions, lists, groups. */
export type Texts<T> = T extends string
  ? string
  : T extends (...args: infer A) => string
    ? (...args: A) => string
    : T extends readonly (infer E)[]
      ? readonly Texts<E>[]
      : { readonly [K in keyof T]: Texts<T[K]> };

/** The texts of the current language; the English ones must have the French ones' shape. */
export function localized<T>(texts: { fr: T; en: NoInfer<Texts<T>> }): Texts<T> {
  return texts[language] as Texts<T>;
}

const pluralRules = new Intl.PluralRules(locale);

/** "one" or "other" by the language's rule (French: 0 and 1 are singular; English: only 1). */
export function plural(count: number, one: string, other: string): string {
  return pluralRules.select(count) === 'one' ? one : other;
}
