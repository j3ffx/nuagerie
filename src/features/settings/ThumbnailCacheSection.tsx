import { useState, useSyncExternalStore } from 'react';
import { useData } from '../../data/dataContext.ts';
import {
  CACHE_SIZE_KEY,
  CACHE_SIZES_MB,
  DEFAULT_CACHE_MB,
  MB,
} from '../../data/thumbnails/setup.ts';
import { formatMegabytes } from '../../lib/format.ts';
import { usePersistentState } from '../../lib/persistent.ts';
import common from '../../ui/common.module.css';
import styles from './SettingsScreen.module.css';

/** Thumbnails kept on the device: space used, maximum size, emptying. */
export function ThumbnailCacheSection() {
  const { thumbnails } = useData();
  const usage = useSyncExternalStore(
    (notify) => thumbnails.disk.subscribe(notify),
    () => thumbnails.disk.usage(),
  );
  const [sizeMb, setSizeMb] = usePersistentState(CACHE_SIZE_KEY, DEFAULT_CACHE_MB);
  const [cleared, setCleared] = useState(false);

  const clear = async () => {
    await thumbnails.disk.clear();
    thumbnails.store.clearMemory();
    setCleared(true);
  };

  return (
    <section className={common.section} aria-labelledby="settings-thumbnails">
      <h2 id="settings-thumbnails" className={common.sectionTitle}>
        Miniatures
      </h2>
      <div className={`${common.card} ${common.stack}`}>
        <dl className={common.definitionList}>
          <dt>Sur l’appareil</dt>
          <dd role="status">
            {formatMegabytes(usage / MB)} sur {formatMegabytes(sizeMb)}
          </dd>
        </dl>
        <label className={styles.field}>
          <span>Taille maximale</span>
          <select
            className={styles.select}
            value={sizeMb}
            onChange={(event) => setSizeMb(Number(event.target.value))}
          >
            {CACHE_SIZES_MB.map((size) => (
              <option key={size} value={size}>
                {formatMegabytes(size)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={common.buttonSoft}
          onClick={() => void clear()}
          disabled={usage === 0}
        >
          {cleared && usage === 0 ? 'Miniatures effacées' : 'Effacer les miniatures'}
        </button>
      </div>
    </section>
  );
}
