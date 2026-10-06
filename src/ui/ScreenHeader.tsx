import type { ReactNode } from 'react';
import { Link } from 'wouter';
import { useData } from '../data/dataContext.ts';
import common from './common.module.css';
import styles from './ScreenHeader.module.css';

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
            Mise à jour…
          </span>
        )}
        {mode === 'demo' && (
          <Link href="/reglages" className={common.chip} aria-label="Mode démo : voir les réglages">
            Démo
          </Link>
        )}
      </div>
    </header>
  );
}
