import { enterDemoMode } from '../../data/mode.ts';
import common from '../../ui/common.module.css';
import { Logo } from '../../ui/Logo.tsx';
import styles from './WelcomeScreen.module.css';

/** Shown in OneDrive mode until sign-in exists. */
export function WelcomeScreen() {
  return (
    <main className={styles.welcome}>
      <Logo size={96} />
      <h1 className={styles.title}>Bienvenue sur Nuagerie</h1>
      <p className={common.muted}>
        La connexion à OneDrive arrive bientôt. En attendant, la démo permet de tout essayer avec
        des photos factices.
      </p>
      <button type="button" className={common.button} onClick={enterDemoMode}>
        Essayer la démo
      </button>
    </main>
  );
}
