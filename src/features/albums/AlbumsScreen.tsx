import { useMemo } from 'react';
import { useMediaIndex } from '../../data/dataContext.ts';
import { formatItemCount, formatYearRange } from '../../lib/format.ts';
import common from '../../ui/common.module.css';
import { Logo } from '../../ui/Logo.tsx';
import { ScreenHeader } from '../../ui/ScreenHeader.tsx';
import { IndexStatus } from '../../ui/IndexStatus.tsx';
import { Thumbnail } from '../../ui/Thumbnail.tsx';
import styles from './AlbumsScreen.module.css';
import { topLevelAlbums } from './topLevelAlbums.ts';

export function AlbumsScreen() {
  const index = useMediaIndex();
  const albums = useMemo(() => (index ? topLevelAlbums(index) : []), [index]);

  return (
    <>
      <ScreenHeader title="Albums" leading={<Logo size={32} />} />
      <div className={common.page}>
        <IndexStatus />
        {index && (
          <ul className={styles.grid} aria-label="Albums">
            {albums.map(({ folder, count, cover, first, last }) => (
              <li key={folder.id} className={styles.tile}>
                {cover ? (
                  <Thumbnail item={cover} className={styles.cover} />
                ) : (
                  <div className={styles.cover} aria-hidden="true" />
                )}
                <div className={styles.caption}>
                  <span className={styles.name}>{folder.name}</span>
                  <span className={styles.meta}>{formatItemCount(count)}</span>
                  {first !== null && last !== null && (
                    <span className={styles.meta}>{formatYearRange(first, last)}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
