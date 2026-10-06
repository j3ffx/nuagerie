import { useMemo } from 'react';
import { useMediaIndex } from '../../data/dataContext.ts';
import { formatCount } from '../../lib/format.ts';
import { MapIcon } from '../../ui/icons.tsx';
import common from '../../ui/common.module.css';
import { IndexStatus } from '../../ui/IndexStatus.tsx';
import { ScreenHeader } from '../../ui/ScreenHeader.tsx';
import styles from './MapScreen.module.css';

export function MapScreen() {
  const index = useMediaIndex();
  const located = useMemo(
    () => index?.items.filter((item) => item.latitude !== null).length ?? 0,
    [index],
  );

  return (
    <>
      <ScreenHeader title="Carte" />
      <div className={common.page}>
        <IndexStatus />
        {index && (
          <div className={`${common.card} ${styles.placeholder}`}>
            <MapIcon width={40} height={40} className={styles.icon} />
            <p className={styles.title}>La carte arrive bientôt</p>
            <p className={common.muted}>
              {formatCount(located)} photos géolocalisées l’attendent déjà.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
