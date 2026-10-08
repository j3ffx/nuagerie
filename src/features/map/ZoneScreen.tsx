import { useMemo } from 'react';
import { Link, useSearchParams } from 'wouter';
import { withinFolder, withoutFolders } from '../../data/albums.ts';
import { useMediaIndex } from '../../data/dataContext.ts';
import { formatItemCount } from '../../lib/format.ts';
import common from '../../ui/common.module.css';
import { BackIcon } from '../../ui/icons.tsx';
import { IndexStatus } from '../../ui/IndexStatus.tsx';
import { ScreenHeader } from '../../ui/ScreenHeader.tsx';
import albumStyles from '../albums/AlbumScreen.module.css';
import allStyles from '../all/AllScreen.module.css';
import { useAllFilter } from '../all/useAllFilter.ts';
import { PhotoBrowser } from '../viewer/PhotoBrowser.tsx';
import { itemsInBounds, parseBounds } from './clusters.ts';

/** Every photo of a map zone (`?b=west,south,east,north`), in a grid by month. */
export function ZoneScreen() {
  const index = useMediaIndex();
  const { excluded } = useAllFilter();
  const [params] = useSearchParams();
  const zone = params.get('b');
  // From an album's map: that album and its sub-albums only.
  const albumId = params.get('album');
  const items = useMemo(() => {
    const bounds = parseBounds(zone);
    if (!index || !bounds) return [];
    const shown =
      albumId && index.folders.has(albumId)
        ? withinFolder(index, albumId)
        : withoutFolders(index, excluded);
    return itemsInBounds(shown, bounds);
  }, [index, excluded, zone, albumId]);

  return (
    <>
      <ScreenHeader
        title="Photos de la zone"
        leading={
          <Link
            href={albumId ? `/carte?album=${encodeURIComponent(albumId)}` : '/carte'}
            className={albumStyles.back}
            aria-label="Retour à la carte"
          >
            <BackIcon />
          </Link>
        }
      />
      <IndexStatus />
      {index && (
        <>
          <p className={`${common.muted} ${allStyles.summary}`}>{formatItemCount(items.length)}</p>
          <PhotoBrowser items={items} label="Photos de la zone" />
        </>
      )}
    </>
  );
}
