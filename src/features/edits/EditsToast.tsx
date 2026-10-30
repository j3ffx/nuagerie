import { useEffect } from 'react';
import styles from '../../app/Banner.module.css';
import { localized } from '../../lib/i18n.ts';
import common from '../../ui/common.module.css';
import { useEdits } from './editsContext.ts';
import layer from './EditsToast.module.css';

const t = localized({
  fr: {
    delete: 'Suppression…',
    move: 'Déplacement…',
    restore: 'Remise en place…',
    undo: 'Annuler',
    hide: 'Masquer',
  },
  en: {
    delete: 'Deleting…',
    move: 'Moving…',
    restore: 'Putting back…',
    undo: 'Undo',
    hide: 'Hide',
  },
});

/** Long enough to read it and change one's mind, short enough not to linger. */
const NOTICE_MS = 8000;

/**
 * At the bottom of the screen: the progress of a change under way, then what
 * it did, with "Annuler" for a few seconds.
 */
export function EditsToast() {
  return (
    <div className={layer.layer}>
      <EditsToastContent />
    </div>
  );
}

function EditsToastContent() {
  const { progress, notice, dismissNotice } = useEdits();

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(dismissNotice, NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [notice, dismissNotice]);

  if (progress) {
    return (
      <div className={styles.banner} role="status">
        <span className={styles.text}>
          <span className={styles.title}>{t[progress.action]}</span>
          <span className={styles.subtitle}>
            {progress.done} / {progress.total}
          </span>
        </span>
      </div>
    );
  }
  if (!notice) return null;

  return (
    <div className={styles.banner} role="status" key={notice.id}>
      <span className={styles.text}>
        <span className={styles.message}>{notice.message}</span>
      </span>
      {notice.undo && (
        <button
          type="button"
          className={`${common.buttonSoft} ${styles.action}`}
          onClick={() => {
            const undo = notice.undo;
            dismissNotice();
            undo?.();
          }}
        >
          {t.undo}
        </button>
      )}
      <button type="button" className={styles.close} onClick={dismissNotice} aria-label={t.hide}>
        ×
      </button>
    </div>
  );
}
