import { useData } from '../data/dataContext.ts';
import { formatCount } from '../lib/format.ts';
import { Logo } from './Logo.tsx';
import styles from './IndexStatus.module.css';
import { localized, plural } from '../lib/i18n.ts';

const t = localized({
  fr: {
    demo: 'Préparation de la démo…',
    indexing: 'Indexation de OneDrive…',
    loading: 'Chargement des photos…',
    items: (count: number) => plural(count, 'élément', 'éléments'),
    once: 'Une seule fois : les prochains démarrages seront immédiats.',
    failed: 'Impossible de charger les photos.',
  },
  en: {
    demo: 'Preparing the demo…',
    indexing: 'Indexing OneDrive…',
    loading: 'Loading the photos…',
    items: (count: number) => plural(count, 'item', 'items'),
    once: 'Only once: the next starts will be immediate.',
    failed: 'Could not load the photos.',
  },
});

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
          {mode === 'demo' ? t.demo : progress ? t.indexing : t.loading}
        </p>
        {progress && (
          <p className={styles.detail}>
            {formatCount(progress.loaded)}
            {progress.total !== null && ` / ~${formatCount(progress.total)}`}{' '}
            {t.items(progress.total ?? progress.loaded)}
          </p>
        )}
        {progress && mode === 'onedrive' && <p className={styles.detail}>{t.once}</p>}
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className={styles.status} role="alert">
        <p className={styles.title}>{t.failed}</p>
        <p className={styles.detail}>{state.message}</p>
      </div>
    );
  }

  return null;
}
