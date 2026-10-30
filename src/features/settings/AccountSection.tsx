import { useAccount } from '@azure/msal-react';
import { signOut } from '../../auth/msal.ts';
import { useSignIn } from '../../auth/useSignIn.ts';
import { useData } from '../../data/dataContext.ts';
import { photoPlaces } from '../../data/places/photoPlaces.ts';
import { forgetAccountPreferences } from '../../data/forgetAccount.ts';
import { forgetMemoryState } from '../../data/memoryNotifier.ts';
import { useOnline } from '../../lib/online.ts';
import common from '../../ui/common.module.css';
import { useConfirm } from '../../ui/confirmContext.ts';
import { useOffline } from '../offline/offlineContext.ts';
import { localized } from '../../lib/i18n.ts';

const t = localized({
  fr: {
    signOutTitle: 'Se déconnecter ?',
    signOutMessage:
      'Ce que Nuagerie garde sur cet appareil (index, miniatures, albums gardés hors connexion, lieux, recherches, copie des favoris et des préférences) sera effacé. Rien ne change dans OneDrive : ce qui est synchronisé y reste et revient quand tu te reconnectes.',
    signOut: 'Se déconnecter',
    account: 'Compte',
    signedIn: 'Connecté',
    address: 'Adresse',
    access: 'Accès',
    readOnly: 'lecture seule',
    unreachable: 'Microsoft ne répond pas sur ce réseau',
    startedOffline: 'Démarré hors connexion',
    fromDevice: ' : les photos enregistrées sur l’appareil s’affichent, sans mise à jour.',
    connecting: 'Connexion…',
    signIn: 'Se connecter',
  },
  en: {
    signOutTitle: 'Sign out?',
    signOutMessage:
      'What Nuagerie keeps on this device (index, thumbnails, albums kept offline, places, searches, copy of the favourites and preferences) will be erased. Nothing changes in OneDrive: what is synced stays there and comes back when you sign in again.',
    signOut: 'Sign out',
    account: 'Account',
    signedIn: 'Signed in',
    address: 'Address',
    access: 'Access',
    readOnly: 'read-only',
    unreachable: 'Microsoft does not answer on this network',
    startedOffline: 'Started offline',
    fromDevice: ': the photos saved on the device show, without updates.',
    connecting: 'Connecting…',
    signIn: 'Sign in',
  },
});

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
      title: t.signOutTitle,
      message: t.signOutMessage,
      confirmLabel: t.signOut,
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
    // This device's copy of the favourites and preferences (OneDrive's copy stays), and the
    // memories already told.
    forgetAccountPreferences();
    await forgetMemoryState().catch(() => undefined);
    await signOut();
  };

  return (
    <section className={common.section} aria-labelledby="settings-account">
      <h2 id="settings-account" className={common.sectionTitle}>
        {t.account}
      </h2>
      <div className={`${common.card} ${common.stack}`}>
        {signedIn ? (
          <>
            <dl className={common.definitionList}>
              <dt>{t.signedIn}</dt>
              <dd>{account?.name || account?.username || '—'}</dd>
              {account?.username && account.name && (
                <>
                  <dt>{t.address}</dt>
                  <dd>{account.username}</dd>
                </>
              )}
              <dt>{t.access}</dt>
              <dd>{t.readOnly}</dd>
            </dl>
            <button
              type="button"
              className={common.buttonDanger}
              onClick={() => void signOutAndForget()}
              disabled={!online}
            >
              {t.signOut}
            </button>
          </>
        ) : (
          <>
            <p className={common.muted}>
              {reconnect.unreachable ? t.unreachable : t.startedOffline}
              {t.fromDevice}
            </p>
            <button
              type="button"
              className={common.buttonSoft}
              onClick={() => void reconnect.start()}
              disabled={!online || reconnect.checking}
              aria-busy={reconnect.checking}
            >
              {reconnect.checking ? t.connecting : t.signIn}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
