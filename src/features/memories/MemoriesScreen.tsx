import { useMemo } from 'react';
import { Link, useSearchParams } from 'wouter';
import { yearsAgoLabel } from '../../data/memories.ts';
import { useMediaIndex } from '../../data/dataContext.ts';
import { formatItemCount } from '../../lib/format.ts';
import common from '../../ui/common.module.css';
import { BackIcon } from '../../ui/icons.tsx';
import { IndexStatus } from '../../ui/IndexStatus.tsx';
import { ScreenHeader } from '../../ui/ScreenHeader.tsx';
import albumStyles from '../albums/AlbumScreen.module.css';
import { PhotoBrowser } from '../viewer/PhotoBrowser.tsx';
import { useMemories, useToday } from './useMemories.ts';

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
  const { memories } = useMemories();
  const today = useToday();
  const [params] = useSearchParams();
  const year = Number(params.get('annee')) || null;
  const shown = useMemo(
    () => (year === null ? memories : memories.filter((memory) => memory.year === year)),
    [memories, year],
  );
  const items = useMemo(() => shown.flatMap((memory) => memory.items), [shown]);
  const title = year !== null && shown[0] ? yearsAgoLabel(shown[0].yearsAgo) : 'Souvenirs';

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
