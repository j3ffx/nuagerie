import { useState } from 'react';
import { syncPaused } from '../data/sync/permission.ts';
import { useSync } from '../data/sync/syncContext.ts';
import { localized } from '../lib/i18n.ts';
import { useOnline } from '../lib/online.ts';
import common from '../ui/common.module.css';
import { HeartIcon } from '../ui/icons.tsx';
import styles from './Banner.module.css';

const t = localized({
  fr: {
    hidden: 'Favoris cachés',
    paused: 'Synchro en pause',
    detail: 'Microsoft demande que tu te reconnectes.',
    reconnect: 'Reconnecter',
    hide: 'Masquer',
  },
  en: {
    hidden: 'Favourites hidden',
    paused: 'Sync paused',
    detail: 'Microsoft asks you to sign in again.',
    reconnect: 'Sign in',
    hide: 'Hide',
  },
});

/**
 * Microsoft no longer gives the sync's token without its page (a session that
 * ran out, a permission withdrawn): favourites are hidden until the user goes
 * through it again. Said here, not only in Réglages, so they do not just vanish.
 */
export function SyncPausedBanner() {
  const sync = useSync();
  const online = useOnline();
  const [dismissed, setDismissed] = useState(false);
  if (!syncPaused(sync) || dismissed) return null;

  return (
    <div className={styles.banner} role="status">
      <span className={styles.icon}>
        <HeartIcon width={20} height={20} />
      </span>
      <span className={styles.text}>
        <span className={styles.title}>{sync.storedFavorites.size > 0 ? t.hidden : t.paused}</span>
        <span className={styles.subtitle}>{t.detail}</span>
      </span>
      <button
        type="button"
        className={`${common.button} ${styles.action}`}
        disabled={!online}
        onClick={() => void sync.enable()}
      >
        {t.reconnect}
      </button>
      <button
        type="button"
        className={styles.close}
        onClick={() => setDismissed(true)}
        aria-label={t.hide}
      >
        ×
      </button>
    </div>
  );
}
