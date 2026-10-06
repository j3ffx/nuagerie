import type { GraphDriveItem } from './graph/types.ts';
import type { MediaIndex } from './model.ts';

/**
 * Anonymous summary of an index, to check assumptions about the Graph data
 * (which facets are present, which file names yield no date…). It holds
 * counts and name *shapes* only — never a real name, path or place.
 */
export interface DiagnosticReport {
  generatedAt: string;
  mode: string;
  channels: { path: string; scope: string }[];
  apiChecks: { check: string; result: string }[];
  counts: {
    storedItems: number;
    folders: number;
    indexedMedia: number;
    images: number;
    videos: number;
    mimeTypes: Record<string, number>;
    photoFacet: number;
    takenDateTime: number;
    videosWithTakenDateTime: number;
    location: number;
    imageSize: number;
    dateSources: { exif: number; filename: number; none: number };
  };
  /** Shapes of names without any date, most frequent first ("a_9999.jpg"). */
  undatedNameShapes: { shape: string; count: number }[];
  /** Shapes of names dated from the file name, to spot unexpected formats. */
  filenameDatedShapes: { shape: string; count: number }[];
  lastSyncAt: string | null;
}

/** "IMG_1234.JPG" → "a_9999.jpg": letters become "a", digits "9", extension kept. */
export function nameShape(name: string): string {
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const extension = dot > 0 ? name.slice(dot).toLowerCase() : '';
  return stem.replace(/\p{L}+/gu, 'a').replace(/\d/g, '9') + extension;
}

function topShapes(names: Iterable<string>, limit: number): { shape: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const name of names) {
    const shape = nameShape(name);
    counts.set(shape, (counts.get(shape) ?? 0) + 1);
  }
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([shape, count]) => ({ shape, count }));
}

export function summarize(
  raw: readonly GraphDriveItem[],
  index: MediaIndex,
  extra: Pick<DiagnosticReport, 'mode' | 'channels' | 'apiChecks' | 'lastSyncAt'>,
): DiagnosticReport {
  const media = new Set(index.items.map((item) => item.id));
  const counts: DiagnosticReport['counts'] = {
    storedItems: raw.length,
    folders: raw.filter((item) => item.folder).length,
    indexedMedia: index.items.length,
    images: 0,
    videos: 0,
    mimeTypes: {},
    photoFacet: 0,
    takenDateTime: 0,
    videosWithTakenDateTime: 0,
    location: 0,
    imageSize: 0,
    dateSources: { exif: 0, filename: 0, none: 0 },
  };

  for (const item of raw) {
    if (!media.has(item.id)) continue;
    const mime = item.file?.mimeType ?? '';
    counts.mimeTypes[mime] = (counts.mimeTypes[mime] ?? 0) + 1;
    const video = mime.startsWith('video/');
    if (video) counts.videos++;
    else counts.images++;
    if (item.photo) counts.photoFacet++;
    if (item.photo?.takenDateTime) {
      counts.takenDateTime++;
      if (video) counts.videosWithTakenDateTime++;
    }
    if (item.location?.latitude !== undefined) counts.location++;
    if (item.image?.width) counts.imageSize++;
  }

  for (const item of index.items) {
    counts.dateSources[item.dateSource ?? 'none']++;
  }

  return {
    generatedAt: new Date().toISOString(),
    ...extra,
    counts,
    undatedNameShapes: topShapes(
      index.items.filter((item) => item.takenAt === null).map((item) => item.name),
      40,
    ),
    filenameDatedShapes: topShapes(
      index.items.filter((item) => item.dateSource === 'filename').map((item) => item.name),
      40,
    ),
  };
}
