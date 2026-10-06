import { formatShortDate } from '../../lib/format.ts';
import type { MediaItem, ThumbnailSize } from '../model.ts';
import { hashString } from './random.ts';

/**
 * Fake thumbnails drawn locally (no real photo, no network): a small
 * landscape or a phone screen, tinted from the item id, with the capture date
 * written in the corner so sorting can be checked at a glance.
 * They are raster images (JPEG from a canvas), like Graph's JPEG thumbnails,
 * drawn in a worker (thumbnailWorker.ts) as if they came from the network, so
 * the demo costs the same to display and goes through the same cache.
 * Grid sizes are square crops; "large" keeps the photo's aspect ratio.
 */

/** What the drawing needs from an item (sent to the worker). */
export type DemoThumbnailInput = Pick<MediaItem, 'id' | 'name' | 'takenAt' | 'width' | 'height'>;

/** Drawing units: shapes are laid out on a 160-unit-wide picture. */
const UNITS = 160;
const PIXELS: Record<ThumbnailSize, number> = { small: 200, medium: 320, large: 800 };

function aspect(item: DemoThumbnailInput, size: ThumbnailSize): number {
  return size === 'large' && item.width && item.height ? item.height / item.width : 1;
}

/** Draws the thumbnail on the current thread. */
export async function drawDemoThumbnail(
  item: DemoThumbnailInput,
  size: ThumbnailSize,
): Promise<Blob> {
  if (typeof OffscreenCanvas === 'undefined') {
    return new Blob([demoThumbnailSvg(item, size)], { type: 'image/svg+xml' });
  }
  const width = PIXELS[size];
  const height = Math.round(width * aspect(item, size));
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No 2D canvas');
  const scale = width / UNITS;
  context.scale(scale, scale);
  draw(context, item, UNITS, height / scale);
  return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
}

function label(item: DemoThumbnailInput): string {
  return item.takenAt === null ? 'sans date' : formatShortDate(item.takenAt);
}

function draw(
  c: OffscreenCanvasRenderingContext2D,
  item: DemoThumbnailInput,
  w: number,
  h: number,
) {
  const hash = hashString(item.id);
  const hue = hash % 360;
  if (/^Screen/i.test(item.name)) {
    c.fillStyle = `hsl(${hue} 25% 96%)`;
    c.fillRect(0, 0, w, h);
    c.fillStyle = `hsl(${hue} 45% 55%)`;
    c.fillRect(0, 0, w, 18);
    c.fillStyle = `hsl(${hue} 30% 86%)`;
    for (let i = 0; i < 6; i++) {
      const y = 30 + i * ((h - 50) / 6);
      c.beginPath();
      c.roundRect(14, y, 70 + ((hash >>> (i * 3)) % 60), (h - 50) / 10, 5);
      c.fill();
    }
  } else {
    const sky = c.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, `hsl(${hue} 70% 80%)`);
    sky.addColorStop(1, `hsl(${(hue + 40) % 360} 60% 64%)`);
    c.fillStyle = sky;
    c.fillRect(0, 0, w, h);

    c.globalAlpha = 0.9;
    c.fillStyle = 'hsl(48 95% 88%)';
    c.beginPath();
    c.arc(24 + ((hash >>> 9) % 112), h * 0.28, 10 + ((hash >>> 17) % 12), 0, Math.PI * 2);
    c.fill();

    const horizon = h * (0.55 + ((hash >>> 4) % 15) / 100);
    const peak = horizon - h * (0.12 + ((hash >>> 12) % 12) / 100);
    c.globalAlpha = 0.75;
    c.fillStyle = `hsl(${(hue + 150) % 360} 30% 46%)`;
    c.beginPath();
    c.moveTo(0, horizon);
    c.quadraticCurveTo(w * 0.3, peak, w * 0.55, horizon - 6);
    // Smooth continuation (SVG "T"): the control point mirrors the previous one.
    c.quadraticCurveTo(w * 0.8, 2 * (horizon - 6) - peak, w, horizon - 12);
    c.lineTo(w, h);
    c.lineTo(0, h);
    c.fill();

    c.globalAlpha = 1;
    c.fillStyle = `hsl(${(hue + 170) % 360} 35% 32%)`;
    c.beginPath();
    c.moveTo(0, horizon + h * 0.14);
    c.quadraticCurveTo(w * 0.45, horizon - 4, w, horizon + h * 0.1);
    c.lineTo(w, h);
    c.lineTo(0, h);
    c.fill();
  }

  c.font = '700 15px system-ui, sans-serif';
  c.lineJoin = 'round';
  c.lineWidth = 3;
  c.strokeStyle = 'rgba(0,0,0,.35)';
  c.fillStyle = '#fff';
  c.strokeText(label(item), 10, h - 12);
  c.fillText(label(item), 10, h - 12);
}

/** Same picture as SVG, where no canvas is available (unit tests). */
export function demoThumbnailSvg(item: DemoThumbnailInput, size: ThumbnailSize): string {
  const height = Math.round(UNITS * aspect(item, size));
  const hue = hashString(item.id) % 360;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${UNITS} ${height}">` +
    `<rect width="${UNITS}" height="${height}" fill="hsl(${hue} 60% 70%)"/>` +
    `<text x="10" y="${height - 12}" font-family="system-ui,sans-serif" font-size="15" font-weight="700" fill="#fff">${label(item)}</text>` +
    `</svg>`
  );
}
