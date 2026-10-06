import type { ReactNode } from 'react';
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
  return (
    <header className={styles.header}>
      {leading}
      <h1 className={styles.title}>{title}</h1>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}
