import { useCallback, useEffect, useState } from 'react';
import { useData } from '../../data/dataContext.ts';
import { MEMORIES_SYNC_TAG } from '../../data/memoryNotifier.ts';
import common from '../../ui/common.module.css';
import { localized } from '../../lib/i18n.ts';

const t = localized({
  fr: {
    refused:
      'Les notifications sont refusées pour Nuagerie : autorise-les dans les réglages du téléphone, puis réessaie.',
    installFirst:
      'Le navigateur ne le permet que pour l’application installée : installe Nuagerie sur l’écran d’accueil (menu ⋮ → Installer l’application), puis réessaie depuis l’application.',
    offFailed: 'La notification n’a pas pu être désactivée. Réessaie dans un moment.',
    title: 'Souvenirs',
    what: 'Une notification les jours où des photos ont été prises à la même date, les années passées : une fois par jour au plus, jamais avant 8 h. C’est le téléphone qui choisit l’heure, selon ton usage de l’application.',
    demo: 'En démo, pas de notification : elle lit l’index de OneDrive.',
    cannot: 'Ce navigateur ne sait pas le faire. Sur Android, installe Nuagerie depuis Chrome.',
    state: (state: string) => `Notification : ${state}`,
    on: 'activée',
    off: 'désactivée',
    turnOff: 'Désactiver la notification',
    turnOn: 'Activer la notification',
  },
  en: {
    refused:
      'Notifications are refused for Nuagerie: allow them in the phone’s settings, then try again.',
    installFirst:
      'The browser allows it only for the installed app: install Nuagerie on the home screen (menu ⋮ → Install app), then try again from the app.',
    offFailed: 'The notification could not be turned off. Try again in a moment.',
    title: 'Memories',
    what: 'A notification on the days when photos were taken on the same date in earlier years: at most once a day, never before 8 am. The phone chooses the time, from how you use the app.',
    demo: 'No notification in the demo: it reads the OneDrive index.',
    cannot: 'This browser cannot do it. On Android, install Nuagerie from Chrome.',
    state: (state: string) => `Notification: ${state}`,
    on: 'on',
    off: 'off',
    turnOff: 'Turn off the notification',
    turnOn: 'Turn on the notification',
  },
});

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
        setMessage(t.refused);
        return;
      }
      const sync = await periodicSync();
      if (!sync) throw new Error('no periodic sync');
      await sync.register(MEMORIES_SYNC_TAG, { minInterval: MIN_INTERVAL });
      await read();
    } catch {
      setMessage(t.installFirst);
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
      setMessage(t.offFailed);
    } finally {
      await read().catch(() => setState('off'));
      setBusy(false);
    }
  };

  return (
    <section className={common.section} aria-labelledby="settings-memories">
      <h2 id="settings-memories" className={common.sectionTitle}>
        {t.title}
      </h2>
      <div className={`${common.card} ${common.stack}`}>
        <p className={common.muted}>{t.what}</p>
        {mode === 'demo' ? (
          <p className={common.muted}>{t.demo}</p>
        ) : !canNotify ? (
          <p className={common.muted}>{t.cannot}</p>
        ) : (
          <>
            <p role="status">{t.state(state === 'on' ? t.on : state === 'off' ? t.off : '…')}</p>
            {state === 'on' ? (
              <button
                type="button"
                className={common.buttonSoft}
                onClick={() => void turnOff()}
                disabled={busy}
              >
                {t.turnOff}
              </button>
            ) : (
              <button
                type="button"
                className={common.button}
                onClick={() => void turnOn()}
                disabled={busy || state === 'unknown'}
              >
                {t.turnOn}
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
