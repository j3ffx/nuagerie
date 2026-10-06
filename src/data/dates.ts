import type { GraphDriveItem } from './graph/types.ts';
import type { CaptureDate } from './model.ts';

/**
 * Capture date of a file (CLAUDE.md → Invariants → Capture dates):
 *  1. `photo.takenDateTime` (EXIF), kept as wall-clock time, never shifted
 *     (for videos, a date in the name comes first: see resolveCaptureDate);
 *  2. otherwise a date found in the file name;
 *  3. otherwise none ("Sans date").
 * `createdDateTime` and `lastModifiedDateTime` are never used: they are upload
 * or export dates. A date is accepted only if it is real and falls between
 * 2000-01-01 and today + 1 day.
 *
 * All dates are wall-clock times encoded as UTC milliseconds (see MediaItem.takenAt).
 */

export interface DateContext {
  /** "Now" as wall-clock time encoded in UTC (same encoding as takenAt). */
  nowWallClock: number;
  /** IANA time zone used to turn epoch timestamps (UTC instants) into wall-clock time. */
  timeZone: string;
}

const DAY = 86_400_000;
const MIN_DATE = Date.UTC(2000, 0, 1);

/** Context for the current device: its clock and its time zone. */
export function currentDateContext(): DateContext {
  const timeZone = deviceTimeZone();
  return { nowWallClock: toWallClock(Date.now(), timeZone), timeZone };
}

/** The device's IANA time zone, or UTC when it is unknown or unusable (e.g. "Etc/Unknown"). */
function deviceTimeZone(): string {
  const candidate = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (!candidate) return 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate });
    return candidate;
  } catch {
    return 'UTC';
  }
}

/** Wall-clock UTC encoding of the given parts, or null if they don't form a real moment. */
function wallClock(
  year: number,
  month: number,
  day: number,
  hours = 0,
  minutes = 0,
  seconds = 0,
  millis = 0,
): number | null {
  if (hours > 23 || minutes > 59 || seconds > 59) return null;
  const value = Date.UTC(year, month - 1, day, hours, minutes, seconds, millis);
  const check = new Date(value);
  // Date.UTC silently rolls over (Feb 31 → Mar 3): reject those.
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return value;
}

function inRange(value: number | null, context: DateContext): value is number {
  return value !== null && value >= MIN_DATE && value <= context.nowWallClock + DAY;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

/** Wall-clock time (encoded as UTC) of a UTC instant in the given time zone. */
export function toWallClock(instant: number, timeZone: string): number {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, formatter);
  }
  const parts: Record<string, number> = {};
  for (const part of formatter.formatToParts(instant)) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value);
  }
  return (
    Date.UTC(
      parts.year ?? 1970,
      (parts.month ?? 1) - 1,
      parts.day ?? 1,
      parts.hour ?? 0,
      parts.minute ?? 0,
      parts.second ?? 0,
    ) +
    (instant % 1000)
  );
}

/** UTC instant whose wall-clock time in the given zone is `wall` (inverse of toWallClock). */
export function toInstant(wall: number, timeZone: string): number {
  let instant = wall - (toWallClock(wall, timeZone) - wall);
  instant = wall - (toWallClock(instant, timeZone) - instant);
  return instant;
}

const EXIF = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,7}))?/;

/**
 * Reads `photo.takenDateTime` as wall-clock time: the digits are kept as they
 * are, whatever offset Graph attaches ("Z" included), so 08:47 stays 08:47.
 */
export function parseExifDate(value: string, context: DateContext): number | null {
  const m = EXIF.exec(value);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, frac] = m;
  const millis = frac ? Number(frac.slice(0, 3).padEnd(3, '0')) : 0;
  const date = wallClock(
    Number(y),
    Number(mo),
    Number(d),
    Number(h),
    Number(mi),
    Number(s),
    millis,
  );
  return inRange(date, context) ? date : null;
}

type NameRule = (name: string, context: DateContext) => number | null;

