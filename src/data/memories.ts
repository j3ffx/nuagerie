import type { MediaItem } from './model.ts';

/**
 * Memories: the photos taken on this day in earlier years ("Il y a 3 ans").
 * Capture dates are wall-clock times encoded in UTC (src/data/model.ts), and
 * so is `today`: both are read with the UTC getters. A photo of 29 February
 * comes back on 28 February in the years without a 29th.
 */

export interface MemoryYear {
  year: number;
  /** 1 for last year. */
  yearsAgo: number;
  /** Most recent first, as in the index. */
  items: MediaItem[];
}

/** "2026-10-28": the day as a key (closing the section for the day, notifications). */
export function dayKey(wallClock: number): string {
  return new Date(wallClock).toISOString().slice(0, 10);
}

const isLeap = (year: number) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

/** Whether a capture date falls on this day of the year (29 February on the 28th otherwise). */
function onThisDay(takenAt: number, month: number, day: number, todayYear: number): boolean {
  const taken = new Date(takenAt);
  if (taken.getUTCMonth() !== month) return false;
  const takenDay = taken.getUTCDate();
  if (takenDay === day) return true;
  return month === 1 && day === 28 && takenDay === 29 && !isLeap(todayYear);
}

/** The memories of `today` (wall clock), most recent year first; empty when there are none. */
export function memoriesOf(items: readonly MediaItem[], today: number): MemoryYear[] {
  const now = new Date(today);
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const day = now.getUTCDate();
  const byYear = new Map<number, MediaItem[]>();
  for (const item of items) {
    if (item.takenAt === null) continue;
    const takenYear = new Date(item.takenAt).getUTCFullYear();
    if (takenYear >= year || !onThisDay(item.takenAt, month, day, year)) continue;
    const list = byYear.get(takenYear);
    if (list) list.push(item);
    else byYear.set(takenYear, [item]);
  }
  return [...byYear]
    .sort(([a], [b]) => b - a)
    .map(([takenYear, list]) => ({ year: takenYear, yearsAgo: year - takenYear, items: list }));
}

/** "Il y a 1 an", "Il y a 7 ans". */
export function yearsAgoLabel(yearsAgo: number): string {
  return `Il y a ${yearsAgo} ${yearsAgo > 1 ? 'ans' : 'an'}`;
}

/** Notifications wait until this hour of the morning, however early the browser wakes the app. */
export const NOTIFY_FROM_HOUR = 8;

/**
 * The notification of the day, or null: none before 8 o'clock, at most one a
 * day, and none without memories. `today` is the wall clock.
 */
export function memoryNotification(
  items: readonly MediaItem[],
  today: number,
  notifiedOn: string | null,
): { day: string; title: string; body: string } | null {
  if (new Date(today).getUTCHours() < NOTIFY_FROM_HOUR) return null;
  const day = dayKey(today);
  if (notifiedOn === day) return null;
  const memories = memoriesOf(items, today);
  if (memories.length === 0) return null;
  const count = memories.reduce((total, memory) => total + memory.items.length, 0);
  const years = memories
    .slice(0, 3)
    .map((memory) => yearsAgoLabel(memory.yearsAgo).replace(/^Il y a/, 'il y a'));
  return {
    day,
    title: count > 1 ? `${count} souvenirs ce jour-là` : 'Un souvenir ce jour-là',
    body: `${capitalize(years.join(', '))}${memories.length > 3 ? '…' : '.'} Touche pour les revoir.`,
  };
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
