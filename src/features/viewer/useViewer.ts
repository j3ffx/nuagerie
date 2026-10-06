import { useCallback } from 'react';
import { useSearchParams } from 'wouter';

const PARAM = 'photo';

/** History entry pushed when the viewer opens: going back closes it. */
interface ViewerState {
  viewer: true;
}

const isViewerEntry = (state: unknown) => (state as ViewerState | null)?.viewer === true;

/**
 * The open photo lives in the URL (`?photo=<id>`), so a reload shows it again
 * and Android's back button closes the viewer: opening pushes a history
 * entry, moving to another photo replaces it, closing goes back.
 */
export function useViewer() {
  const [params, setParams] = useSearchParams();
  const photoId = params.get(PARAM);

  const withPhoto = (id: string | null) => (prev: URLSearchParams) => {
    const next = new URLSearchParams(prev);
    if (id === null) next.delete(PARAM);
    else next.set(PARAM, id);
    return next;
  };

  const open = useCallback(
    (id: string) => setParams(withPhoto(id), { state: { viewer: true } satisfies ViewerState }),
    [setParams],
  );

  const show = useCallback(
    (id: string) =>
      setParams(withPhoto(id), { replace: true, state: window.history.state as unknown }),
    [setParams],
  );

  const close = useCallback(() => {
    if (isViewerEntry(window.history.state)) window.history.back();
    // Opened from a link or a reload: there is no entry of ours to go back to.
    else setParams(withPhoto(null), { replace: true });
  }, [setParams]);

  return { photoId, open, show, close };
}

/** Link target of a photo, for the grid cells (opened with useViewer().open). */
export function photoHref(id: string): string {
  return `?${PARAM}=${encodeURIComponent(id)}`;
}
