import { useEffect, useState } from 'react';
import { grantedScopes, MANAGE_CONSENT_URL } from '../../auth/msal.ts';
import common from '../../ui/common.module.css';
import styles from './SettingsScreen.module.css';
import { locale, localized } from '../../lib/i18n.ts';

const t = localized({
  fr: {
    read: 'Lire tes fichiers OneDrive (lecture seule)',
    user: 'Connaître ton nom et ton adresse',
    stay: 'Rester connecté sans redemander ton mot de passe',
    appFolder:
      'Écrire dans un seul dossier, Applis/Nuagerie, pour la synchronisation (favoris, préférences, index)',
    signIn: 'Te connecter avec ton compte Microsoft',
    title: 'Permissions',
    intro: 'Ce que Microsoft autorise Nuagerie à faire :',
    nothingElseWrites:
      'Rien d’autre : Nuagerie ne peut ni modifier, ni déplacer, ni supprimer tes photos.',
    nothingElse: 'Rien d’autre : Nuagerie ne peut rien modifier dans ton OneDrive.',
    unavailable: 'Liste indisponible pour l’instant.',
    loading: 'Chargement…',
    manage: 'Gérer sur ton compte Microsoft',
  },
  en: {
    read: 'Read your OneDrive files (read-only)',
    user: 'Know your name and address',
    stay: 'Stay signed in without asking for your password again',
    appFolder:
      'Write in one folder only, Apps/Nuagerie, for the sync (favourites, preferences, index)',
    signIn: 'Sign you in with your Microsoft account',
    title: 'Permissions',
    intro: 'What Microsoft allows Nuagerie to do:',
    nothingElseWrites: 'Nothing else: Nuagerie can neither change, move nor delete your photos.',
    nothingElse: 'Nothing else: Nuagerie cannot change anything in your OneDrive.',
    unavailable: 'List unavailable for now.',
    loading: 'Loading…',
    manage: 'Manage on your Microsoft account',
  },
});

/** What each permission allows, in plain words; the sign-in ones go together. */
const DESCRIPTIONS: Record<string, string> = {
  'Files.Read': t.read,
  'User.Read': t.user,
  offline_access: t.stay,
  'Files.ReadWrite.AppFolder': t.appFolder,
  openid: t.signIn,
  profile: t.signIn,
  email: t.signIn,
};

/**
 * The permissions Microsoft has actually granted the app, as its tokens say
 * (not what the app believes it asked for), and where to withdraw them.
 */
export function PermissionsSection() {
  const [scopes, setScopes] = useState<string[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    grantedScopes().then(
      (granted) => {
        if (active) setScopes(granted);
      },
      () => {
        if (active) setFailed(true);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  const lines = scopes
    ? [...new Set(scopes.map((scope) => DESCRIPTIONS[scope] ?? scope))].sort((a, b) =>
        a.localeCompare(b, locale),
      )
    : [];
  const writes = scopes?.includes('Files.ReadWrite.AppFolder') ?? false;

  return (
    <section className={common.section} aria-labelledby="settings-permissions">
      <h2 id="settings-permissions" className={common.sectionTitle}>
        {t.title}
      </h2>
      <div className={`${common.card} ${common.stack}`}>
        {scopes ? (
          <>
            <p className={common.muted}>{t.intro}</p>
            <ul className={styles.permissions}>
              {lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className={common.muted}>{writes ? t.nothingElseWrites : t.nothingElse}</p>
          </>
        ) : (
          <p className={common.muted} role="status">
            {failed ? t.unavailable : t.loading}
          </p>
        )}
        <a href={MANAGE_CONSENT_URL} target="_blank" rel="noreferrer" className={common.buttonSoft}>
          {t.manage}
        </a>
      </div>
    </section>
  );
}
