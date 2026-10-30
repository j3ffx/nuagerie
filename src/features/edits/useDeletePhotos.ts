import { useCallback } from 'react';
import type { MediaItem } from '../../data/model.ts';
import { formatItemCount } from '../../lib/format.ts';
import { localized, plural } from '../../lib/i18n.ts';
import { useConfirm } from '../../ui/confirmContext.ts';
import { useEdits } from './editsContext.ts';

const t = localized({
  fr: {
    title: (count: string) => `Supprimer ${count} ?`,
    message: (count: number) =>
      `${plural(count, 'Il va', 'Ils vont')} dans la corbeille de OneDrive, qui ${plural(count, 'le', 'les')} garde 30 jours : tu peux ${plural(count, 'le', 'les')} restaurer depuis Réglages → Modifications → Corbeille.`,
    confirm: 'Supprimer',
  },
  en: {
    title: (count: string) => `Delete ${count}?`,
    message: (count: number) =>
      `${plural(count, 'It goes', 'They go')} to OneDrive’s recycle bin, which keeps ${plural(count, 'it', 'them')} 30 days: you can restore ${plural(count, 'it', 'them')} from Settings → Changes → Recycle bin.`,
    confirm: 'Delete',
  },
});

/**
 * Asks first, then puts the photos in the recycle bin; true once some went.
 * `confirmed` runs between the two (the viewer moves on to the next photo).
 */
export function useDeletePhotos(): (
  items: readonly MediaItem[],
  confirmed?: () => void,
) => Promise<boolean> {
  const confirm = useConfirm();
  const { deletePhotos } = useEdits();
  return useCallback(
    async (items, confirmed) => {
      const answer = await confirm({
        title: t.title(formatItemCount(items.length)),
        message: t.message(items.length),
        confirmLabel: t.confirm,
        danger: true,
      });
      if (!answer) return false;
      confirmed?.();
      return deletePhotos(items);
    },
    [confirm, deletePhotos],
  );
}
