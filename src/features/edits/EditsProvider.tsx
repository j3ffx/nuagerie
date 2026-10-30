import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { getEditToken, requestEditPermission } from '../../auth/msal.ts';
import { useData } from '../../data/dataContext.ts';
import {
  EditRefused,
  failureOf,
  type EditFailure,
  type EditResult,
} from '../../data/edits/driveEdits.ts';
import {
  parseTrash,
  trashCacheName,
  trashKey,
  withDeleted,
  without,
} from '../../data/edits/trash.ts';
import type { MediaIndex, MediaItem } from '../../data/model.ts';
import { createOfflineCache } from '../../data/offline/offlineCache.ts';
import { thumbnailKey } from '../../data/thumbnails/thumbnailStore.ts';
import { formatItemCount } from '../../lib/format.ts';
import { localized } from '../../lib/i18n.ts';
import { useOnline } from '../../lib/online.ts';
import { readPersistent, usePersistentState, writePersistent } from '../../lib/persistent.ts';
import {
  EDITS_ASKING_KEY,
  EDITS_ENABLED_KEY,
  EDITS_GRANTED_KEY,
  EditsContext,
  type EditNotice,
  type EditProgress,
  type EditsStatus,
} from './editsContext.ts';

const t = localized({
  fr: {
    deleted: (count: string) => `${count} dans la corbeille`,
    moved: (count: string, album: string) => `${count} dans « ${album} »`,
    restored: (count: string) => `${count} remis en place`,
    elsewhere: (count: string) =>
      `${count} hors de tes dossiers : son album n’existe plus, regarde dans OneDrive`,
    rehomed: (count: string, album: string) =>
      `${count} dans « ${album} » : son album n’existait plus`,
    created: (name: string) => `Album « ${name} » créé`,
    renamed: (name: string) => `Album renommé « ${name} »`,
    albumDeleted: 'Album supprimé',
    notDone: (count: string) => `${count} pas fait :`,
    reasons: {
      nameTaken: 'un fichier du même nom est déjà là.',
      gone: 'il n’existe plus dans OneDrive.',
      refused: 'Nuagerie ne peut pas toucher à ça.',
      permission: 'Microsoft demande de redonner la permission (Réglages → Modifications).',
      error: 'OneDrive n’a pas répondu, réessaie.',
    },
    albumNameTaken: 'Un album de ce nom est déjà là.',
    albumNotEmpty: 'Cet album n’est pas vide dans OneDrive : il garde d’autres fichiers.',
    declined:
      'Microsoft n’a pas donné la permission : sans elle, Nuagerie ne peut rien changer dans ton OneDrive.',
    failed: (detail: string) => `Impossible de demander la permission (${detail}).`,
  },
  en: {
    deleted: (count: string) => `${count} in the recycle bin`,
    moved: (count: string, album: string) => `${count} in “${album}”`,
    restored: (count: string) => `${count} put back`,
    elsewhere: (count: string) =>
      `${count} outside your folders: its album no longer exists, look in OneDrive`,
    rehomed: (count: string, album: string) => `${count} in “${album}”: its album was gone`,
    created: (name: string) => `Album “${name}” created`,
    renamed: (name: string) => `Album renamed “${name}”`,
    albumDeleted: 'Album deleted',
    notDone: (count: string) => `${count} not done:`,
    reasons: {
      nameTaken: 'a file of the same name is already there.',
      gone: 'it no longer exists in OneDrive.',
      refused: 'Nuagerie cannot touch that.',
      permission: 'Microsoft asks for the permission again (Settings → Changes).',
      error: 'OneDrive did not answer, try again.',
    },
    albumNameTaken: 'An album of that name is already there.',
    albumNotEmpty: 'This album is not empty in OneDrive: it keeps other files.',
    declined:
      'Microsoft did not give the permission: without it, Nuagerie cannot change anything in your OneDrive.',
    failed: (detail: string) => `The permission could not be asked for (${detail}).`,
  },
});

/** The thumbnail kept with a trash entry: the grid's size. */
const TRASH_THUMBNAIL = 'medium' as const;

/** What did not go through, in one line: the most frequent reason. */
function failureText(failed: EditResult['failed']): string | null {
  if (failed.length === 0) return null;
  const counts = new Map<EditFailure, number>();
  for (const { reason } of failed) counts.set(reason, (counts.get(reason) ?? 0) + 1);
  const [reason] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? ['error'];
  return `${t.notDone(formatItemCount(failed.length))} ${t.reasons[reason]}`;
}

