/**
 * Formatting helpers (French UI).
 *
 * Capture dates are stored as "wall-clock time encoded as UTC" (see
 * MediaItem.takenAt), so they are always formatted in the UTC time zone:
 * a photo taken at 08:47 shows 08:47 wherever the viewer is.
 */

const numberFormat = new Intl.NumberFormat('fr-FR');
const monthYearFormat = new Intl.DateTimeFormat('fr-FR', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const shortDateFormat = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
  timeZone: 'UTC',
});
const yearFormat = new Intl.DateTimeFormat('fr-FR', { year: 'numeric', timeZone: 'UTC' });
const longDateFormat = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

export function formatCount(value: number): string {
  return numberFormat.format(value);
}

/** "Octobre 2026" */
export function formatMonthYear(takenAt: number): string {
  const text = monthYearFormat.format(takenAt);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const dateTimeFormat = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/** A real instant in the viewer's time zone: "6 oct., 14:32" (sync times, not capture dates). */
export function formatDateTime(instant: number): string {
  return dateTimeFormat.format(instant);
}

/** "6 octobre 2026" */
export function formatLongDate(takenAt: number): string {
  return longDateFormat.format(takenAt);
}

/** "06/10/26" */
export function formatShortDate(takenAt: number): string {
  return shortDateFormat.format(takenAt);
}

/** "2019 – 2026", or "2024" when the range is within one year. */
export function formatYearRange(first: number, last: number): string {
  const a = yearFormat.format(first);
  const b = yearFormat.format(last);
  return a === b ? a : `${a} – ${b}`;
}

/** Accessible description of a thumbnail: "Photo du 6 octobre 2026", "Vidéo sans date". */
export function describeItem(item: { kind: 'image' | 'video'; takenAt: number | null }): string {
  const kind = item.kind === 'video' ? 'Vidéo' : 'Photo';
  return item.takenAt === null ? `${kind} sans date` : `${kind} du ${formatLongDate(item.takenAt)}`;
}

/** "1 élément", "12 éléments" */
export function formatItemCount(count: number): string {
  return `${formatCount(count)} ${count > 1 ? 'éléments' : 'élément'}`;
}
