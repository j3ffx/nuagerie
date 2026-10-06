import { useState } from 'react';
import { useData } from '../../data/dataContext.ts';
import type { DiagnosticReport } from '../../data/diagnostics.ts';
import { formatCount } from '../../lib/format.ts';
import common from '../../ui/common.module.css';
import { ScreenHeader } from '../../ui/ScreenHeader.tsx';
import styles from './DiagnosticScreen.module.css';

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
      <ScreenHeader title="Diagnostic" />
      <div className={common.page}>
        <p className={common.muted}>
          Compte les informations fournies par OneDrive, sans aucun nom de fichier ni de dossier :
          le rapport peut être partagé sans risque.
        </p>
        <div className={`${common.stack} ${styles.actions}`}>
          <button
            type="button"
            className={common.button}
            onClick={() => void run()}
            disabled={running || state.status !== 'ready' || !source.diagnose}
          >
            {running ? 'Analyse…' : 'Lancer le diagnostic'}
          </button>
          {report && (
            <button type="button" className={common.buttonSoft} onClick={() => void copy()}>
              {copied ? 'Rapport copié' : 'Copier le rapport'}
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
              <h2 className={common.sectionTitle}>Vérifications de l’API</h2>
              <div className={common.card}>
                <dl className={common.definitionList}>
                  {report.apiChecks.map(({ check, result }) => (
                    <div key={check} className={styles.row}>
                      <dt>{check}</dt>
                      <dd>{result}</dd>
                    </div>
                  ))}
                  {report.apiChecks.length === 0 && (
                    <div className={styles.row}>
                      <dt>Mode démo</dt>
                      <dd>pas d’appel réel</dd>
                    </div>
                  )}
                </dl>
              </div>
            </section>

            <section className={common.section}>
              <h2 className={common.sectionTitle}>Contenu</h2>
              <div className={common.card}>
                <dl className={common.definitionList}>
                  <dt>Photos et vidéos</dt>
                  <dd>{formatCount(report.counts.indexedMedia)}</dd>
                  <dt>Vidéos</dt>
                  <dd>{pct(report.counts.videos, report.counts.indexedMedia)}</dd>
                  <dt>Dossiers</dt>
                  <dd>{formatCount(report.counts.folders)}</dd>
                  <dt>Date EXIF</dt>
                  <dd>{pct(report.counts.dateSources.exif, report.counts.indexedMedia)}</dd>
                  <dt>Date du nom</dt>
                  <dd>{pct(report.counts.dateSources.filename, report.counts.indexedMedia)}</dd>
                  <dt>Sans date</dt>
                  <dd>{pct(report.counts.dateSources.none, report.counts.indexedMedia)}</dd>
                  <dt>Vidéos avec date EXIF</dt>
                  <dd>{pct(report.counts.videosWithTakenDateTime, report.counts.videos)}</dd>
                  <dt>Lieu (GPS)</dt>
                  <dd>{pct(report.counts.location, report.counts.indexedMedia)}</dd>
                  <dt>Dimensions connues</dt>
                  <dd>{pct(report.counts.imageSize, report.counts.images)}</dd>
                </dl>
              </div>
            </section>

            <section className={common.section}>
              <h2 className={common.sectionTitle}>Formats</h2>
              <div className={common.card}>
                <dl className={common.definitionList}>
                  {Object.entries(report.counts.mimeTypes)
                    .sort((a, b) => b[1] - a[1])
                    .map(([mime, count]) => (
                      <div key={mime} className={styles.row}>
                        <dt>{mime || '(inconnu)'}</dt>
                        <dd>{formatCount(count)}</dd>
                      </div>
                    ))}
                </dl>
              </div>
            </section>

            {report.lastFullSync && (
              <section className={common.section}>
                <h2 className={common.sectionTitle}>Dernière indexation complète</h2>
                <div className={common.card}>
                  <dl className={common.definitionList}>
                    <dt>Durée totale</dt>
                    <dd>{formatSeconds(report.lastFullSync.totalMs)}</dd>
                    <dt>Attente de OneDrive</dt>
                    <dd>{formatSeconds(report.lastFullSync.fetchMs)}</dd>
                    <dt>Écriture locale</dt>
                    <dd>{formatSeconds(report.lastFullSync.storeMs)}</dd>
                    <dt>Pages</dt>
                    <dd>{formatCount(report.lastFullSync.pages)}</dd>
                  </dl>
                </div>
              </section>
            )}

            <section className={common.section}>
              <h2 className={common.sectionTitle}>Date EXIF moins date du nom (minutes)</h2>
              <div className={common.card}>
                {report.exifVersusName.length === 0 ? (
                  <p className={common.muted}>Aucun fichier avec les deux dates.</p>
                ) : (
                  <dl className={common.definitionList}>
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
              <h2 className={common.sectionTitle}>Noms sans date (formes)</h2>
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
  return `${(ms / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} s`;
}

function ShapeList({ shapes }: { shapes: DiagnosticReport['undatedNameShapes'] }) {
  if (shapes.length === 0) return <p className={common.muted}>Aucun.</p>;
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
