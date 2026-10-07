import { readPersistent, usePersistentState, writePersistent } from '../lib/persistent.ts';

/**
 * Root folders of the perimeter: what the index covers, as paths from the
 * drive root ("/Pictures"). OneDrive paths ignore case. Roots never overlap:
 * a folder inside a root is already covered, and adding a folder that holds
 * roots replaces them.
 */

export const DEFAULT_ROOT_PATHS: readonly string[] = ['/Pictures'];
const ROOT_PATHS_KEY = 'rootPaths';

export function readRootPaths(): string[] {
  const paths = readPersistent<string[] | null>(ROOT_PATHS_KEY, null);
  return paths && paths.length > 0 ? paths : [...DEFAULT_ROOT_PATHS];
}

export function writeRootPaths(paths: readonly string[]): void {
  writePersistent(ROOT_PATHS_KEY, paths);
}

/** The root paths, updated when they change. */
export function useRootPaths(): readonly string[] {
  const [paths] = usePersistentState<string[] | null>(ROOT_PATHS_KEY, null);
  return paths && paths.length > 0 ? paths : DEFAULT_ROOT_PATHS;
}

const key = (path: string) => path.toLocaleLowerCase('en');

/** Whether `path` is `root` or a folder below it. */
export function isWithin(path: string, root: string): boolean {
  if (root === '/') return true;
  return key(path) === key(root) || key(path).startsWith(`${key(root)}/`);
}

/** The root that already covers `path`, if any. */
export function rootCovering(roots: readonly string[], path: string): string | null {
  return roots.find((root) => isWithin(path, root)) ?? null;
}

/** Roots with `path` added, minus the roots it holds. Unchanged when already covered. */
export function withRoot(roots: readonly string[], path: string): string[] {
  if (rootCovering(roots, path)) return [...roots];
  return [...roots.filter((root) => !isWithin(root, path)), path];
}

/** Roots without `path`; the last root cannot be removed. */
export function withoutRoot(roots: readonly string[], path: string): string[] {
  const rest = roots.filter((root) => key(root) !== key(path));
  return rest.length > 0 ? rest : [...roots];
}

/** Last segment of a path, for display ("/" is the whole drive). */
export function folderName(path: string): string {
  return path === '/' ? 'OneDrive' : (path.split('/').filter(Boolean).at(-1) ?? path);
}

/** Path of a folder in `parent`. */
export function childPath(parent: string, name: string): string {
  return parent === '/' ? `/${name}` : `${parent}/${name}`;
}
