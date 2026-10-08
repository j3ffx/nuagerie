import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'wouter';
import { useData, useMediaIndex } from '../../data/dataContext.ts';
import { lookupPlace } from '../../data/places/places.ts';
import type { MediaItem } from '../../data/model.ts';
import { formatLongDate, formatPlace, formatTakenTime } from '../../lib/format.ts';
import { useSync } from '../../data/sync/syncContext.ts';
import { useConfirm } from '../../ui/confirmContext.ts';
import { useOnline } from '../../lib/online.ts';
import { BackIcon, ChevronIcon, DownloadIcon, HeartIcon, MapIcon } from '../../ui/icons.tsx';
import {
  clampZoom,
  closesOnDrag,
  fitSize,
  itemAspect,
  NO_ZOOM,
  swipeOutcome,
  toggleZoom,
  zoomAt,
  type Size,
  type Zoom,
} from './gestures.ts';
import { ShareButton } from './ShareButton.tsx';
import { ViewerSlide } from './ViewerSlide.tsx';
import styles from './Viewer.module.css';

const TAP_MOVE = 10;
const DOUBLE_TAP_MS = 300;
/** Height of a video's native control bar, left to the video. */
const CONTROL_BAR = 64;

type Mode = 'idle' | 'pending' | 'swipe' | 'pan' | 'pinch' | 'dismiss' | 'ignore';

interface Gesture {
  mode: Mode;
  pointers: Map<number, { x: number; y: number }>;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  lastTime: number;
  velocityX: number;
  velocityY: number;
  startZoom: Zoom;
  startDistance: number;
  startMid: { x: number; y: number };
  /** Started on a video: a plain tap is the video's (play, pause, controls). */
  onVideo: boolean;
}

const newGesture = (): Gesture => ({
  mode: 'idle',
  pointers: new Map(),
  startX: 0,
  startY: 0,
  lastX: 0,
  lastY: 0,
  lastTime: 0,
  velocityX: 0,
  velocityY: 0,
  startZoom: NO_ZOOM,
  startDistance: 1,
  startMid: { x: 0, y: 0 },
  onVideo: false,
});

/** Runs `done` after a CSS transition, at once when motion is reduced (no transition). */
function transition(element: HTMLElement, apply: () => void, done: () => void) {
  const duration = parseFloat(getComputedStyle(element).getPropertyValue('--duration')) || 0;
  element.style.transition = `transform ${duration}ms var(--ease), opacity ${duration}ms var(--ease)`;
  apply();
  if (duration === 0) {
    done();
    return;
  }
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    element.removeEventListener('transitionend', finish);
    done();
  };
  element.addEventListener('transitionend', finish);
  window.setTimeout(finish, duration + 80);
}

