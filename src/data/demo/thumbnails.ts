import { formatShortDate } from '../../lib/format.ts';
import type { MediaItem, ThumbnailSize } from '../model.ts';
import { hashString } from './random.ts';

/**
 * Fake thumbnails drawn locally as SVG (no real photo, no network): a small
 * landscape or a phone screen, tinted from the item id, with the capture
 * date written in the corner so sorting can be checked at a glance.
 * Grid sizes are square crops (like Graph's cropped thumbnails), so the label
 * is never cut; "large" keeps the photo's aspect ratio.
 */

const WIDTH = 160;
const cache = new Map<string, string>();

export function demoThumbnailUrl(item: MediaItem, size: ThumbnailSize): string {
  const key = `${item.id}:${size === 'large' ? 'l' : 's'}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const ratio = size === 'large' && item.width && item.height ? item.height / item.width : 1;
  const height = Math.round(WIDTH * ratio);
  const hash = hashString(item.id);
  const body = /^Screen/i.test(item.name) ? screen(hash, height) : landscape(hash, height);
  const label = item.takenAt === null ? 'sans date' : formatShortDate(item.takenAt);

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${height}" preserveAspectRatio="xMidYMid slice">` +
    body +
    `<text x="10" y="${height - 12}" font-family="system-ui,sans-serif" font-size="15" font-weight="700" fill="#fff" stroke="rgba(0,0,0,.35)" stroke-width="3" paint-order="stroke">${label}</text>` +
    `</svg>`;

  const url = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  if (cache.size > 5_000) cache.clear();
  cache.set(key, url);
  return url;
}

function landscape(hash: number, height: number): string {
  const hue = hash % 360;
  const sunX = 24 + ((hash >>> 9) % 112);
  const sunR = 10 + ((hash >>> 17) % 12);
  const horizon = height * (0.55 + ((hash >>> 4) % 15) / 100);
  const peak = horizon - height * (0.12 + ((hash >>> 12) % 12) / 100);
  return (
    `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="hsl(${hue} 70% 80%)"/>` +
    `<stop offset="1" stop-color="hsl(${(hue + 40) % 360} 60% 64%)"/>` +
    `</linearGradient></defs>` +
    `<rect width="${WIDTH}" height="${height}" fill="url(#s)"/>` +
    `<circle cx="${sunX}" cy="${height * 0.28}" r="${sunR}" fill="hsl(48 95% 88%)" opacity=".9"/>` +
    `<path d="M0 ${horizon} Q ${WIDTH * 0.3} ${peak} ${WIDTH * 0.55} ${horizon - 6} T ${WIDTH} ${horizon - 12} V ${height} H 0 Z" fill="hsl(${(hue + 150) % 360} 30% 46%)" opacity=".75"/>` +
    `<path d="M0 ${horizon + height * 0.14} Q ${WIDTH * 0.45} ${horizon - 4} ${WIDTH} ${horizon + height * 0.1} V ${height} H 0 Z" fill="hsl(${(hue + 170) % 360} 35% 32%)"/>`
  );
}

function screen(hash: number, height: number): string {
  const hue = hash % 360;
  const rows = Array.from({ length: 6 }, (_, i) => {
    const y = 30 + i * ((height - 50) / 6);
    const width = 70 + ((hash >>> (i * 3)) % 60);
    return `<rect x="14" y="${y}" width="${width}" height="${(height - 50) / 10}" rx="5" fill="hsl(${hue} 30% 86%)"/>`;
  }).join('');
  return (
    `<rect width="${WIDTH}" height="${height}" fill="hsl(${hue} 25% 96%)"/>` +
    `<rect width="${WIDTH}" height="18" fill="hsl(${hue} 45% 55%)"/>` +
    rows
  );
}
