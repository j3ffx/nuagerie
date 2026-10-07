import { useAccount } from '@azure/msal-react';
import { signIn, signOut } from '../../auth/msal.ts';
import { useData } from '../../data/dataContext.ts';
import { useOnline } from '../../lib/online.ts';
import common from '../../ui/common.module.css';

/** The signed-in Microsoft account (OneDrive mode only). */
export function AccountSection() {
  const account = useAccount();
  const { signedIn } = useData();
  const online = useOnline();

  return (
    <section className={common.section} aria-labelledby="settings-account">
      <h2 id="settings-account" className={common.sectionTitle}>
        Compte
      </h2>
      <div className={`${common.card} ${common.stack}`}>
        {signedIn ? (
          <>
            <dl className={common.definitionList}>
              <dt>Connecté</dt>
              <dd>{account?.name || account?.username || '—'}</dd>
              {account?.username && account.name && (
                <>
                  <dt>Adresse</dt>
                  <dd>{account.username}</dd>
                </>
              )}
              <dt>Accès</dt>
              <dd>lecture seule</dd>
            </dl>
            <button type="button" className={common.buttonSoft} onClick={() => void signOut()}>
              Se déconnecter
            </button>
          </>
        ) : (
          <>
            <p className={common.muted}>
              Démarré hors connexion : les photos enregistrées sur l’appareil s’affichent, sans mise
              à jour.
            </p>
            <button
              type="button"
              className={common.buttonSoft}
              onClick={() => void signIn()}
              disabled={!online}
            >
              Se connecter
            </button>
          </>
        )}
      </div>
    </section>
  );
}
