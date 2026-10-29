import { useState } from 'react';
import { useData } from '../../data/dataContext.ts';
import type { DiagnosticReport } from '../../data/diagnostics.ts';
import { formatCount } from '../../lib/format.ts';
import common from '../../ui/common.module.css';
import { ScreenHeader } from '../../ui/ScreenHeader.tsx';
import styles from './DiagnosticScreen.module.css';
import { locale, localized } from '../../lib/i18n.ts';

const t = localized({
  fr: {
    title: 'Diagnostic',
    intro:
      'Compte les informations fournies par OneDrive, sans aucun nom de fichier ni de dossier : le rapport peut être partagé sans risque.',
    running: 'Analyse…',
    run: 'Lancer le diagnostic',
    copied: 'Rapport copié',
    copy: 'Copier le rapport',
    api: 'Vérifications de l’API',
    demo: 'Mode démo',
    noCall: 'pas d’appel réel',
    content: 'Contenu',
    media: 'Photos et vidéos',
    videos: 'Vidéos',
    folders: 'Dossiers',
    exif: 'Date EXIF',
    name: 'Date du nom',
    undated: 'Sans date',
    videosExif: 'Vidéos avec date EXIF',
    place: 'Lieu (GPS)',
    sizes: 'Dimensions connues',
    formats: 'Formats',
    unknown: '(inconnu)',
    lastFull: 'Dernière indexation complète',
    total: 'Durée totale',
    waiting: 'Attente de OneDrive',
    writing: 'Écriture locale',
    pages: 'Pages',
    offsets: 'Date EXIF moins date du nom (minutes)',
    noBoth: 'Aucun fichier avec les deux dates.',
    shapes: 'Noms sans date (formes)',
    none: 'Aucun.',
  },
  en: {
    title: 'Diagnostic',
    intro:
      'Counts what OneDrive gives, without any file or folder name: the report can be shared safely.',
    running: 'Analysing…',
    run: 'Run the diagnostic',
    copied: 'Report copied',
    copy: 'Copy the report',
    api: 'API checks',
    demo: 'Demo mode',
    noCall: 'no real call',
    content: 'Content',
    media: 'Photos and videos',
    videos: 'Videos',
    folders: 'Folders',
    exif: 'EXIF date',
    name: 'Date from the name',
    undated: 'Undated',
    videosExif: 'Videos with an EXIF date',
    place: 'Place (GPS)',
    sizes: 'Known dimensions',
    formats: 'Formats',
    unknown: '(unknown)',
    lastFull: 'Last full indexing',
    total: 'Total time',
    waiting: 'Waiting for OneDrive',
    writing: 'Writing on the device',
    pages: 'Pages',
    offsets: 'EXIF date minus name date (minutes)',
    noBoth: 'No file with both dates.',
    shapes: 'Undated names (shapes)',
    none: 'None.',
  },
});

/**
 * Checks the assumptions about the Graph data on the real drive. The report
 * holds counts and anonymous name shapes only, so it can be shared safely.
 */
