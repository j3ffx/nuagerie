import { useMsal } from '@azure/msal-react';
import { UNREACHABLE_MESSAGE, useSignIn } from '../../auth/useSignIn.ts';
import { enterDemoMode } from '../../data/mode.ts';
import { useOnline } from '../../lib/online.ts';
import common from '../../ui/common.module.css';
import { Logo } from '../../ui/Logo.tsx';
import { PRIVACY_PATH } from '../privacy/PrivacyScreen.tsx';
import banners from '../../app/Banner.module.css';
import { MovedBanner } from '../../app/MovedBanner.tsx';
import styles from './SignInScreen.module.css';
import { localized } from '../../lib/i18n.ts';

const t = localized({
  fr: {
    welcome: 'Bienvenue sur Nuagerie',
    pitch:
      'Les photos et vidéos de OneDrive, rangées par albums, par date et par lieu. Lecture seule : Nuagerie ne modifie jamais rien.',
    offline: 'Hors connexion : la connexion à Microsoft attend le réseau.',
    elsewhere: 'Réessaie sur un autre réseau, ou essaie la démo.',
    failed: 'La connexion n’a pas abouti. Réessayer devrait suffire.',
    connecting: 'Connexion…',
    signIn: 'Se connecter avec Microsoft',
    demo: 'Essayer la démo',
    privacy: 'Confidentialité',
    restoring: 'Connexion à OneDrive…',
  },
  en: {
    welcome: 'Welcome to Nuagerie',
    pitch:
      'Your OneDrive photos and videos, sorted by album, date and place. Read-only: Nuagerie never changes anything.',
    offline: 'Offline: signing in to Microsoft waits for the network.',
    elsewhere: 'Try again on another network, or try the demo.',
    failed: 'Signing in did not go through. Trying again should do.',
    connecting: 'Connecting…',
    signIn: 'Sign in with Microsoft',
    demo: 'Try the demo',
    privacy: 'Privacy',
    restoring: 'Connecting to OneDrive…',
  },
});

/** OneDrive mode without a signed-in account. */
export function SignInScreen({ error }: { error: string | null }) {
  const { inProgress } = useMsal();
  const online = useOnline();
  const signIn = useSignIn();
  const busy = inProgress !== 'none' || signIn.checking;

  return (
    <main className={styles.welcome}>
      <div className={banners.stack}>
        <MovedBanner />
      </div>
      <Logo size={96} />
      <h1 className={styles.title}>{t.welcome}</h1>
      <p className={common.muted}>{t.pitch}</p>
      {!online ? (
        <p className={styles.error} role="status">
          {t.offline}
        </p>
      ) : signIn.unreachable ? (
        <p className={styles.error} role="status">
          {UNREACHABLE_MESSAGE} {t.elsewhere}
        </p>
      ) : (
        error && (
          <p className={styles.error} role="alert">
            {t.failed}
          </p>
        )
      )}
      <div className={styles.actions}>
        <button
          type="button"
          className={common.button}
          onClick={() => void signIn.start()}
          disabled={busy || !online}
          aria-busy={signIn.checking}
        >
          {signIn.checking ? t.connecting : t.signIn}
        </button>
        <button type="button" className={common.buttonSoft} onClick={enterDemoMode}>
          {t.demo}
        </button>
      </div>
      <a href={PRIVACY_PATH} className={styles.privacy}>
        {t.privacy}
      </a>
    </main>
  );
}

/**
 * Shown while the session is restored, which may mean a hidden sign-in to
 * Microsoft (a few seconds). Appears only if it lasts, so a quick start
 * shows no flash.
 */
export function ConnectingScreen() {
  return (
    <main className={`${styles.welcome} ${styles.connecting}`}>
      <Logo size={96} />
      <p className={common.muted} role="status">
        {t.restoring}
      </p>
    </main>
  );
}
