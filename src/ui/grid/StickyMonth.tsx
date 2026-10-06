import { memo, useEffect, useRef } from 'react';
import { sectionIndexAt, type GridLayout } from './layout.ts';
import { stickyHeaderHeight } from './page.ts';
import styles from './PhotoGrid.module.css';

/**
 * The month being scrolled stays visible under the screen header; the next
 * month's header pushes it up. Updated straight from the scroll events, with
 * no React render, so it follows the scroll frame by frame.
 */
export const StickyMonth = memo(function StickyMonth({
  layout,
  gridTop,
}: {
  layout: GridLayout;
  gridTop: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    const title = titleRef.current;
    if (!host || !title) return;

    const update = () => {
      const top = stickyHeaderHeight();
      host.style.top = `${top}px`;
      const offset = window.scrollY + top - gridTop;
      const index = sectionIndexAt(layout, offset);
      const start = layout.sectionStarts[index];
      // Hidden while the month's own header is still in place.
      if (start === undefined || offset <= start) {
        title.hidden = true;
        return;
      }
      const next = layout.sectionStarts[index + 1] ?? Infinity;
      const push = Math.min(0, next - offset - title.offsetHeight);
      const text = layout.sections[index]?.title ?? '';
      if (title.textContent !== text) title.textContent = text;
      title.style.transform = push < 0 ? `translateY(${push}px)` : '';
      title.hidden = false;
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [layout, gridTop]);

  return (
    <div ref={hostRef} className={styles.stickyHost} aria-hidden="true">
      <div ref={titleRef} className={`${styles.title} ${styles.stickyTitle}`} hidden />
    </div>
  );
});
