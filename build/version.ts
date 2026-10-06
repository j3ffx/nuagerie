import { execFileSync } from 'node:child_process';
import type { Plugin } from 'vite';

/** Short commit of the build: from CI (GitHub, Cloudflare) or the local checkout. */
export function currentCommit(): string {
  const fromCi = process.env.GITHUB_SHA ?? process.env.CF_PAGES_COMMIT_SHA;
  if (fromCi) return fromCi.slice(0, 7);
  try {
    return execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

/**
 * Publishes /version.json, so a running app can tell whether a newer version
 * is deployed. No build time in it: times are personal data (CLAUDE.md → Privacy).
 */
export function versionFile(info: { version: string; commit: string }): Plugin {
  return {
    name: 'nuagerie:version-file',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify(info) });
    },
  };
}
