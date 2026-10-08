import { useAccount } from '@azure/msal-react';
import { signIn, signOut } from '../../auth/msal.ts';
import { useData } from '../../data/dataContext.ts';
import {
  SYNC_ENABLED_KEY,
  SYNC_GRANTED_KEY,
  SYNC_TURNED_OFF_KEY,
  syncStateKey,
} from '../../data/sync/syncContext.ts';
import { removePersistent } from '../../lib/persistent.ts';
import { useOnline } from '../../lib/online.ts';
import common from '../../ui/common.module.css';
import { useConfirm } from '../../ui/confirmContext.ts';

/** The signed-in Microsoft account (OneDrive mode only). */
export function AccountSection() {
  const account = useAccount();
  const { signedIn, source, thumbnails } = useData();
  const online = useOnline();
  const confirm = useConfirm();

  /** Signing out leaves nothing of the drive on the device: index and thumbnails go too. */
  const signOutAndForget = async () => {
    const answer = await confirm({
      title: 'Se déconnecter ?',
      message:
        'Ce que Nuagerie garde sur cet appareil (index, miniatures, copie des favoris et des préférences) sera effacé. Rien ne change dans OneDrive : ce qui est synchronisé y reste et revient quand tu te reconnectes.',
      confirmLabel: 'Se déconnecter',
      danger: true,
    });
    if (!answer) return;
    await Promise.all([source.reset?.(), thumbnails.disk.clear()]);
    thumbnails.store.clearMemory();
    // This device's copy of the favourites and preferences; OneDrive's copy stays.
    removePersistent(syncStateKey('onedrive'));
    removePersistent(SYNC_ENABLED_KEY);
    removePersistent(SYNC_GRANTED_KEY);
    removePersistent(SYNC_TURNED_OFF_KEY);
    await signOut();
  };

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
            <button
              type="button"
              className={common.buttonDanger}
              onClick={() => void signOutAndForget()}
              disabled={!online}
            >
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