/**
 * The changes to the user's drive (M14): off by default, turned on per device
 * in Réglages → Modifications, which asks Microsoft for the permission then.
 * Each change shows at once, says what it did, and can be undone.
 */
export function EditsProvider({ children }: { children: ReactNode }) {
  const { mode, signedIn, source, thumbnails, state, showIndex, exclusive } = useData();
  const online = useOnline();
  const [enabled, setEnabled] = usePersistentState<boolean>(EDITS_ENABLED_KEY, false);
  const [granted] = usePersistentState<boolean>(EDITS_GRANTED_KEY, false);
  const [storedTrash] = usePersistentState<unknown>(trashKey(mode), []);
  const [permissionLost, setPermissionLost] = useState(false);
  const [progress, setProgress] = useState<EditProgress | null>(null);
  const [notice, setNotice] = useState<EditNotice | null>(null);
  const noticeId = useRef(0);
  /** One change at a time, from the tap on: a double tap or a second action waits for none. */
  const busy = useRef(false);
  const [working, setWorking] = useState(false);
  const edits = source.edits;
  const available = !!edits && (mode === 'demo' || signedIn);
  const trashCache = useMemo(() => createOfflineCache(trashCacheName(mode)), [mode]);

  const status: EditsStatus =
    !available || !enabled
      ? 'off'
      : mode === 'demo' || (granted && !permissionLost)
        ? 'on'
        : 'needs-permission';
  const usable = status === 'on' && (mode === 'demo' || online) && !working;
  const index = state.status === 'ready' ? state.index : null;

  const say = useCallback((message: string, undo?: () => void) => {
    setNotice({ id: ++noticeId.current, message, ...(undo ? { undo } : {}) });
  }, []);

  // Back from Microsoft's page: the token says whether the permission was given.
  useEffect(() => {
    if (mode !== 'onedrive' || !signedIn || !enabled || granted) return;
    let cancelled = false;
    void getEditToken({ deviceOnly: true })
      .then(() => {
        if (cancelled) return;
        writePersistent(EDITS_GRANTED_KEY, true);
        writePersistent(EDITS_ASKING_KEY, false);
      })
      .catch(() => {
        if (cancelled) return;
        if (readPersistent(EDITS_ASKING_KEY, false)) say(t.declined);
        writePersistent(EDITS_ASKING_KEY, false);
        setEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, signedIn, enabled, granted, say, setEnabled]);

  const enable = useCallback(async () => {
    setPermissionLost(false);
    if (mode === 'demo') {
      setEnabled(true);
      return;
    }
    // Refused by Microsoft just now: the token kept on the device is no answer, its page is.
    if (!permissionLost) {
      try {
        await getEditToken({ deviceOnly: true });
        writePersistent(EDITS_GRANTED_KEY, true);
        setEnabled(true);
        return;
      } catch {
        // Microsoft's page asks the user; coming back tells what they said.
      }
    }
    writePersistent(EDITS_GRANTED_KEY, false);
    writePersistent(EDITS_ASKING_KEY, true);
    setEnabled(true);
    try {
      await requestEditPermission();
    } catch (error) {
      writePersistent(EDITS_ASKING_KEY, false);
      setEnabled(false);
      say(t.failed(error instanceof Error ? error.message : String(error)));
    }
  }, [mode, permissionLost, setEnabled, say]);

  const disable = useCallback(() => setEnabled(false), [setEnabled]);

  /** Runs one change, apart from the background sync; none when one is under way. */
  const guard = useCallback(
    async <T,>(task: () => Promise<T>, none: T): Promise<T> => {
      if (busy.current) return none;
      busy.current = true;
      setWorking(true);
      try {
        return await exclusive(task);
      } finally {
        busy.current = false;
        setWorking(false);
      }
    },
    [exclusive],
  );

  /** Shows the new index, and remembers when Microsoft said no. */
  const settle = useCallback(
    (result: EditResult) => {
      if (result.index) showIndex(result.index);
      if (result.failed.some((failure) => failure.reason === 'permission')) setPermissionLost(true);
    },
    [showIndex],
  );

  const run = useCallback(
    async (
      action: EditProgress['action'],
      task: (onProgress: (done: number, total: number) => void) => Promise<EditResult>,
    ): Promise<EditResult | null> => {
      try {
        const result = await task((done, total) => setProgress({ action, done, total }));
        settle(result);
        return result;
      } catch (error) {
        const reason = failureOf(error);
        if (reason === 'permission') setPermissionLost(true);
        say(t.reasons[reason]);
        return null;
      } finally {
        setProgress(null);
      }
    },
    [settle, say],
  );

  const albumName = useCallback(
    (folderId: string, of: MediaIndex | null = index) => of?.folders.get(folderId)?.name ?? '',
    [index],
  );

  const restore = useCallback(
    (ids: readonly string[]) =>
      guard(async () => {
        if (!edits) return [];
        const kept = new Map(
          parseTrash(readPersistent(trashKey(mode), []), null).map((entry) => [entry.id, entry]),
        );
        const items = ids.map((id) => {
          const entry = kept.get(id);
          return entry
            ? {
                id,
                folderId: entry.folderId,
                albumName: entry.albumName,
                albumParentId: entry.albumParentId ?? null,
              }
            : { id };
        });
        const result = await run('restore', (onProgress) => edits.restoreItems(items, onProgress));
        if (!result) return [];
        // Back, or gone for good: either way, no longer in the app's list.
        const forgotten = [
          ...result.done,
          ...result.failed
            .filter((failure) => failure.reason === 'gone')
            .map((failure) => failure.id),
        ];
        writePersistent(
          trashKey(mode),
          without(parseTrash(readPersistent(trashKey(mode), []), Date.now()), forgotten),
        );
        void trashCache.delete(forgotten);
        // Its album deleted too: in another one (said), or where the index does not look.
        const after = result.index ?? index;
        const shown = new Map(after?.items.map((item) => [item.id, item]));
        const elsewhere = result.done.filter((id) => !shown.has(id)).length;
        const rehomed = result.done.flatMap((id) => {
          const was = kept.get(id)?.folderId;
          const item = shown.get(id);
          return item && was && !index?.folders.has(was) ? [item] : [];
        });
        const back = result.done.length - elsewhere - rehomed.length;
        const done = back > 0 ? t.restored(formatItemCount(back)) : null;
        const moved = rehomed[0]
          ? t.rehomed(formatItemCount(rehomed.length), albumName(rehomed[0].albumId, after))
          : null;
        say(
          [
            done,
            moved,
            elsewhere > 0 ? t.elsewhere(formatItemCount(elsewhere)) : null,
            failureText(result.failed),
          ]
            .filter(Boolean)
            .join(' · '),
        );
        // Made again right in a root folder: on the home screen, as when it was made.
        return (result.albums ?? []).filter((id) => {
          const parentId = after?.folders.get(id)?.parentId;
          return !!parentId && after?.rootFolderIds.includes(parentId);
        });
      }, []),
    [guard, edits, run, mode, trashCache, index, albumName, say],
  );

  const deletePhotos = useCallback(
    (items: readonly MediaItem[]) =>
      guard(async () => {
        if (!edits || items.length === 0) return false;
        // Their thumbnails stay with the app's list: the grid's cache may let them go.
        await Promise.all(
          items.map(async (item) => {
            const blob = await thumbnails.disk
              .get(thumbnailKey(item, TRASH_THUMBNAIL))
              .catch(() => null);
            if (blob) await trashCache.put(item.id, blob).catch(() => undefined);
          }),
        );
        const before = index;
        const result = await run('delete', (onProgress) =>
          edits.deleteItems(
            items.map((item) => item.id),
            onProgress,
          ),
        );
        if (!result) return false;
        const done = new Set(result.done);
        const deleted = items.filter((item) => done.has(item.id));
        writePersistent(
          trashKey(mode),
          withDeleted(
            parseTrash(readPersistent(trashKey(mode), []), Date.now()),
            deleted,
            (item) => ({
              name: albumName(item.albumId, before),
              parentId: before?.folders.get(item.albumId)?.parentId ?? null,
            }),
            Date.now(),
          ),
        );
        void trashCache.delete(items.filter((item) => !done.has(item.id)).map((item) => item.id));
        const text = deleted.length > 0 ? t.deleted(formatItemCount(deleted.length)) : null;
        say(
          [text, failureText(result.failed)].filter(Boolean).join(' · '),
          deleted.length > 0 ? () => void restore(result.done) : undefined,
        );
        return deleted.length > 0;
      }, false),
    [guard, edits, thumbnails, trashCache, index, run, mode, albumName, say, restore],
  );

  const movePhotos = useCallback(
    (items: readonly MediaItem[], folderId: string) =>
      guard(async () => {
        if (!edits || items.length === 0) return false;
        const result = await run('move', (onProgress) =>
          edits.moveItems(
            items.map((item) => item.id),
            folderId,
            onProgress,
          ),
        );
        if (!result) return false;
        const done = new Set(result.done);
        // Each back to its own folder.
        const from = new Map<string, string[]>();
        for (const item of items) {
          if (!done.has(item.id) || item.folderId === folderId) continue;
          from.set(item.folderId, [...(from.get(item.folderId) ?? []), item.id]);
        }
        // Back where each came from, a year or a month folder included; every group is tried.
        const undo = () =>
          guard(async () => {
            const failed: EditResult['failed'] = [];
            for (const [origin, ids] of from) {
              const back = await run('move', (onProgress) =>
                edits.moveBack(ids, origin, onProgress),
              );
              if (back) failed.push(...back.failed);
              else return;
            }
            if (failed.length > 0) say(failureText(failed) ?? '');
          }, undefined);
        const text =
          result.done.length > 0
            ? t.moved(
                formatItemCount(result.done.length),
                albumName(folderId, result.index ?? index),
              )
            : null;
        say(
          [text, failureText(result.failed)].filter(Boolean).join(' · '),
          from.size > 0 ? () => void undo() : undefined,
        );
        return result.done.length > 0;
      }, false),
    [guard, edits, run, albumName, index, say],
  );

  /** An album change: shown at once, or said why not. */
  const albumChange = useCallback(
    async <T,>(change: () => Promise<T>, done: (value: T) => string): Promise<T | null> =>
      guard(async () => {
        try {
          const value = await change();
          say(done(value));
          return value;
        } catch (error) {
          const reason = failureOf(error);
          if (reason === 'permission') setPermissionLost(true);
          say(
            reason === 'nameTaken'
              ? t.albumNameTaken
              : error instanceof EditRefused
                ? t.albumNotEmpty
                : t.reasons[reason],
          );
          return null;
        }
      }, null),
    [guard, say],
  );

  const createAlbum = useCallback(
    async (parentId: string, name: string) => {
      if (!edits) return null;
      const created = await albumChange(
        () => edits.createAlbum(parentId, name),
        () => t.created(name.trim()),
      );
      if (!created) return null;
      showIndex(created.index);
      return created.id;
    },
    [edits, albumChange, showIndex],
  );

  const renameAlbum = useCallback(
    async (id: string, name: string) => {
      if (!edits) return false;
      const next = await albumChange(
        () => edits.renameAlbum(id, name),
        () => t.renamed(name.trim()),
      );
      if (next) showIndex(next);
      return next !== null;
    },
    [edits, albumChange, showIndex],
  );

  const deleteAlbum = useCallback(
    async (id: string) => {
      if (!edits) return false;
      const next = await albumChange(
        () => edits.deleteAlbum(id),
        () => t.albumDeleted,
      );
      if (next) showIndex(next);
      return next !== null;
    },
    [edits, albumChange, showIndex],
  );

  const dismissNotice = useCallback(() => setNotice(null), []);

  const trashThumbnail = useCallback(
    async (id: string) => {
      const blob = await trashCache.get(id);
      return blob ? URL.createObjectURL(blob) : null;
    },
    [trashCache],
  );

  const trash = useMemo(() => parseTrash(storedTrash, null), [storedTrash]);
  // What OneDrive no longer keeps leaves the list as the app starts.
  useEffect(() => {
    // The demo's drive is drawn anew at each start: nothing of it is in a bin any more.
    if (mode === 'demo') {
      writePersistent(trashKey(mode), []);
      if (typeof caches !== 'undefined')
        void caches.delete(trashCacheName(mode)).catch(() => false);
      return;
    }
    const kept = parseTrash(readPersistent(trashKey(mode), []), Date.now());
    if (kept.length !== parseTrash(readPersistent(trashKey(mode), []), null).length) {
      writePersistent(trashKey(mode), kept);
    }
  }, [mode]);

  return (
    <EditsContext.Provider
      value={{
        available,
        status,
        usable,
        enable,
        disable,
        progress,
        notice,
        dismissNotice,
        deletePhotos,
        movePhotos,
        trash,
        restore,
        trashThumbnail,
        createAlbum,
        renameAlbum,
        deleteAlbum,
      }}
    >
      {children}
    </EditsContext.Provider>
  );
}
