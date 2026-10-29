import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useData } from '../../data/dataContext.ts';
import {
  folderName,
  rootCovering,
  useRootPaths,
  withoutRoot,
  withRoot,
  writeRootPaths,
} from '../../data/roots.ts';
import type { DriveFolder } from '../../data/source.ts';
import { useSync } from '../../data/sync/syncContext.ts';
import { formatBytes, formatCount, formatItemCount } from '../../lib/format.ts';
import { useOnline } from '../../lib/online.ts';
import common from '../../ui/common.module.css';
import { BackIcon, ChevronIcon } from '../../ui/icons.tsx';
import { ScreenHeader } from '../../ui/ScreenHeader.tsx';
import { useConfirm } from '../../ui/confirmContext.ts';
import albumStyles from '../albums/AlbumScreen.module.css';
import styles from './FoldersScreen.module.css';
import { localized, plural } from '../../lib/i18n.ts';

const t = localized({
  fr: {
    empty: 'vide',
    files: (count: string, n: number) => `${count} ${plural(n, 'fichier', 'fichiers')}`,
    saveTitle: 'Enregistrer ces dossiers ?',
    demoReload: 'Les photos de la démo seront rechargées.',
    reindex: (synced: boolean) =>
      `Nuagerie va réindexer les photos, ce qui prend environ une minute.${synced ? ' Tes autres appareils synchronisés suivront.' : ''}`,
    save: 'Enregistrer',
    title: 'Dossiers',
    back: 'Retour aux réglages',
    help: 'Nuagerie montre les photos et vidéos de ces dossiers OneDrive, et de tout ce qu’ils contiennent.',
    current: 'Dossiers parcourus',
    remove: (name: string) => `Retirer ${name}`,
    removeShort: 'Retirer',
    willReindex: 'Les photos seront réindexées à l’enregistrement.',
    offline: 'Hors connexion : enregistrement impossible pour l’instant.',
    cancel: 'Annuler',
    add: 'Ajouter un dossier',
    backTo: (name: string) => `Revenir à ${name}`,
    loading: 'Chargement…',
    failed: 'Impossible de lister les dossiers.',
    retry: 'Réessayer',
    noSub: (content: string) => `Aucun sous-dossier : ${content}.`,
    emptyFolder: 'Dossier vide.',
    foldersOf: (name: string) => `Dossiers de ${name}`,
    covered: 'parcouru',
    within: (name: string) => `inclus dans ${name}`,
    open: 'Ouvrir',
    addNamed: (name: string) => `Ajouter ${name}`,
    addShort: 'Ajouter',
  },
  en: {
    empty: 'empty',
    files: (count: string, n: number) => `${count} ${plural(n, 'file', 'files')}`,
    saveTitle: 'Save these folders?',
    demoReload: 'The demo photos will be loaded again.',
    reindex: (synced: boolean) =>
      `Nuagerie will index the photos again, which takes about a minute.${synced ? ' Your other synced devices will follow.' : ''}`,
    save: 'Save',
    title: 'Folders',
    back: 'Back to the settings',
    help: 'Nuagerie shows the photos and videos of these OneDrive folders, and of everything they hold.',
    current: 'Folders looked through',
    remove: (name: string) => `Remove ${name}`,
    removeShort: 'Remove',
    willReindex: 'The photos will be indexed again on saving.',
    offline: 'Offline: saving is not possible for now.',
    cancel: 'Cancel',
    add: 'Add a folder',
    backTo: (name: string) => `Back to ${name}`,
    loading: 'Loading…',
    failed: 'Could not list the folders.',
    retry: 'Try again',
    noSub: (content: string) => `No subfolder: ${content}.`,
    emptyFolder: 'Empty folder.',
    foldersOf: (name: string) => `Folders of ${name}`,
    covered: 'looked through',
    within: (name: string) => `included in ${name}`,
    open: 'Open',
    addNamed: (name: string) => `Add ${name}`,
    addShort: 'Add',
  },
});

/** "41 éléments · 3,2 Go": what is right inside, and the weight of it all. */
function folderContent(folder: DriveFolder): string {
  if (folder.childCount === 0) return t.empty;
  const count = formatItemCount(folder.childCount);
  return folder.size ? `${count} · ${formatBytes(folder.size)}` : count;
}

/** "40 fichiers · 120 Mo": the content of a folder that holds no subfolder. */
function filesContent(folder: DriveFolder): string {
  const count = t.files(formatCount(folder.childCount), folder.childCount);
  return folder.size ? `${count} · ${formatBytes(folder.size)}` : count;
}

/** Parent of a folder path ("/" for a first-level folder). */
const parentOf = (path: string) => path.slice(0, path.lastIndexOf('/')) || '/';

/**
 * The root folders of the perimeter: the ones in use, and the drive's
 * folders to add more. Changes are a draft until saved, as saving
 * reindexes everything.
 */
