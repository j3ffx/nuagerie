import { useCallback } from 'react';
import { useSearchParams } from 'wouter';

const PARAM = 'photo';
const INFO_PARAM = 'infos';

/** History entry pushed when the viewer opens: going back closes it. */
interface ViewerState {
  viewer: true;
}

/** History entry pushed when the information panel opens: going back closes the panel only. */
interface InfoState {
  info: true;
  /** The entry below is the viewer's own, so closing the viewer goes back two steps. */
  viewerBelow: boolean;
}

const isViewerEntry = (state: unknown) => (state as ViewerState | null)?.viewer === true;
const infoEntry = (state: unknown) =>
  (state as InfoState | null)?.info ? (state as InfoState) : null;

/**
 * The open photo lives in the URL (`?photo=<id>`), so a reload shows it again
 * and Android's back button closes the viewer: opening pushes a history
 * entry, moving to another photo replaces it, closing goes back. The
 * information panel works the same way (`&infos=1`), on top of the viewer,
 * and stays open from one photo to the next.
 */
export function useViewer() {
  const [params, setParams] = useSearchParams();
  const photoId = params.get(PARAM);
  const infoOpen = photoId !== null && params.get(INFO_PARAM) === '1';

  const withPhoto = (id: string | null) => (prev: URLSearchParams) => {
    const next = new URLSearchParams(prev);
    if (id === null) {
      next.delete(PARAM);
      next.delete(INFO_PARAM);
    } else next.set(PARAM, id);
    return next;
  };

  const withInfo = (open: boolean) => (prev: URLSearchParams) => {
    const next = new URLSearchParams(prev);
    if (open) next.set(INFO_PARAM, '1');
    else next.delete(INFO_PARAM);
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
    const info = infoEntry(window.history.state);
    if (info?.viewerBelow) window.history.go(-2);
    else if (!info && isViewerEntry(window.history.state)) window.history.back();
    // Opened from a link or a reload: there is no entry of ours to go back to.
    else setParams(withPhoto(null), { replace: true });
  }, [setParams]);

  const openInfo = useCallback(() => {
    // Already open: a second entry would leave the panel open after one close.
    if (new URLSearchParams(window.location.search).get(INFO_PARAM) === '1') return;
    setParams(withInfo(true), {
      state: {
        info: true,
        viewerBelow: isViewerEntry(window.history.state),
      } satisfies InfoState,
    });
  }, [setParams]);

  const closeInfo = useCallback(() => {
    if (infoEntry(window.history.state)) window.history.back();
    else setParams(withInfo(false), { replace: true, state: window.history.state as unknown });
  }, [setParams]);

  return { photoId, open, show, close, infoOpen, openInfo, closeInfo };
}

/** Link target of a photo, for the grid cells (opened with useViewer().open). */
export function photoHref(id: string): string {
  return `?${PARAM}=${encodeURIComponent(id)}`;
}
