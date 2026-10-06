import { memo, useEffect, useRef, useState } from 'react';
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

/** Plays on demand, from the file's download URL (asked for again once if it expired). */
function VideoPlayer({ item, active }: { item: MediaItem; active: boolean }) {
  const { source } = useData();
  const [state, setState] = useState<
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'playing'; url: string; retried: boolean }
    | { status: 'unavailable'; message: string }
  >({ status: 'idle' });
  const videoRef = useRef<HTMLVideoElement>(null);

  // Swiped away: stop the sound.
  useEffect(() => {
    if (!active) videoRef.current?.pause();
  }, [active]);

  const play = async (retried = false) => {
    setState({ status: 'loading' });
    try {
      const url = await source.getOriginalUrl(item);
      setState(
        url
          ? { status: 'playing', url, retried }
          : { status: 'unavailable', message: 'Lecture des vidéos indisponible en démo' },
      );
    } catch {
      setState({ status: 'unavailable', message: 'Vidéo inaccessible pour le moment' });
    }
  };

  if (state.status === 'playing') {
    return (
      <video
        ref={videoRef}
        className={styles.video}
        src={state.url}
        controls
        autoPlay
        playsInline
        onError={() => {
          if (!state.retried) void play(true);
          else setState({ status: 'unavailable', message: 'Lecture impossible' });
        }}
      />
    );
  }

  return (
    <div className={styles.videoCover}>
      {state.status === 'unavailable' ? (
        <p className={styles.notice} role="status">
          {state.message}
        </p>
      ) : (
        <button
          type="button"
          className={styles.play}
          onClick={() => void play()}
          disabled={state.status === 'loading'}
          aria-label="Lire la vidéo"
          tabIndex={active ? 0 : -1}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 5.5v13l10.5-6.5Z" />
          </svg>
        </button>
      )}
    </div>
  );
}
