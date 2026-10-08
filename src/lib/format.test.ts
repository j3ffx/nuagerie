import { describe, expect, it } from 'vitest';
import { formatBytes, formatDimensions, formatDuration } from './format.ts';

describe('formatBytes', () => {
  it('uses decimal units, as OneDrive shows sizes', () => {
    expect(formatBytes(120)).toBe('1 Ko');
    expect(formatBytes(820_000)).toBe('820 Ko');
    expect(formatBytes(3_240_000)).toBe('3,2 Mo');
    expect(formatBytes(512_000_000)).toBe('512 Mo');
    expect(formatBytes(12_400_000_000)).toBe('12,4 Go');
  });
});

describe('formatDuration', () => {
  it('says seconds, minutes and hours as a video player would', () => {
    expect(formatDuration(42_000)).toBe('42 s');
    expect(formatDuration(185_000)).toBe('3 min 05 s');
    expect(formatDuration(3_720_000)).toBe('1 h 02 min');
    expect(formatDuration(200)).toBe('1 s');
  });
});

describe('formatDimensions', () => {
  it('gives the size in pixels, and megapixels from 1 up', () => {
    expect(formatDimensions(4000, 3000)).toBe('4 000 × 3 000 · 12 Mpx');
    expect(formatDimensions(4080, 3060)).toBe('4 080 × 3 060 · 12,5 Mpx');
    expect(formatDimensions(640, 480)).toBe('640 × 480');
  });
});
