import { useEffect, useMemo, useRef, useState } from 'react';
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
import { localized } from '../../lib/i18n.ts';

const t = localized({
  fr: {
    shareOffline: 'Partager (hors connexion)',
    shareReady: 'Partager (prêt, toucher à nouveau)',
    share: 'Partager',
    shareFailed: 'Partage impossible pour l’instant, réessaie.',
    unfavorite: 'Retirer des favoris',
    favorite: 'Ajouter aux favoris',
    downloadOffline: 'Télécharger (hors connexion)',
    download: 'Télécharger',
    syncTitle: 'Activer la synchronisation ?',
    syncConfirm: 'Activer',
    shareMany: (count: string) => `Partager ${count} éléments ?`,
    shareManyMessage: (bytes: string, items: number, limit: string) =>
      `Il faut d’abord télécharger ${bytes} : ça peut être très long, ou échouer. Au-delà de ${items} éléments ou ${limit}, mieux vaut partager en plusieurs fois.`,
    shareAnyway: 'Partager quand même',
    cannotShare: 'Ces fichiers ne peuvent pas être partagés.',
    syncMessage:
      'Les favoris se rangent dans ton OneDrive, avec tes préférences, dans un dossier à part (Applis/Nuagerie). Nuagerie va demander à Microsoft le droit d’écrire dans ce seul dossier : tes photos restent en lecture seule.',
    downloadMany: (count: string) => `Télécharger ${count} fichiers ?`,
    downloadManyMessage: (bytes: string) =>
      `Soit ${bytes}. Le navigateur peut te demander d’autoriser plusieurs téléchargements.`,
    preparing: 'Préparation du partage',
    downloading: 'Téléchargement',
    selection: 'Sélection',
    cancel: 'Annuler la sélection',
  },
  en: {
    shareOffline: 'Share (offline)',
    shareReady: 'Share (ready, tap again)',
    share: 'Share',
    shareFailed: 'Sharing is not possible right now, try again.',
    unfavorite: 'Remove from favourites',
    favorite: 'Add to favourites',
    downloadOffline: 'Download (offline)',
    download: 'Download',
    syncTitle: 'Turn on the sync?',
    syncConfirm: 'Turn on',
    shareMany: (count: string) => `Share ${count} items?`,
    shareManyMessage: (bytes: string, items: number, limit: string) =>
      `${bytes} must be downloaded first: it may take very long, or fail. Beyond ${items} items or ${limit}, better share in several goes.`,
    shareAnyway: 'Share anyway',
    cannotShare: 'These files cannot be shared.',
    syncMessage:
      'Favourites are kept in your OneDrive, with your preferences, in a folder of their own (Apps/Nuagerie). Nuagerie will ask Microsoft for the right to write in that one folder: your photos stay read-only.',
    downloadMany: (count: string) => `Download ${count} files?`,
    downloadManyMessage: (bytes: string) =>
      `That is ${bytes}. The browser may ask you to allow several downloads.`,
    preparing: 'Preparing to share',
    downloading: 'Downloading',
    selection: 'Selection',
    cancel: 'Cancel the selection',
  },
});

type ShareState = { for: string } & (
  | { status: 'idle' }
  | { status: 'preparing'; done: number; total: number }
  /** Downloaded, but the browser wants a fresh tap to open the share sheet. */
  | { status: 'ready'; files: File[] }
  | { status: 'failed'; message: string }
);

