import { useState } from 'react';
import { UNREACHABLE_MESSAGE, useSignIn } from '../auth/useSignIn.ts';
import { useData } from '../data/dataContext.ts';
import { useOnline } from '../lib/online.ts';
import common from '../ui/common.module.css';
import { CloudOffIcon } from '../ui/icons.tsx';
import { Logo } from '../ui/Logo.tsx';
import styles from './Banner.module.css';

/**
 * Says when the device is offline (only the thumbnails kept on the device
 * show), and after an offline start (or one where Microsoft could not be
 * reached) offers to sign in again so the index can be updated: only when
 * Microsoft answers, or its page would never load.
 */
export function ConnectionBanner() {
  const online = useOnline();
  const { mode, signedIn } = useData();
  // Dismissed until the connection changes: going offline again shows it again.
  const [dismissed, setDismissed] = useState(false);
  const [shownFor, setShownFor] = useState(online);
  const { start, checking, unreachable, forget } = useSignIn();
  if (shownFor !== online) {
    setShownFor(online);
    setDismissed(false);
    forget();
  }
  const reconnect = online && mode === 'onedrive' && !signedIn;
  if ((online && !reconnect) || dismissed) return null;

  return (
    <div className={styles.banner} role="status">
      {online ? (
        <Logo size={32} />
      ) : (
        <span className={styles.icon}>
          <CloudOffIcon width={20} height={20} />
        </span>
      )}
      <span className={styles.text}>
        <span className={styles.title}>{online ? 'Pas à jour' : 'Hors connexion'}</span>
        <span className={styles.subtitle}>
          {online
            ? unreachable
              ? UNREACHABLE_MESSAGE.replace(/\.$/, '')
              : 'Photos de cet appareil'
            : mode === 'demo'
              ? 'La carte n’a pas de fond'
              : 'Photos déjà vues seulement'}
        </span>
      </span>
      {reconnect && (
        <button
          type="button"
          className={`${common.button} ${styles.action}`}
          disabled={checking}
          aria-busy={checking}
          onClick={() => void start()}
        >
          {checking ? 'Connexion…' : unreachable ? 'Réessayer' : 'Se connecter'}
        </button>
      )}
      <button
        type="button"
        className={styles.close}
        onClick={() => setDismissed(true)}
        aria-label="Masquer"
      >
        ×
      </button>
    </div>
  );
}
