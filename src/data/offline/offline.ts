import { withinFolder } from '../albums.ts';
import type { MediaIndex, MediaItem, ThumbnailSize } from '../model.ts';
import type { ThumbnailData } from '../source.ts';
import { thumbnailKey } from '../thumbnails/thumbnailStore.ts';
import type { OfflineStorage } from './offlineCache.ts';

/**
 * "Garder hors connexion": the favourites and the albums the user chose, kept
 * on this device (per device, never synchronised: it is this device's space
 * that counts). For each photo, the grid's thumbnail and the viewer's large
 * image; never originals, videos or map tiles. The manager downloads what is
 * missing a few images at a time, pauses offline (and on mobile data when the
 * device says so, unless allowed), and drops what is no longer kept.
 */

export interface KeptChoice {
  favorites: boolean;
  /** Folder ids: each album with its sub-albums. */
  albums: string[];
}

export const NOTHING_KEPT: KeptChoice = { favorites: false, albums: [] };

/** The two images of a photo that make it usable offline: grid and viewer. */
export const KEPT_SIZES: readonly ThumbnailSize[] = ['medium', 'large'];

/** Bytes a photo takes before any is measured (large JPEG + grid thumbnail, as on a real drive). */
export const ESTIMATED_BYTES_PER_ITEM = 320 * 1024;

/** The items kept: the favourites and the chosen albums' (sub-albums included), once each. */
export function keptItems(
  index: MediaIndex,
  choice: KeptChoice,
  favorites: readonly MediaItem[],
): MediaItem[] {
  const ids = new Set<string>();
  const items: MediaItem[] = [];
  const add = (list: readonly MediaItem[]) => {
    for (const item of list) {
      if (!ids.has(item.id)) {
        ids.add(item.id);
        items.push(item);
      }
    }
  };
  if (choice.favorites) add(favorites);
  for (const albumId of choice.albums) {
    if (index.folders.has(albumId)) add(withinFolder(index, albumId));
  }
  return items;
}

export interface Download {
  item: MediaItem;
  size: ThumbnailSize;
  key: string;
}

/** What to download (in the items' order, most recent first) and what to drop. */
export function offlinePlan(
  items: readonly MediaItem[],
  present: ReadonlySet<string>,
): { downloads: Download[]; drops: string[] } {
  const wanted = new Set<string>();
  const downloads: Download[] = [];
  for (const item of items) {
    for (const size of KEPT_SIZES) {
      const key = thumbnailKey(item, size);
      wanted.add(key);
      if (!present.has(key)) downloads.push({ item, size, key });
    }
  }
  return { downloads, drops: [...present].filter((key) => !wanted.has(key)) };
}

/** Bytes a list of photos would take, from what the kept ones weigh on average. */
export function estimateBytes(count: number, keptBytes: number, keptImages: number): number {
  const perItem =
    keptImages >= 20 ? (keptBytes / keptImages) * KEPT_SIZES.length : ESTIMATED_BYTES_PER_ITEM;
  return Math.round(count * perItem);
}

export type OfflinePause = 'offline' | 'mobile-data' | null;

export interface OfflineState {
  /** Images kept on the device, and their bytes. */
  images: number;
  bytes: number;
  /** Images of the current round: to get, got, failed. */
  total: number;
  done: number;
  failed: number;
  running: boolean;
  pause: OfflinePause;
}

/**
 * Why an image could not be kept: the host would not let its bytes be read,
 * OneDrive no longer has it, the device is full, or anything else (network,
 * OneDrive's errors). Tried again on the next round, except when full.
 */
export type FailureReason = 'unreadable' | 'missing' | 'full' | 'failed';

function reasonOf(error: unknown): FailureReason {
  if (error instanceof DOMException && error.name === 'QuotaExceededError') return 'full';
  if (error instanceof Error && error.message === 'not readable') return 'unreadable';
  const status = (error as { status?: unknown } | null)?.status;
  return status === 404 ? 'missing' : 'failed';
}

/** What the images kept for a list of photos (an album) look like. */
export interface KeptStatus {
  photos: number;
  /** Photos with both their images on the device. */
  keptPhotos: number;
  bytes: number;
  failedPhotos: number;
  /** The reasons of the failures, most frequent first. */
  reasons: FailureReason[];
  /** done: all there; downloading: under way; waiting: paused or queued; error: some failed. */
  phase: 'done' | 'downloading' | 'waiting' | 'error';
}

