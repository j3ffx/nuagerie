import { toInstant, toWallClock } from '../dates.ts';
import type { MediaKind } from '../model.ts';
import { pick, pickWeighted, randomInt, type Random } from './random.ts';

/**
 * Realistic file names (phones, messaging apps) for synthetic items. Each builder also returns
 * the date a correct parser must read from the name (wall-clock time encoded
 * as UTC, truncated to the precision of the name), so the generator doubles
 * as a test oracle for the date extraction.
 */

export type NameStyle =
  | 'camera'
  | 'screenshot'
  | 'whatsapp'
  | 'signal'
  | 'epoch'
  | 'facebook'
  | 'img'
  | 'pixel'
  | 'iphone'
  | 'meme';

export interface GeneratedName {
  name: string;
  /** Date encoded in the name, or null when the name carries none. */
  nameDate: number | null;
}

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  webp: 'image/webp',
  gif: 'image/gif',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  pdf: 'application/pdf',
  txt: 'text/plain',
  ini: 'text/plain',
};

export function mimeTypeOf(name: string): string {
  const extension = name.slice(name.lastIndexOf('.') + 1).toLowerCase();
  return MIME_BY_EXTENSION[extension] ?? 'application/octet-stream';
}

const pad = (value: number, length = 2) => String(value).padStart(length, '0');

function parts(wallClock: number) {
  const d = new Date(wallClock);
  return {
    Y: String(d.getUTCFullYear()),
    M: pad(d.getUTCMonth() + 1),
    D: pad(d.getUTCDate()),
    h: pad(d.getUTCHours()),
    m: pad(d.getUTCMinutes()),
    s: pad(d.getUTCSeconds()),
    ms: pad(d.getUTCMilliseconds(), 3),
  };
}

const toSecond = (wallClock: number) => Math.floor(wallClock / 1000) * 1000;
const toDay = (wallClock: number) => Math.floor(wallClock / 86_400_000) * 86_400_000;

const SCREENSHOT_APPS = ['Chrome', 'Messages', 'Maps', 'Photos', 'YouTube', 'Gmail', 'Settings'];

export function generateName(
  style: NameStyle,
  kind: MediaKind,
  wallClock: number,
  random: Random,
  counter: number,
  timeZone: string,
): GeneratedName {
  const { Y, M, D, h, m, s, ms } = parts(wallClock);
  const video = kind === 'video';

  switch (style) {
    case 'camera': {
      const suffix = video
        ? ''
        : pickWeighted(random, [
            ['', 96],
            ['_Bokeh', 3],
            ['_HDR', 1],
          ]);
      const extension = video
        ? 'mp4'
        : pickWeighted(random, [
            ['jpg', 9],
            ['heic', 1],
          ]);
      return {
        name: `${Y}${M}${D}_${h}${m}${s}${suffix}.${extension}`,
        nameDate: toSecond(wallClock),
      };
    }
    case 'screenshot': {
      if (video) {
        const app = pick(random, SCREENSHOT_APPS);
        return {
          name: `Screen_Recording_${Y}${M}${D}_${h}${m}${s}_${app}.mp4`,
          nameDate: toSecond(wallClock),
        };
      }
      if (Number(Y) < 2019) {
        return { name: `Screenshot_${Y}${M}${D}-${h}${m}${s}.png`, nameDate: toSecond(wallClock) };
      }
      if (random() < 0.2) {
        return {
          name: `Screenshot ${Y}-${M}-${D} ${h}${m}${s}.png`,
          nameDate: toSecond(wallClock),
        };
      }
      const app = pick(random, SCREENSHOT_APPS);
      return {
        name: `Screenshot_${Y}${M}${D}_${h}${m}${s}_${app}.jpg`,
        nameDate: toSecond(wallClock),
      };
    }
    case 'whatsapp': {
      const sequence = pad(randomInt(random, 0, 120), 4);
      const prefix = video ? 'VID' : 'IMG';
      const extension = video ? 'mp4' : 'jpg';
      return {
        name: `${prefix}-${Y}${M}${D}-WA${sequence}.${extension}`,
        nameDate: toDay(wallClock),
      };
    }
    case 'signal': {
      const extension = video ? 'mp4' : pick(random, ['jpg', 'png']);
      return {
        name: `signal-${Y}-${M}-${D}-${h}-${m}-${s}-${ms}.${extension}`,
        nameDate: wallClock,
      };
    }
    case 'epoch': {
      // A millisecond timestamp is a UTC instant: the parser shows it in the device's time zone.
      const instant = toInstant(wallClock, timeZone);
      const name = video ? `${instant}_0.mp4` : `${instant}.${pick(random, ['jpg', 'jpg', 'png'])}`;
      return { name, nameDate: toWallClock(instant, timeZone) };
    }
    case 'facebook': {
      const instant = toInstant(wallClock, timeZone);
      return {
        name: video ? `${instant}_0.mp4` : `FB_IMG_${instant}.jpg`,
        nameDate: toWallClock(instant, timeZone),
      };
    }
    case 'img': {
      const prefix = video ? 'VID' : 'IMG';
      const extension = video ? 'mp4' : 'jpg';
      return {
        name: `${prefix}_${Y}${M}${D}_${h}${m}${s}.${extension}`,
        nameDate: toSecond(wallClock),
      };
    }
    case 'pixel': {
      const extension = video ? 'mp4' : 'jpg';
      return { name: `PXL_${Y}${M}${D}_${h}${m}${s}${ms}.${extension}`, nameDate: wallClock };
    }
    case 'iphone': {
      const extension = video
        ? 'MOV'
        : pickWeighted(random, [
            ['HEIC', 8],
            ['JPG', 2],
          ]);
      return { name: `IMG_${pad(counter % 10_000, 4)}.${extension}`, nameDate: null };
    }
    case 'meme': {
      const extension = video ? 'mp4' : pick(random, ['jpg', 'png', 'gif', 'webp']);
      const stem = pick(random, ['meme', 'lol', 'reaction', 'chat-surpris', 'lundi-matin']);
      return { name: `${stem}-${pad(counter, 3)}.${extension}`, nameDate: null };
    }
  }
}

/**
 * Names that carry no usable date, including traps a parser must reject:
 * impossible days, years before 2000, dates in the future, 15-digit numbers.
 */
export function generateUndatedName(
  kind: MediaKind,
  random: Random,
  counter: number,
  nowYear: number,
): string {
  if (kind === 'video') {
    return pick(random, [`video-${counter}.mp4`, `IMG_${pad(counter % 10_000, 4)}.MOV`]);
  }
  const year = randomInt(random, 2016, nowYear);
  const time = `${pad(randomInt(random, 0, 23))}${pad(randomInt(random, 0, 59))}${pad(randomInt(random, 0, 59))}`;
  const digits = (length: number) =>
    Array.from({ length }, (_, i) =>
      i === 0 ? randomInt(random, 1, 9) : randomInt(random, 0, 9),
    ).join('');

  return pickWeighted(random, [
    [`IMG_${pad(counter % 10_000, 4)}.JPG`, 30],
    [`image (${counter}).png`, 15],
    [`photo-${counter}.jpg`, 15],
    [`Snapchat-${digits(10)}.jpg`, 10],
    [`received_${digits(15)}.jpeg`, 10],
    [`${year}0231_${time}.jpg`, 7],
    [`19991231_${time}.jpg`, 7],
    [`${nowYear + 5}0101_${time}.jpg`, 6],
  ] as const);
}
