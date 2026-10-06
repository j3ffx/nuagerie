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
import { PhotoBrowser } from '../viewer/PhotoBrowser.tsx';
import styles from './AllScreen.module.css';
import { useAllFilter, useAllOrder } from './useAllFilter.ts';

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
        title="Tout"
        actions={
          <>
            <button
              type="button"
              className={albumStyles.order}
              onClick={() => setOrder(order === 'desc' ? 'asc' : 'desc')}
              aria-label={`Ordre : ${order === 'desc' ? 'récent d’abord' : 'ancien d’abord'}. Inverser`}
            >
              {order === 'desc' ? <SortDownIcon /> : <SortUpIcon />}
            </button>
            <Link
              href="/tout/filtre"
              className={`${common.chip} ${styles.filter}`}
              aria-label={
                hiddenCount > 0
                  ? `Filtrer par albums (${formatCount(hiddenCount)} masqué${hiddenCount > 1 ? 's' : ''})`
                  : 'Filtrer par albums'
              }
            >
              <FilterIcon width={18} height={18} />
              {hiddenCount > 0 ? formatCount(hiddenCount) : 'Filtrer'}
            </Link>
          </>
        }
      />
      <IndexStatus />
      {index && (
        <>
          <p className={`${common.muted} ${styles.summary}`}>
            {formatItemCount(items.length)}
            {hiddenCount > 0 &&
              ` · ${formatCount(hiddenCount)} dossier${hiddenCount > 1 ? 's' : ''} masqué${hiddenCount > 1 ? 's' : ''}`}
          </p>
          <PhotoBrowser items={items} label="Photos et vidéos" />
        </>
      )}
    </>
  );
}