/** First valid match of a pattern in the name (later matches are tried if earlier ones are invalid). */
function rule(pattern: RegExp, build: (groups: string[]) => number | null): NameRule {
  const global = new RegExp(
    pattern.source,
    pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`,
  );
  return (name, context) => {
    for (const match of name.matchAll(global)) {
      const date = build(match.slice(1).map((group) => group ?? ''));
      if (inRange(date, context)) return date;
    }
    return null;
  };
}

const n = Number;

/**
 * Ordered from most to least precise. Digits must not touch other digits, so
 * longer numbers (IDs, 15-digit "received_…" names) never match by accident.
 */
const NAME_RULES: readonly NameRule[] = [
  // OneDrive's iPhone camera upload: 20190415_123456789_iOS.jpg is written in UTC (measured on a
  // real drive: EXIF minus name was a steady +60/+120 min), so it is read as a UTC instant.
  (name, context) => {
    const match = /(?<!\d)(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})(\d{3})_iOS/i.exec(name);
    if (!match) return null;
    const [, y, mo, d, h, mi, s, ms] = match;
    const instant = wallClock(n(y), n(mo), n(d), n(h), n(mi), n(s), n(ms));
    if (instant === null) return null;
    const date = toWallClock(instant, context.timeZone);
    return inRange(date, context) ? date : null;
  },
  // 20261006_084759.jpg, 20260812_103801(0).jpg, 20190415_123456_Bokeh.jpg, IMG_20190415_123456.jpg,
  // VID_…, Screenshot_20261005_220836_Chrome.jpg, Screenshot_20180315-171124.png, PXL_20240101_123456789.jpg
  rule(
    /(?<!\d)(\d{4})(\d{2})(\d{2})[_-](\d{2})(\d{2})(\d{2})(\d{3})?(?!\d)/,
    ([y, mo, d, h, mi, s, ms]) => wallClock(n(y), n(mo), n(d), n(h), n(mi), n(s), ms ? n(ms) : 0),
  ),
  // Screenshot 2026-09-30 094706.png, signal-2024-11-20-17-17-37-620.png
  rule(
    /(?<!\d)(\d{4})-(\d{2})-(\d{2})[ _T-](\d{2})[-.:]?(\d{2})[-.:]?(\d{2})(?:[-.](\d{3}))?(?!\d)/,
    ([y, mo, d, h, mi, s, ms]) => wallClock(n(y), n(mo), n(d), n(h), n(mi), n(s), ms ? n(ms) : 0),
  ),
  // 13-digit millisecond timestamps (UTC instants): 1773214568483_0.mp4, 1760957103748.jpg, FB_IMG_…
  (name, context) => {
    for (const match of name.matchAll(/(?<!\d)(1\d{12})(?!\d)/g)) {
      const date = toWallClock(n(match[1]), context.timeZone);
      if (inRange(date, context)) return date;
    }
    return null;
  },
  // Date only: IMG-20250914-WA0003.jpg, VID-20250914-WA0001.mp4 (WhatsApp), 2024-05-04.jpg
  rule(/(?<!\d)(\d{4})(\d{2})(\d{2})(?!\d)/, ([y, mo, d]) => wallClock(n(y), n(mo), n(d))),
  rule(/(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/, ([y, mo, d]) => wallClock(n(y), n(mo), n(d))),
];

/** Date found in a file name, or null. */
export function parseFileNameDate(name: string, context: DateContext): number | null {
  const stem = name.replace(/\.[^.]+$/, '');
  for (const nameRule of NAME_RULES) {
    const date = nameRule(stem, context);
    if (date !== null) return date;
  }
  return null;
}

/**
 * The capture date of a drive item, or null for "Sans date".
 * Photos: EXIF first, then the name. Videos: the name first, because the
 * "EXIF" date of MP4 files is the container's creation time, stored in UTC
 * (measured on a real drive: EXIF minus name was a steady -60/-120 min).
 */
export function resolveCaptureDate(item: GraphDriveItem, context: DateContext): CaptureDate | null {
  const exif = item.photo?.takenDateTime ? parseExifDate(item.photo.takenDateTime, context) : null;
  const fromName = item.name ? parseFileNameDate(item.name, context) : null;
  const video = Boolean(item.video) || (item.file?.mimeType ?? '').startsWith('video/');
  if (video && fromName !== null) return { takenAt: fromName, source: 'filename' };
  if (exif !== null) return { takenAt: exif, source: 'exif' };
  if (fromName !== null) return { takenAt: fromName, source: 'filename' };
  return null;
}
