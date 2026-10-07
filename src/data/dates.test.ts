import { describe, expect, it } from 'vitest';
import {
  parseExifDate,
  parseFileNameDate,
  resolveCaptureDate,
  toInstant,
  toWallClock,
  type DateContext,
} from './dates.ts';
import { generateDemoDataset } from './demo/generator.ts';

const context: DateContext = {
  nowWallClock: Date.UTC(2026, 9, 6, 12, 0, 0),
  timeZone: 'Europe/Paris',
};

/** "2026-10-06 08:47:59" style, to compare dates readably. */
const show = (value: number | null) =>
  value === null
    ? null
    : new Date(value)
        .toISOString()
        .replace('T', ' ')
        .replace(/\.000Z$|Z$/, '');

const fromName = (name: string) => show(parseFileNameDate(name, context));

describe('parseFileNameDate: the formats found on real phones and apps', () => {
  it.each([
    ['20261006_084759.jpg', '2026-10-06 08:47:59'],
    ['20260812_103801(0).jpg', '2026-08-12 10:38:01'],
    ['20190415_123456_Bokeh.jpg', '2019-04-15 12:34:56'],
    ['IMG-20250914-WA0003.jpg', '2025-09-14 00:00:00'],
    ['VID-20250914-WA0001.mp4', '2025-09-14 00:00:00'],
    ['IMG_20190415_123456.jpg', '2019-04-15 12:34:56'],
    ['VID_20190415_123456.mp4', '2019-04-15 12:34:56'],
    ['PXL_20240101_123456789.jpg', '2024-01-01 12:34:56.789'],
    ['PXL_20240101_123456789.NIGHT.jpg', '2024-01-01 12:34:56.789'],
    ['Screenshot_20261005_220836_Chrome.jpg', '2026-10-05 22:08:36'],
    ['Screenshot_20180315-171124.png', '2018-03-15 17:11:24'],
    ['Screenshot 2026-09-30 094706.png', '2026-09-30 09:47:06'],
    ['signal-2024-11-20-17-17-37-620.png', '2024-11-20 17:17:37.620'],
  ])('%s → %s', (name, expected) => {
    expect(fromName(name)).toBe(expected);
  });

  it('reads OneDrive iPhone upload names (…_iOS) as UTC, shown in local time', () => {
    // 12:34:56.789 UTC = 14:34:56.789 in Paris (UTC+2 in April)
    expect(fromName('20190415_123456789_iOS.jpg')).toBe('2019-04-15 14:34:56.789');
    expect(fromName('20190415_123456789_iOS 2.jpg')).toBe('2019-04-15 14:34:56.789');
    expect(fromName('20190115_233000000_iOS.heic')).toBe('2019-01-16 00:30:00');
  });

  it('reads 13-digit millisecond timestamps as UTC instants, shown in local time', () => {
    // 1773214568483 = 2026-03-11T07:36:08.483Z = 08:36:08 in Paris (UTC+1 in March)
    expect(fromName('1773214568483_0.mp4')).toBe('2026-03-11 08:36:08.483');
    // 1760957103748 = 2025-10-20T10:45:03.748Z = 12:45:03 in Paris (UTC+2 in October)
    expect(fromName('1760957103748.jpg')).toBe('2025-10-20 12:45:03.748');
    expect(fromName('FB_IMG_1760957103748.jpg')).toBe('2025-10-20 12:45:03.748');
  });
});

describe('parseFileNameDate: names without a usable date', () => {
  it.each([
    ['IMG_1234.JPG', 'no date at all'],
    ['image (3).png', 'no date at all'],
    ['20190231_120000.jpg', 'February 31 does not exist'],
    ['20190230.jpg', 'February 30 does not exist'],
    ['20191301_120000.jpg', 'month 13 does not exist'],
    ['19991231_235959.jpg', 'before 2000'],
    ['20310101_120000.jpg', 'in the future'],
    ['received_123456789012345.jpeg', '15 digits are not a timestamp'],
    ['Snapchat-1234567890.jpg', '10 digits are not a millisecond timestamp'],
    ['photo-20190415123456789.jpg', 'digits glued together'],
  ])('%s (%s)', (name) => {
    expect(fromName(name)).toBeNull();
  });

  it('keeps only the day when the time is impossible', () => {
    expect(fromName('20190415_256000.jpg')).toBe('2019-04-15 00:00:00');
  });

  it('accepts dates up to today + 1 day, not beyond', () => {
    expect(fromName('20261007_090000.jpg')).toBe('2026-10-07 09:00:00');
    expect(fromName('20261008_090000.jpg')).toBeNull();
  });
});

