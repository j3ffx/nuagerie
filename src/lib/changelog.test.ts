import { describe, expect, it } from 'vitest';
import changelog from '../../CHANGELOG.md?raw';
import packageJson from '../../package.json?raw';
import { compareVersions, parseChangelog, releasesSince } from './changelog.ts';

const SAMPLE = `# Nouveautés

Intro of the file, ignored.

## 0.2.0 — 2026-11-02

Favourites, at last.

### Nouveautés

- A heart in the viewer, and a
  [Favoris](https://example.test) album.
- Works \`offline\` too.

### Corrections

- A fix.

## 0.1.0 — 2026-10-07

### Nouveautés

- First version.
`;

describe('parseChangelog', () => {
  it('reads versions, dates, intros, sections and wrapped items as plain text', () => {
    const releases = parseChangelog(SAMPLE);
    expect(releases.map((r) => r.version)).toEqual(['0.2.0', '0.1.0']);
    expect(releases[0]).toEqual({
      version: '0.2.0',
      date: '2026-11-02',
      intro: 'Favourites, at last.',
      sections: [
        {
          title: 'Nouveautés',
          items: ['A heart in the viewer, and a Favoris album.', 'Works offline too.'],
        },
        { title: 'Corrections', items: ['A fix.'] },
      ],
    });
    expect(releases[1]?.intro).toBe('');
  });

  it('compares versions number by number', () => {
    expect(compareVersions('0.10.0', '0.9.1')).toBeGreaterThan(0);
    expect(compareVersions('0.1.0', '0.1.0')).toBe(0);
    expect(compareVersions('0.1.0', '1.0.0')).toBeLessThan(0);
  });

  it('keeps the releases after the last one seen, up to the running one', () => {
    const releases = parseChangelog(SAMPLE);
    expect(releasesSince(releases, '0.1.0', '0.2.0').map((r) => r.version)).toEqual(['0.2.0']);
    expect(releasesSince(releases, '0.0.0', '0.1.0').map((r) => r.version)).toEqual(['0.1.0']);
    expect(releasesSince(releases, '0.2.0', '0.2.0')).toEqual([]);
  });
});

describe('CHANGELOG.md', () => {
  it('describes the version in package.json, or the next one being prepared', () => {
    const { version } = JSON.parse(packageJson) as { version: string };
    const releases = parseChangelog(changelog);
    const latest = releases[0];
    expect(latest?.sections.flatMap((s) => s.items).length).toBeGreaterThan(0);
    // The notes may be written ahead of the release; a released version always has its own.
    expect(compareVersions(latest?.version ?? '0.0.0', version)).toBeGreaterThanOrEqual(0);
    if (version !== '0.0.0') expect(releases.map((r) => r.version)).toContain(version);
    // Most recent first.
    const versions = releases.map((r) => r.version);
    expect([...versions].sort((a, b) => compareVersions(b, a))).toEqual(versions);
  });
});
