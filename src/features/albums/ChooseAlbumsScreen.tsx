import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'wouter';
import { folderTree, type FolderNode } from '../../data/albums.ts';
import { useMediaIndex } from '../../data/dataContext.ts';
import { formatCount } from '../../lib/format.ts';
import common from '../../ui/common.module.css';
import { BackIcon, ChevronIcon } from '../../ui/icons.tsx';
import { IndexStatus } from '../../ui/IndexStatus.tsx';
import { ScreenHeader } from '../../ui/ScreenHeader.tsx';
import { useConfirm } from '../../ui/confirmContext.ts';
import albumStyles from './AlbumScreen.module.css';
import styles from './ChooseAlbumsScreen.module.css';
import { useAlbumSelection } from './useAlbums.ts';

/** Lowercase, without accents: "Événements" matches "evene". */
const normalize = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** "1 234 éléments", or "7 dossiers" for a folder holding only subfolders. */
function contentLabel(count: number, folders: number): string {
  if (count === 0 && folders > 0) return `${formatCount(folders)} dossier${folders > 1 ? 's' : ''}`;
  return `${formatCount(count)} élément${count > 1 ? 's' : ''}`;
}

interface Row {
  node: FolderNode;
  depth: number;
  /** Nearest checked ancestor: the row is then a sub-album of it. */
  parentAlbum: FolderNode | null;
  path: string[];
}

export function ChooseAlbumsScreen() {
  const index = useMediaIndex();
  const tree = useMemo(() => (index ? folderTree(index) : []), [index]);
  const { checked, hidden, setChecked, setHidden, reset, selection } = useAlbumSelection();
  // Also opened from the settings: go back there.
  const [params] = useSearchParams();
  const fromSettings = params.get('retour') === 'reglages';
  const confirm = useConfirm();
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of index?.items ?? []) map.set(item.albumId, (map.get(item.albumId) ?? 0) + 1);
    return map;
  }, [index]);

  const rows = useMemo(() => {
    const result: Row[] = [];
    const search = normalize(query.trim());
    const walk = (
      node: FolderNode,
      depth: number,
      parentAlbum: FolderNode | null,
      path: string[],
    ) => {
      const matches = !search || normalize(node.folder.name).includes(search);
      if (matches) result.push({ node, depth: search ? 0 : depth, parentAlbum, path });
      const open = search || expanded.has(node.folder.id);
      if (!open) return;
      const nextParent = parentAlbum ?? (checked.has(node.folder.id) ? node : null);
      for (const child of node.children) {
        walk(child, depth + 1, nextParent, [...path, node.folder.name]);
      }
    };
    for (const node of tree) walk(node, 0, null, []);
    return result;
  }, [tree, expanded, checked, query]);

  const toggleOpen = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  const searching = query.trim() !== '';

  return (
    <>
      <ScreenHeader
        title="Choisir les albums"
        leading={
          <Link
            href={fromSettings ? '/reglages' : '/'}
            className={albumStyles.back}
            aria-label={fromSettings ? 'Retour aux réglages' : 'Retour aux albums'}
          >
            <BackIcon />
          </Link>
        }
      />
      <div className={common.page}>
        <IndexStatus />
        {index && (
          <>
            <p className={`${common.muted} ${styles.help}`}>
              Un dossier coché devient un album. Ses sous-dossiers deviennent ses sous-albums : ils
              s’affichent dans sa page, et chacun peut être masqué.
            </p>
            <label className={styles.search}>
              <span className="visually-hidden">Rechercher un dossier</span>
              <input
                type="search"
                placeholder="Rechercher un dossier"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>

            <ul className={styles.list} aria-label="Dossiers">
              {rows.map(({ node, depth, parentAlbum, path }) => {
                const { id, name } = node.folder;
                const isSubAlbum = parentAlbum !== null;
                const on = isSubAlbum ? !hidden.has(id) : checked.has(id);
                const count = counts.get(id) ?? 0;
                return (
                  <li key={id} className={styles.row} style={{ paddingLeft: `${depth * 20}px` }}>
                    {node.children.length > 0 && !searching ? (
                      <button
                        type="button"
                        className={styles.expand}
                        aria-expanded={expanded.has(id)}
                        aria-label={`${expanded.has(id) ? 'Replier' : 'Déplier'} ${name}`}
                        onClick={() => toggleOpen(id)}
                      >
                        <ChevronIcon />
                      </button>
                    ) : (
                      <span className={styles.expandSpacer} aria-hidden="true" />
                    )}
                    <label className={styles.label}>
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={(event) =>
                          isSubAlbum
                            ? setHidden(id, !event.target.checked)
                            : setChecked(id, event.target.checked)
                        }
                      />
                      <span className={styles.text}>
                        <span className={styles.name}>{name}</span>
                        <span className={styles.meta}>
                          {searching && path.length > 0 && `${path.join(' › ')} · `}
                          {isSubAlbum
                            ? `sous-album de ${parentAlbum.folder.name}${on ? '' : ' · masqué'}`
                            : contentLabel(count, node.children.length)}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            {rows.length === 0 && <p className={common.muted}>Aucun dossier ne correspond.</p>}

            {selection.checked !== null && (
              <button
                type="button"
                className={`${common.buttonSoft} ${styles.reset}`}
                onClick={() =>
                  void confirm({
                    title: 'Revenir à la sélection par défaut ?',
                    message:
                      'Les dossiers de premier niveau redeviennent les albums de l’accueil, et plus aucun sous-album n’est masqué.',
                    confirmLabel: 'Revenir au défaut',
                  }).then((answer) => answer && reset())
                }
              >
                Revenir à la sélection par défaut
              </button>
            )}
          </>
        )}
      </div>
    </>
  );
}