function useViewSize(): Size {
  const read = () => ({ width: window.innerWidth, height: window.innerHeight });
  const [view, setView] = useState(read);
  useEffect(() => {
    const onResize = () => setView(read());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return view;
}

/**
 * Full-screen viewer: swipe between pictures, pinch or double-tap to zoom,
 * drag down to close; arrows and Escape on a keyboard. The gestures move the
 * DOM directly (no React render per frame); React renders when the picture
 * changes. The app behind is inert while it is open.
 */
export function Viewer({
  items,
  index,
  onShow,
  onClose,
}: {
  items: readonly MediaItem[];
  index: number;
  onShow: (id: string) => void;
  onClose: () => void;
}) {
  const view = useViewSize();
  const item = items[index];
  const previous = items[index - 1];
  const next = items[index + 1];

  const stageRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture>(newGesture());
  const zoom = useRef<Zoom>(NO_ZOOM);
  const aspects = useRef(new Map<string, number>());
  const lastTap = useRef<{ time: number; x: number; y: number } | null>(null);
  const tapTimer = useRef(0);
  const [chrome, setChrome] = useState(true);

  // The app behind: no scrolling, no focus, hidden from screen readers.
  useEffect(() => {
    const root = document.getElementById('root');
    const html = document.documentElement;
    const overflow = html.style.overflow;
    html.style.overflow = 'hidden';
    if (root) root.inert = true;
    return () => {
      html.style.overflow = overflow;
      if (root) root.inert = false;
    };
  }, []);

  const fitted = useCallback(
    (target: MediaItem | undefined): Size =>
      fitSize(view, target ? (aspects.current.get(target.id) ?? itemAspect(target)) : 1),
    [view],
  );

  const zoomElement = () =>
    stageRef.current?.querySelector<HTMLElement>('[data-active] [data-zoom]') ?? null;

  const applyZoom = (value: Zoom) => {
    zoom.current = value;
    const element = zoomElement();
    if (element) {
      element.style.transition = 'none';
      element.style.transform =
        value.scale === 1 && value.x === 0 && value.y === 0
          ? ''
          : `translate(${value.x}px, ${value.y}px) scale(${value.scale})`;
    }
  };

  const setTrack = (x: number, y = 0, fade = 1) => {
    const track = trackRef.current;
    const stage = stageRef.current;
    if (!track || !stage) return;
    track.style.transition = 'none';
    track.style.transform = x || y ? `translate(${x}px, ${y}px)` : '';
    stage.style.setProperty('--backdrop', String(fade));
  };

  // A new picture starts unzoomed, centred.
  useLayoutEffect(() => {
    zoom.current = NO_ZOOM;
    setTrack(0);
    stageRef.current
      ?.querySelectorAll<HTMLElement>('[data-zoom]')
      .forEach((element) => (element.style.transform = ''));
  }, [index]);

  const go = useCallback(
    (step: 1 | -1) => {
      const target = items[index + step];
      const track = trackRef.current;
      if (!target || !track) return;
      transition(
        track,
        () => (track.style.transform = `translateX(${-step * view.width}px)`),
        () => onShow(target.id),
      );
    },
    [items, index, onShow, view.width],
  );

  // Keyboard (PC): arrows move, Escape closes.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') go(1);
      else if (event.key === 'ArrowLeft') go(-1);
      else if (event.key === 'Escape') onClose();
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, onClose]);

  useEffect(() => () => window.clearTimeout(tapTimer.current), []);

  /** Pointer position relative to the centre of the screen. */
  const fromCentre = (x: number, y: number) => ({ x: x - view.width / 2, y: y - view.height / 2 });

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    // Buttons keep their own touches, and so does a video's control bar.
    if (target.closest('button, a')) return;
    const video = target.closest('video');
    if (video && event.clientY > video.getBoundingClientRect().bottom - CONTROL_BAR) return;
    const g = gesture.current;
    // Captured once the gesture is known, so that taps still reach a video.
    if (!video) event.currentTarget.setPointerCapture(event.pointerId);
    g.onVideo = video !== null;
    g.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (g.pointers.size === 2) {
      const [a, b] = [...g.pointers.values()] as [
        { x: number; y: number },
        { x: number; y: number },
      ];
      setTrack(0);
      g.mode = 'pinch';
      g.startZoom = zoom.current;
      g.startDistance = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      g.startMid = fromCentre((a.x + b.x) / 2, (a.y + b.y) / 2);
      return;
    }
    if (g.pointers.size > 2) return;
    g.mode = 'pending';
    g.startX = g.lastX = event.clientX;
    g.startY = g.lastY = event.clientY;
    g.lastTime = event.timeStamp;
    g.velocityX = g.velocityY = 0;
    g.startZoom = zoom.current;
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g.pointers.has(event.pointerId)) return;
    g.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const dt = Math.max(1, event.timeStamp - g.lastTime);
    g.velocityX = (event.clientX - g.lastX) / dt;
    g.velocityY = (event.clientY - g.lastY) / dt;
    g.lastX = event.clientX;
    g.lastY = event.clientY;
    g.lastTime = event.timeStamp;

    const current = fitted(item);
    if (g.mode === 'pinch') {
      const [a, b] = [...g.pointers.values()] as [
        { x: number; y: number },
        { x: number; y: number },
      ];
      if (!a || !b) return;
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = fromCentre((a.x + b.x) / 2, (a.y + b.y) / 2);
      const scaled = zoomAt(
        g.startZoom,
        (g.startZoom.scale * distance) / g.startDistance,
        g.startMid.x,
        g.startMid.y,
        current,
        view,
      );
      applyZoom(
        clampZoom(
          { ...scaled, x: scaled.x + mid.x - g.startMid.x, y: scaled.y + mid.y - g.startMid.y },
          current,
          view,
        ),
      );
      return;
    }

    const dx = event.clientX - g.startX;
    const dy = event.clientY - g.startY;
    if (g.mode === 'pending') {
      if (Math.hypot(dx, dy) < TAP_MOVE) return;
      if (zoom.current.scale > 1.01) g.mode = 'pan';
      else if (Math.abs(dx) > Math.abs(dy)) g.mode = 'swipe';
      else g.mode = dy > 0 ? 'dismiss' : 'ignore';
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    }
    if (g.mode === 'pan') {
      applyZoom(
        clampZoom({ ...g.startZoom, x: g.startZoom.x + dx, y: g.startZoom.y + dy }, current, view),
      );
    } else if (g.mode === 'swipe') {
      // Resistance past the first and last pictures.
      const blocked = (dx > 0 && !previous) || (dx < 0 && !next);
      setTrack(blocked ? dx * 0.25 : dx);
    } else if (g.mode === 'dismiss') {
      setTrack(0, Math.max(0, dy), Math.max(0.2, 1 - dy / view.height));
    }
  };

  const endGesture = (event: ReactPointerEvent<HTMLDivElement>, cancelled = false) => {
    const g = gesture.current;
    if (!g.pointers.delete(event.pointerId)) return;
    const track = trackRef.current;
    const stage = stageRef.current;

    if (g.mode === 'pinch') {
      // One finger left: it pans from here, without a jump.
      const rest = [...g.pointers.values()][0];
      if (rest) {
        g.mode = 'pan';
        g.startX = rest.x;
        g.startY = rest.y;
        g.startZoom = zoom.current;
      } else {
        g.mode = 'idle';
      }
      return;
    }
    if (g.pointers.size > 0) return;

    const dx = event.clientX - g.startX;
    const dy = event.clientY - g.startY;
    const mode = g.mode;
    g.mode = 'idle';
    if (cancelled || !track || !stage) {
      setTrack(0);
      return;
    }

    if (mode === 'swipe') {
      const step = swipeOutcome(dx, g.velocityX, view.width);
      if (step !== 0 && items[index + step]) go(step);
      else
        transition(
          track,
          () => (track.style.transform = ''),
          () => setTrack(0),
        );
    } else if (mode === 'dismiss') {
      if (closesOnDrag(dy, g.velocityY, view.height)) onClose();
      else
        transition(
          track,
          () => {
            track.style.transform = '';
            stage.style.setProperty('--backdrop', '1');
          },
          () => setTrack(0),
        );
    } else if (mode === 'pending' && !g.onVideo) {
      onTap(event.clientX, event.clientY, event.timeStamp);
    }
  };

  /** Double tap zooms; a single tap shows or hides the bars. */
  const onTap = (x: number, y: number, time: number) => {
    const last = lastTap.current;
    if (last && time - last.time < DOUBLE_TAP_MS && Math.hypot(x - last.x, y - last.y) < 30) {
      window.clearTimeout(tapTimer.current);
      lastTap.current = null;
      const point = fromCentre(x, y);
      const target = toggleZoom(zoom.current, point.x, point.y, fitted(item), view);
      const element = zoomElement();
      if (element) {
        transition(
          element,
          () => {
            zoom.current = target;
            element.style.transform =
              target.scale === 1
                ? ''
                : `translate(${target.x}px, ${target.y}px) scale(${target.scale})`;
          },
          () => undefined,
        );
      }
      return;
    }
    lastTap.current = { time, x, y };
    window.clearTimeout(tapTimer.current);
    tapTimer.current = window.setTimeout(() => setChrome((shown) => !shown), DOUBLE_TAP_MS);
  };

  const onWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    const point = fromCentre(event.clientX, event.clientY);
    applyZoom(
      zoomAt(
        zoom.current,
        zoom.current.scale * Math.exp(-event.deltaY * 0.002),
        point.x,
        point.y,
        fitted(item),
        view,
      ),
    );
  };

  const onAspect = useCallback((id: string, aspect: number) => {
    aspects.current.set(id, aspect);
  }, []);

  if (!item) return null;

  return createPortal(
    <div
      className={styles.viewer}
      role="dialog"
      aria-modal="true"
      aria-label="Visionneuse"
      data-chrome={chrome || undefined}
    >
      <div
        ref={stageRef}
        className={styles.stage}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(event) => endGesture(event)}
        onPointerCancel={(event) => endGesture(event, true)}
        onWheel={onWheel}
      >
        <div ref={trackRef} className={styles.track}>
          {[previous, item, next].map((slide, i) =>
            slide ? (
              <ViewerSlide
                key={slide.id}
                item={slide}
                offset={i - 1}
                active={i === 1}
                view={view}
                onAspect={onAspect}
              />
            ) : null,
          )}
        </div>
      </div>

      <ViewerBar item={item} onClose={onClose} />

      {previous && (
        <button
          type="button"
          className={`${styles.step} ${styles.stepPrevious}`}
          onClick={() => go(-1)}
          aria-label="Photo précédente"
        >
          <ChevronIcon />
        </button>
      )}
      {next && (
        <button
          type="button"
          className={`${styles.step} ${styles.stepNext}`}
          onClick={() => go(1)}
          aria-label="Photo suivante"
        >
          <ChevronIcon />
        </button>
      )}
    </div>,
    document.body,
  );
}

