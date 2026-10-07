/**
 * Reads CHANGELOG.md, the list of what each version brought, for "Quoi de
 * neuf" in the app. Only the shape that file uses is understood: a "## x.y.z
 * — date" heading per version, optional intro lines, "### Section" headings
 * and "- " items (wrapped lines are indented).
 */

export interface Release {
  version: string;
  /** "2026-10-07", when given. */
  date: string | null;
  intro: string;
  sections: { title: string; items: string[] }[];
}

/** Markdown links and code marks become plain text. */
const plain = (text: string) =>
  text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();

export function parseChangelog(markdown: string): Release[] {
  const releases: Release[] = [];
  let release: Release | null = null;
  let section: Release['sections'][number] | null = null;
  let intro: string[] = [];

  const closeIntro = () => {
    if (release && intro.length > 0) release.intro = plain(intro.join(' '));
    intro = [];
  };

  for (const line of markdown.replace(/\r\n/g, '\n').split('\n')) {
    const heading = /^## (\d+\.\d+\.\d+)(?:\s+—\s+(\S+))?/.exec(line);
    if (heading) {
      closeIntro();
      release = { version: heading[1] ?? '', date: heading[2] ?? null, intro: '', sections: [] };
      releases.push(release);
      section = null;
      continue;
    }
    if (!release) continue;
    const title = /^### (.+)/.exec(line);
    if (title) {
      closeIntro();
      section = { title: plain(title[1] ?? ''), items: [] };
      release.sections.push(section);
      continue;
    }
    if (section) {
      if (line.startsWith('- ')) section.items.push(plain(line.slice(2)));
      else if (/^\s+\S/.test(line) && section.items.length > 0) {
        const last = section.items.length - 1;
        section.items[last] = `${section.items[last] ?? ''} ${plain(line)}`;
      }
    } else if (line.trim()) {
      intro.push(line);
    }
  }
  closeIntro();
  return releases;
}

/** Negative, zero or positive, like a sort comparator ("0.10.0" comes after "0.9.1"). */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** Releases newer than `seen`, up to `current`, most recent first. */
export function releasesSince(releases: readonly Release[], seen: string, current: string) {
  return releases.filter(
    (release) =>
      compareVersions(release.version, seen) > 0 && compareVersions(release.version, current) <= 0,
  );
}
