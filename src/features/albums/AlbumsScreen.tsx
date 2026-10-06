import { useMemo } from 'react';
import { Link } from 'wouter';
import { sortAlbums, type AlbumSort, type AlbumSortKey } from '../../data/albums.ts';
import common from '../../ui/common.module.css';
import { SortDownIcon, SortUpIcon } from '../../ui/icons.tsx';
import { IndexStatus } from '../../ui/IndexStatus.tsx';
import { Logo } from '../../ui/Logo.tsx';
import { ScreenHeader } from '../../ui/ScreenHeader.tsx';
import { AlbumTile } from './AlbumTile.tsx';
import tiles from './AlbumTile.module.css';
import styles from './AlbumsScreen.module.css';
import { useAlbumModel, useAlbumSort } from './useAlbums.ts';

const SORT_LABELS: Record<AlbumSortKey, string> = {
  last: 'Dernière photo',
  first: 'Première photo',
  name: 'Nom',
};

function directionLabel(sort: AlbumSort): string {
  if (sort.key === 'name') return sort.direction === 'asc' ? 'A → Z' : 'Z → A';
  return sort.direction === 'desc' ? 'Récent d’abord' : 'Ancien d’abord';
}

export function AlbumsScreen() {
  const model = useAlbumModel();
  const [sort, setSort] = useAlbumSort();
  const albums = useMemo(() => (model ? sortAlbums(model.home, sort) : []), [model, sort]);

  return (
    <>
      <ScreenHeader
        title="Albums"
        leading={<Logo size={32} />}
        actions={
          <Link href="/albums/choisir" className={common.chip} aria-label="Choisir les albums">
            Choisir
          </Link>
        }
      />
      <div className={common.page}>
        <IndexStatus />
        {model && (
          <>
            <div className={styles.toolbar}>
              <label className={styles.sort}>
                <span className="visually-hidden">Trier les albums par</span>
                <select
                  value={sort.key}
                  onChange={(event) => {
                    const key = event.target.value as AlbumSortKey;
                    // Each criterion starts in its natural order: A → Z, most recent first.
                    setSort({ key, direction: key === 'name' ? 'asc' : 'desc' });
                  }}
                >
                  {Object.entries(SORT_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className={styles.direction}
                onClick={() =>
                  setSort({ ...sort, direction: sort.direction === 'desc' ? 'asc' : 'desc' })
                }
                aria-label={`Ordre : ${directionLabel(sort)}. Inverser`}
              >
                {sort.direction === 'desc' ? <SortDownIcon /> : <SortUpIcon />}
                {directionLabel(sort)}
              </button>
            </div>

            {albums.length === 0 ? (
              <div className={`${common.card} ${styles.empty}`}>
                <p>Aucun album n’est affiché pour l’instant.</p>
                <Link href="/albums/choisir" className={common.button}>
                  Choisir les albums
                </Link>
              </div>
            ) : (
              <ul className={tiles.grid} aria-label="Albums">
                {albums.map((album) => (
                  <li key={album.id}>
                    <AlbumTile album={album} />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </>
  );
}
