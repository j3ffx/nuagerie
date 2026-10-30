import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { useData } from '../../data/dataContext.ts';
import { keptUntil, type TrashEntry } from '../../data/edits/trash.ts';
import { formatDateTime } from '../../lib/format.ts';
import { localized } from '../../lib/i18n.ts';
import { useOnline } from '../../lib/online.ts';
import common from '../../ui/common.module.css';
import { BackIcon } from '../../ui/icons.tsx';
import { ScreenHeader } from '../../ui/ScreenHeader.tsx';
import albumStyles from '../albums/AlbumScreen.module.css';
import { useEdits } from './editsContext.ts';
import styles from './TrashScreen.module.css';

const t = localized({
  fr: {
    title: 'Corbeille',
    back: 'Retour aux réglages',
    intro:
      'Les photos et vidéos supprimées depuis Nuagerie sur cet appareil. OneDrive les garde 30 jours dans sa corbeille (moins si elle est pleine), puis les efface pour de bon.',
    empty: 'Rien de supprimé depuis cet appareil ces 30 derniers jours.',
    list: 'Éléments supprimés',
    from: (album: string) => `De « ${album} »`,
    deleted: (date: string) => `Supprimé le ${date}`,
    until: (date: string) => `jusqu’au ${date} au plus tard`,
    restore: 'Restaurer',
    restoreAll: 'Tout restaurer',
    others:
      'Ce que tu supprimes ailleurs (sur le site ou l’appli OneDrive) n’est pas ici : ouvre la corbeille de OneDrive depuis son menu.',
    openOneDrive: 'Ouvrir OneDrive',
    off: 'Active les modifications (Réglages) pour restaurer.',
  },
  en: {
    title: 'Recycle bin',
    back: 'Back to the settings',
    intro:
      'The photos and videos deleted from Nuagerie on this device. OneDrive keeps them 30 days in its recycle bin (less when it is full), then erases them for good.',
    empty: 'Nothing deleted from this device in the last 30 days.',
    list: 'Deleted items',
    from: (album: string) => `From “${album}”`,
    deleted: (date: string) => `Deleted on ${date}`,
    until: (date: string) => `until ${date} at the latest`,
    restore: 'Restore',
    restoreAll: 'Restore all',
    others:
      'What you delete elsewhere (on the OneDrive website or app) is not here: open OneDrive’s recycle bin from its menu.',
    openOneDrive: 'Open OneDrive',
    off: 'Turn on the changes (Settings) to restore.',
  },
});

const ONEDRIVE_URL = 'https://onedrive.live.com/';

/** The thumbnail kept with an entry, released when it leaves the screen. */
function TrashThumbnail({ entry }: { entry: TrashEntry }) {
  const { trashThumbnail } = useEdits();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let current: string | null = null;
    let cancelled = false;
    void trashThumbnail(entry.id).then((found) => {
      if (cancelled) {
        if (found) URL.revokeObjectURL(found);
        return;
      }
      current = found;
      setUrl(found);
    });
    return () => {
      cancelled = true;
      if (current) URL.revokeObjectURL(current);
    };
  }, [entry.id, trashThumbnail]);
  return url ? (
    <img className={styles.thumbnail} src={url} alt="" />
  ) : (
    <span className={styles.thumbnail} aria-hidden="true" />
  );
}

/**
 * Réglages → Modifications → Corbeille: what the app put in OneDrive's
 * recycle bin, to bring back (Graph cannot list the bin itself).
 */
export function TrashScreen() {
  const edits = useEdits();
  const { mode } = useData();
  const online = useOnline();
  const canRestore = edits.usable && (mode === 'demo' || online);

  return (
    <>
      <ScreenHeader
        title={t.title}
        leading={
          <Link href="/reglages" className={albumStyles.back} aria-label={t.back}>
            <BackIcon />
          </Link>
        }
      />
      <div className={common.page}>
        <div className={common.stack}>
          <p className={common.muted}>{t.intro}</p>
          {edits.status === 'off' && edits.trash.length > 0 && (
            <p className={common.muted}>{t.off}</p>
          )}
          {edits.trash.length === 0 ? (
            <p className={common.card}>{t.empty}</p>
          ) : (
            <>
              {edits.trash.length > 1 && (
                <button
                  type="button"
                  className={common.buttonSoft}
                  disabled={!canRestore}
                  onClick={() => void edits.restore(edits.trash.map((entry) => entry.id))}
                >
                  {t.restoreAll}
                </button>
              )}
              <ul className={styles.list} aria-label={t.list}>
                {edits.trash.map((entry) => (
                  <li key={entry.id} className={styles.row}>
                    <TrashThumbnail entry={entry} />
                    <span className={styles.text}>
                      <span className={styles.name}>{entry.name}</span>
                      <span className={styles.meta}>{t.from(entry.albumName)}</span>
                      <span className={styles.meta}>
                        {t.deleted(formatDateTime(entry.deletedAt))},{' '}
                        {t.until(formatDateTime(keptUntil(entry)))}
                      </span>
                    </span>
                    <button
                      type="button"
                      className={`${common.buttonSoft} ${styles.restore}`}
                      disabled={!canRestore}
                      onClick={() => void edits.restore([entry.id])}
                      aria-label={`${t.restore} ${entry.name}`}
                    >
                      {t.restore}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {mode === 'onedrive' && (
            <>
              <p className={common.muted}>{t.others}</p>
              <a href={ONEDRIVE_URL} target="_blank" rel="noreferrer" className={common.buttonSoft}>
                {t.openOneDrive}
              </a>
            </>
          )}
        </div>
      </div>
    </>
  );
}
