import { toInstant } from '../dates.ts';
import type { GraphDriveItem } from '../graph/types.ts';
import type { CaptureDate, MediaKind } from '../model.ts';
import { generateName, generateUndatedName, mimeTypeOf, type NameStyle } from './filenames.ts';
import { ABROAD, findPlace, HOME, REGIONAL, type Place } from './places.ts';
import { createRandom, gaussian, pick, pickWeighted, randomInt } from './random.ts';

/**
 * Synthetic OneDrive: ~20 000 Graph-shaped drive items reproducing a typical
 * phone-backup folder structure with generic names, realistic file names, ~3 %
 * undated files, GPS on ~40 % and a few videos. Deterministic for a given seed.
 */

export interface DemoDriveItem extends GraphDriveItem {
  /** Demo only: the capture date the app must show — oracle for date extraction. */
  demoExpectedDate?: CaptureDate | null;
}

export interface DemoDataset {
  items: DemoDriveItem[];
  rootFolderIds: string[];
}

export interface DemoOptions {
  seed?: number;
  /** Number of photos and videos (non-media files come on top). */
  mediaCount?: number;
  /** "Now" as wall-clock time encoded in UTC (see CaptureDate.takenAt). */
  nowWallClock?: number;
  /** Time zone of the device, used for names holding UTC timestamps. */
  timeZone?: string;
}

export const DEMO_ROOT_ID = 'demo!pictures';
const DEMO_DRIVE_ROOT_ID = 'demo!root';
const DAY = 86_400_000;
const UNDATED_SHARE = 0.023;
const MEMES_SHARE = 0.004;

type PlaceMode = 'everyday' | 'none' | Place;

interface Bucket {
  path: readonly string[];
  weight: number;
  from: number;
  to: number;
  /** Files go into AAAA/MM subfolders. */
  yearMonth: boolean;
  styles: readonly (readonly [NameStyle, number])[];
  video: number;
  exif: number;
  gps: number;
  places: PlaceMode;
  session: readonly [number, number];
  /** Pick dates towards the end of the range (people take more photos lately). */
  recentBias: boolean;
  camera: readonly [string, string] | null;
}

const ym = (year: number, month: number) => Date.UTC(year, month - 1, 1);
const endOfMonth = (year: number, month: number) => Date.UTC(year, month, 1) - 1;

const PHONE = ['Samsung', 'Galaxy S21'] as const;
const OLD_PHONE = ['Apple', 'iPhone 8'] as const;

function bucket(
  path: readonly string[],
  weight: number,
  from: number,
  to: number,
  options: Partial<Omit<Bucket, 'path' | 'weight' | 'from' | 'to'>>,
): Bucket {
  return {
    path,
    weight,
    from,
    to,
    yearMonth: false,
    styles: [['camera', 1]],
    video: 0.05,
    exif: 0,
    gps: 0,
    places: 'none',
    session: [1, 4],
    recentBias: true,
    camera: null,
    ...options,
  };
}

interface DemoEvent {
  name: string;
  start: number;
  days: number;
  place: string;
  subfolders?: readonly string[];
}

const EVENTS: readonly DemoEvent[] = [
  { name: '2017-04 - Printemps à Kyoto', start: Date.UTC(2017, 3, 8), days: 9, place: 'Kyoto' },
  { name: '2018-02 - Ski', start: Date.UTC(2018, 1, 17), days: 7, place: 'Chamonix' },
  {
    name: '2019-06 - Week-end à Lisbonne',
    start: Date.UTC(2019, 5, 14),
    days: 3,
    place: 'Lisbonne',
  },
  { name: '2020-08 - Road trip', start: Date.UTC(2020, 7, 3), days: 12, place: 'Biarritz' },
  { name: '2021-09-05 - Randonnée', start: Date.UTC(2021, 8, 5), days: 1, place: 'Annecy' },
  { name: '2022-12 - Noël en famille', start: Date.UTC(2022, 11, 24), days: 2, place: 'Lyon' },
  { name: '2023-07-14 - Feu d’artifice', start: Date.UTC(2023, 6, 14), days: 1, place: 'Paris' },
  { name: '2024-05 - Vacances', start: Date.UTC(2024, 4, 4), days: 10, place: 'Santorin' },
  { name: '2024-10-12 - Anniversaire', start: Date.UTC(2024, 9, 12), days: 1, place: 'Lyon' },
  {
    name: '2025-08-23 - Mariage',
    start: Date.UTC(2025, 7, 23),
    days: 2,
    place: 'Bordeaux',
    subfolders: ['Cérémonie', 'Soirée'],
  },
  { name: '2026-02 - Islande', start: Date.UTC(2026, 1, 10), days: 8, place: 'Reykjavik' },
  { name: '2026-07 - Vacances à la mer', start: Date.UTC(2026, 6, 11), days: 14, place: 'Nice' },
];

