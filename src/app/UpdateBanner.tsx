import { useState } from 'react';
import common from '../ui/common.module.css';
import styles from './UpdateBanner.module.css';
import { applyUpdate, useUpdateState } from './updates.ts';

/** Offers to load a newer version once it is downloaded; never reloads by itself. */
export function UpdateBanner() {
  const { status } = useUpdateState();
  const [dismissed, setDismissed] = useState(false);
  if (status !== 'ready' || dismissed) return null;

  return (
    <div className={styles.banner} role="status">
      <span className={styles.text}>Nouvelle version disponible</span>
      <button type="button" className={common.button} onClick={applyUpdate}>
        Mettre à jour
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
