import { useCallback, useEffect, useState } from 'react';
import { useData } from '../../data/dataContext.ts';
import { MEMORIES_SYNC_TAG } from '../../data/memoryNotifier.ts';
import common from '../../ui/common.module.css';
import { useFocusRescue } from '../../ui/useFocusRescue.ts';
import { localized } from '../../lib/i18n.ts';

import {
  memoriesNotificationAvailable,
  memoriesNotificationOn,
  periodicSync,
} from './memoriesNotification.ts';

const t = localized({
  fr: {
    refused:
      'Les notifications sont refusées pour Nuagerie : autorise-les dans les réglages du téléphone, puis réessaie.',
    installFirst:
      'Le navigateur ne le permet que pour l’appli installée : installe Nuagerie sur l’écran d’accueil (menu ⋮ → Installer l’application), puis réessaie depuis l’appli.',
    offFailed: 'La notification n’a pas pu être désactivée. Réessaie dans un moment.',
    title: 'Souvenirs',
    what: 'Une notification les jours où des photos ont été prises à la même date, les années passées : une fois par jour au plus, jamais avant 8 h. C’est le téléphone qui choisit l’heure, selon ton usage de l’appli.',
    demo: 'En démo, pas de notification : elle lit l’index de OneDrive.',
    cannot: 'Ce navigateur ne sait pas le faire. Sur Android, installe Nuagerie depuis Chrome.',
    state: (state: string) => `État : ${state}`,
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
    state: (state: string) => `State: ${state}`,
    on: 'on',
    off: 'off',
    turnOff: 'Turn off the notification',
    turnOn: 'Turn on the notification',
  },
});

/** Twice a day at most: the browser decides when, often less. */
const MIN_INTERVAL = 12 * 60 * 60 * 1000;

type State = 'unknown' | 'on' | 'off';

const currentState = async (): Promise<State> => ((await memoriesNotificationOn()) ? 'on' : 'off');

/**
 * "Souvenirs du jour": a notification when there are memories, at most once
 * a day and never before 8 o'clock, at a time the browser chooses. Only
 * Chrome on an installed app can; elsewhere, the section says so.
 */
export function MemoriesNotificationSection() {
  const card = useFocusRescue<HTMLDivElement>();
  const { mode } = useData();
  const [state, setState] = useState<State>('unknown');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canNotify = memoriesNotificationAvailable();

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
      <div ref={card} tabIndex={-1} className={`${common.card} ${common.stack}`}>
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
