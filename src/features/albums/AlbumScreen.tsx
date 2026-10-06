import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { orderItems, sortAlbums, type Album } from '../../data/albums.ts';
import { formatItemCount, formatYearRange } from '../../lib/format.ts';
import common from '../../ui/common.module.css';
import { BackIcon, SortDownIcon, SortUpIcon } from '../../ui/icons.tsx';
import { IndexStatus } from '../../ui/IndexStatus.tsx';
import { PhotoGrid } from '../../ui/grid/PhotoGrid.tsx';
import { ScreenHeader } from '../../ui/ScreenHeader.tsx';
import { AlbumSortControls } from './AlbumSortControls.tsx';
import { sortSummary } from './albumSortLabels.ts';
import { AlbumTile } from './AlbumTile.tsx';
import tiles from './AlbumTile.module.css';
import styles from './AlbumScreen.module.css';
import { useAlbumModel, usePhotoOrder, useSubAlbumSort } from './useAlbums.ts';

export function AlbumScreen({ params }: { params: { id: string } }) {
  const model = useAlbumModel();
  const album = model?.byId.get(decodeURIComponent(params.id)) ?? null;
  const parent = album?.parentId ? (model?.byId.get(album.parentId) ?? null) : null;
  const [order, setOrder] = usePhotoOrder();
  const items = useMemo(() => (album ? orderItems(album.items, order) : []), [album, order]);

  const back = (
    <Link
      href={parent ? `/album/${encodeURIComponent(parent.id)}` : '/'}
      className={styles.back}
      aria-label={parent ? `Retour à ${parent.name}` : 'Retour aux albums'}
    >
      <BackIcon />
    </Link>
  );

  if (model && !album) {
    return (
      <>
        <ScreenHeader title="Album" leading={back} />
        <div className={common.page}>
          <p className={common.muted}>Cet album n’existe plus ou n’est plus sélectionné.</p>
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
              aria-label={`Ordre : ${order === 'desc' ? 'récent d’abord' : 'ancien d’abord'}. Inverser`}
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
              {subAlbums.length > 1 ? `${subAlbums.length} sous-albums` : '1 sous-album'}
            </h2>
            {subAlbums.length > 1 && (
              <button
                type="button"
                className={styles.sortToggle}
                aria-expanded={sorting}
                aria-controls="sub-album-sort"
                aria-label={`Trier les sous-albums (${sortSummary(subSort)})`}
                onClick={() => setSorting(!sorting)}
              >
                {subSort.direction === 'desc' ? <SortDownIcon /> : <SortUpIcon />}
                Trier
              </button>
            )}
          </div>
          {sorting && (
            <div id="sub-album-sort">
              <AlbumSortControls
                sort={subSort}
                onChange={setSubSort}
                label="Trier les sous-albums par"
              />
            </div>
          )}
          <ul className={`${tiles.grid} ${styles.subGrid}`}>
            {subAlbums.map((sub) => (
              <li key={sub.id}>
                <AlbumTile album={sub} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {items.length > 0 ? (
        <PhotoGrid items={items} label={`Photos et vidéos de ${album.name}`} />
      ) : (
        subAlbums.length === 0 && (
          <p className={`${common.muted} ${styles.summary}`}>Cet album est vide.</p>
        )
      )}
    </>
  );
}
