import { useMemo } from 'react';
import { Link } from 'wouter';
import { sortAlbums } from '../../data/albums.ts';
import common from '../../ui/common.module.css';
import { IndexStatus } from '../../ui/IndexStatus.tsx';
import { Logo } from '../../ui/Logo.tsx';
import { ScreenHeader } from '../../ui/ScreenHeader.tsx';
import { AlbumSortControls } from './AlbumSortControls.tsx';
import { AlbumTile } from './AlbumTile.tsx';
import tiles from './AlbumTile.module.css';
import styles from './AlbumsScreen.module.css';
import { useAlbumModel, useAlbumSort } from './useAlbums.ts';

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
            <AlbumSortControls sort={sort} onChange={setSort} label="Trier les albums par" />

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