function buildBuckets(now: number): Bucket[] {
  const camera = {
    styles: [['camera', 1]],
    exif: 0.97,
    gps: 0.62,
    places: 'everyday',
    camera: PHONE,
    video: 0.07,
  } as const;
  // Camera Roll also receives uploads from an iPhone through the OneDrive app (…_iOS names).
  const cameraRoll = {
    ...camera,
    styles: [
      ['camera', 9],
      ['ios', 1],
    ],
  } as const;
  const oldPhone = {
    styles: [['iphone', 1]],
    exif: 0.95,
    gps: 0.5,
    places: 'everyday',
    camera: OLD_PHONE,
    video: 0.08,
    session: [1, 12],
  } as const;

  const buckets: Bucket[] = [
    bucket(['Camera Roll'], 0.5, ym(2016, 1), now, {
      ...cameraRoll,
      yearMonth: true,
      session: [1, 14],
    }),
    bucket(['Screenshots'], 0.09, ym(2016, 6), now, {
      yearMonth: true,
      styles: [['screenshot', 1]],
      video: 0.03,
      session: [1, 3],
    }),
    bucket(['Quick Share'], 0.02, ym(2021, 3), now, {
      yearMonth: true,
      styles: [
        ['img', 1],
        ['camera', 1],
      ],
      exif: 0.6,
      gps: 0.3,
      places: 'everyday',
      session: [1, 8],
    }),
    bucket(['Messages'], 0.015, ym(2017, 1), now, {
      yearMonth: true,
      styles: [
        ['img', 7],
        ['epoch', 3],
      ],
      exif: 0.2,
      gps: 0.05,
      places: 'everyday',
      session: [1, 3],
    }),
    bucket(['Tapo'], 0.015, ym(2023, 1), now, {
      yearMonth: true,
      styles: [['epoch', 1]],
      video: 0.7,
      session: [1, 6],
    }),
    bucket(['Download'], 0.02, ym(2016, 1), now, {
      yearMonth: true,
      styles: [
        ['img', 4],
        ['epoch', 3],
        ['screenshot', 1],
        ['facebook', 2],
      ],
      exif: 0.2,
      gps: 0.05,
      places: 'everyday',
      session: [1, 2],
    }),
    bucket(['Pictures'], 0.01, ym(2016, 1), endOfMonth(2021, 12), {
      yearMonth: true,
      styles: [['pixel', 1]],
      exif: 0.9,
      gps: 0.4,
      places: 'everyday',
      session: [1, 5],
    }),
    bucket(['Applis', 'WhatsApp'], 0.1, ym(2016, 1), now, {
      yearMonth: true,
      styles: [['whatsapp', 1]],
      video: 0.1,
      session: [1, 10],
    }),
    bucket(['Applis', 'Messenger'], 0.015, ym(2016, 1), now, {
      styles: [['epoch', 1]],
      video: 0.08,
    }),
    bucket(['Applis', 'Snapchat'], 0.008, ym(2016, 1), endOfMonth(2022, 12), {
      styles: [['epoch', 1]],
      video: 0.3,
      session: [1, 3],
    }),
    bucket(['Applis', 'Facebook'], 0.008, ym(2016, 1), now, { styles: [['facebook', 1]] }),
    bucket(['Applis', 'Instagram'], 0.008, ym(2017, 1), now, { styles: [['epoch', 1]] }),
    bucket(['Applis', 'Skype'], 0.004, ym(2016, 1), endOfMonth(2019, 12), {
      styles: [['epoch', 1]],
    }),
    bucket(['Applis', 'Signal'], 0.01, ym(2020, 1), now, { styles: [['signal', 1]] }),
    bucket(['Albums', 'Animaux'], 0.008, ym(2016, 1), now, { ...camera, gps: 0.3, video: 0.1 }),
    bucket(['Albums', 'Animaux', 'Chat'], 0.006, ym(2018, 3), now, { ...camera, gps: 0.2 }),
    bucket(['Albums', 'Animaux', 'Chien'], 0.005, ym(2020, 6), now, { ...camera, gps: 0.4 }),
    bucket(['Albums', 'Jardin'], 0.004, ym(2018, 1), now, { ...camera, gps: 0.5 }),
    bucket(['Albums', 'Souvenirs'], 0.002, ym(2016, 1), endOfMonth(2017, 12), camera),
    bucket(['Albums', 'Souvenirs', '2018'], 0.003, ym(2018, 1), endOfMonth(2018, 12), camera),
    bucket(['Albums', 'Souvenirs', '2019'], 0.003, ym(2019, 1), endOfMonth(2019, 12), camera),
    bucket(['Albums', 'Retouches'], 0.005, ym(2019, 1), now, { ...camera, exif: 0.9 }),
    bucket(['Albums', 'Recettes'], 0.003, ym(2017, 1), now, { ...camera, gps: 0 }),
    bucket(['Albums', 'Fonds d’écran'], 0.003, ym(2016, 1), now, {
      styles: [['epoch', 1]],
      video: 0,
    }),
    bucket(['Ancien téléphone', '2016-2019'], 0.025, ym(2016, 1), endOfMonth(2019, 12), oldPhone),
    bucket(['Ancien téléphone', '2020'], 0.01, ym(2020, 1), endOfMonth(2020, 12), oldPhone),
    bucket(['Ancien téléphone', '2021'], 0.01, ym(2021, 1), endOfMonth(2021, 12), oldPhone),
    bucket(
      ['Ancien téléphone', '2021 - Voyage'],
      0.005,
      Date.UTC(2021, 6, 10),
      Date.UTC(2021, 6, 24) - 1,
      { ...oldPhone, gps: 0.85, places: findPlace('Athènes'), recentBias: false },
    ),
    bucket(['Ancien téléphone', '2022'], 0.01, ym(2022, 1), endOfMonth(2022, 9), oldPhone),
  ];

  for (const event of EVENTS) {
    if (event.start > now) continue;
    const end = Math.min(event.start + event.days * DAY - 1, now);
    const weight = Math.max(0.002, event.days * 0.0012);
    const options = {
      ...camera,
      gps: 0.8,
      places: findPlace(event.place),
      session: [4, 30],
      recentBias: false,
    } as const;
    const folders = event.subfolders ?? [];
    buckets.push(
      bucket(
        ['Événements', event.name],
        folders.length ? 0.002 : weight,
        event.start,
        end,
        options,
      ),
    );
    for (const sub of folders) {
      buckets.push(bucket(['Événements', event.name, sub], weight / 2, event.start, end, options));
    }
  }

  return buckets;
}

