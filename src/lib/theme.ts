import { useEffect } from 'react';
import { usePersistentState } from './persistent.ts';

export type ThemePreference = 'auto' | 'light' | 'dark';

const THEME_KEY = 'theme';
const DEFAULT_THEME: ThemePreference = 'auto';
const THEME_COLORS = { light: '#f5f9ff', dark: '#0e1726' } as const;

export function useThemePreference() {
  return usePersistentState<ThemePreference>(THEME_KEY, DEFAULT_THEME);
}

/** Applies the theme preference to <html> and to the browser UI colour. */
export function useApplyTheme() {
  const [theme] = useThemePreference();

  useEffect(() => {
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
  }, [theme]);
}
