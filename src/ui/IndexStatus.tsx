import { useData } from '../data/dataContext.ts';
import { formatCount } from '../lib/format.ts';
import { Logo } from './Logo.tsx';
import styles from './IndexStatus.module.css';

/** Loading and error states of the index, shown at the top of data screens. */
export function IndexStatus() {
  const { state, mode } = useData();

  if (state.status === 'loading') {
    const { progress } = state;
    return (
      <div className={styles.status} role="status">
        <span className={styles.cloud}>
          <Logo size={56} />
        </span>
        <p className={styles.title}>
          {mode === 'demo'
            ? 'Préparation de la démo…'
            : progress
              ? 'Indexation de OneDrive…'
              : 'Chargement des photos…'}
        </p>
        {progress && (
          <p className={styles.detail}>
            {formatCount(progress.loaded)}
            {progress.total !== null && ` / ~${formatCount(progress.total)}`} éléments
          </p>
        )}
        {progress && mode === 'onedrive' && (
          <p className={styles.detail}>
            Une seule fois : les prochains démarrages seront immédiats.
          </p>
        )}
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className={styles.status} role="alert">
        <p className={styles.title}>Impossible de charger les photos.</p>
        <p className={styles.detail}>{state.message}</p>
      </div>
    );
  }

  return null;
}
