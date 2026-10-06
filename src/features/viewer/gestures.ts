/**
 * Geometry of the viewer gestures, kept pure so it can be tested: fitting a
 * picture in the screen, zooming around a point, keeping a zoomed picture
 * inside the screen, and deciding what a released drag means.
 * Offsets are in CSS pixels from the centre of the screen.
 */

export interface Size {
  width: number;
  height: number;
}

export interface Zoom {
  scale: number;
  x: number;
  y: number;
}

export const NO_ZOOM: Zoom = { scale: 1, x: 0, y: 0 };
export const MAX_SCALE = 4;
export const DOUBLE_TAP_SCALE = 2.5;

/** Height / width from the index, until the picture itself is loaded; square when unknown. */
export function itemAspect(item: { width: number | null; height: number | null }): number {
  return item.width && item.height ? item.height / item.width : 1;
}

/** Largest size of the given aspect ratio (height / width) that fits in the view. */
export function fitSize(view: Size, aspect: number): Size {
  if (!(aspect > 0) || view.width <= 0 || view.height <= 0) return { ...view };
  const width = Math.min(view.width, view.height / aspect);
  return { width, height: width * aspect };
}

/** Keeps the zoomed picture covering the screen where it can, centred where it cannot. */
export function clampZoom(zoom: Zoom, fitted: Size, view: Size): Zoom {
  const scale = Math.min(MAX_SCALE, Math.max(1, zoom.scale));
  const maxX = Math.max(0, (fitted.width * scale - view.width) / 2);
  const maxY = Math.max(0, (fitted.height * scale - view.height) / 2);
  return {
    scale,
    x: Math.min(maxX, Math.max(-maxX, zoom.x)),
    y: Math.min(maxY, Math.max(-maxY, zoom.y)),
  };
}

/** Zooms to `scale` keeping the point under (px, py) — relative to the centre — in place. */
export function zoomAt(
  zoom: Zoom,
  scale: number,
  px: number,
  py: number,
  fitted: Size,
  view: Size,
): Zoom {
  const target = Math.min(MAX_SCALE, Math.max(1, scale));
  const ratio = target / zoom.scale;
  return clampZoom(
    { scale: target, x: px - (px - zoom.x) * ratio, y: py - (py - zoom.y) * ratio },
    fitted,
    view,
  );
}

/** Double tap: zoom in on the tapped point, or back to the whole picture. */
export function toggleZoom(zoom: Zoom, px: number, py: number, fitted: Size, view: Size): Zoom {
  return zoom.scale > 1.01 ? NO_ZOOM : zoomAt(zoom, DOUBLE_TAP_SCALE, px, py, fitted, view);
}

/**
 * What a released horizontal drag means: the next picture (1), the previous
 * one (-1), or staying (0). A quarter of the screen, or a quick flick, is enough.
 */
export function swipeOutcome(dx: number, velocity: number, width: number): -1 | 0 | 1 {
  const far = Math.abs(dx) > width / 4;
  const flick = Math.abs(velocity) > 0.5 && Math.abs(dx) > 24;
  if (!far && !flick) return 0;
  return dx < 0 ? 1 : -1;
}

/** A released vertical drag downwards closes the viewer. */
export function closesOnDrag(dy: number, velocity: number, height: number): boolean {
  return dy > height / 5 || (velocity > 0.5 && dy > 40);
}