export function FoldersScreen() {
  const { mode, source, resetIndex } = useData();
  const [, navigate] = useLocation();
  const online = useOnline();
  const saved = useRootPaths();
  const [draft, setDraft] = useState<readonly string[]>(saved);
  const changed = draft.join('\n') !== saved.join('\n');
  const listFolders = useMemo(() => source.listFolders?.bind(source), [source]);

  const confirm = useConfirm();
  const { enabled: synced } = useSync();

  const save = async () => {
    const answer = await confirm({
      title: t.saveTitle,
      message: mode === 'demo' ? t.demoReload : t.reindex(synced),
      confirmLabel: t.save,
    });
    if (!answer) return;
    writeRootPaths(draft);
    await resetIndex();
    navigate('/');
  };

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
        <p className={`${common.muted} ${styles.help}`}>{t.help}</p>

        <section aria-labelledby="folders-current">
          <h2 id="folders-current" className={common.sectionTitle}>
            {t.current}
          </h2>
          <ul className={styles.list}>
            {draft.map((path) => (
              <li key={path} className={styles.row}>
                <span className={styles.text}>
                  <span className={styles.name}>{folderName(path)}</span>
                  <span className={styles.meta}>{path}</span>
                </span>
                {draft.length > 1 && (
                  <button
                    type="button"
                    className={styles.action}
                    onClick={() => setDraft(withoutRoot(draft, path))}
                    aria-label={t.remove(folderName(path))}
                  >
                    {t.removeShort}
                  </button>
                )}
              </li>
            ))}
          </ul>
          {changed && (
            <div className={`${common.stack} ${styles.save}`}>
              <p className={common.muted}>{online ? t.willReindex : t.offline}</p>
              <div className={styles.buttons}>
                <button
                  type="button"
                  className={common.button}
                  onClick={() => void save()}
                  disabled={!online}
                >
                  {t.save}
                </button>
                <button type="button" className={common.buttonSoft} onClick={() => setDraft(saved)}>
                  {t.cancel}
                </button>
              </div>
            </div>
          )}
        </section>

        {listFolders && (
          <FolderBrowser
            listFolders={listFolders}
            roots={draft}
            onAdd={(path) => setDraft(withRoot(draft, path))}
          />
        )}
      </div>
    </>
  );
}

function FolderBrowser({
  listFolders,
  roots,
  onAdd,
}: {
  listFolders: (path: string) => Promise<DriveFolder[]>;
  roots: readonly string[];
  onAdd: (path: string) => void;
}) {
  // The folders opened so far, from the drive root: what each holds stays known on the way back.
  const [trail, setTrail] = useState<readonly DriveFolder[]>([]);
  const current = trail.at(-1) ?? null;
  const path = current?.path ?? '/';
  const [attempt, setAttempt] = useState(0);
  const [listing, setListing] = useState<{
    path: string;
    attempt: number;
    folders: DriveFolder[] | null;
  } | null>(null);
  const loading = listing?.path !== path || listing.attempt !== attempt;

  useEffect(() => {
    let active = true;
    listFolders(path).then(
      (folders) => {
        if (active) setListing({ path, attempt, folders });
      },
      () => {
        if (active) setListing({ path, attempt, folders: null });
      },
    );
    return () => {
      active = false;
    };
  }, [listFolders, path, attempt]);

  return (
    <section className={common.section} aria-labelledby="folders-add">
      <h2 id="folders-add" className={common.sectionTitle}>
        {t.add}
      </h2>
      <div className={styles.list}>
        <div className={styles.location}>
          {path !== '/' && (
            <button
              type="button"
              className={styles.up}
              onClick={() => setTrail(trail.slice(0, -1))}
              aria-label={t.backTo(folderName(parentOf(path)))}
            >
              <BackIcon />
            </button>
          )}
          <span className={styles.text}>
            <span className={styles.name}>{folderName(path)}</span>
            {current && (
              <span className={styles.meta}>
                {folderContent(current)} · {current.path}
              </span>
            )}
          </span>
        </div>

        {loading ? (
          <p className={`${common.muted} ${styles.state}`} role="status">
            {t.loading}
          </p>
        ) : listing.folders === null ? (
          <div className={`${styles.state} ${common.stack}`} role="alert">
            <p className={common.muted}>{t.failed}</p>
            <button
              type="button"
              className={common.buttonSoft}
              onClick={() => setAttempt(attempt + 1)}
            >
              {t.retry}
            </button>
          </div>
        ) : listing.folders.length === 0 ? (
          <p className={`${common.muted} ${styles.state}`}>
            {current && current.childCount > 0 ? t.noSub(filesContent(current)) : t.emptyFolder}
          </p>
        ) : (
          <ul aria-label={t.foldersOf(folderName(path))}>
            {listing.folders.map((folder) => {
              const covering = rootCovering(roots, folder.path);
              const opens = folder.childCount > 0;
              const details = [
                covering && (covering === folder.path ? t.covered : t.within(folderName(covering))),
                folderContent(folder),
              ]
                .filter(Boolean)
                .join(' · ');
              return (
                <li key={folder.path} className={styles.row}>
                  <button
                    type="button"
                    className={styles.open}
                    onClick={() => setTrail([...trail, folder])}
                    disabled={!opens}
                  >
                    {/* Named by what it shows (no aria-label: it must say what is seen), with hidden
                        words and commas for screen readers. */}
                    <span className={styles.text}>
                      <span className={styles.name}>
                        {opens && <span className="hidden-inline">{t.open}&nbsp;</span>}
                        {folder.name}
                        <span className="hidden-inline">, </span>
                      </span>
                      <span className={styles.meta}>{details}</span>
                    </span>
                    {opens && <ChevronIcon className={styles.chevron} />}
                  </button>
                  {!covering && (
                    <button
                      type="button"
                      className={styles.action}
                      onClick={() => onAdd(folder.path)}
                      aria-label={t.addNamed(folder.name)}
                    >
                      {t.addShort}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
