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

const timeFormat = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
});

/** The time of a capture, "14:32"; null for a date read from a file name without a time. */
export function formatTakenTime(item: {
  takenAt: number;
  dateSource: string | null;
}): string | null {
  const midnight = item.takenAt % 86_400_000 === 0;
  return item.dateSource === 'filename' && midnight ? null : timeFormat.format(item.takenAt);
}

const countryNames = new Intl.DisplayNames(['fr'], { type: 'region' });

/**
 * "Annecy, France"; "Près de Chamonix, France" when the photo is a fair
 * way from the nearest town (mountains, sea shore).
 */
export function formatPlace(place: { name: string; country: string; km: number }): string {
  let country = place.country;
  try {
    country = countryNames.of(place.country) ?? place.country;
  } catch {
    // Unknown code: keep it as is.
  }
  return `${place.km > 15 ? `Près de ${place.name}` : place.name}, ${country}`;
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

/** A size in bytes: "820 Ko", "3,2 Mo", "12 Go" (decimal units, as OneDrive shows them). */
export function formatBytes(bytes: number): string {
  if (bytes < 1_000_000) return `${formatCount(Math.max(1, Math.round(bytes / 1000)))} Ko`;
  return formatMegabytes(bytes / 1_000_000);
}

/** "1 élément", "12 éléments" */
export function formatItemCount(count: number): string {
  return `${formatCount(count)} ${count > 1 ? 'éléments' : 'élément'}`;
}

/** A video's length: "42 s", "3 min 05 s", "1 h 02 min". */
export function formatDuration(ms: number): string {
  const total = Math.max(1, Math.round(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const two = (n: number) => String(n).padStart(2, '0');
  if (hours > 0) return `${hours} h ${two(minutes)} min`;
  if (minutes > 0) return `${minutes} min ${two(seconds)} s`;
  return `${seconds} s`;
}

/** "4 000 × 3 000 · 12 Mpx" (megapixels only from 1 up, rounded as cameras say it). */
export function formatDimensions(width: number, height: number): string {
  const megapixels = (width * height) / 1_000_000;
  const size = `${formatCount(width)} × ${formatCount(height)}`;
  return megapixels >= 1
    ? `${size} · ${decimalFormat.format(Math.round(megapixels * 10) / 10)} Mpx`
    : size;
}
