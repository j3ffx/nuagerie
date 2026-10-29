import { useAccount } from '@azure/msal-react';
import { signOut } from '../../auth/msal.ts';
import { useSignIn } from '../../auth/useSignIn.ts';
import { useData } from '../../data/dataContext.ts';
import { photoPlaces } from '../../data/places/photoPlaces.ts';
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
import { useOffline } from '../offline/offlineContext.ts';

/** The signed-in Microsoft account (OneDrive mode only). */
export function AccountSection() {
  const account = useAccount();
  const { signedIn, source, thumbnails } = useData();
  const online = useOnline();
  const confirm = useConfirm();
  const reconnect = useSignIn();
  const offline = useOffline();

  /** Signing out leaves nothing of the drive on the device: index, thumbnails and places go too. */
  const signOutAndForget = async () => {
    const answer = await confirm({
      title: 'Se déconnecter ?',
      message:
        'Ce que Nuagerie garde sur cet appareil (index, miniatures, albums gardés hors connexion, lieux, recherches, copie des favoris et des préférences) sera effacé. Rien ne change dans OneDrive : ce qui est synchronisé y reste et revient quand tu te reconnectes.',
      confirmLabel: 'Se déconnecter',
      danger: true,
    });
    if (!answer) return;
    await Promise.all([
      source.reset?.(),
      thumbnails.disk.clear(),
      offline.clear(),
      photoPlaces().clear(),
    ]);
    thumbnails.store.clearMemory();
    // This device's copy of the favourites and preferences; OneDrive's copy stays.
    removePersistent(syncStateKey('onedrive'));
    removePersistent(SYNC_ENABLED_KEY);
    removePersistent(SYNC_GRANTED_KEY);
    removePersistent(SYNC_TURNED_OFF_KEY);
    removePersistent('search.recent.onedrive');
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
              {reconnect.unreachable
                ? 'Microsoft ne répond pas sur ce réseau'
                : 'Démarré hors connexion'}{' '}
              : les photos enregistrées sur l’appareil s’affichent, sans mise à jour.
            </p>
            <button
              type="button"
              className={common.buttonSoft}
              onClick={() => void reconnect.start()}
              disabled={!online || reconnect.checking}
              aria-busy={reconnect.checking}
            >
              {reconnect.checking ? 'Connexion…' : 'Se connecter'}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
