import { describe, expect, it } from 'vitest';
import { isTechnicalFolderName } from './technical.ts';

describe('isTechnicalFolderName', () => {
  it('treats years as technical', () => {
    expect(isTechnicalFolderName('2026', 'Camera Roll')).toBe(true);
    expect(isTechnicalFolderName('2016', null)).toBe(true);
  });

  it('treats months as technical only under a year', () => {
    expect(isTechnicalFolderName('10', '2026')).toBe(true);
    expect(isTechnicalFolderName('01', '2019')).toBe(true);
    expect(isTechnicalFolderName('10', 'Albums')).toBe(false);
    expect(isTechnicalFolderName('13', '2026')).toBe(false);
    expect(isTechnicalFolderName('00', '2026')).toBe(false);
    expect(isTechnicalFolderName('7', '2026')).toBe(false);
  });

  it('treats "Sans date" as technical, whatever the case', () => {
    expect(isTechnicalFolderName('Sans date', 'Camera Roll')).toBe(true);
    expect(isTechnicalFolderName('sans date', '2026')).toBe(true);
  });

  it('keeps named folders as albums', () => {
    expect(isTechnicalFolderName('Camera Roll', null)).toBe(false);
    expect(isTechnicalFolderName('2016-2019', 'Ancien téléphone')).toBe(false);
    expect(isTechnicalFolderName('2021 - Voyage', 'Ancien téléphone')).toBe(false);
    expect(isTechnicalFolderName('2024-05 - Vacances', 'Événements')).toBe(false);
  });
});
