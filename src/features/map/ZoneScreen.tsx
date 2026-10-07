import { useMemo } from 'react';
import { Link, useSearchParams } from 'wouter';
import { withoutFolders } from '../../data/albums.ts';
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
  const items = useMemo(() => {
    const bounds = parseBounds(zone);
    return index && bounds ? itemsInBounds(withoutFolders(index, excluded), bounds) : [];
  }, [index, excluded, zone]);

  return (
    <>
      <ScreenHeader
        title="Photos de la zone"
        leading={
          <Link href="/carte" className={albumStyles.back} aria-label="Retour à la carte">
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
