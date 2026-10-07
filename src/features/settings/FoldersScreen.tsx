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
import { useOnline } from '../../lib/online.ts';
import common from '../../ui/common.module.css';
import { BackIcon, ChevronIcon } from '../../ui/icons.tsx';
import { ScreenHeader } from '../../ui/ScreenHeader.tsx';
import albumStyles from '../albums/AlbumScreen.module.css';
import styles from './FoldersScreen.module.css';

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

  const save = async () => {
    const message =
      mode === 'demo'
        ? 'Enregistrer ces dossiers ? Les photos de la démo seront rechargées.'
        : 'Enregistrer ces dossiers ? Nuagerie va réindexer les photos, ce qui prend environ une minute.';
    if (!window.confirm(message)) return;
    writeRootPaths(draft);
    await resetIndex();
    navigate('/');
  };

  return (
    <>
      <ScreenHeader
        title="Dossiers"
        leading={
          <Link href="/reglages" className={albumStyles.back} aria-label="Retour aux réglages">
            <BackIcon />
          </Link>
        }
      />
      <div className={common.page}>
        <p className={`${common.muted} ${styles.help}`}>
          Nuagerie montre les photos et vidéos de ces dossiers OneDrive, et de tout ce qu’ils
          contiennent.
        </p>

        <section aria-labelledby="folders-current">
          <h2 id="folders-current" className={common.sectionTitle}>
            Dossiers parcourus
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
                    aria-label={`Retirer ${folderName(path)}`}
                  >
                    Retirer
                  </button>
                )}
              </li>
            ))}
          </ul>
          {changed && (
            <div className={`${common.stack} ${styles.save}`}>
              <p className={common.muted}>
                {online
                  ? 'Les photos seront réindexées à l’enregistrement.'
                  : 'Hors connexion : enregistrement impossible pour l’instant.'}
              </p>
              <div className={styles.buttons}>
                <button
                  type="button"
                  className={common.button}
                  onClick={() => void save()}
                  disabled={!online}
                >
                  Enregistrer
                </button>
                <button type="button" className={common.buttonSoft} onClick={() => setDraft(saved)}>
                  Annuler
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
  const [path, setPath] = useState('/');
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
        Ajouter un dossier
      </h2>
      <div className={styles.list}>
        <div className={styles.location}>
          {path !== '/' && (
            <button
              type="button"
              className={styles.up}
              onClick={() => setPath(parentOf(path))}
              aria-label={`Revenir à ${folderName(parentOf(path))}`}
            >
              <BackIcon />
            </button>
          )}
          <span className={styles.text}>
            <span className={styles.name}>{folderName(path)}</span>
            {path !== '/' && <span className={styles.meta}>{path}</span>}
          </span>
        </div>

        {loading ? (
          <p className={`${common.muted} ${styles.state}`} role="status">
            Chargement…
          </p>
        ) : listing.folders === null ? (
          <div className={`${styles.state} ${common.stack}`} role="alert">
            <p className={common.muted}>Impossible de lister les dossiers.</p>
            <button
              type="button"
              className={common.buttonSoft}
              onClick={() => setAttempt(attempt + 1)}
            >
              Réessayer
            </button>
          </div>
        ) : listing.folders.length === 0 ? (
          <p className={`${common.muted} ${styles.state}`}>Aucun sous-dossier.</p>
        ) : (
          <ul aria-label={`Dossiers de ${folderName(path)}`}>
            {listing.folders.map((folder) => {
              const covering = rootCovering(roots, folder.path);
              return (
                <li key={folder.path} className={styles.row}>
                  <button
                    type="button"
                    className={styles.open}
                    onClick={() => setPath(folder.path)}
                    disabled={!folder.hasChildren}
                    aria-label={folder.hasChildren ? `Ouvrir ${folder.name}` : undefined}
                  >
                    <span className={styles.text}>
                      <span className={styles.name}>{folder.name}</span>
                      {covering && (
                        <span className={styles.meta}>
                          {covering === folder.path
                            ? 'parcouru'
                            : `inclus dans ${folderName(covering)}`}
                        </span>
                      )}
                    </span>
                    {folder.hasChildren && <ChevronIcon className={styles.chevron} />}
                  </button>
                  {!covering && (
                    <button
                      type="button"
                      className={styles.action}
                      onClick={() => onAdd(folder.path)}
                      aria-label={`Ajouter ${folder.name}`}
                    >
                      Ajouter
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
