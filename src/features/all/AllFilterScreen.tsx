import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'wouter';
import { folderTree, type FolderNode } from '../../data/albums.ts';
import { useMediaIndex } from '../../data/dataContext.ts';
import { formatCount } from '../../lib/format.ts';
import common from '../../ui/common.module.css';
import { BackIcon, ChevronIcon } from '../../ui/icons.tsx';
import { IndexStatus } from '../../ui/IndexStatus.tsx';
import { ScreenHeader } from '../../ui/ScreenHeader.tsx';
import albumStyles from '../albums/AlbumScreen.module.css';
import styles from '../albums/ChooseAlbumsScreen.module.css';
import { useAllFilter } from './useAllFilter.ts';

/** Lowercase, without accents: "Événements" matches "evene". */
const normalize = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

interface Row {
  node: FolderNode;
  depth: number;
  /** Nearest hidden ancestor: the folder is hidden with it. */
  hiddenWith: FolderNode | null;
  path: string[];
}

/** Which folders "Tout" shows: unchecking one hides it and everything below it. */
export function AllFilterScreen() {
  const index = useMediaIndex();
  const tree = useMemo(() => (index ? folderTree(index) : []), [index]);
  const { excluded, setShown, showAll } = useAllFilter();
  // The same filter serves the map: come back where it was opened from.
  const [params] = useSearchParams();
  const fromMap = params.get('retour') === 'carte';
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  /** Items of each folder, sub-folders included. */
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of index?.items ?? []) {
      for (let id: string | null = item.albumId; id !== null;) {
        map.set(id, (map.get(id) ?? 0) + 1);
        id = index?.folders.get(id)?.parentId ?? null;
      }
    }
    return map;
  }, [index]);

  const rows = useMemo(() => {
    const result: Row[] = [];
    const search = normalize(query.trim());
    const walk = (
      node: FolderNode,
      depth: number,
      hiddenWith: FolderNode | null,
      path: string[],
    ) => {
      if (!search || normalize(node.folder.name).includes(search)) {
        result.push({ node, depth: search ? 0 : depth, hiddenWith, path });
      }
      if (!search && !expanded.has(node.folder.id)) return;
      const nextHidden = hiddenWith ?? (excluded.has(node.folder.id) ? node : null);
      for (const child of node.children) {
        walk(child, depth + 1, nextHidden, [...path, node.folder.name]);
      }
    };
    for (const node of tree) walk(node, 0, null, []);
    return result;
  }, [tree, expanded, excluded, query]);

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
        title={fromMap ? 'Filtrer la carte' : 'Filtrer « Tout »'}
        leading={
          <Link
            href={fromMap ? '/carte' : '/tout'}
            className={albumStyles.back}
            aria-label={fromMap ? 'Retour à la carte' : 'Retour à Tout'}
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
              Décoche un dossier pour masquer ses photos dans « Tout » et sur la carte. Ses
              sous-dossiers sont masqués avec lui. Les albums ne changent pas.
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

            <ul className={styles.list} aria-label="Dossiers affichés dans Tout">
              {rows.map(({ node, depth, hiddenWith, path }) => {
                const { id, name } = node.folder;
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
                        checked={hiddenWith === null && !excluded.has(id)}
                        disabled={hiddenWith !== null}
                        onChange={(event) => setShown(id, event.target.checked)}
                      />
                      <span className={styles.text}>
                        <span className={styles.name}>{name}</span>
                        <span className={styles.meta}>
                          {searching && path.length > 0 && `${path.join(' › ')} · `}
                          {hiddenWith
                            ? `masqué avec ${hiddenWith.folder.name}`
                            : `${formatCount(count)} élément${count > 1 ? 's' : ''}`}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            {rows.length === 0 && <p className={common.muted}>Aucun dossier ne correspond.</p>}

            {excluded.size > 0 && (
              <button
                type="button"
                className={`${common.buttonSoft} ${styles.reset}`}
                onClick={showAll}
              >
                Tout afficher
              </button>
            )}
          </>
        )}
      </div>
    </>
  );
}
