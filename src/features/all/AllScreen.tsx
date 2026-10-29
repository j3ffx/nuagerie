import { useMemo } from 'react';
import { Link } from 'wouter';
import { orderItems, withoutFolders } from '../../data/albums.ts';
import { useMediaIndex } from '../../data/dataContext.ts';
import { formatCount, formatItemCount } from '../../lib/format.ts';
import common from '../../ui/common.module.css';
import { FilterIcon, SortDownIcon, SortUpIcon } from '../../ui/icons.tsx';
import { IndexStatus } from '../../ui/IndexStatus.tsx';
import { ScreenHeader } from '../../ui/ScreenHeader.tsx';
import albumStyles from '../albums/AlbumScreen.module.css';
import { orderToggleLabel } from '../albums/albumSortLabels.ts';
import { PhotoBrowser } from '../viewer/PhotoBrowser.tsx';
import styles from './AllScreen.module.css';
import { useAllFilter, useAllOrder } from './useAllFilter.ts';
import { localized, plural } from '../../lib/i18n.ts';

const t = localized({
  fr: {
    title: 'Tout',
    filterHidden: (count: string, n: number) =>
      `Filtrer par albums (${count} ${plural(n, 'masqué', 'masqués')})`,
    filterBy: 'Filtrer par albums',
    filter: 'Filtrer',
    hiddenFolders: (count: string, n: number) =>
      ` · ${count} ${plural(n, 'dossier masqué', 'dossiers masqués')}`,
    photos: 'Photos et vidéos',
  },
  en: {
    title: 'All',
    filterHidden: (count: string) => `Filter by album (${count} hidden)`,
    filterBy: 'Filter by album',
    filter: 'Filter',
    hiddenFolders: (count: string, n: number) =>
      ` · ${count} ${plural(n, 'hidden folder', 'hidden folders')}`,
    photos: 'Photos and videos',
  },
});

/**
 * Every photo and video of the perimeter, "Sans date" last, in either date
 * order, without the folders the user chose to hide.
 */
export function AllScreen() {
  const index = useMediaIndex();
  const { excluded } = useAllFilter();
  const [order, setOrder] = useAllOrder();
  const items = useMemo(
    () => (index ? orderItems(withoutFolders(index, excluded), order) : []),
    [index, excluded, order],
  );
  // Folders that still exist (a hidden folder may have been deleted since).
  const hiddenCount = index ? [...excluded].filter((id) => index.folders.has(id)).length : 0;

  return (
    <>
      <ScreenHeader
        title={t.title}
        actions={
          <>
            <button
              type="button"
              className={albumStyles.order}
              onClick={() => setOrder(order === 'desc' ? 'asc' : 'desc')}
              aria-label={orderToggleLabel(order)}
            >
              {order === 'desc' ? <SortDownIcon /> : <SortUpIcon />}
            </button>
            <Link
              href="/tout/filtre"
              className={`${common.chip} ${styles.filter}`}
              aria-label={
                hiddenCount > 0 ? t.filterHidden(formatCount(hiddenCount), hiddenCount) : t.filterBy
              }
            >
              <FilterIcon width={18} height={18} />
              {hiddenCount > 0 ? formatCount(hiddenCount) : t.filter}
            </Link>
          </>
        }
      />
      <IndexStatus />
      {index && (
        <>
          <p className={`${common.muted} ${styles.summary}`}>
            {formatItemCount(items.length)}
            {hiddenCount > 0 && t.hiddenFolders(formatCount(hiddenCount), hiddenCount)}
          </p>
          <PhotoBrowser items={items} label={t.photos} />
        </>
      )}
    </>
  );
}
