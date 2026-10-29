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
import { useFavoritesAlbum } from '../favorites/useFavorites.ts';
import { MemoriesSection } from '../memories/MemoriesSection.tsx';
import { useAlbumModel, useAlbumSort } from './useAlbums.ts';
import { localized } from '../../lib/i18n.ts';

const t = localized({
  fr: {
    title: 'Albums',
    choose: 'Choisir les albums',
    chooseShort: 'Choisir',
    sortBy: 'Trier les albums par',
    none: 'Aucun album n’est affiché pour l’instant.',
  },
  en: {
    title: 'Albums',
    choose: 'Choose the albums',
    chooseShort: 'Choose',
    sortBy: 'Sort the albums by',
    none: 'No album is shown yet.',
  },
});

export function AlbumsScreen() {
  const model = useAlbumModel();
  const [sort, setSort] = useAlbumSort();
  const albums = useMemo(() => (model ? sortAlbums(model.home, sort) : []), [model, sort]);
  // The favourites come first, whatever the sort: they gather photos from every album.
  const favorites = useFavoritesAlbum();

  return (
    <>
      <ScreenHeader
        title={t.title}
        leading={<Logo size={32} />}
        actions={
          <Link href="/albums/choisir" className={common.chip} aria-label={t.choose}>
            {t.chooseShort}
          </Link>
        }
      />
      <div className={common.page}>
        <IndexStatus />
        {model && (
          <>
            <MemoriesSection />
            <AlbumSortControls sort={sort} onChange={setSort} label={t.sortBy} />

            {albums.length === 0 && !favorites ? (
              <div className={`${common.card} ${styles.empty}`}>
                <p>{t.none}</p>
                <Link href="/albums/choisir" className={common.button}>
                  {t.choose}
                </Link>
              </div>
            ) : (
              <ul className={tiles.grid} aria-label={t.title}>
                {favorites && (
                  <li>
                    <AlbumTile album={favorites} href="/favoris" menu="favorites" />
                  </li>
                )}
                {albums.map((album) => (
                  <li key={album.id}>
                    <AlbumTile album={album} menu="home" />
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
