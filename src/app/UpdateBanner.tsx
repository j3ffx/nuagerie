import { useState } from 'react';
import common from '../ui/common.module.css';
import { Logo } from '../ui/Logo.tsx';
import styles from './Banner.module.css';
import { applyUpdate, useUpdateState } from './updates.ts';

/** Offers to load a newer version once it is downloaded; never reloads by itself. */
export function UpdateBanner() {
  const { status } = useUpdateState();
  const [dismissed, setDismissed] = useState(false);
  if (status !== 'ready' || dismissed) return null;

  return (
    <div className={styles.banner} role="status">
      <Logo size={32} />
      <span className={styles.text}>
        <span className={styles.title}>Nouvelle version</span>
        <span className={styles.subtitle}>disponible</span>
      </span>
      <button type="button" className={`${common.button} ${styles.action}`} onClick={applyUpdate}>
        Installer
      </button>
      <button
        type="button"
        className={styles.close}
        onClick={() => setDismissed(true)}
        aria-label="Plus tard"
      >
        ×
      </button>
    </div>
  );
}
