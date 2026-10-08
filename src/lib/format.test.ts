import { describe, expect, it } from 'vitest';
import { formatBytes } from './format.ts';

describe('formatBytes', () => {
  it('uses decimal units, as OneDrive shows sizes', () => {
    expect(formatBytes(120)).toBe('1 Ko');
    expect(formatBytes(820_000)).toBe('820 Ko');
    expect(formatBytes(3_240_000)).toBe('3,2 Mo');
    expect(formatBytes(512_000_000)).toBe('512 Mo');
    expect(formatBytes(12_400_000_000)).toBe('12,4 Go');
  });
});
