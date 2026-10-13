import { useEffect } from 'react';
import { readPersistent, usePersistentState } from './persistent.ts';

export type ThemePreference = 'auto' | 'light' | 'dark';

const THEME_KEY = 'theme';
const DEFAULT_THEME: ThemePreference = 'auto';
const THEME_COLORS = { light: '#f5f9ff', dark: '#0e1726' } as const;

export function useThemePreference() {
  return usePersistentState<ThemePreference>(THEME_KEY, DEFAULT_THEME);
}

/** Applies a theme preference to <html> and to the browser UI colour. */
function applyTheme(theme: ThemePreference): void {
  const root = document.documentElement;
  const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');

  if (theme === 'auto') {
    delete root.dataset.theme;
    metas.forEach((meta) => {
      const dark = meta.media.includes('dark');
      meta.content = dark ? THEME_COLORS.dark : THEME_COLORS.light;
    });
  } else {
    root.dataset.theme = theme;
    metas.forEach((meta) => (meta.content = THEME_COLORS[theme]));
  }
}

/**
 * The chosen theme from the very start: the screens shown before the app
 * (connecting, signing in) follow it too, not only the system's.
 */
export function applyStoredTheme(): void {
  applyTheme(readPersistent<ThemePreference>(THEME_KEY, DEFAULT_THEME));
}

/** Keeps <html> on the theme preference as it changes. */
export function useApplyTheme() {
  const [theme] = useThemePreference();
  useEffect(() => applyTheme(theme), [theme]);
}