/** Where undated files live, with their share of the undated total. */
const UNDATED_FOLDERS: readonly (readonly [readonly string[], number])[] = [
  [['Camera Roll', 'Sans date'], 0.4],
  [['Screenshots', 'Sans date'], 0.1],
  [['Applis', 'WhatsApp', 'Sans date'], 0.15],
  [['Download', 'Sans date'], 0.15],
  [['Ancien téléphone', 'Sans date'], 0.1],
  [['Albums', 'Souvenirs', 'Sans date'], 0.1],
];

/** Largest-remainder split of `total` according to `weights`. */
function splitCount(total: number, weights: readonly number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  const exact = weights.map((weight) => (weight / sum) * total);
  const counts = exact.map(Math.floor);
  let missing = total - counts.reduce((a, b) => a + b, 0);
  const order = exact
    .map((value, index) => [value - Math.floor(value), index] as const)
    .sort((a, b) => b[0] - a[0]);
  for (const [, index] of order) {
    if (missing <= 0) break;
    counts[index] = (counts[index] ?? 0) + 1;
    missing--;
  }
  return counts;
}

const HOURS: readonly (readonly [number, number])[] = Array.from({ length: 24 }, (_, hour) => [
  hour,
  hour < 7
    ? 0.3
    : hour < 9
      ? 2
      : hour < 12
        ? 4
        : hour < 14
          ? 5
          : hour < 19
            ? 6
            : hour < 22
              ? 5
              : 1.5,
]);

