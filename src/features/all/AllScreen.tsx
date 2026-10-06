import { useMediaIndex } from '../../data/dataContext.ts';
import { formatCount } from '../../lib/format.ts';
import common from '../../ui/common.module.css';
import { IndexStatus } from '../../ui/IndexStatus.tsx';
import { ScreenHeader } from '../../ui/ScreenHeader.tsx';
import { Thumbnail } from '../../ui/Thumbnail.tsx';
import styles from './AllScreen.module.css';

/** Preview: the most recent items only, until the virtualized grid lands. */
const PREVIEW_COUNT = 300;

export function AllScreen() {
  const index = useMediaIndex();

  return (
    <>
      <ScreenHeader title="Tout" />
      <IndexStatus />
      {index && (
        <>
          <p className={`${common.muted} ${styles.summary}`}>
            {formatCount(index.items.length)} éléments · aperçu des{' '}
            {formatCount(Math.min(PREVIEW_COUNT, index.items.length))} plus récents
          </p>
          <ul className={styles.grid} aria-label="Photos et vidéos">
            {index.items.slice(0, PREVIEW_COUNT).map((item) => (
              <li key={item.id}>
                <Thumbnail item={item} />
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