export function DiagnosticScreen() {
  const { source, state } = useData();
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);

  const run = async () => {
    if (!source.diagnose) return;
    setRunning(true);
    setError(null);
    try {
      setReport(await source.diagnose());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  const copy = async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const pct = (part: number, total: number) =>
    total ? `${formatCount(part)} (${Math.round((100 * part) / total)} %)` : formatCount(part);

  return (
    <>
      <ScreenHeader title={t.title} />
      <div className={common.page}>
        <p className={common.muted}>{t.intro}</p>
        <div className={`${common.stack} ${styles.actions}`}>
          <button
            type="button"
            className={common.button}
            onClick={() => void run()}
            disabled={running || state.status !== 'ready' || !source.diagnose}
          >
            {running ? t.running : t.run}
          </button>
          {report && (
            <button type="button" className={common.buttonSoft} onClick={() => void copy()}>
              {copied ? t.copied : t.copy}
            </button>
          )}
        </div>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}

        {report && (
          <>
            <section className={common.section}>
              <h2 className={common.sectionTitle}>{t.api}</h2>
              <div className={common.card}>
                <dl className={`${common.definitionList} ${styles.stacked}`}>
                  {report.apiChecks.map(({ check, result }) => (
                    <div key={check} className={styles.row}>
                      <dt>{check}</dt>
                      <dd>{result}</dd>
                    </div>
                  ))}
                  {report.apiChecks.length === 0 && (
                    <div className={styles.row}>
                      <dt>{t.demo}</dt>
                      <dd>{t.noCall}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </section>

            <section className={common.section}>
              <h2 className={common.sectionTitle}>{t.content}</h2>
              <div className={common.card}>
                <dl className={common.definitionList}>
                  <dt>{t.media}</dt>
                  <dd>{formatCount(report.counts.indexedMedia)}</dd>
                  <dt>{t.videos}</dt>
                  <dd>{pct(report.counts.videos, report.counts.indexedMedia)}</dd>
                  <dt>{t.folders}</dt>
                  <dd>{formatCount(report.counts.folders)}</dd>
                  <dt>{t.exif}</dt>
                  <dd>{pct(report.counts.dateSources.exif, report.counts.indexedMedia)}</dd>
                  <dt>{t.name}</dt>
                  <dd>{pct(report.counts.dateSources.filename, report.counts.indexedMedia)}</dd>
                  <dt>{t.undated}</dt>
                  <dd>{pct(report.counts.dateSources.none, report.counts.indexedMedia)}</dd>
                  <dt>{t.videosExif}</dt>
                  <dd>{pct(report.counts.videosWithTakenDateTime, report.counts.videos)}</dd>
                  <dt>{t.place}</dt>
                  <dd>{pct(report.counts.location, report.counts.indexedMedia)}</dd>
                  <dt>{t.sizes}</dt>
                  <dd>{pct(report.counts.imageSize, report.counts.images)}</dd>
                </dl>
              </div>
            </section>

            <section className={common.section}>
              <h2 className={common.sectionTitle}>{t.formats}</h2>
              <div className={common.card}>
                <dl className={common.definitionList}>
                  {Object.entries(report.counts.mimeTypes)
                    .sort((a, b) => b[1] - a[1])
                    .map(([mime, count]) => (
                      <div key={mime} className={styles.row}>
                        <dt>{mime || t.unknown}</dt>
                        <dd>{formatCount(count)}</dd>
                      </div>
                    ))}
                </dl>
              </div>
            </section>

            {report.lastFullSync && (
              <section className={common.section}>
                <h2 className={common.sectionTitle}>{t.lastFull}</h2>
                <div className={common.card}>
                  <dl className={common.definitionList}>
                    <dt>{t.total}</dt>
                    <dd>{formatSeconds(report.lastFullSync.totalMs)}</dd>
                    <dt>{t.waiting}</dt>
                    <dd>{formatSeconds(report.lastFullSync.fetchMs)}</dd>
                    <dt>{t.writing}</dt>
                    <dd>{formatSeconds(report.lastFullSync.storeMs)}</dd>
                    <dt>{t.pages}</dt>
                    <dd>{formatCount(report.lastFullSync.pages)}</dd>
                  </dl>
                </div>
              </section>
            )}

            <section className={common.section}>
              <h2 className={common.sectionTitle}>{t.offsets}</h2>
              <div className={common.card}>
                {report.exifVersusName.length === 0 ? (
                  <p className={common.muted}>{t.noBoth}</p>
                ) : (
                  <dl className={`${common.definitionList} ${styles.stacked}`}>
                    {report.exifVersusName.map(({ shape, count, offsets }) => (
                      <div key={shape} className={styles.row}>
                        <dt className={styles.shape}>
                          {shape} ({formatCount(count)})
                        </dt>
                        <dd>
                          {Object.entries(offsets)
                            .map(([minutes, n]) => `${minutes} : ${formatCount(n)}`)
                            .join(' · ')}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            </section>

            <section className={common.section}>
              <h2 className={common.sectionTitle}>{t.shapes}</h2>
              <div className={common.card}>
                <ShapeList shapes={report.undatedNameShapes} />
              </div>
            </section>
          </>
        )}
      </div>
    </>
  );
}

function formatSeconds(ms: number): string {
  return `${(ms / 1000).toLocaleString(locale, { maximumFractionDigits: 1 })} s`;
}

function ShapeList({ shapes }: { shapes: DiagnosticReport['undatedNameShapes'] }) {
  if (shapes.length === 0) return <p className={common.muted}>{t.none}</p>;
  return (
    <dl className={common.definitionList}>
      {shapes.map(({ shape, count }) => (
        <div key={shape} className={styles.row}>
          <dt className={styles.shape}>{shape}</dt>
          <dd>{formatCount(count)}</dd>
        </div>
      ))}
    </dl>
  );
}
