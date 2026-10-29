import { useEffect } from 'react';
import { Link, useSearchParams } from 'wouter';
import { RELEASES, UPCOMING, useWhatsNew } from '../../app/whatsNew.ts';
import { formatLongDate } from '../../lib/format.ts';
import common from '../../ui/common.module.css';
import { BackIcon } from '../../ui/icons.tsx';
import { ScreenHeader } from '../../ui/ScreenHeader.tsx';
import albumStyles from '../albums/AlbumScreen.module.css';
import styles from './WhatsNewScreen.module.css';
import { localized } from '../../lib/i18n.ts';

const t = localized({
  fr: {
    title: 'Nouveautés',
    backToSettings: 'Retour aux réglages',
    back: 'Retour',
    since: (version: string) => `Depuis la version ${version}`,
    touches: 'Petites retouches déjà en ligne, sans nouveau numéro.',
    version: (version: string) => `Version ${version}`,
  },
  en: {
    title: 'What’s new',
    backToSettings: 'Back to the settings',
    back: 'Back',
    since: (version: string) => `Since version ${version}`,
    touches: 'Small touches already live, without a new number.',
    version: (version: string) => `Version ${version}`,
  },
});

/** A path inside the app to go back to; anything else (another site) is ignored. */
function returnPath(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/reglages';
}

/** What each version brought (CHANGELOG.md), the most recent first. */
export function WhatsNewScreen() {
  const [params] = useSearchParams();
  const back = returnPath(params.get('retour'));
  const { unseen, markSeen } = useWhatsNew();

  // Read: the banner has nothing more to announce.
  useEffect(() => {
    if (unseen.length > 0) markSeen();
  }, [unseen.length, markSeen]);

  return (
    <>
      <ScreenHeader
        title={t.title}
        leading={
          <Link
            href={back}
            className={albumStyles.back}
            aria-label={back === '/reglages' ? t.backToSettings : t.back}
          >
            <BackIcon />
          </Link>
        }
      />
      <div className={common.page}>
        {UPCOMING.length > 0 && (
          <section className={common.section} aria-labelledby="release-upcoming">
            <h2 id="release-upcoming" className={styles.version}>
              {t.since(RELEASES[0]?.version ?? '')}
            </h2>
            <div className={`${common.card} ${common.stack}`}>
              <p className={common.muted}>{t.touches}</p>
              <ul className={styles.items}>
                {UPCOMING.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </section>
        )}
        {RELEASES.map((release) => (
          <section
            key={release.version}
            className={common.section}
            aria-labelledby={`release-${release.version}`}
          >
            <h2 id={`release-${release.version}`} className={styles.version}>
              {t.version(release.version)}
              {release.date && (
                <span className={styles.date}>{formatLongDate(Date.parse(release.date))}</span>
              )}
            </h2>
            <div className={`${common.card} ${common.stack}`}>
              {release.intro && <p>{release.intro}</p>}
              {release.sections.map((section) => (
                <div key={section.title}>
                  <h3 className={styles.sectionTitle}>{section.title}</h3>
                  <ul className={styles.items}>
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
