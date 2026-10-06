import { describe, expect, it } from 'vitest';
import {
  clampZoom,
  closesOnDrag,
  fitSize,
  MAX_SCALE,
  NO_ZOOM,
  swipeOutcome,
  toggleZoom,
  zoomAt,
} from './gestures.ts';

const view = { width: 360, height: 760 };

describe('fitSize', () => {
  it('fits landscape pictures to the width and portrait ones to the height', () => {
    expect(fitSize(view, 3 / 4)).toEqual({ width: 360, height: 270 });
    expect(fitSize(view, 3)).toEqual({ width: 760 / 3, height: 760 });
  });

  it('fills the view when the ratio is unknown', () => {
    expect(fitSize(view, Number.NaN)).toEqual(view);
  });
});

describe('zoom', () => {
  const fitted = { width: 360, height: 270 };

  it('keeps the zoomed picture inside the screen', () => {
    // At 2×, the picture is 720 × 540: it can move 180 px sideways, not vertically.
    expect(clampZoom({ scale: 2, x: 500, y: 500 }, fitted, view)).toEqual({
      scale: 2,
      x: 180,
      y: 0,
    });
    expect(clampZoom({ scale: 10, x: 0, y: 0 }, fitted, view).scale).toBe(MAX_SCALE);
    expect(clampZoom({ scale: 0.5, x: 30, y: 0 }, fitted, view)).toEqual(NO_ZOOM);
  });

  it('zooms around the fingers: the point under them stays in place', () => {
    const zoomed = zoomAt(NO_ZOOM, 2, 100, 0, fitted, view);
    // The picture point at +100 px is now at 2 × 100 + x: still under the finger.
    expect(2 * 100 + zoomed.x).toBeCloseTo(100);
  });

  it('toggles between the whole picture and a close-up on double tap', () => {
    const close = toggleZoom(NO_ZOOM, 50, 20, fitted, view);
    expect(close.scale).toBe(2.5);
    expect(toggleZoom(close, 0, 0, fitted, view)).toEqual(NO_ZOOM);
  });
});

describe('drag outcomes', () => {
  it('moves to the next or previous picture past a quarter of the screen, or on a flick', () => {
    expect(swipeOutcome(-100, 0.1, 360)).toBe(1);
    expect(swipeOutcome(100, 0.1, 360)).toBe(-1);
    expect(swipeOutcome(-60, 0.1, 360)).toBe(0);
    expect(swipeOutcome(-40, 0.9, 360)).toBe(1);
    expect(swipeOutcome(-10, 2, 360)).toBe(0);
  });

  it('closes on a long or quick drag down', () => {
    expect(closesOnDrag(200, 0.1, 760)).toBe(true);
    expect(closesOnDrag(60, 0.8, 760)).toBe(true);
    expect(closesOnDrag(60, 0.1, 760)).toBe(false);
  });
});