describe('parseExifDate', () => {
  it('keeps the wall-clock time and ignores the offset Graph attaches', () => {
    expect(show(parseExifDate('2026-10-06T08:47:59Z', context))).toBe('2026-10-06 08:47:59');
    expect(show(parseExifDate('2026-10-06T08:47:59+02:00', context))).toBe('2026-10-06 08:47:59');
    expect(show(parseExifDate('2026-10-06T08:47:59.123Z', context))).toBe(
      '2026-10-06 08:47:59.123',
    );
  });

  it('rejects impossible or out-of-range camera clocks', () => {
    expect(parseExifDate('1970-01-01T00:00:00Z', context)).toBeNull();
    expect(parseExifDate('2031-01-01T00:00:00Z', context)).toBeNull();
    expect(parseExifDate('not a date', context)).toBeNull();
  });
});

describe('resolveCaptureDate', () => {
  it('prefers EXIF, then the file name, and never uses upload dates', () => {
    const base = {
      id: '1',
      file: { mimeType: 'image/jpeg' },
      createdDateTime: '2026-05-01T10:00:00Z',
      lastModifiedDateTime: '2026-05-01T10:00:00Z',
    };
    expect(
      resolveCaptureDate(
        { ...base, name: '20250901_100000.jpg', photo: { takenDateTime: '2025-09-02T11:00:00Z' } },
        context,
      ),
    ).toEqual({ takenAt: Date.UTC(2025, 8, 2, 11), source: 'exif' });
    expect(resolveCaptureDate({ ...base, name: '20250901_100000.jpg' }, context)).toEqual({
      takenAt: Date.UTC(2025, 8, 1, 10),
      source: 'filename',
    });
    expect(resolveCaptureDate({ ...base, name: 'IMG_0001.JPG' }, context)).toBeNull();
  });

  it('prefers the name for videos, whose "EXIF" date is a UTC container time', () => {
    const video = {
      id: 'v',
      name: '20250701_100000.mp4',
      file: { mimeType: 'video/mp4' },
      photo: { takenDateTime: '2025-07-01T08:00:00Z' },
    };
    expect(resolveCaptureDate(video, context)).toEqual({
      takenAt: Date.UTC(2025, 6, 1, 10),
      source: 'filename',
    });
    expect(resolveCaptureDate({ ...video, name: 'IMG_0001.MOV' }, context)).toEqual({
      takenAt: Date.UTC(2025, 6, 1, 8),
      source: 'exif',
    });
  });

  it('falls back to the file name when the camera clock is wrong', () => {
    expect(
      resolveCaptureDate(
        { id: '1', name: '20250901_100000.jpg', photo: { takenDateTime: '1970-01-01T00:00:00Z' } },
        context,
      ),
    ).toEqual({ takenAt: Date.UTC(2025, 8, 1, 10), source: 'filename' });
  });
});

describe('time zone helpers', () => {
  it('round-trips wall-clock time and instants', () => {
    const wall = Date.UTC(2026, 6, 14, 22, 30, 0);
    const instant = toInstant(wall, 'Europe/Paris');
    expect(instant).toBe(Date.UTC(2026, 6, 14, 20, 30, 0));
    expect(toWallClock(instant, 'Europe/Paris')).toBe(wall);
  });
});

describe('demo dataset as an oracle', () => {
  it('finds the expected date of every synthetic file', () => {
    const dataset = generateDemoDataset(context);
    const media = dataset.items.filter((item) => item.file && 'demoExpectedDate' in item);
    // 20,000 in /Pictures, plus the few kept outside it.
    expect(media.length).toBe(20_052);
    const mismatches = media
      .map((item) => ({
        name: item.name,
        expected: item.demoExpectedDate ?? null,
        actual: resolveCaptureDate(item, context),
      }))
      .filter(({ expected, actual }) => JSON.stringify(expected) !== JSON.stringify(actual));
    expect(mismatches.slice(0, 5)).toEqual([]);
  });
});
