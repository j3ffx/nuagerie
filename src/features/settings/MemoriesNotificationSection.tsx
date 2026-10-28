import { useCallback, useEffect, useState } from 'react';
import { useData } from '../../data/dataContext.ts';
import { MEMORIES_SYNC_TAG } from '../../data/memoryNotifier.ts';
import common from '../../ui/common.module.css';

/** Periodic Background Sync, which the DOM types do not have yet (Chrome only). */
interface PeriodicSyncManager {
  register(tag: string, options?: { minInterval?: number }): Promise<void>;
  unregister(tag: string): Promise<void>;
  getTags(): Promise<string[]>;
}
type WithPeriodicSync = ServiceWorkerRegistration & { periodicSync?: PeriodicSyncManager };

/** Twice a day at most: the browser decides when, often less. */
const MIN_INTERVAL = 12 * 60 * 60 * 1000;

const supported = () =>
  'serviceWorker' in navigator &&
  'Notification' in window &&
  typeof ServiceWorkerRegistration !== 'undefined' &&
  'periodicSync' in ServiceWorkerRegistration.prototype;

/** How long to wait for the service worker, which may never come (failed to register). */
const READY_TIMEOUT_MS = 5000;

async function periodicSync(): Promise<PeriodicSyncManager | null> {
  const registration = await Promise.race([
    navigator.serviceWorker.ready as Promise<WithPeriodicSync>,
    new Promise<null>((resolve) => window.setTimeout(() => resolve(null), READY_TIMEOUT_MS)),
  ]);
  return registration?.periodicSync ?? null;
}

type State = 'unknown' | 'on' | 'off';

/**
 * On when the periodic sync is registered and notifications are allowed. Notifications taken
 * back in the phone's settings: the sync goes too, rather than waking the app for nothing.
 */
async function currentState(): Promise<State> {
  const sync = await periodicSync();
  const registered = ((await sync?.getTags()) ?? []).includes(MEMORIES_SYNC_TAG);
  if (registered && Notification.permission !== 'granted') {
    await sync?.unregister(MEMORIES_SYNC_TAG);
    return 'off';
  }
  return registered ? 'on' : 'off';
}

/**
 * "Souvenirs du jour": a notification when there are memories, at most once
 * a day and never before 8 o'clock, at a time the browser chooses. Only
 * Chrome on an installed app can; elsewhere, the section says so.
 */
export function MemoriesNotificationSection() {
  const { mode } = useData();
  const [state, setState] = useState<State>('unknown');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canNotify = supported();

  const read = useCallback(async () => setState(await currentState()), []);

  useEffect(() => {
    if (!canNotify) return;
    let live = true;
    currentState().then(
      (next) => live && setState(next),
      () => live && setState('off'),
    );
    return () => {
      live = false;
    };
  }, [canNotify]);

  const turnOn = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setMessage(
          'Les notifications sont refusées pour Nuagerie : autorise-les dans les réglages du téléphone, puis réessaie.',
        );
        return;
      }
      const sync = await periodicSync();
      if (!sync) throw new Error('no periodic sync');
      await sync.register(MEMORIES_SYNC_TAG, { minInterval: MIN_INTERVAL });
      await read();
    } catch {
      setMessage(
        'Le navigateur ne le permet que pour l’application installée : installe Nuagerie sur l’écran d’accueil (menu ⋮ → Installer l’application), puis réessaie depuis l’application.',
      );
      setState('off');
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await (await periodicSync())?.unregister(MEMORIES_SYNC_TAG);
    } catch {
      setMessage('La notification n’a pas pu être désactivée. Réessaie dans un moment.');
    } finally {
      await read().catch(() => setState('off'));
      setBusy(false);
    }
  };

  return (
    <section className={common.section} aria-labelledby="settings-memories">
      <h2 id="settings-memories" className={common.sectionTitle}>
        Souvenirs
      </h2>
      <div className={`${common.card} ${common.stack}`}>
        <p className={common.muted}>
          Une notification les jours où des photos ont été prises à la même date, les années passées
          : une fois par jour au plus, jamais avant 8 h. C’est le téléphone qui choisit l’heure,
          selon ton usage de l’application.
        </p>
        {mode === 'demo' ? (
          <p className={common.muted}>
            En démo, pas de notification : elle lit l’index de OneDrive.
          </p>
        ) : !canNotify ? (
          <p className={common.muted}>
            Ce navigateur ne sait pas le faire. Sur Android, installe Nuagerie depuis Chrome.
          </p>
        ) : (
          <>
            <p role="status">
              Notification : {state === 'on' ? 'activée' : state === 'off' ? 'désactivée' : '…'}
            </p>
            {state === 'on' ? (
              <button
                type="button"
                className={common.buttonSoft}
                onClick={() => void turnOff()}
                disabled={busy}
              >
                Désactiver la notification
              </button>
            ) : (
              <button
                type="button"
                className={common.button}
                onClick={() => void turnOn()}
                disabled={busy || state === 'unknown'}
              >
                Activer la notification
              </button>
            )}
            {message && (
              <p className={common.muted} role="alert">
                {message}
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
