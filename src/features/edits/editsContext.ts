import { createContext, useContext } from 'react';
import type { MediaItem } from '../../data/model.ts';
import type { TrashEntry } from '../../data/edits/trash.ts';

/** This device's choice to allow changes (Réglages → Modifications); off by default. */
export const EDITS_ENABLED_KEY = 'edits.enabled';
/** Microsoft granted the permission on this device (a token was obtained). */
export const EDITS_GRANTED_KEY = 'edits.granted';
/** Set while the user is on Microsoft's page for the permission, to know what they answered. */
export const EDITS_ASKING_KEY = 'edits.asking';

export type EditsStatus =
  /** Off, or not possible here (offline start without an account). */
  | 'off'
  | 'on'
  /** On, but Microsoft no longer grants the permission: the user must give it again. */
  | 'needs-permission';

/** A change under way, for its progress: "Suppression… 3 / 12". */
export interface EditProgress {
  action: 'delete' | 'move' | 'restore';
  done: number;
  total: number;
}

/** What a change did, said once at the bottom of the screen, with a way back when there is one. */
export interface EditNotice {
  id: number;
  message: string;
  /** Undoes the change ("Annuler"). */
  undo?: () => void;
}

export interface EditsContextValue {
  /** The changes can be turned on here: OneDrive with an account, or the demo. */
  available: boolean;
  status: EditsStatus;
  /** On, and possible now (online, or the demo). */
  usable: boolean;
  /** Asks Microsoft for the permission unless this device holds it already (leaves the page). */
  enable: () => Promise<void>;
  disable: () => void;
  progress: EditProgress | null;
  notice: EditNotice | null;
  dismissNotice: () => void;
  /** To OneDrive's recycle bin, kept in the app's list, with "Annuler". */
  deletePhotos: (items: readonly MediaItem[]) => Promise<boolean>;
  movePhotos: (items: readonly MediaItem[], folderId: string) => Promise<boolean>;
  /** What the app put in the recycle bin, most recent first. */
  trash: readonly TrashEntry[];
  restore: (ids: readonly string[]) => Promise<void>;
  /** The thumbnail kept for a trash entry, as an object URL to release, or null. */
  trashThumbnail: (id: string) => Promise<string | null>;
  /** The new album's id, or null when it failed (the notice says why). */
  createAlbum: (parentId: string, name: string) => Promise<string | null>;
  renameAlbum: (id: string, name: string) => Promise<boolean>;
  deleteAlbum: (id: string) => Promise<boolean>;
}

export const EditsContext = createContext<EditsContextValue | null>(null);

export function useEdits(): EditsContextValue {
  const value = useContext(EditsContext);
  if (!value) throw new Error('useEdits() must be used inside <EditsProvider>');
  return value;
}
