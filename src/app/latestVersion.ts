/** What the deployed app says about itself (/version.json). */
export interface Deployed {
  version: string;
  commit: string;
}

/**
 * How to name the version waiting to be installed: its number ("0.1.3"),
 * plus the commit when only the build changed ("0.1.2 (abc1234)", a deploy
 * with no new release). Null when unknown or when it is the running one.
 */
export function latestLabel(latest: Deployed | null, running: Deployed): string | null {
  if (!latest || latest.commit === running.commit) return null;
  return latest.version === running.version
    ? `${latest.version} (${latest.commit})`
    : latest.version;
}

/** Reads /version.json; null when it cannot be read. */
export async function fetchDeployed(): Promise<Deployed | null> {
  try {
    const response = await fetch('/version.json', { cache: 'no-store' });
    if (!response.ok) return null;
    const body = (await response.json()) as Partial<Deployed>;
    return typeof body.version === 'string' && typeof body.commit === 'string'
      ? { version: body.version, commit: body.commit }
      : null;
  } catch {
    return null;
  }
}