/** Date, album and place of the picture; close, share and download buttons. */
function ViewerBar({ item, onClose }: { item: MediaItem; onClose: () => void }) {
  const { source } = useData();
  const index = useMediaIndex();
  const album = index?.folders.get(item.albumId)?.name ?? null;
  const [downloading, setDownloading] = useState(false);
  const place = usePlaceName(item);
  // Sharing and saving need the original file: crossed out while offline.
  const offline = !useOnline();
  const sync = useSync();
  const confirm = useConfirm();
  const favorite = sync.favorites.has(item.id);

  /** Favourites live in OneDrive: before the first one, the sync is turned on (once). */
  const onHeart = async () => {
    if (sync.favoritesOn) {
      sync.toggleFavorite(item.id);
      return;
    }
    const answer = await confirm({
      title: 'Activer les favoris ?',
      message:
        'Les favoris se rangent dans ton OneDrive, dans un dossier à part (Applis/Nuagerie), pour ne jamais être perdus. Nuagerie va demander à Microsoft le droit d’écrire dans ce seul dossier : tes photos restent en lecture seule.',
      confirmLabel: 'Activer',
    });
    if (answer) await sync.enable(item.id);
  };
  const time =
    item.takenAt === null
      ? null
      : formatTakenTime({ takenAt: item.takenAt, dateSource: item.dateSource });

  /** The original file, saved by the browser (OneDrive serves it as an attachment). */
  const download = async () => {
    setDownloading(true);
    try {
      const url = await source.getOriginalUrl(item);
      if (url) {
        const link = document.createElement('a');
        link.href = url;
        link.download = item.name;
        link.click();
      }
    } catch {
      // Nothing to save now; the button stays available.
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <header className={styles.top}>
        <button
          type="button"
          className={styles.icon}
          onClick={onClose}
          aria-label="Fermer"
          autoFocus
        >
          <BackIcon />
        </button>
        {/* The day on top, then the time and the album: the bar has four buttons on a phone. */}
        <div className={styles.caption}>
          <p className={styles.date}>
            {item.takenAt === null ? 'Sans date' : formatLongDate(item.takenAt)}
          </p>
          {(time || album) && (
            <p className={styles.album}>{[time, album].filter(Boolean).join(' · ')}</p>
          )}
        </div>
        {(sync.favoritesOn || sync.available) && (
          <button
            type="button"
            className={styles.icon}
            onClick={() => void onHeart()}
            disabled={!sync.favoritesOn && offline}
            aria-pressed={favorite}
            aria-label={favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            title={favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            data-favorite={favorite || undefined}
          >
            <HeartIcon filled={favorite} />
          </button>
        )}
        {!(item.kind === 'video' && source.mode === 'demo') && (
          <ShareButton key={item.id} item={item} offline={offline} />
        )}
        {!(item.kind === 'video' && source.mode === 'demo') && (
          <button
            type="button"
            className={styles.icon}
            onClick={() => void download()}
            disabled={downloading || offline}
            data-offline={offline || undefined}
            aria-label={offline ? 'Télécharger (hors connexion)' : 'Télécharger'}
            title={offline ? 'Télécharger (hors connexion)' : 'Télécharger'}
          >
            <DownloadIcon />
          </button>
        )}
      </header>
      {place && (
        <footer className={styles.bottom}>
          <Link
            href={`/carte?focus=${encodeURIComponent(item.id)}`}
            className={styles.place}
            aria-label={`${place}, voir sur la carte`}
          >
            <MapIcon width={18} height={18} />
            <span>{place}</span>
          </Link>
        </footer>
      )}
    </>
  );
}

/** "Annecy, France" for a geotagged photo, once the place list is loaded; null otherwise. */
function usePlaceName(item: MediaItem): string | null {
  const [found, setFound] = useState<{ id: string; name: string | null } | null>(null);
  const { latitude, longitude } = item;
  useEffect(() => {
    if (latitude === null || longitude === null) return;
    let cancelled = false;
    lookupPlace(latitude, longitude).then(
      (place) => {
        if (!cancelled) setFound({ id: item.id, name: place ? formatPlace(place) : null });
      },
      () => undefined, // no place list (offline before it was ever loaded): no name
    );
    return () => {
      cancelled = true;
    };
  }, [item.id, latitude, longitude]);
  return found?.id === item.id ? found.name : null;
}
