import type { MediaItem } from '../../data/model.ts';

/** A month's round box while picking: all of it picked, none, or some ("mixed", as ARIA says). */
export type MonthState = true | false | 'mixed';

export function monthState(items: readonly MediaItem[], selected: ReadonlySet<string>): MonthState {
  let count = 0;
  for (const item of items) if (selected.has(item.id)) count++;
  if (count === 0) return false;
  return count === items.length ? true : 'mixed';
}
