import type { ReactNode } from 'react';
import { Link } from 'wouter';
import { useData } from '../data/dataContext.ts';
import common from './common.module.css';
import styles from './ScreenHeader.module.css';
import { localized } from '../lib/i18n.ts';

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
  return (
    <header className={styles.header} data-screen-header>
      {leading}
      <h1 className={styles.title}>{title}</h1>
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
