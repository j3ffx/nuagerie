import { useEffect } from 'react';
import { MANAGE_CONSENT_URL } from '../../auth/msal.ts';
import { localized } from '../../lib/i18n.ts';
import { REPOSITORY_URL } from '../../lib/report.ts';
import common from '../../ui/common.module.css';
import { Logo } from '../../ui/Logo.tsx';
import styles from './PrivacyScreen.module.css';
import { PRIVACY_TEXT, PRIVACY_UPDATED as UPDATED } from './privacyText.ts';

/** Where the page is served: the address given to Microsoft as the app's privacy statement. */
export const PRIVACY_PATH = '/confidentialite';

interface Part {
  title: string;
  paragraphs: readonly string[];
}

const t = localized(PRIVACY_TEXT);

/**
 * What the app does with the user's data, readable without signing in (it is
 * the privacy statement given to Microsoft): served on its own by main.tsx.
 */
export function PrivacyScreen() {
  const parts: readonly Part[] = t.parts;
  useEffect(() => {
    document.title = `${t.title} · Nuagerie`;
    // A page of its own for search engines, not a copy of the home page.
    document
      .querySelector('link[rel="canonical"]')
      ?.setAttribute('href', `https://nuagerie.app${PRIVACY_PATH}`);
  }, []);
  return (
    <main className={styles.privacy}>
      <header className={styles.header}>
        <Logo size={48} />
        <h1 className={styles.title}>{t.title}</h1>
      </header>
      <p>{t.intro}</p>
      {parts.map((part) => (
        <section key={part.title} className={common.section}>
          <h2 className={common.sectionTitle}>{part.title}</h2>
          <div className={`${common.card} ${common.stack}`}>
            {part.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </section>
      ))}
      <div className={common.stack}>
        <a href={MANAGE_CONSENT_URL} target="_blank" rel="noreferrer" className={common.buttonSoft}>
          {t.manage}
        </a>
        <a href={REPOSITORY_URL} target="_blank" rel="noreferrer" className={common.buttonSoft}>
          {t.source}
        </a>
        <a href="/" className={common.button}>
          {t.back}
        </a>
      </div>
      <p className={common.muted}>{t.updated(UPDATED)}</p>
    </main>
  );
}
