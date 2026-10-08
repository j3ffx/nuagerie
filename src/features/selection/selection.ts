import type { MediaItem } from '../../data/model.ts';

/** Photos picked in a grid, by id. */
export type Selection = ReadonlySet<string>;

/** Adds the item, or takes it out if it was in. */
export function toggled(selection: Selection, id: string): Selection {
  const next = new Set(selection);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/** Ids of the items from `fromId` to `toId` (either order), as the grid shows them. */
export function rangeIds(items: readonly MediaItem[], fromId: string, toId: string): string[] {
  const from = items.findIndex((item) => item.id === fromId);
  const to = items.findIndex((item) => item.id === toId);
  if (from < 0 || to < 0) return to >= 0 ? [toId] : [];
  const [start, end] = from <= to ? [from, to] : [to, from];
  return items.slice(start, end + 1).map((item) => item.id);
}

/** `base` plus every item from `anchorId` to `toId`: what a drag (or Shift + click) selects. */
export function withRange(
  base: Selection,
  items: readonly MediaItem[],
  anchorId: string,
  toId: string,
): Selection {
  return new Set([...base, ...rangeIds(items, anchorId, toId)]);
}

/** A month's title touched: all of its items in, or all out when they all were. */
export function toggledAll(selection: Selection, ids: readonly string[]): Selection {
  const next = new Set(selection);
  if (ids.every((id) => next.has(id))) ids.forEach((id) => next.delete(id));
  else ids.forEach((id) => next.add(id));
  return next;
}

/** Above this, sharing several files at once asks first: it can take long, or fail. */
export const SHARE_LIMIT = { items: 30, bytes: 200_000_000 };

export function beyondShareLimit(items: readonly MediaItem[]): boolean {
  const bytes = items.reduce((sum, item) => sum + item.size, 0);
  return items.length > SHARE_LIMIT.items || bytes > SHARE_LIMIT.bytes;
}

/** "1 sélectionné", "12 sélectionnés" */
export function selectedLabel(count: number): string {
  return `${count} ${count > 1 ? 'sélectionnés' : 'sélectionné'}`;
}
