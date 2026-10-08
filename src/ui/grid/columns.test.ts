import { describe, expect, it } from 'vitest';
import { clampColumns, MAX_COLUMNS_NARROW, MIN_COLUMNS, pinchStep } from './columns.ts';

describe('pinchStep', () => {
  it('takes a column away when the fingers spread, adds one when they close', () => {
    expect(pinchStep(1.3)).toBe(-1);
    expect(pinchStep(0.75)).toBe(1);
  });

  it('waits for a clear move', () => {
    expect(pinchStep(1)).toBe(0);
    expect(pinchStep(1.1)).toBe(0);
    expect(pinchStep(0.9)).toBe(0);
  });
});

describe('clampColumns', () => {
  it('keeps the count between the fewest and the most a screen allows', () => {
    expect(clampColumns(2, MAX_COLUMNS_NARROW)).toBe(MIN_COLUMNS);
    expect(clampColumns(5, MAX_COLUMNS_NARROW)).toBe(5);
    expect(clampColumns(9, MAX_COLUMNS_NARROW)).toBe(MAX_COLUMNS_NARROW);
  });
});
