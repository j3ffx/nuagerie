import { describe, expect, it } from 'vitest';
import { childPath, folderName, isWithin, rootCovering, withoutRoot, withRoot } from './roots.ts';

describe('root folders', () => {
  it('knows when a folder is inside a root, ignoring case', () => {
    expect(isWithin('/Pictures/Albums', '/Pictures')).toBe(true);
    expect(isWithin('/pictures', '/Pictures')).toBe(true);
    expect(isWithin('/Pictures 2', '/Pictures')).toBe(false);
    expect(isWithin('/Documents', '/')).toBe(true);
    expect(rootCovering(['/Pictures', '/Documents/Scans'], '/Documents/Scans/2019')).toBe(
      '/Documents/Scans',
    );
    expect(rootCovering(['/Pictures'], '/Documents')).toBeNull();
  });

  it('adds a folder, ignoring one already covered and replacing the roots it holds', () => {
    expect(withRoot(['/Pictures'], '/Documents/Scans')).toEqual(['/Pictures', '/Documents/Scans']);
    expect(withRoot(['/Pictures'], '/Pictures/Albums')).toEqual(['/Pictures']);
    expect(withRoot(['/Pictures', '/Documents/Scans'], '/Documents')).toEqual([
      '/Pictures',
      '/Documents',
    ]);
  });

  it('removes a folder, but never the last one', () => {
    expect(withoutRoot(['/Pictures', '/Documents'], '/documents')).toEqual(['/Pictures']);
    expect(withoutRoot(['/Pictures'], '/Pictures')).toEqual(['/Pictures']);
  });

  it('names folders and builds child paths', () => {
    expect(folderName('/Documents/Scans')).toBe('Scans');
    expect(folderName('/')).toBe('OneDrive');
    expect(childPath('/', 'Pictures')).toBe('/Pictures');
    expect(childPath('/Documents', 'Scans')).toBe('/Documents/Scans');
  });
});
