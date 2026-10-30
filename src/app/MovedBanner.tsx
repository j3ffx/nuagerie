import { useState } from 'react';
import { localized } from '../lib/i18n.ts';
import common from '../ui/common.module.css';
import { Logo } from '../ui/Logo.tsx';
import styles from './Banner.module.css';
import { newHome } from './home.ts';

const t = localized({
  fr: {
    title: (host: string) => `Nuagerie a déménagé : ${host}`,
    detail: 'Installe-la depuis là-bas. Ici, tes photos restent jusqu’à ta déconnexion.',
    open: 'Ouvrir',
    later: 'Plus tard',
  },
  en: {
    title: (host: string) => `Nuagerie has moved: ${host}`,
    detail: 'Install it from there. Here, your photos stay until you sign out.',
    open: 'Open',
    later: 'Later',
  },
});

/**
 * At the first address, for whoever has data here (src/app/home.ts): where the
 * app now lives. Whoever has none was sent there as the app started.
 */
export function MovedBanner() {
  const [dismissed, setDismissed] = useState(false);
  const to = newHome();
  if (!to || dismissed) return null;

  return (
    <div className={styles.banner} role="status">
      <Logo size={32} />
      <span className={styles.text}>
        <span className={styles.title}>{t.title(new URL(to).host)}</span>
        <span className={styles.subtitle}>{t.detail}</span>
      </span>
      <a href={to} className={`${common.button} ${styles.action}`}>
        {t.open}
      </a>
      <button
        type="button"
        className={styles.close}
        onClick={() => setDismissed(true)}
        aria-label={t.later}
      >
        ×
      </button>
    </div>
  );
}
