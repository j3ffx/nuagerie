import { useMsal } from '@azure/msal-react';
import { signIn } from '../../auth/msal.ts';
import { enterDemoMode } from '../../data/mode.ts';
import common from '../../ui/common.module.css';
import { Logo } from '../../ui/Logo.tsx';
import styles from './SignInScreen.module.css';

/** OneDrive mode without a signed-in account. */
export function SignInScreen({ error }: { error: string | null }) {
  const { inProgress } = useMsal();
  const busy = inProgress !== 'none';

  return (
    <main className={styles.welcome}>
      <Logo size={96} />
      <h1 className={styles.title}>Bienvenue sur Nuagerie</h1>
      <p className={common.muted}>
        Les photos et vidéos de OneDrive, rangées par albums, par date et par lieu. Lecture seule :
        Nuagerie ne modifie jamais rien.
      </p>
      {error && (
        <p className={styles.error} role="alert">
          La connexion n’a pas abouti. Réessayer devrait suffire.
        </p>
      )}
      <div className={styles.actions}>
        <button
          type="button"
          className={common.button}
          onClick={() => void signIn()}
          disabled={busy}
        >
          Se connecter avec Microsoft
        </button>
        <button type="button" className={common.buttonSoft} onClick={enterDemoMode}>
          Essayer la démo
        </button>
      </div>
    </main>
  );
}
