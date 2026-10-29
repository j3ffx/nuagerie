import { deviceLanguages, language, LANGUAGE_KEY, resolveLanguage } from './i18n.ts';
import type { LanguagePreference } from './i18n.ts';
import { usePersistentState, writePersistent } from './persistent.ts';

const DEFAULT_PREFERENCE: LanguagePreference = 'auto';

/** The language chosen in Réglages → Apparence; another one starts the app again in it. */
export function useLanguagePreference(): [LanguagePreference, (next: LanguagePreference) => void] {
  const [preference] = usePersistentState<LanguagePreference>(LANGUAGE_KEY, DEFAULT_PREFERENCE);
  const choose = (next: LanguagePreference) => {
    if (next === preference) return;
    writePersistent(LANGUAGE_KEY, next);
    // Texts are picked as the app starts.
    if (resolveLanguage(next, deviceLanguages()) !== language) window.location.reload();
  };
  return [preference, choose];
}
