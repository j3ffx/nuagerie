import { useAccount } from '@azure/msal-react';
import { signOut } from '../../auth/msal.ts';
import common from '../../ui/common.module.css';

/** The signed-in Microsoft account (OneDrive mode only). */
export function AccountSection() {
  const account = useAccount();

  return (
    <section className={common.section} aria-labelledby="settings-account">
      <h2 id="settings-account" className={common.sectionTitle}>
        Compte
      </h2>
      <div className={`${common.card} ${common.stack}`}>
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
      </div>
    </section>
  );
}
