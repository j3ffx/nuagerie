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
  const { mode } = useData();
  return (
    <header className={styles.header}>
      {leading}
      <h1 className={styles.title}>{title}</h1>
      <div className={styles.actions}>
        {actions}
        {mode === 'demo' && (
          <Link href="/reglages" className={common.chip} aria-label="Mode démo : voir les réglages">
            Démo
          </Link>
        )}
      </div>
    </header>
  );
}
