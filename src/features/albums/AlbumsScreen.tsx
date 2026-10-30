import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { sortAlbums } from '../../data/albums.ts';
import { useMediaIndex } from '../../data/dataContext.ts';
import { PlusIcon } from '../../ui/icons.tsx';
import { NameDialog } from '../edits/EditDialogs.tsx';
import { useEdits } from '../edits/editsContext.ts';
import { useCreateAlbum } from '../edits/useCreateAlbum.ts';
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
    newAlbum: 'Nouvel album',
    create: 'Créer',
    none: 'Aucun album n’est affiché pour l’instant.',
  },
  en: {
    title: 'Albums',
    choose: 'Choose the albums',
    chooseShort: 'Choose',
    sortBy: 'Sort the albums by',
    newAlbum: 'New album',
    create: 'Create',
    none: 'No album is shown yet.',
  },
});

export function AlbumsScreen() {
  const model = useAlbumModel();
  const [sort, setSort] = useAlbumSort();
  const albums = useMemo(() => (model ? sortAlbums(model.home, sort) : []), [model, sort]);
  // The favourites come first, whatever the sort: they gather photos from every album.
  const favorites = useFavoritesAlbum();
  const edits = useEdits();
  const createAlbum = useCreateAlbum();
  const index = useMediaIndex();
  const [creating, setCreating] = useState(false);
  // A new album goes into the first root folder (the Photos folder, by default).
  const newParent = index?.rootFolderIds[0] ?? null;

  return (
    <>
      <ScreenHeader
        title={t.title}
        leading={<Logo size={32} />}
        actions={
          <>
            {edits.status !== 'off' && newParent && (
              <button
                type="button"
                className={styles.newAlbum}
                onClick={() => setCreating(true)}
                disabled={!edits.usable}
                aria-label={t.newAlbum}
                title={t.newAlbum}
              >
                <PlusIcon width={20} height={20} />
              </button>
            )}
            <Link href="/albums/choisir" className={common.chip} aria-label={t.choose}>
              {t.chooseShort}
            </Link>
          </>
        }
      />
      {creating && newParent && (
        <NameDialog
          title={t.newAlbum}
          confirmLabel={t.create}
          parentId={newParent}
          onCancel={() => setCreating(false)}
          onDone={async (name) => {
            await createAlbum(newParent, name);
            setCreating(false);
          }}
        />
      )}
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
