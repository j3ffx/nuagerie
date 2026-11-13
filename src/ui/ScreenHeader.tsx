import { useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'wouter';
import { useData } from '../data/dataContext.ts';
import common from './common.module.css';
import styles from './ScreenHeader.module.css';
import { localized } from '../lib/i18n.ts';

const APP_NAME = 'Nuagerie';

const t = localized({
  fr: { syncing: 'Mise à jour…', demo: 'Démo', demoLabel: 'Mode démo : voir les réglages' },
  en: { syncing: 'Updating…', demo: 'Demo', demoLabel: 'Demo mode: see the settings' },
});

export function ScreenHeader({
  title,
  leading,
  actions,
}: {
  title: string;
  leading?: ReactNode;
  actions?: ReactNode;
}) {
  const { mode, sync } = useData();
  const heading = useRef<HTMLHeadingElement>(null);
  // Each screen its own title (tabs, history, screen readers), and the focus brought to it after a
  // navigation, unless something on the screen took it (the search field).
  useEffect(() => {
    document.title = title === APP_NAME ? APP_NAME : `${title} · ${APP_NAME}`;
  }, [title]);
  useEffect(() => {
    const active = document.activeElement;
    const lost = !active || active === document.body || active.closest('nav') !== null;
    if (lost) heading.current?.focus({ preventScroll: true });
  }, []);
  return (
    <header className={styles.header} data-screen-header>
      {leading}
      <h1 ref={heading} className={styles.title} tabIndex={-1}>
        {title}
      </h1>
      <div className={styles.actions}>
        {actions}
        {sync.status === 'running' && (
          <span className={styles.sync} role="status">
            {t.syncing}
          </span>
        )}
        {mode === 'demo' && (
          <Link href="/reglages" className={common.chip} aria-label={t.demoLabel}>
            {t.demo}
          </Link>
        )}
      </div>
    </header>
  );
}
