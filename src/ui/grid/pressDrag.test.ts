import { describe, expect, it } from 'vitest';
import { dragPoint } from './pressDrag.ts';

// A 360 × 760 phone: header 56 px high, bottom bar from 680 px.
const area = { top: 56, bottom: 680, left: 0, right: 360 };

describe('dragPoint', () => {
  it('points where the finger is in the middle of the grid, without scrolling', () => {
    expect(dragPoint({ x: 100, y: 300 }, area)).toEqual({ x: 100, y: 300, scroll: 0 });
  });

  it('over the bottom bar, points at the last row on screen and scrolls down faster', () => {
    const point = dragPoint({ x: 100, y: 720 }, area);
    expect(point.y).toBe(679);
    expect(point.scroll).toBeGreaterThan(dragPoint({ x: 100, y: 650 }, area).scroll);
    expect(dragPoint({ x: 100, y: 650 }, area).scroll).toBeGreaterThan(0);
  });

  it('under the header, points at the first row and scrolls up', () => {
    const point = dragPoint({ x: 100, y: 20 }, area);
    expect(point.y).toBe(57);
    expect(point.scroll).toBeLessThan(0);
    expect(dragPoint({ x: 100, y: 100 }, area).scroll).toBeLessThan(0);
  });

  it('stays within the grid sideways (the date scrubber floats on the right)', () => {
    expect(dragPoint({ x: 400, y: 300 }, area).x).toBe(359);
    expect(dragPoint({ x: -5, y: 300 }, area).x).toBe(1);
  });
});
