import { useEffect, useState } from 'react';
import { useData } from '../../data/dataContext.ts';
import type { MediaItem } from '../../data/model.ts';
import { ShareIcon } from '../../ui/icons.tsx';
import { canShareFiles, shareableFile } from './share.ts';
import styles from './Viewer.module.css';

type State =
  | { status: 'idle' }
  | { status: 'preparing' }
  /** Downloaded, but the browser wants a fresh tap to open the share sheet. */
  | { status: 'ready'; file: File }
  | { status: 'failed' };

const MESSAGE_MS = 4000;

/**
 * Shares the photo or video through the system share sheet (WhatsApp,
 * mail…), without saving a copy in the Download folder. Rendered with a key
 * per item, so its state never outlives the photo. A failure says so for a
 * moment and leaves the button ready for another try.
 */
export function ShareButton({ item }: { item: MediaItem }) {
  const { source, thumbnails } = useData();
  const [state, setState] = useState<State>({ status: 'idle' });

  useEffect(() => {
    if (state.status !== 'failed') return;
    const timer = window.setTimeout(() => setState({ status: 'idle' }), MESSAGE_MS);
    return () => window.clearTimeout(timer);
  }, [state.status]);

  if (!canShareFiles()) return null;

  const share = async (file: File) => {
    try {
      await navigator.share({ files: [file] });
      setState({ status: 'idle' });
    } catch (error) {
      const name = error instanceof DOMException ? error.name : '';
      // A large file outlasts the tap's permission: one more tap shares at once.
      if (name === 'NotAllowedError') setState({ status: 'ready', file });
      else if (name === 'AbortError')
        setState({ status: 'idle' }); // closed by the user
      else setState({ status: 'failed' });
    }
  };

  const onClick = async () => {
    if (state.status === 'preparing') return;
    if (state.status === 'ready') {
      await share(state.file);
      return;
    }
    setState({ status: 'preparing' });
    const file = await shareableFile(item, source, thumbnails.store, (candidate) =>
      navigator.canShare({ files: [candidate] }),
    );
    if (file) await share(file);
    else setState({ status: 'failed' });
  };

  const label = state.status === 'ready' ? 'Partager (prêt, toucher à nouveau)' : 'Partager';

  return (
    <>
      <button
        type="button"
        className={styles.icon}
        onClick={() => void onClick()}
        aria-busy={state.status === 'preparing'}
        data-ready={state.status === 'ready' || undefined}
        aria-label={label}
        title={label}
      >
        {state.status === 'preparing' ? <span className={styles.smallSpinner} /> : <ShareIcon />}
      </button>
      {state.status === 'failed' && (
        <p className={styles.toast} role="status">
          Partage impossible pour l’instant, réessaie.
        </p>
      )}
    </>
  );
}
