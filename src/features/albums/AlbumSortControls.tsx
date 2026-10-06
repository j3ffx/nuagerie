import type { AlbumSort, AlbumSortKey } from '../../data/albums.ts';
import { SortDownIcon, SortUpIcon } from '../../ui/icons.tsx';
import styles from './AlbumSortControls.module.css';
import { directionLabel, SORT_LABELS } from './albumSortLabels.ts';

/** Sort criterion (select) and direction (toggle) for a list of albums. */
export function AlbumSortControls({
  sort,
  onChange,
  label,
}: {
  sort: AlbumSort;
  onChange: (sort: AlbumSort) => void;
  /** Accessible name of the criterion, e.g. "Trier les albums par". */
  label: string;
}) {
  return (
    <div className={styles.toolbar}>
      <label className={styles.sort}>
        <span className="visually-hidden">{label}</span>
        <select
          value={sort.key}
          onChange={(event) => {
            const key = event.target.value as AlbumSortKey;
            // Each criterion starts in its natural order: A → Z, most recent first.
            onChange({ key, direction: key === 'name' ? 'asc' : 'desc' });
          }}
        >
          {Object.entries(SORT_LABELS).map(([key, text]) => (
            <option key={key} value={key}>
              {text}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className={styles.direction}
        onClick={() => onChange({ ...sort, direction: sort.direction === 'desc' ? 'asc' : 'desc' })}
        aria-label={`Ordre : ${directionLabel(sort)}. Inverser`}
      >
        {sort.direction === 'desc' ? <SortDownIcon /> : <SortUpIcon />}
        {directionLabel(sort)}
      </button>
    </div>
  );
}
