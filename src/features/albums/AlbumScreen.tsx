import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { orderItems, sortAlbums, type Album } from '../../data/albums.ts';
import { formatItemCount, formatYearRange } from '../../lib/format.ts';
import common from '../../ui/common.module.css';
import { BackIcon, SortDownIcon, SortUpIcon } from '../../ui/icons.tsx';
import { IndexStatus } from '../../ui/IndexStatus.tsx';
import { PhotoBrowser } from '../viewer/PhotoBrowser.tsx';
import { ScreenHeader } from '../../ui/ScreenHeader.tsx';
import { AlbumSortControls } from './AlbumSortControls.tsx';
import { orderToggleLabel, sortSummary } from './albumSortLabels.ts';
import { AlbumTile } from './AlbumTile.tsx';
import tiles from './AlbumTile.module.css';
import styles from './AlbumScreen.module.css';
import { useAlbumModel, usePhotoOrder, useSubAlbumSort } from './useAlbums.ts';
import { localized, plural } from '../../lib/i18n.ts';

const t = localized({
  fr: {
    backTo: (name: string) => `Retour à ${name}`,
    back: 'Retour aux albums',
    album: 'Album',
    gone: 'Cet album n’existe plus ou n’est plus sélectionné.',
    subAlbums: (count: number) => `${count} ${plural(count, 'sous-album', 'sous-albums')}`,
    sortSubAlbums: (summary: string) => `Trier les sous-albums (${summary})`,
    sort: 'Trier',
    sortBy: 'Trier les sous-albums par',
    photosOf: (name: string) => `Photos et vidéos de ${name}`,
    empty: 'Cet album est vide.',
  },
  en: {
    backTo: (name: string) => `Back to ${name}`,
    back: 'Back to the albums',
    album: 'Album',
    gone: 'This album no longer exists or is no longer selected.',
    subAlbums: (count: number) => `${count} ${plural(count, 'sub-album', 'sub-albums')}`,
    sortSubAlbums: (summary: string) => `Sort the sub-albums (${summary})`,
    sort: 'Sort',
    sortBy: 'Sort the sub-albums by',
    photosOf: (name: string) => `Photos and videos of ${name}`,
    empty: 'This album is empty.',
  },
});

/** Back to the parent album, or to the albums. */
function BackLink({ parent }: { parent: Album | null }) {
  return (
    <Link
      href={parent ? `/album/${encodeURIComponent(parent.id)}` : '/'}
      className={styles.back}
      aria-label={parent ? t.backTo(parent.name) : t.back}
    >
      <BackIcon />
    </Link>
  );
}

export function AlbumScreen({ params }: { params: { id: string } }) {
  const model = useAlbumModel();
  const album = model?.byId.get(decodeURIComponent(params.id)) ?? null;
  const parent = album?.parentId ? (model?.byId.get(album.parentId) ?? null) : null;
  const [order, setOrder] = usePhotoOrder();
  const items = useMemo(() => (album ? orderItems(album.items, order) : []), [album, order]);

  const back = <BackLink parent={parent} />;

  if (model && !album) {
    return (
      <>
        <ScreenHeader title={t.album} leading={back} />
        <div className={common.page}>
          <p className={common.muted}>{t.gone}</p>
        </div>
      </>
    );
  }

  return (
    <>
      <ScreenHeader
        title={album?.name ?? ''}
        leading={back}
        actions={
          album && album.items.length > 1 ? (
            <button
              type="button"
              className={styles.order}
              onClick={() => setOrder(order === 'desc' ? 'asc' : 'desc')}
              aria-label={orderToggleLabel(order)}
            >
              {order === 'desc' ? <SortDownIcon /> : <SortUpIcon />}
            </button>
          ) : undefined
        }
      />
      <IndexStatus />
      {album && model && <AlbumContent album={album} items={items} model={model} />}
    </>
  );
}

function AlbumContent({
  album,
  items,
  model,
}: {
  album: Album;
  items: Album['items'];
  model: NonNullable<ReturnType<typeof useAlbumModel>>;
}) {
  const [subSort, setSubSort] = useSubAlbumSort();
  const [sorting, setSorting] = useState(false);
  const subAlbums = useMemo(
    () =>
      sortAlbums(
        album.subAlbumIds
          .map((id) => model.byId.get(id))
          .filter((sub): sub is Album => sub !== undefined),
        subSort,
      ),
    [album, model, subSort],
  );

  return (
    <>
      <p className={`${common.muted} ${styles.summary}`}>
        {[
          album.items.length > 0 ? formatItemCount(album.items.length) : null,
          album.first !== null && album.last !== null
            ? formatYearRange(album.first, album.last)
            : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>

      {subAlbums.length > 0 && (
        <section className={styles.subAlbums} aria-labelledby="sub-albums">
          <div className={styles.subHeader}>
            <h2 id="sub-albums" className={common.sectionTitle}>
              {t.subAlbums(subAlbums.length)}
            </h2>
            {subAlbums.length > 1 && (
              <button
                type="button"
                className={styles.sortToggle}
                aria-expanded={sorting}
                aria-controls="sub-album-sort"
                aria-label={t.sortSubAlbums(sortSummary(subSort))}
                onClick={() => setSorting(!sorting)}
              >
                {subSort.direction === 'desc' ? <SortDownIcon /> : <SortUpIcon />}
                {t.sort}
              </button>
            )}
          </div>
          {sorting && (
            <div id="sub-album-sort">
              <AlbumSortControls sort={subSort} onChange={setSubSort} label={t.sortBy} />
            </div>
          )}
          <ul className={`${tiles.grid} ${styles.subGrid}`}>
            {subAlbums.map((sub) => (
              <li key={sub.id}>
                <AlbumTile album={sub} menu="sub" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {items.length > 0 ? (
        // One per album: wouter keeps this screen from one album to the next, and a
        // selection must not follow into a sub-album.
        <PhotoBrowser key={album.id} items={items} label={t.photosOf(album.name)} />
      ) : (
        subAlbums.length === 0 && <p className={`${common.muted} ${styles.summary}`}>{t.empty}</p>
      )}
    </>
  );
}