const IDLE = { for: '', status: 'idle' } as const;

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
  // What sharing has prepared is for these photos only: picked otherwise, it starts over.
  const picked = useMemo(() => items.map((item) => item.id).join(' '), [items]);
  const [stored, setShare] = useState<ShareState>(IDLE);
  const share: ShareState = stored.for === picked ? stored : IDLE;
  const [downloading, setDownloading] = useState<{ done: number; total: number } | null>(null);
  const busy = share.status === 'preparing' || downloading !== null;
  const allFavorites = items.length > 0 && items.every((item) => sync.favorites.has(item.id));
  const bytes = items.reduce((sum, item) => sum + item.size, 0);

  // The downloads under way stop when the bar goes (cancelled, back) or the photos change.
  const running = useRef<AbortController | null>(null);
  const start = () => {
    running.current?.abort();
    running.current = new AbortController();
    return running.current.signal;
  };
  useEffect(() => () => running.current?.abort(), [picked]);
  const close = () => {
    running.current?.abort();
    onClose();
  };

  useEffect(() => {
    if (share.status !== 'failed') return;
    const timer = window.setTimeout(() => setShare(IDLE), MESSAGE_MS);
    return () => window.clearTimeout(timer);
  }, [share.status]);

  const openShareSheet = async (files: File[]) => {
    try {
      await navigator.share({ files });
      setShare(IDLE);
      onClose();
    } catch (error) {
      const name = error instanceof DOMException ? error.name : '';
      // Long downloads outlast the tap's permission: one more tap shares at once.
      if (name === 'NotAllowedError') setShare({ for: picked, status: 'ready', files });
      else if (name === 'AbortError') setShare(IDLE);
      else
        setShare({
          for: picked,
          status: 'failed',
          message: t.shareFailed,
        });
    }
  };

  const onShare = async () => {
    if (busy) return;
    if (share.status === 'ready') {
      await openShareSheet(share.files);
      return;
    }
    if (
      beyondShareLimit(items) &&
      !(await confirm({
        title: t.shareMany(formatCount(items.length)),
        message: t.shareManyMessage(
          formatBytes(bytes),
          SHARE_LIMIT.items,
          formatBytes(SHARE_LIMIT.bytes),
        ),
        confirmLabel: t.shareAnyway,
      }))
    ) {
      return;
    }
    const signal = start();
    const files: File[] = [];
    for (const [done, item] of items.entries()) {
      setShare({ for: picked, status: 'preparing', done, total: items.length });
      const file = await shareableFile(
        item,
        source,
        thumbnails.store,
        (candidate) => navigator.canShare({ files: [candidate] }),
        signal,
      );
      if (signal.aborted) return;
      if (file) files.push(file);
    }
    if (files.length === 0 || !navigator.canShare({ files })) {
      setShare({
        for: picked,
        status: 'failed',
        message: t.cannotShare,
      });
      return;
    }
    await openShareSheet(files);
  };

  /** All in, or all out when they all were; favourites need the sync first in OneDrive mode. */
  const onFavorite = async () => {
    if (!sync.favoritesOn) {
      const answer = await confirm({
        title: t.syncTitle,
        message: t.syncMessage,
        confirmLabel: t.syncConfirm,
      });
      // These photos become favourites once it is on, even after Microsoft's page.
      if (answer) await sync.enable(items.map((item) => item.id));
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
        title: t.downloadMany(formatCount(items.length)),
        message: t.downloadManyMessage(formatBytes(bytes)),
        confirmLabel: t.download,
      }))
    ) {
      return;
    }
    const signal = start();
    try {
      for (const [done, item] of items.entries()) {
        setDownloading({ done, total: items.length });
        try {
          const url = await source.getOriginalUrl(item);
          if (signal.aborted) return;
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
        if (signal.aborted) return;
      }
      onClose();
    } finally {
      // Done, or stopped (cancelled, other photos picked): the bar is free again.
      setDownloading(null);
    }
  };

  const shareLabel = offline ? t.shareOffline : share.status === 'ready' ? t.shareReady : t.share;
  const favoriteLabel = allFavorites ? t.unfavorite : t.favorite;
  const downloadLabel = offline ? t.downloadOffline : t.download;
  // Short enough for 360 px beside four buttons; the full words for screen readers.
  const progress =
    share.status === 'preparing'
      ? { label: t.preparing, done: share.done, total: share.total }
      : downloading
        ? { label: t.downloading, done: downloading.done, total: downloading.total }
        : null;

  return (
    <div className={styles.bar} role="toolbar" aria-label={t.selection}>
      <button type="button" className={styles.icon} onClick={close} aria-label={t.cancel}>
        <CloseIcon />
      </button>
      <p className={styles.count} role="status">
        {progress ? (
          <>
            <span className="visually-hidden">{progress.label} : </span>
            {progress.done + 1} / {progress.total}
          </>
        ) : (
          selectedLabel(items.length)
        )}
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
          disabled={busy || (!sync.favoritesOn && offline)}
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
