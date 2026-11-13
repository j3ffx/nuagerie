import { analysisComplete, ANALYSED_ELSEWHERE } from '../../data/content/contentSearch.ts';
import { Link } from 'wouter';
import { useData } from '../../data/dataContext.ts';
import { formatBytes, formatCount } from '../../lib/format.ts';
import { localized } from '../../lib/i18n.ts';
import { useOnline } from '../../lib/online.ts';
import common from '../../ui/common.module.css';
import { useFocusRescue } from '../../ui/useFocusRescue.ts';
import { useConfirm } from '../../ui/confirmContext.ts';
import { useContentSearch } from '../content/contentContext.ts';
import styles from './OfflineSection.module.css';

const t = localized({
  fr: {
    title: 'Recherche dans les photos',
    what: 'Cherche ce que montrent tes photos avec tes propres mots : « gâteau avec des bougies », « plage au coucher du soleil ». Tout se calcule sur tes appareils : ni tes photos ni tes recherches ne partent ailleurs.',
    demo: 'En démo, c’est simulé à partir du nom des albums : rien n’est téléchargé.',
    onTitle: 'Activer la recherche dans les photos ?',
    onMessage:
      'Nuagerie télécharge une fois un modèle d’environ 320 Mo depuis Hugging Face (de préférence en Wi-Fi), gardé sur cet appareil. Hugging Face voit seulement ton adresse IP, comme tout site qui sert un fichier. Rien sur tes photos ne lui est envoyé.',
    onConfirm: 'Activer',
    turnOn: 'Activer la recherche',
    downloading: (done: string, total: string) => `Téléchargement du modèle : ${done} / ${total}`,
    loading: 'Préparation du modèle…',
    downloadLabel: 'Téléchargement du modèle',
    fetching: 'Recherche d’une analyse faite sur un autre appareil…',
    count: (done: string, total: string) => `${done} photos analysées sur ${total}`,
    allDone: 'Analyse terminée : cherche tes photos depuis l’écran Recherche.',
    howTo:
      'L’analyse se fait une fois, puis pour chaque nouvelle photo. Fais-la plutôt sur un ordinateur (environ 45 min pour 20 000 photos, et quelque 190 Mo de plus à télécharger). Sur un téléphone, compte au moins 3 h, branché, en Wi-Fi, écran allumé.',
    share:
      'Avec la synchronisation active, l’analyse terminée va dans ton dossier Applis/Nuagerie : tes autres appareils la reprennent sans rien refaire.',
    analyse: 'Analyser les photos',
    resume: 'Reprendre l’analyse',
    stop: 'Arrêter',
    running: 'Analyse en cours. Garde l’appli ouverte.',
    starting: 'Préparation de l’analyse…',
    progress: 'Analyse des photos',
    unreadable:
      'Ces photos n’ont pas pu être lues : Microsoft n’en donne pas de miniature pour l’instant. La recherche ne les trouvera pas.',
    unreadableElsewhere:
      'L’appareil qui a fait l’analyse n’a pas pu lire ces photos : la recherche ne les trouvera pas.',
    andMore: (count: string) => `Et ${count} de plus.`,
    retry: 'Réessayer',
    error: (text: string) => `Échec : ${text}`,
    elsewhere:
      'Cette analyse vient d’un appareil d’un autre type (carte graphique ou processeur) : continue-la là-bas, ou désactive puis réactive pour tout refaire ici.',
    offTitle: 'Désactiver la recherche dans les photos ?',
    offMessage:
      'Le modèle et l’analyse sont effacés de cet appareil. Une copie de l’analyse reste dans Applis/Nuagerie si la synchronisation l’y a mise.',
    offConfirm: 'Désactiver',
    turnOff: 'Désactiver la recherche',
  },
  en: {
    title: 'Search in the photos',
    what: 'Search for what your photos show in your own words: “cake with candles”, “beach at sunset”. Everything is worked out on your devices: neither your photos nor your searches go anywhere else.',
    demo: 'In the demo, this is simulated from the album names: nothing is downloaded.',
    onTitle: 'Turn on the search in the photos?',
    onMessage:
      'Nuagerie downloads a model of about 320 MB from Hugging Face once (on Wi-Fi if you can), and keeps it on this device. Hugging Face only sees your IP address, as any site serving a file does. Nothing about your photos is sent to it.',
    onConfirm: 'Turn on',
    turnOn: 'Turn on the search',
    downloading: (done: string, total: string) => `Downloading the model: ${done} / ${total}`,
    loading: 'Getting the model ready…',
    downloadLabel: 'Downloading the model',
    fetching: 'Looking for an analysis made on another device…',
    count: (done: string, total: string) => `${done} photos analysed out of ${total}`,
    allDone: 'Analysis finished: search for your photos from the Search screen.',
    howTo:
      'The analysis runs once, then for each new photo. Better do it on a computer (about 45 min for 20,000 photos, and some 190 MB more to download). On a phone, expect 3 hours at least, plugged in, on Wi-Fi, screen on.',
    share:
      'With the sync on, the finished analysis goes to your Apps/Nuagerie folder: your other devices pick it up without doing it again.',
    analyse: 'Analyse the photos',
    resume: 'Resume the analysis',
    stop: 'Stop',
    running: 'Analysis under way. Keep the app open.',
    starting: 'Getting the analysis ready…',
    progress: 'Analysing the photos',
    unreadable:
      'These photos could not be read: Microsoft gives no thumbnail for them for now. The search will not find them.',
    unreadableElsewhere:
      'The device that made the analysis could not read these photos: the search will not find them.',
    andMore: (count: string) => `And ${count} more.`,
    retry: 'Try again',
    error: (text: string) => `Failed: ${text}`,
    elsewhere:
      'This analysis comes from another kind of device (graphics card or processor): continue it there, or turn this off and on again to redo it all here.',
    offTitle: 'Turn off the search in the photos?',
    offMessage:
      'The model and the analysis are erased from this device. A copy of the analysis stays in Apps/Nuagerie if the sync put it there.',
    offConfirm: 'Turn off',
    turnOff: 'Turn off the search',
  },
});

