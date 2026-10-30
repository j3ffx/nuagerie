import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { dayKey, yearsAgoLabel, type MemoryYear } from '../../data/memories.ts';
import { formatItemCount, formatLongDate } from '../../lib/format.ts';
import { CloseIcon } from '../../ui/icons.tsx';
import { Thumbnail } from '../../ui/Thumbnail.tsx';
import styles from './MemoriesSection.module.css';
import { useMemories, useMemoriesSeen } from './useMemories.ts';
import { localized } from '../../lib/i18n.ts';

const t = localized({
  fr: { title: 'Souvenirs', seeAll: 'Tout voir', close: 'Fermer les souvenirs jusqu’à demain' },
  en: { title: 'Memories', seeAll: 'See all', close: 'Close the memories until tomorrow' },
});

const MEMORIES_PATH = '/souvenirs';

/** The photo that stands for a year: its most recent photo, a video when there is none. */
const coverOf = (memory: MemoryYear) =>
  memory.items.find((item) => item.kind === 'image') ?? memory.items[0];

/**
 * "Il y a N ans", at the top of the albums: one card per year with photos
 * taken on this day, on a panel of its own. A tap anywhere on it (a year's
 * card or the panel) opens all of today's memories. Closed, it stays closed
 * until the next day, on every device (the sync carries it).
 */
export function MemoriesSection() {
  const { memories, today, closed, close } = useMemories();
  const [, navigate] = useLocation();
  const section = useRef<HTMLElement>(null);
  const shown = !closed && memories.length > 0;
  // Seen once half of it was on screen: no notification about them today.
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const element = section.current;
    if (!shown || !element || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setSeen(true);
      },
      { threshold: 0.5 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [shown]);
  useMemoriesSeen(seen, dayKey(today));
  if (!shown) return null;

  // The section goes with the button that has the focus: the focus moves on to what follows
  // (the albums' sort), not back to the top of the page (screen readers, keyboard).
  const closeAndMoveOn = () => {
    const next =
      section.current?.nextElementSibling?.querySelector<HTMLElement>('a[href], button, select');
    close();
    next?.focus();
  };

  return (
    // The panel's own tap, for pointers: keyboards and screen readers have the links.
    <section
      ref={section}
      className={styles.section}
      aria-labelledby="memories-title"
      onClick={(event) => {
        if (!(event.target as Element).closest('a, button')) navigate(MEMORIES_PATH);
      }}
    >
      <div className={styles.header}>
        <h2 id="memories-title" className={styles.title}>
          {t.title}
        </h2>
        <Link href={MEMORIES_PATH} className={styles.all}>
          {t.seeAll}
        </Link>
        <button
          type="button"
          className={styles.close}
          aria-label={t.close}
          onClick={closeAndMoveOn}
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
              <Link href={MEMORIES_PATH} className={styles.card} draggable={false}>
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
