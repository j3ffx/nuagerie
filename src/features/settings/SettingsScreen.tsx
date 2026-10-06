import { useThemePreference, type ThemePreference } from '../../lib/theme.ts';
import common from '../../ui/common.module.css';
import { ScreenHeader } from '../../ui/ScreenHeader.tsx';

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: 'auto', label: 'Automatique' },
  { value: 'light', label: 'Clair' },
  { value: 'dark', label: 'Sombre' },
];

export function SettingsScreen() {
  const [theme, setTheme] = useThemePreference();

  return (
    <>
      <ScreenHeader title="Réglages" />
      <div className={common.page}>
        <section className={common.section} aria-labelledby="settings-appearance">
          <h2 id="settings-appearance" className={common.sectionTitle}>
            Apparence
          </h2>
          <div className={common.card}>
            <fieldset className={common.segmented}>
              <legend className="visually-hidden">Thème</legend>
              {THEMES.map(({ value, label }) => (
                <label key={value}>
                  <input
                    type="radio"
                    name="theme"
                    value={value}
                    checked={theme === value}
                    onChange={() => setTheme(value)}
                  />
                  {label}
                </label>
              ))}
            </fieldset>
          </div>
        </section>

        <section className={common.section} aria-labelledby="settings-about">
          <h2 id="settings-about" className={common.sectionTitle}>
            À propos
          </h2>
          <div className={common.card}>
            <dl className={common.definitionList}>
              <dt>Version</dt>
              <dd>
                {__APP_VERSION__}
                {__APP_COMMIT__ && ` (${__APP_COMMIT__})`}
              </dd>
            </dl>
          </div>
        </section>
      </div>
    </>
  );
}
