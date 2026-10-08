import { useEffect, useState } from 'react';
import { useData } from '../../data/dataContext.ts';
import type { MediaItem } from '../../data/model.ts';
import { useSync } from '../../data/sync/syncContext.ts';
import { formatBytes, formatCount } from '../../lib/format.ts';
import { useOnline } from '../../lib/online.ts';
import { useConfirm } from '../../ui/confirmContext.ts';
import { CloseIcon, DownloadIcon, HeartIcon, ShareIcon } from '../../ui/icons.tsx';
import { canShareFiles, shareableFile } from '../viewer/share.ts';
import { beyondShareLimit, SHARE_LIMIT, selectedLabel } from './selection.ts';
import styles from './SelectionBar.module.css';

type ShareState =
  | { status: 'idle' }
  | { status: 'preparing'; done: number; total: number }
  /** Downloaded, but the browser wants a fresh tap to open the share sheet. */
  | { status: 'ready'; files: File[] }
  | { status: 'failed'; message: string };

const MESSAGE_MS = 4000;
const DOWNLOAD_GAP_MS = 350;

/**
 * Over the screen while photos are picked: how many, and what to do with
 * them — share them together, add them to (or take them out of) the
 * favourites, download them. What needs the network is greyed out offline.
 */
export function SelectionBar({
  items,
  onClose,
}: {
  items: readonly MediaItem[];
  onClose: () => void;
}) {
  const { source, thumbnails } = useData();
  const sync = useSync();
  const confirm = useConfirm();
  const offline = !useOnline();
  const [share, setShare] = useState<ShareState>({ status: 'idle' });
  const [downloading, setDownloading] = useState<{ done: number; total: number } | null>(null);
  const allFavorites = items.length > 0 && items.every((item) => sync.favorites.has(item.id));
  const bytes = items.reduce((sum, item) => sum + item.size, 0);

  useEffect(() => {
    if (share.status !== 'failed') return;
    const timer = window.setTimeout(() => setShare({ status: 'idle' }), MESSAGE_MS);
    return () => window.clearTimeout(timer);
  }, [share.status]);

  const openShareSheet = async (files: File[]) => {
    try {
      await navigator.share({ files });
      setShare({ status: 'idle' });
      onClose();
    } catch (error) {
      const name = error instanceof DOMException ? error.name : '';
      // Long downloads outlast the tap's permission: one more tap shares at once.
      if (name === 'NotAllowedError') setShare({ status: 'ready', files });
      else if (name === 'AbortError') setShare({ status: 'idle' });
      else setShare({ status: 'failed', message: 'Partage impossible pour l’instant, réessaie.' });
    }
  };

  const onShare = async () => {
    if (share.status === 'preparing') return;
    if (share.status === 'ready') {
      await openShareSheet(share.files);
      return;
    }
    if (
      beyondShareLimit(items) &&
      !(await confirm({
        title: `Partager ${formatCount(items.length)} éléments ?`,
        message: `Il faut d’abord télécharger ${formatBytes(bytes)} : ça peut être très long, ou échouer. Au-delà de ${SHARE_LIMIT.items} éléments ou ${formatBytes(SHARE_LIMIT.bytes)}, mieux vaut partager en plusieurs fois.`,
        confirmLabel: 'Partager quand même',
      }))
    ) {
      return;
    }
    const files: File[] = [];
    for (const [done, item] of items.entries()) {
      setShare({ status: 'preparing', done, total: items.length });
      const file = await shareableFile(item, source, thumbnails.store, (candidate) =>
        navigator.canShare({ files: [candidate] }),
      );
      if (file) files.push(file);
    }
    if (files.length === 0 || !navigator.canShare({ files })) {
      setShare({ status: 'failed', message: 'Ces fichiers ne peuvent pas être partagés.' });
      return;
    }
    await openShareSheet(files);
  };

  /** All in, or all out when they all were; favourites need the sync first in OneDrive mode. */
  const onFavorite = async () => {
    if (!sync.favoritesOn) {
      const answer = await confirm({
        title: 'Activer la synchronisation ?',
        message:
          'Les favoris se rangent dans ton OneDrive, avec tes préférences, dans un dossier à part (Applis/Nuagerie). Nuagerie va demander à Microsoft le droit d’écrire dans ce seul dossier : tes photos restent en lecture seule.',
        confirmLabel: 'Activer',
      });
      if (answer) await sync.enable();
      return;
    }
    for (const item of items) {
      if (sync.favorites.has(item.id) === allFavorites) sync.toggleFavorite(item.id);
    }
    onClose();
  };

  /** The originals, one after the other (the browser may ask once to allow several downloads). */
  const onDownload = async () => {
    if (
      items.length > SHARE_LIMIT.items &&
      !(await confirm({
        title: `Télécharger ${formatCount(items.length)} fichiers ?`,
        message: `Soit ${formatBytes(bytes)}. Le navigateur peut te demander d’autoriser plusieurs téléchargements.`,
        confirmLabel: 'Télécharger',
      }))
    ) {
      return;
    }
    for (const [done, item] of items.entries()) {
      setDownloading({ done, total: items.length });
      try {
        const url = await source.getOriginalUrl(item);
        if (url) {
          const link = document.createElement('a');
          link.href = url;
          link.download = item.name;
          link.click();
          await new Promise((resolve) => setTimeout(resolve, DOWNLOAD_GAP_MS));
        }
      } catch {
        // This one is skipped; the others go on.
      }
    }
    setDownloading(null);
    onClose();
  };

  const shareLabel = offline
    ? 'Partager (hors connexion)'
    : share.status === 'ready'
      ? 'Partager (prêt, toucher à nouveau)'
      : 'Partager';
  const favoriteLabel = allFavorites ? 'Retirer des favoris' : 'Ajouter aux favoris';
  const downloadLabel = offline ? 'Télécharger (hors connexion)' : 'Télécharger';
  const progress =
    share.status === 'preparing'
      ? `Préparation ${share.done + 1} / ${share.total}…`
      : downloading
        ? `Téléchargement ${downloading.done + 1} / ${downloading.total}…`
        : null;

  return (
    <div className={styles.bar} role="toolbar" aria-label="Sélection">
      <button
        type="button"
        className={styles.icon}
        onClick={onClose}
        aria-label="Annuler la sélection"
      >
        <CloseIcon />
      </button>
      <p className={styles.count} role="status">
        {progress ?? selectedLabel(items.length)}
      </p>
      {canShareFiles() && (
        <button
          type="button"
          className={styles.icon}
          onClick={() => void onShare()}
          disabled={offline || downloading !== null}
          data-ready={share.status === 'ready' || undefined}
          aria-busy={share.status === 'preparing'}
          aria-label={shareLabel}
          title={shareLabel}
        >
          {share.status === 'preparing' ? <span className={styles.spinner} /> : <ShareIcon />}
        </button>
      )}
      {(sync.favoritesOn || sync.available) && (
        <button
          type="button"
          className={styles.icon}
          onClick={() => void onFavorite()}
          disabled={!sync.favoritesOn && offline}
          aria-pressed={allFavorites}
          aria-label={favoriteLabel}
          title={favoriteLabel}
          data-favorite={allFavorites || undefined}
        >
          <HeartIcon filled={allFavorites} />
        </button>
      )}
      <button
        type="button"
        className={styles.icon}
        onClick={() => void onDownload()}
        disabled={offline || downloading !== null || share.status === 'preparing'}
        aria-busy={downloading !== null}
        aria-label={downloadLabel}
        title={downloadLabel}
      >
        {downloading ? <span className={styles.spinner} /> : <DownloadIcon />}
      </button>
      {share.status === 'failed' && (
        <p className={styles.toast} role="status">
          {share.message}
        </p>
      )}
    </div>
  );
}
