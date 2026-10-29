import { useState } from 'react';
import { UNREACHABLE_MESSAGE, useSignIn } from '../auth/useSignIn.ts';
import { useData } from '../data/dataContext.ts';
import { useOnline } from '../lib/online.ts';
import common from '../ui/common.module.css';
import { CloudOffIcon } from '../ui/icons.tsx';
import { Logo } from '../ui/Logo.tsx';
import styles from './Banner.module.css';
import { localized } from '../lib/i18n.ts';

const t = localized({
  fr: {
    stale: 'Pas à jour',
    offline: 'Hors connexion',
    fromDevice: 'Photos de cet appareil',
    noMap: 'La carte n’a pas de fond',
    seenOnly: 'Photos déjà vues seulement',
    connecting: 'Connexion…',
    retry: 'Réessayer',
    signIn: 'Se connecter',
    hide: 'Masquer',
  },
  en: {
    stale: 'Not up to date',
    offline: 'Offline',
    fromDevice: 'Photos on this device',
    noMap: 'The map has no background',
    seenOnly: 'Photos already seen only',
    connecting: 'Connecting…',
    retry: 'Try again',
    signIn: 'Sign in',
    hide: 'Hide',
  },
});

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
        <span className={styles.title}>{online ? t.stale : t.offline}</span>
        <span className={styles.subtitle}>
          {online
            ? unreachable
              ? UNREACHABLE_MESSAGE.replace(/\.$/, '')
              : t.fromDevice
            : mode === 'demo'
              ? t.noMap
              : t.seenOnly}
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
          {checking ? t.connecting : unreachable ? t.retry : t.signIn}
        </button>
      )}
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
