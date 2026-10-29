import { useMemo } from 'react';
import { Link, useSearchParams } from 'wouter';
import { dayKey, yearsAgoLabel } from '../../data/memories.ts';
import { useMediaIndex } from '../../data/dataContext.ts';
import { formatItemCount } from '../../lib/format.ts';
import common from '../../ui/common.module.css';
import { BackIcon } from '../../ui/icons.tsx';
import { IndexStatus } from '../../ui/IndexStatus.tsx';
import { ScreenHeader } from '../../ui/ScreenHeader.tsx';
import albumStyles from '../albums/AlbumScreen.module.css';
import { PhotoBrowser } from '../viewer/PhotoBrowser.tsx';
import { useMemories, useMemoriesSeen } from './useMemories.ts';

const dayMonth = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});

/**
 * The memories of today in one grid (`/souvenirs`), or one year of them
 * (`?annee=2023`): the months' titles then name the years. Opened from the
 * albums or from the morning notification, even when the section is closed.
 */
export function MemoriesScreen() {
  const index = useMediaIndex();
  const { memories, today } = useMemories();
  const [params] = useSearchParams();
  const year = Number(params.get('annee')) || null;
  // A year with nothing today (a link kept from another day): all of today's memories instead.
  const shown = useMemo(() => {
    const ofYear = memories.filter((memory) => memory.year === year);
    return ofYear.length > 0 ? ofYear : memories;
  }, [memories, year]);
  const items = useMemo(() => shown.flatMap((memory) => memory.items), [shown]);
  useMemoriesSeen(items.length > 0, dayKey(today));
  const title =
    year !== null && shown.length === 1 && shown[0]?.year === year
      ? yearsAgoLabel(shown[0].yearsAgo)
      : 'Souvenirs';

  return (
    <>
      <ScreenHeader
        title={title}
        leading={
          <Link href="/" className={albumStyles.back} aria-label="Retour aux albums">
            <BackIcon />
          </Link>
        }
      />
      <IndexStatus />
      {index &&
        (items.length === 0 ? (
          <div className={common.page}>
            <div className={`${common.card} ${common.stack}`}>
              <p>Pas de souvenir aujourd’hui.</p>
              <p className={common.muted}>
                Ici reviennent les photos prises un {dayMonth.format(today)}, les années passées.
              </p>
            </div>
          </div>
        ) : (
          <>
            <p className={`${common.muted} ${albumStyles.summary}`}>
              {dayMonth.format(today)} · {formatItemCount(items.length)}
            </p>
            <PhotoBrowser items={items} label="Souvenirs" />
          </>
        ))}
    </>
  );
}
