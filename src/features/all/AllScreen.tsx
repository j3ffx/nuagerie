import { useMediaIndex } from '../../data/dataContext.ts';
import { formatItemCount } from '../../lib/format.ts';
import common from '../../ui/common.module.css';
import { IndexStatus } from '../../ui/IndexStatus.tsx';
import { PhotoBrowser } from '../viewer/PhotoBrowser.tsx';
import { ScreenHeader } from '../../ui/ScreenHeader.tsx';
import styles from './AllScreen.module.css';

/** Every photo and video of the perimeter, most recent first, "Sans date" last. */
export function AllScreen() {
  const index = useMediaIndex();

  return (
    <>
      <ScreenHeader title="Tout" />
      <IndexStatus />
      {index && (
        <>
          <p className={`${common.muted} ${styles.summary}`}>
            {formatItemCount(index.items.length)}
          </p>
          <PhotoBrowser items={index.items} label="Photos et vidéos" />
        </>
      )}
    </>
  );
}
