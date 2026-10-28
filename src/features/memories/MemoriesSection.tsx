import { Link } from 'wouter';
import { yearsAgoLabel, type MemoryYear } from '../../data/memories.ts';
import { formatItemCount, formatLongDate } from '../../lib/format.ts';
import { CloseIcon } from '../../ui/icons.tsx';
import { Thumbnail } from '../../ui/Thumbnail.tsx';
import styles from './MemoriesSection.module.css';
import { useMemories } from './useMemories.ts';

/** The photo that stands for a year: its most recent photo, a video when there is none. */
const coverOf = (memory: MemoryYear) =>
  memory.items.find((item) => item.kind === 'image') ?? memory.items[0];

/**
 * "Il y a N ans", at the top of the albums: one card per year with photos
 * taken on this day. Closed, it stays closed until the next day, on every
 * device (the sync carries it).
 */
export function MemoriesSection() {
  const { memories, closed, close } = useMemories();
  if (closed || memories.length === 0) return null;

  return (
    <section className={styles.section} aria-labelledby="memories-title">
      <div className={styles.header}>
        <h2 id="memories-title" className={styles.title}>
          Souvenirs
        </h2>
        <Link href="/souvenirs" className={styles.all}>
          Tout voir
        </Link>
        <button
          type="button"
          className={styles.close}
          aria-label="Fermer les souvenirs jusqu’à demain"
          onClick={close}
        >
          <CloseIcon width={20} height={20} />
        </button>
      </div>
      <ul className={styles.cards}>
        {memories.map((memory) => {
          const cover = coverOf(memory);
          const takenAt = cover?.takenAt ?? null;
          return (
            <li key={memory.year}>
              <Link
                href={`/souvenirs?annee=${memory.year}`}
                className={styles.card}
                draggable={false}
              >
                {cover && <Thumbnail item={cover} className={styles.cover} decorative />}
                {/* Read as shown: "Il y a 3 ans, 28 octobre 2023, 12 éléments". */}
                <span className={styles.caption}>
                  <span className={styles.ago}>
                    {yearsAgoLabel(memory.yearsAgo)}
                    <span className="hidden-inline">, </span>
                  </span>
                  {takenAt !== null && (
                    <span className={styles.meta}>
                      {formatLongDate(takenAt)}
                      <span className="hidden-inline">, </span>
                    </span>
                  )}
                  <span className={styles.meta}>{formatItemCount(memory.items.length)}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
