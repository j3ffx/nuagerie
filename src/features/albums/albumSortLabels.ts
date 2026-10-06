import type { AlbumSort, AlbumSortKey } from '../../data/albums.ts';

export const SORT_LABELS: Record<AlbumSortKey, string> = {
  last: 'Dernière photo',
  first: 'Première photo',
  name: 'Nom',
};

/** "A → Z", "Récent d’abord"… */
export function directionLabel(sort: AlbumSort): string {
  if (sort.key === 'name') return sort.direction === 'asc' ? 'A → Z' : 'Z → A';
  return sort.direction === 'desc' ? 'Récent d’abord' : 'Ancien d’abord';
}

/** "Nom · A → Z" */
export function sortSummary(sort: AlbumSort): string {
  return `${SORT_LABELS[sort.key]} · ${directionLabel(sort)}`;
}
