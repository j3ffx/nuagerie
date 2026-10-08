import { useEffect, useState } from 'react';
import { grantedScopes, MANAGE_CONSENT_URL } from '../../auth/msal.ts';
import common from '../../ui/common.module.css';
import styles from './SettingsScreen.module.css';

/** What each permission allows, in plain words; the sign-in ones go together. */
const DESCRIPTIONS: Record<string, string> = {
  'Files.Read': 'Lire tes fichiers OneDrive (lecture seule)',
  'User.Read': 'Connaître ton nom et ton adresse',
  offline_access: 'Rester connecté sans redemander ton mot de passe',
  'Files.ReadWrite.AppFolder':
    'Écrire dans un seul dossier, Applis/Nuagerie, pour la synchronisation des favoris',
  openid: 'Te connecter avec ton compte Microsoft',
  profile: 'Te connecter avec ton compte Microsoft',
  email: 'Te connecter avec ton compte Microsoft',
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
        a.localeCompare(b, 'fr'),
      )
    : [];
  const writes = scopes?.includes('Files.ReadWrite.AppFolder') ?? false;

  return (
    <section className={common.section} aria-labelledby="settings-permissions">
      <h2 id="settings-permissions" className={common.sectionTitle}>
        Permissions
      </h2>
      <div className={`${common.card} ${common.stack}`}>
        {scopes ? (
          <>
            <p className={common.muted}>Ce que Microsoft autorise Nuagerie à faire :</p>
            <ul className={styles.permissions}>
              {lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className={common.muted}>
              {writes
                ? 'Rien d’autre : Nuagerie ne peut ni modifier, ni déplacer, ni supprimer tes photos.'
                : 'Rien d’autre : Nuagerie ne peut rien modifier dans ton OneDrive.'}
            </p>
          </>
        ) : (
          <p className={common.muted} role="status">
            {failed ? 'Liste indisponible pour l’instant.' : 'Chargement…'}
          </p>
        )}
        <a href={MANAGE_CONSENT_URL} target="_blank" rel="noreferrer" className={common.buttonSoft}>
          Gérer sur ton compte Microsoft
        </a>
      </div>
    </section>
  );
}
