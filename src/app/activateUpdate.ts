/** Waiting this long for the new version to take over is enough; the page reloads anyway. */
export const RELOAD_FALLBACK_MS = 4000;

export interface ActivateDeps {
  /** The version waiting to take over, if any. */
  waiting: Pick<ServiceWorker, 'postMessage'> | null | undefined;
  onControllerChange: (listener: () => void) => void;
  reload: () => void;
  setTimeout: (callback: () => void, ms: number) => void;
}

/**
 * Lets the downloaded version take over, then reloads the page into it. The
 * plugin's own `updateSW` reloads only for an update it noticed itself: one
 * found by `checkForUpdate` (back to the foreground, "Rechercher") took over
 * without a reload, and the button seemed to do nothing.
 */
export function activateUpdate(deps: ActivateDeps): void {
  let reloading = false;
  const reload = () => {
    if (reloading) return;
    reloading = true;
    deps.reload();
  };
  // Already taken over (another tab, or a click that did not reload): the page only needs reloading.
  if (!deps.waiting) return reload();
  deps.onControllerChange(reload);
  deps.waiting.postMessage({ type: 'SKIP_WAITING' });
  // A browser that never says the new version took over still gets it on reload.
  deps.setTimeout(reload, RELOAD_FALLBACK_MS);
}
