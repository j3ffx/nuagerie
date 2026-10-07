import { memo, useEffect, useState } from 'react';
import { useData } from '../../data/dataContext.ts';
import type { MediaItem } from '../../data/model.ts';
import { describeItem } from '../../lib/format.ts';
import { useThumbnailUrl } from '../../ui/useThumbnailUrl.ts';
import { fitSize, itemAspect, type Size } from './gestures.ts';
import styles from './Viewer.module.css';

/**
 * One picture of the viewer: the grid thumbnail at once (already cached),
 * then the large version over it. Graph makes large versions of every format
 * as JPEG, HEIC included. The zoom transform is set on `.zoom` by the viewer.
 */
export const ViewerSlide = memo(function ViewerSlide({
  item,
  offset,
  active,
  view,
  onAspect,
}: {
  item: MediaItem;
  /** -1, 0 or 1: left of, on, or right of the screen. */
  offset: number;
  active: boolean;
  view: Size;
  onAspect: (id: string, aspect: number) => void;
}) {
  const [aspect, setAspect] = useState(() => itemAspect(item));
  const preview = useThumbnailUrl(item, 'medium');
  const large = useThumbnailUrl(item, 'large');
  const [largeShown, setLargeShown] = useState(false);
  const fitted = fitSize(view, aspect);

  return (
    <div
      className={styles.slide}
      style={{ transform: `translateX(${offset * 100}%)` }}
      data-active={active || undefined}
      aria-hidden={!active}
    >
      <div className={styles.zoom} data-zoom={active || undefined}>
        <div className={styles.frame} style={{ width: fitted.width, height: fitted.height }}>
          {preview && !largeShown && (
            <img className={styles.preview} src={preview} alt="" draggable={false} />
          )}
          {large && (
            <img
              className={styles.picture}
              src={large}
              alt={describeItem(item)}
              draggable={false}
              data-shown={largeShown || undefined}
              onLoad={(event) => {
                const { naturalWidth, naturalHeight } = event.currentTarget;
                if (naturalWidth > 0) {
                  // The real proportions (rotation applied) win over the index.
                  const real = naturalHeight / naturalWidth;
                  setAspect(real);
                  onAspect(item.id, real);
                }
                setLargeShown(true);
              }}
            />
          )}
          {item.kind === 'video' && <VideoPlayer item={item} active={active} />}
        </div>
      </div>
    </div>
  );
});

/**
 * Starts as soon as the video is on screen, from the file's download URL
 * (asked for again once if it expired). A neighbouring video gets its URL
 * ahead of time, so swiping to it starts at once. Without permission to play
 * on its own, the native controls offer the play button.
 */
function VideoPlayer({ item, active }: { item: MediaItem; active: boolean }) {
  const { source } = useData();
  const [state, setState] = useState<
    | { status: 'waiting' }
    | { status: 'ready'; url: string; retried: boolean }
    | { status: 'unavailable'; message: string }
  >({ status: 'waiting' });

  const ready = (url: string | null, retried: boolean) =>
    setState(
      url
        ? { status: 'ready', url, retried }
        : { status: 'unavailable', message: 'Lecture des vidéos indisponible en démo' },
    );
  const failed = () =>
    setState({ status: 'unavailable', message: 'Vidéo inaccessible pour le moment' });

  // On screen: get the URL and play. Not yet: warm the URL cache only.
  const waiting = state.status === 'waiting';
  useEffect(() => {
    if (!waiting) return;
    let cancelled = false;
    source.getOriginalUrl(item).then(
      (url) => {
        if (!cancelled && active) ready(url, false);
      },
      () => {
        if (!cancelled && active) failed();
      },
    );
    return () => {
      cancelled = true;
    };
  }, [waiting, active, source, item]);

  if (state.status === 'unavailable') {
    return (
      <div className={styles.videoCover}>
        <p className={styles.notice} role="status">
          {state.message}
        </p>
      </div>
    );
  }
  // Swiped away, the player goes: the sound stops with it.
  if (state.status === 'waiting' || !active) {
    return (
      <div className={styles.videoCover} aria-hidden="true">
        {active && <span className={styles.spinner} />}
      </div>
    );
  }
  return (
    <video
      className={styles.video}
      src={state.url}
      aria-label={describeItem(item)}
      controls
      autoPlay
      playsInline
      onError={() => {
        if (state.retried) setState({ status: 'unavailable', message: 'Lecture impossible' });
        // The download URL may have expired: ask for it once more.
        else source.getOriginalUrl(item).then((url) => ready(url, true), failed);
      }}
    />
  );
}
