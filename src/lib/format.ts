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

const takenDateTimeFormat = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
});

/**
 * Capture date and time: "6 octobre 2026 à 14:32". A date read from a file
 * name without a time (WhatsApp) shows no time rather than a false midnight.
 */
export function formatTakenDateTime(item: { takenAt: number; dateSource: string | null }): string {
  const midnight = item.takenAt % 86_400_000 === 0;
  return item.dateSource === 'filename' && midnight
    ? formatLongDate(item.takenAt)
    : takenDateTimeFormat.format(item.takenAt);
}

const coordinateFormat = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

/** "48,8566° N, 2,3522° E" */
export function formatCoordinates(latitude: number, longitude: number): string {
  const lat = `${coordinateFormat.format(Math.abs(latitude))}° ${latitude < 0 ? 'S' : 'N'}`;
  const lon = `${coordinateFormat.format(Math.abs(longitude))}° ${longitude < 0 ? 'O' : 'E'}`;
  return `${lat}, ${lon}`;
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

const decimalFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

/** Storage size from megabytes: "0 Mo", "12,4 Mo", "500 Mo", "1 Go", "1,5 Go". */
export function formatMegabytes(megabytes: number): string {
  if (megabytes >= 1000) return `${decimalFormat.format(megabytes / 1000)} Go`;
  return `${decimalFormat.format(megabytes >= 10 ? Math.round(megabytes) : megabytes)} Mo`;
}

/** "1 élément", "12 éléments" */
export function formatItemCount(count: number): string {
  return `${formatCount(count)} ${count > 1 ? 'éléments' : 'élément'}`;
}