/** Enough to find them; beyond that, something else is wrong than a few files. */
const MAX_LISTED = 20;

/** Turns the search on, runs the analysis, says how far it went. */
export function ContentSection() {
  const card = useFocusRescue<HTMLDivElement>();
  const { mode } = useData();
  const { state, search } = useContentSearch();
  const online = useOnline();
  const confirm = useConfirm();
  const demo = mode === 'demo';

  const turnOn = async () => {
    if (!demo) {
      const answer = await confirm({
        title: t.onTitle,
        message: t.onMessage,
        confirmLabel: t.onConfirm,
      });
      if (!answer) return;
    }
    // Worth keeping: ask the browser not to clear it when space runs low.
    void navigator.storage?.persist?.().catch(() => false);
    await search.enable();
  };

  const turnOff = async () => {
    const answer = await confirm({
      title: t.offTitle,
      message: t.offMessage,
      confirmLabel: t.offConfirm,
      danger: true,
    });
    if (answer) await search.disable();
  };

  const complete = analysisComplete(state);

  return (
    <section className={common.section} aria-labelledby="settings-content">
      <h2 id="settings-content" className={common.sectionTitle}>
        {t.title}
      </h2>
      <div ref={card} tabIndex={-1} className={`${common.card} ${common.stack}`}>
        {!state.enabled ? (
          <>
            <p className={common.muted}>{demo ? `${t.what} ${t.demo}` : t.what}</p>
            <button
              type="button"
              className={common.button}
              onClick={() => void turnOn()}
              disabled={!demo && !online}
            >
              {t.turnOn}
            </button>
          </>
        ) : (
          <>
            {state.download ? (
              <div className={common.stack}>
                <p role="status">
                  {t.downloading(
                    formatBytes(state.download.loaded),
                    formatBytes(state.download.total),
                  )}
                </p>
                <progress
                  className={styles.progress}
                  max={state.download.total}
                  value={state.download.loaded}
                  aria-label={t.downloadLabel}
                />
              </div>
            ) : (
              state.preparing && <p role="status">{t.loading}</p>
            )}
            {state.fetching && <p role="status">{t.fetching}</p>}
            <p>
              {complete ? t.allDone : t.count(formatCount(state.done), formatCount(state.total))}
            </p>
            {state.analysing && (
              <div className={common.stack}>
                <p className={common.muted}>{state.device ? t.running : t.starting}</p>
                <progress
                  className={styles.progress}
                  max={state.total}
                  value={state.done}
                  aria-label={t.progress}
                />
                <button type="button" className={common.buttonSoft} onClick={search.stop}>
                  {t.stop}
                </button>
              </div>
            )}
            {!state.analysing && state.unreadable.length > 0 && (
              <div className={common.stack}>
                <p className={common.muted}>
                  {state.analysedHere ? t.unreadable : t.unreadableElsewhere}
                </p>
                <ul className={styles.unreadable}>
                  {state.unreadable.slice(0, MAX_LISTED).map((item) => (
                    <li key={item.id}>
                      <Link href={`/album/${encodeURIComponent(item.albumId)}`}>{item.name}</Link>
                    </li>
                  ))}
                </ul>
                {state.unreadable.length > MAX_LISTED && (
                  <p className={common.muted}>
                    {t.andMore(formatCount(state.unreadable.length - MAX_LISTED))}
                  </p>
                )}
                {state.analysedHere && (
                  <button
                    type="button"
                    className={common.buttonSoft}
                    onClick={() => void search.analyse()}
                    disabled={(!demo && !online) || state.preparing}
                  >
                    {t.retry}
                  </button>
                )}
              </div>
            )}
            {state.error && (
              <p className={common.muted} role="alert">
                {state.error === ANALYSED_ELSEWHERE ? t.elsewhere : t.error(state.error)}
              </p>
            )}
            {!complete && !state.analysing && (
              <>
                <button
                  type="button"
                  className={common.button}
                  onClick={() => void search.analyse()}
                  disabled={(!demo && !online) || state.preparing}
                >
                  {state.done > 0 ? t.resume : t.analyse}
                </button>
                <p className={common.muted}>{t.howTo}</p>
                <p className={common.muted}>{t.share}</p>
              </>
            )}
            <button
              type="button"
              className={common.buttonSoft}
              onClick={() => void turnOff()}
              disabled={state.preparing}
            >
              {t.turnOff}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