export interface KeptView {
  size(key: string): number | null;
  failure(key: string): FailureReason | null;
}

export function keptStatus(
  items: readonly MediaItem[],
  view: KeptView,
  state: Pick<OfflineState, 'running'>,
): KeptStatus {
  let keptPhotos = 0;
  let bytes = 0;
  let failedPhotos = 0;
  const reasons = new Map<FailureReason, number>();
  for (const item of items) {
    let complete = true;
    let failed: FailureReason | null = null;
    for (const size of KEPT_SIZES) {
      const key = thumbnailKey(item, size);
      const kept = view.size(key);
      if (kept === null) {
        complete = false;
        failed ??= view.failure(key);
      } else {
        bytes += kept;
      }
    }
    if (complete) keptPhotos++;
    else if (failed) {
      failedPhotos++;
      reasons.set(failed, (reasons.get(failed) ?? 0) + 1);
    }
  }
  const phase =
    keptPhotos === items.length
      ? 'done'
      : state.running
        ? 'downloading'
        : failedPhotos > 0
          ? 'error'
          : 'waiting';
  return {
    photos: items.length,
    keptPhotos,
    bytes,
    failedPhotos,
    reasons: [...reasons].sort((a, b) => b[1] - a[1]).map(([reason]) => reason),
    phase,
  };
}

export interface ManagerDeps {
  storage: OfflineStorage;
  /** The thumbnail cache first (already seen images), then the network. */
  fetch(item: MediaItem, size: ThumbnailSize, signal: AbortSignal): Promise<ThumbnailData>;
  isOnline(): boolean;
  /** The device says it is on mobile data (Network Information API, Android). */
  onMobileData(): boolean;
}

const PARALLEL = 3;

/** Network failures in a row (not "not found") that mean the network lets nothing through. */
const FAILURES_BEFORE_PAUSE = 6;
/** Listeners hear of the progress at most this often: every tile and badge redraws on it. */
const NOTIFY_EVERY_MS = 250;

/** The photos and versions a list stands for: the same list needs no new round. */
const signatureOf = (items: readonly MediaItem[]) =>
  items.map((item) => `${item.id}:${item.eTag}`).join('\n');

