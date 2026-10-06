import { useEffect, useMemo, useRef, useState } from 'react';
import { groupByMonth } from '../data/grouping.ts';
import type { MediaItem } from '../data/model.ts';
import styles from './MonthGrid.module.css';
import { Thumbnail } from './Thumbnail.tsx';

const PAGE = 240;

/**
 * Photos grouped by month ("Octobre 2026"), "Sans date" last. Items render in
 * slices as the user scrolls.
 * TODO: virtualized grid with the date scrubber.
 */
export function MonthGrid({ items, label }: { items: readonly MediaItem[]; label: string }) {
  const [limit, setLimit] = useState(PAGE);
  const [shownFor, setShownFor] = useState(items);
  const sentinel = useRef<HTMLDivElement>(null);

  // Start again from the top when the list changes (other album, other order).
  if (shownFor !== items) {
    setShownFor(items);
    setLimit(PAGE);
  }

  const sections = useMemo(() => groupByMonth(items.slice(0, limit)), [items, limit]);
  const more = limit < items.length;

  useEffect(() => {
    const target = sentinel.current;
    if (!target || !more) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setLimit((l) => l + PAGE);
      },
      { rootMargin: '1200px 0px' },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [more, limit]);

  return (
    <div aria-label={label}>
      {sections.map((section) => (
        <section key={section.key} aria-labelledby={`month-${section.key}`}>
          <h2 id={`month-${section.key}`} className={styles.title}>
            {section.title}
          </h2>
          <ul className={styles.grid}>
            {section.items.map((item) => (
              <li key={item.id}>
                <Thumbnail item={item} />
              </li>
            ))}
          </ul>
        </section>
      ))}
      {more && <div ref={sentinel} className={styles.sentinel} aria-hidden="true" />}
    </div>
  );
}