export function generateDemoDataset(options: DemoOptions = {}): DemoDataset {
  const random = createRandom(options.seed ?? 20_261_006);
  const mediaCount = options.mediaCount ?? 20_000;
  const now = options.nowWallClock ?? Date.now() - new Date().getTimezoneOffset() * 60_000;
  const nowYear = new Date(now).getUTCFullYear();
  const timeZone = options.timeZone ?? 'UTC';

  const folders: DemoDriveItem[] = [];
  const files: DemoDriveItem[] = [];
  const folderIds = new Map<string, string>([['', DEMO_ROOT_ID]]);
  const namesByFolder = new Map<string, Set<string>>();
  let nextId = 0;

  folders.push({
    id: DEMO_ROOT_ID,
    name: 'Pictures',
    folder: { childCount: 0 },
    parentReference: { id: DEMO_DRIVE_ROOT_ID },
  });

  const ensureFolder = (path: readonly string[]): string => {
    const key = path.join('/');
    const existing = folderIds.get(key);
    if (existing) return existing;
    const parentId = ensureFolder(path.slice(0, -1));
    const id = `demo!f${folderIds.size}`;
    folderIds.set(key, id);
    folders.push({
      id,
      name: path.at(-1) ?? '',
      folder: { childCount: 0 },
      parentReference: { id: parentId },
    });
    return id;
  };

  const uniqueName = (folderId: string, name: string): string => {
    let names = namesByFolder.get(folderId);
    if (!names) {
      names = new Set();
      namesByFolder.set(folderId, names);
    }
    let candidate = name;
    const dot = name.lastIndexOf('.');
    for (let k = 0; names.has(candidate); k++) {
      candidate = `${name.slice(0, dot)}(${k})${name.slice(dot)}`;
    }
    names.add(candidate);
    return candidate;
  };

  const addFile = (
    path: readonly string[],
    name: string,
    kind: MediaKind,
    extra: Partial<DemoDriveItem>,
  ): void => {
    const parentId = ensureFolder(path);
    const id = `demo!${nextId++}`;
    const finalName = uniqueName(parentId, name);
    files.push({
      id,
      name: finalName,
      eTag: `"{${id}},1"`,
      size:
        kind === 'video'
          ? randomInt(random, 4, 180) * 1_000_000
          : randomInt(random, 300, 6_000) * 1_000,
      parentReference: { id: parentId },
      file: { mimeType: mimeTypeOf(finalName) },
      ...extra,
    });
  };

  const dimensions = (style: NameStyle, kind: MediaKind) => {
    const portrait = random() < 0.6;
    const [long, short] =
      kind === 'video'
        ? [1920, 1080]
        : style === 'screenshot'
          ? [2340, 1080]
          : style === 'whatsapp' || style === 'epoch' || style === 'facebook'
            ? [1600, 1200]
            : style === 'iphone'
              ? [4032, 3024]
              : style === 'meme'
                ? [900, 900]
                : [4000, 3000];
    const vertical = style === 'screenshot' || portrait;
    return vertical ? { width: short, height: long } : { width: long, height: short };
  };

  const choosePlace = (mode: PlaceMode): { place: Place; spread: number } | null => {
    if (mode === 'none') return null;
    if (mode !== 'everyday') return { place: mode, spread: 0.03 };
    const area = pickWeighted(random, [
      ['home', 70],
      ['regional', 22],
      ['abroad', 8],
    ] as const);
    if (area === 'home') return { place: HOME, spread: 0.06 };
    return { place: pick(random, area === 'regional' ? REGIONAL : ABROAD), spread: 0.03 };
  };

  // Dated files, bucket by bucket, in "sessions" of photos taken close together.
  const buckets = buildBuckets(now);
  const undatedCount = Math.round(mediaCount * UNDATED_SHARE);
  const memesCount = Math.round(mediaCount * MEMES_SHARE);
  const counts = splitCount(
    mediaCount - undatedCount - memesCount,
    buckets.map((b) => b.weight),
  );

  buckets.forEach((b, bucketIndex) => {
    let remaining = counts[bucketIndex] ?? 0;
    let counter = randomInt(random, 1, 4000);
    const end = Math.min(b.to, now);

    while (remaining > 0) {
      const [minSession, maxSession] = b.session;
      const size = Math.min(
        remaining,
        Math.round(minSession + (maxSession - minSession) * random() ** 2),
      );
      const position = b.recentBias ? Math.sqrt(random()) : random();
      const day = Math.floor((b.from + (end - b.from) * position) / DAY) * DAY;
      let time = day + pickWeighted(random, HOURS) * 3_600_000 + randomInt(random, 0, 3_599_999);
      const session = choosePlace(b.places);
      const geotagged = session !== null && random() < b.gps;

      for (let i = 0; i < size; i++) {
        time += 5_000 + Math.round(-Math.log(1 - random()) * 240_000);
        const takenAt = Math.max(b.from, Math.min(time, end - randomInt(random, 0, 60_000)));
        const kind: MediaKind = random() < b.video ? 'video' : 'image';
        const style = pickWeighted(random, b.styles);
        const { name, nameDate } = generateName(style, kind, takenAt, random, counter++, timeZone);
        const hasExif = random() < (kind === 'video' ? b.exif * 0.85 : b.exif);
        const second = Math.floor(takenAt / 1000) * 1000;

        const d = new Date(takenAt);
        const path = b.yearMonth
          ? [...b.path, String(d.getUTCFullYear()), String(d.getUTCMonth() + 1).padStart(2, '0')]
          : b.path;

        const { width, height } = dimensions(style, kind);
        // Like on a real drive: MP4 videos carry their container time in UTC, while
        // photos and iPhone videos carry the local time.
        const utcContainer = kind === 'video' && style !== 'iphone' && style !== 'ios';
        const exifDigits = utcContainer ? toInstant(second, timeZone) : second;
        const fromExif = hasExif ? ({ takenAt: exifDigits, source: 'exif' } as const) : null;
        const fromName =
          nameDate !== null ? ({ takenAt: nameDate, source: 'filename' } as const) : null;
        const extra: Partial<DemoDriveItem> = {
          // Same precedence as resolveCaptureDate: the name first for videos, EXIF first for photos.
          demoExpectedDate:
            (kind === 'video' ? (fromName ?? fromExif) : (fromExif ?? fromName)) ?? null,
        };
        if (hasExif) {
          extra.photo = {
            takenDateTime: new Date(exifDigits).toISOString().replace('.000Z', 'Z'),
            ...(b.camera ? { cameraMake: b.camera[0], cameraModel: b.camera[1] } : {}),
          };
        }
        if (kind === 'video') {
          extra.video = { duration: randomInt(random, 2_000, 90_000), width, height };
        } else {
          extra.image = { width, height };
        }
        if (geotagged && session) {
          extra.location = {
            latitude: round6(session.place.latitude + gaussian(random) * session.spread),
            longitude: round6(session.place.longitude + gaussian(random) * session.spread),
          };
        }
        addFile(path, name, kind, extra);
      }
      remaining -= size;
    }
  });

  // Undated files: in "Sans date" folders, plus a memes album with no dates at all.
  const undatedCounts = splitCount(
    undatedCount,
    UNDATED_FOLDERS.map(([, share]) => share),
  );
  UNDATED_FOLDERS.forEach(([path], index) => {
    for (let i = 0; i < (undatedCounts[index] ?? 0); i++) {
      const kind: MediaKind = random() < 0.05 ? 'video' : 'image';
      const name = generateUndatedName(kind, random, randomInt(random, 1, 9_999), nowYear);
      const { width, height } = dimensions('camera', kind);
      addFile(path, name, kind, {
        demoExpectedDate: null,
        ...(kind === 'video'
          ? { video: { duration: randomInt(random, 2_000, 60_000), width, height } }
          : { image: { width, height } }),
      });
    }
  });
  for (let i = 0; i < memesCount; i++) {
    const { name } = generateName('meme', 'image', 0, random, i + 1, timeZone);
    addFile(['Albums', 'Memes'], name, 'image', {
      demoExpectedDate: null,
      image: dimensions('meme', 'image'),
    });
  }

  // A few non-media files, which the index must ignore.
  for (const [path, name] of [
    [[], 'desktop.ini'],
    [['Download', '2024', '03'], 'facture.pdf'],
    [['Albums', 'Recettes'], 'liste-de-courses.txt'],
    [['Camera Roll'], 'Thumbs.db'],
  ] as const) {
    const parentId = ensureFolder(path);
    const id = `demo!${nextId++}`;
    files.push({
      id,
      name,
      eTag: `"{${id}},1"`,
      size: randomInt(random, 1, 500) * 1_000,
      parentReference: { id: parentId },
      file: { mimeType: mimeTypeOf(name) },
    });
  }

  return { items: [...folders, ...files], rootFolderIds: [DEMO_ROOT_ID] };
}

function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}
