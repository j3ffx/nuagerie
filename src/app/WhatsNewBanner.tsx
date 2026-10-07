import { useLocation } from 'wouter';
import common from '../ui/common.module.css';
import { Logo } from '../ui/Logo.tsx';
import styles from './Banner.module.css';
import { useWhatsNew } from './whatsNew.ts';

/** After an update, offers once to see what the new version brings. */
export function WhatsNewBanner() {
  const { unseen, markSeen } = useWhatsNew();
  const [location, navigate] = useLocation();
  if (unseen.length === 0 || location === '/nouveautes') return null;

  return (
    <div className={styles.banner} role="status">
      <Logo size={32} />
      <span className={styles.text}>
        <span className={styles.title}>Nouveautés</span>
        <span className={styles.subtitle}>Version {__APP_VERSION__}</span>
      </span>
      <button
        type="button"
        className={`${common.button} ${styles.action}`}
        onClick={() => {
          markSeen();
          navigate(`/nouveautes?retour=${encodeURIComponent(location)}`);
        }}
      >
        Voir
      </button>
      <button type="button" className={styles.close} onClick={markSeen} aria-label="Plus tard">
        ×
      </button>
    </div>
  );
}