export function createOfflineManager(deps: ManagerDeps) {
  let state: OfflineState = {
    images: 0,
    bytes: 0,
    total: 0,
    done: 0,
    failed: 0,
    running: false,
    pause: null,
  };
  const listeners = new Set<() => void>();
  let present: Map<string, number> | null = null;
  const failures = new Map<string, FailureReason>();
  let latest: readonly MediaItem[] = [];
  let signature: string | null = null;
  let mobileDataAllowed = false;
  let controller: AbortController | null = null;
  let round: Promise<void> | null = null;
  let again = false;
  let notifiedAt = 0;
  let notifyTimer: ReturnType<typeof setTimeout> | null = null;

  const notify = () => {
    notifiedAt = Date.now();
    notifyTimer = null;
    listeners.forEach((listener) => listener());
  };
  const update = (next: Partial<OfflineState>, now = false) => {
    state = { ...state, ...next };
    if (now || Date.now() - notifiedAt >= NOTIFY_EVERY_MS) {
      if (notifyTimer) clearTimeout(notifyTimer);
      notify();
    } else {
      notifyTimer ??= setTimeout(notify, NOTIFY_EVERY_MS);
    }
  };
  const counted = () => {
    let bytes = 0;
    for (const size of present?.values() ?? []) bytes += size;
    return { images: present?.size ?? 0, bytes };
  };
  /** Why downloads must wait now, if they must. */
  const pauseNow = (): OfflinePause =>
    !deps.isOnline() ? 'offline' : deps.onMobileData() && !mobileDataAllowed ? 'mobile-data' : null;

  const runRound = async () => {
    // From the start: a new list given while the kept images are listed or dropped stops this
    // round, which would otherwise download what is no longer wanted.
    const signal = (controller = new AbortController()).signal;
    present ??= await deps.storage.list().catch(() => new Map<string, number>());
    if (signal.aborted) return;
    const { downloads, drops } = offlinePlan(latest, new Set(present.keys()));
    if (drops.length > 0) {
      await deps.storage.delete(drops).catch(() => undefined);
      for (const key of drops) present.delete(key);
      if (signal.aborted) return;
    }
    const wanted = new Set(downloads.map((download) => download.key));
    for (const key of failures.keys()) if (!wanted.has(key)) failures.delete(key);
    update({ ...counted(), total: downloads.length, done: 0, failed: 0, pause: null }, true);
    if (downloads.length === 0) return;

    const stop = (pause: OfflinePause) => {
      controller?.abort();
      update({ pause }, true);
    };
    const waiting = pauseNow();
    if (waiting) {
      update({ pause: waiting }, true);
      return;
    }

    update({ running: true }, true);
    let next = 0;
    let failedInARow = 0;
    const worker = async () => {
      while (next < downloads.length && !signal.aborted) {
        // Checked before each image: off the Wi-Fi in the middle, the rest waits for it.
        const pause = pauseNow();
        if (pause) {
          stop(pause);
          break;
        }
        const download = downloads[next++];
        if (!download) break;
        try {
          const data = await deps.fetch(download.item, download.size, signal);
          // Shown as a URL only (the host would not let the bytes be read): nothing to keep.
          if (!('blob' in data)) throw new Error('not readable');
          await deps.storage.put(download.key, data.blob);
          present?.set(download.key, data.blob.size);
          failures.delete(download.key);
          failedInARow = 0;
          update({ ...counted(), done: state.done + 1 });
        } catch (error) {
          if (signal.aborted) break;
          // The network went: not this image's fault. Stop here, the round starts again when
          // it is back.
          if (!deps.isOnline()) {
            stop('offline');
            break;
          }
          const reason = reasonOf(error);
          failures.set(download.key, reason);
          update({ failed: state.failed + 1 });
          // No room left on the device: the next images would fail the same way.
          if (reason === 'full') controller?.abort();
          // "Connected" but nothing gets through (hotel Wi-Fi, a portal): stop asking.
          if (reason === 'failed' && ++failedInARow >= FAILURES_BEFORE_PAUSE) stop('offline');
        }
      }
    };
    await Promise.all(Array.from({ length: PARALLEL }, worker));
    update({ running: false }, true);
  };

  const start = (): Promise<void> => {
    if (round) {
      again = true;
      return round;
    }
    round = (async () => {
      do {
        again = false;
        await runRound();
      } while (again);
    })().finally(() => {
      round = null;
      controller = null;
      if (state.running) update({ running: false }, true);
    });
    return round;
  };

  return {
    getSnapshot: () => state,
    /** What is kept, image by image (read with each new snapshot). */
    view: {
      size: (key) => present?.get(key) ?? null,
      failure: (key) => failures.get(key) ?? null,
    } satisfies KeptView,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /** Keeps these items (and only these): downloads what is missing, drops the rest. */
    sync(items: readonly MediaItem[]): Promise<void> {
      latest = items;
      const next = signatureOf(items);
      // The same photos (an index refreshed with nothing new for them): the round goes on.
      if (next === signature && round) return round;
      signature = next;
      // The list changed: the round in progress gives way to a new one.
      controller?.abort();
      return start();
    },
    /** The network is back. */
    resume(): Promise<void> {
      return start();
    },
    /**
     * The app came back to the screen: what is kept is listed again (the browser may have
     * cleared it to free space), then downloads go on.
     */
    refresh(): Promise<void> {
      if (!round) present = null;
      return start();
    },
    /** "Télécharger quand même": mobile data is fine, until the app closes. */
    allowMobileData(): Promise<void> {
      mobileDataAllowed = true;
      return start();
    },
    /** Signing out, or "Tout retirer". */
    async clear(): Promise<void> {
      latest = [];
      signature = null;
      controller?.abort();
      await round?.catch(() => undefined);
      await deps.storage.clear();
      present = new Map();
      failures.clear();
      update(
        { images: 0, bytes: 0, total: 0, done: 0, failed: 0, running: false, pause: null },
        true,
      );
    },
  };
}

export type OfflineManager = ReturnType<typeof createOfflineManager>;
