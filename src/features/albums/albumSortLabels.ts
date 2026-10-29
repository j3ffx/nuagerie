import type { AlbumSort, AlbumSortKey } from '../../data/albums.ts';
import { localized } from '../../lib/i18n.ts';

const t = localized({
  fr: {
    last: 'Dernière photo',
    first: 'Première photo',
    name: 'Nom',
    recentFirst: 'Récent d’abord',
    oldestFirst: 'Ancien d’abord',
    order: (direction: string) => `Ordre : ${direction}. Inverser`,
  },
  en: {
    last: 'Latest photo',
    first: 'First photo',
    name: 'Name',
    recentFirst: 'Newest first',
    oldestFirst: 'Oldest first',
    order: (direction: string) => `Order: ${direction}. Reverse`,
  },
});

export const SORT_LABELS: Record<AlbumSortKey, string> = {
  last: t.last,
  first: t.first,
  name: t.name,
};

/** "A → Z", "Récent d’abord"… */
export function directionLabel(sort: AlbumSort): string {
  if (sort.key === 'name') return sort.direction === 'asc' ? 'A → Z' : 'Z → A';
  return sort.direction === 'desc' ? t.recentFirst : t.oldestFirst;
}

/** The name of the button that reverses a photo order: "Ordre : récent d’abord. Inverser". */
export function orderToggleLabel(order: 'asc' | 'desc'): string {
  return reverseLabel((order === 'desc' ? t.recentFirst : t.oldestFirst).toLowerCase());
}

/** "Ordre : A → Z. Inverser" */
export function reverseLabel(direction: string): string {
  return t.order(direction);
}

/** "Nom · A → Z" */
export function sortSummary(sort: AlbumSort): string {
  return `${SORT_LABELS[sort.key]} · ${directionLabel(sort)}`;
}
