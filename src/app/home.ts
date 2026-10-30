/**
 * The app's own address (VITE_HOME_URL, e.g. "https://nuagerie.app"), once it
 * has one. Its first address on Cloudflare Pages ("<project>.pages.dev") then
 * sends people there: data on a device belongs to one address (IndexedDB,
 * Cache Storage, the installed app), so whoever has none yet goes at once,
 * and whoever has some is told, and keeps it until they sign out. Branch
 * previews ("<branch>.<project>.pages.dev"), localhost and the new address
 * itself never move. Unset, nothing moves.
 */

/** The new address of the page at `current`, or null when it stays. */
export function movedTo(current: string, home: string | undefined): string | null {
  if (!home) return null;
  let from: URL;
  let to: URL;
  try {
    from = new URL(current);
    to = new URL(home);
  } catch {
    return null;
  }
  if (to.origin === from.origin) return null;
  // Only the project's production address: "nuagerie.pages.dev", three labels.
  const labels = from.hostname.split('.');
  if (labels.length !== 3 || !from.hostname.endsWith('.pages.dev')) return null;
  return `${to.origin}${from.pathname}${from.search}${from.hash}`;
}

/** Where this page now lives, from the build's VITE_HOME_URL; null when it stays. */
export function newHome(): string | null {
  return movedTo(window.location.href, import.meta.env.VITE_HOME_URL);
}
