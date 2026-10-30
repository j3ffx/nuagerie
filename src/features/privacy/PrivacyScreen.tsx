import { MANAGE_CONSENT_URL } from '../../auth/msal.ts';
import { localized } from '../../lib/i18n.ts';
import { REPOSITORY_URL } from '../../lib/report.ts';
import common from '../../ui/common.module.css';
import { Logo } from '../../ui/Logo.tsx';
import styles from './PrivacyScreen.module.css';

/** Where the page is served: the address given to Microsoft as the app's privacy statement. */
export const PRIVACY_PATH = '/confidentialite';

/** Updated with the page: the date it was last changed. */
const UPDATED = '2026-10-30';

interface Part {
  title: string;
  paragraphs: readonly string[];
}

const t = localized({
  fr: {
    title: 'Confidentialité',
    intro:
      'Nuagerie montre tes photos OneDrive. Elle n’a pas de serveur à elle : elle tourne dans ton navigateur, et tes photos passent directement de Microsoft à ton appareil.',
    parts: [
      {
        title: 'Ce que Nuagerie ne fait pas',
        paragraphs: [
          'Pas de compte Nuagerie, pas de publicité, pas de mesure d’audience, pas de cookie de suivi. Personne d’autre que toi ne voit tes photos, tes favoris ni tes recherches.',
        ],
      },
      {
        title: 'Microsoft',
        paragraphs: [
          'Tu te connectes avec ton compte Microsoft. Nuagerie demande à lire tes fichiers OneDrive (lecture seule), ton nom et ton adresse e-mail (pour les afficher dans les réglages) et à rester connectée.',
          'Seulement si tu actives la synchronisation, elle demande aussi à écrire dans un seul dossier, Applis/Nuagerie, pour y ranger tes favoris, tes préférences, tes dossiers et une copie de l’index de tes photos. Elle ne crée, ne modifie, ne déplace ni ne supprime jamais tes fichiers.',
          'Une fois activée, la synchronisation suit sur tes autres appareils connectés au même compte ; Réglages → Synchronisation la coupe appareil par appareil. La couper, ou retirer la permission, laisse ce dossier dans ton OneDrive : supprime Applis/Nuagerie pour l’effacer.',
          'Réglages → Permissions montre ce que Microsoft autorise vraiment, avec un lien pour le retirer.',
        ],
      },
      {
        title: 'Sur ton appareil',
        paragraphs: [
          'Pour s’ouvrir vite, et sans réseau, Nuagerie garde dans ton navigateur l’index de tes photos, leurs miniatures, les albums que tu gardes hors connexion, les lieux de tes photos, tes favoris, tes dernières recherches, tes préférences et ta connexion Microsoft (nom du compte, adresse e-mail et jetons, gardés par la bibliothèque de connexion de Microsoft).',
          'Se déconnecter efface tout cela, sauf l’apparence de l’appli (thème, langue, colonnes). Effacer les données du site dans le navigateur aussi.',
          'La notification des souvenirs est préparée sur l’appareil et montre une de tes photos parmi tes notifications. Partager envoie une photo seulement à l’appli que tu choisis.',
        ],
      },
      {
        title: 'Lieux et carte',
        paragraphs: [
          'Le lieu d’une photo est trouvé sur l’appareil, dans une liste de villes (GeoNames) : ses coordonnées ne sont envoyées nulle part.',
          'Les fonds de carte viennent d’OpenStreetMap. La carte s’ouvre sur tes photos : ton navigateur leur demande donc les images de cette zone (ce qui dit, à peu près, où tes photos ont été prises), avec ton adresse IP et l’adresse de Nuagerie, comme tout site qui montre leur carte.',
        ],
      },
      {
        title: 'Hébergement',
        paragraphs: [
          'Les fichiers de l’application sont servis par Cloudflare Pages, qui peut, comme tout hébergeur, journaliser les requêtes (adresse IP, page demandée). Tes photos n’y passent jamais.',
        ],
      },
      {
        title: 'Signaler un problème',
        paragraphs: [
          'Le lien des réglages ouvre GitHub (compte nécessaire), avec la version de Nuagerie, si c’est la démo, et le type d’appareil (système, navigateur, largeur d’écran), rien de personnel. Ce que tu y écris est public.',
        ],
      },
    ],
    manage: 'Gérer les permissions sur ton compte Microsoft',
    source: 'Code source et questions sur GitHub',
    updated: (date: string) => `Mise à jour : ${date}.`,
    back: 'Ouvrir Nuagerie',
  },
  en: {
    title: 'Privacy',
    intro:
      'Nuagerie shows your OneDrive photos. It has no server of its own: it runs in your browser, and your photos go straight from Microsoft to your device.',
    parts: [
      {
        title: 'What Nuagerie does not do',
        paragraphs: [
          'No Nuagerie account, no ads, no analytics, no tracking cookie. Nobody but you sees your photos, your favourites or your searches.',
        ],
      },
      {
        title: 'Microsoft',
        paragraphs: [
          'You sign in with your Microsoft account. Nuagerie asks to read your OneDrive files (read-only), your name and email address (to show them in the settings) and to stay signed in.',
          'Only if you turn on the sync does it also ask to write in one folder, Apps/Nuagerie, to keep your favourites, your preferences, your folders and a copy of your photos’ index there. It never creates, changes, moves or deletes your files.',
          'Once on, the sync follows on your other devices signed in to the same account; Settings → Sync turns it off device by device. Turning it off, or withdrawing the permission, leaves this folder in your OneDrive: delete Apps/Nuagerie to erase it.',
          'Settings → Permissions shows what Microsoft really allows, with a link to withdraw it.',
        ],
      },
      {
        title: 'On your device',
        paragraphs: [
          'To open fast, and without a network, Nuagerie keeps in your browser the index of your photos, their thumbnails, the albums you keep offline, the places of your photos, your favourites, your latest searches, your preferences and your Microsoft sign-in (account name, email address and tokens, kept by Microsoft’s sign-in library).',
          'Signing out erases all of it, except the look of the app (theme, language, columns). So does clearing the site’s data in the browser.',
          'The memories notification is made on the device and shows one of your photos among your notifications. Sharing sends a photo only to the app you choose.',
        ],
      },
      {
        title: 'Places and map',
        paragraphs: [
          'A photo’s place is found on the device, in a list of towns (GeoNames): its coordinates are sent nowhere.',
          'Map backgrounds come from OpenStreetMap. The map opens on your photos: your browser therefore asks them for the images of that area (which tells, roughly, where your photos were taken), along with your IP address and Nuagerie’s address, like any site that shows their map.',
        ],
      },
      {
        title: 'Hosting',
        paragraphs: [
          'The app’s files are served by Cloudflare Pages, which, like any host, may log requests (IP address, page asked for). Your photos never go through it.',
        ],
      },
      {
        title: 'Reporting a problem',
        paragraphs: [
          'The link in the settings opens GitHub (an account is needed), with Nuagerie’s version, whether it shows the demo, and the kind of device (system, browser, screen width), nothing personal. What you write there is public.',
        ],
      },
    ],
    manage: 'Manage the permissions on your Microsoft account',
    source: 'Source code and questions on GitHub',
    updated: (date: string) => `Last updated: ${date}.`,
    back: 'Open Nuagerie',
  },
});

/**
 * What the app does with the user's data, readable without signing in (it is
 * the privacy statement given to Microsoft): served on its own by main.tsx.
 */
export function PrivacyScreen() {
  const parts: readonly Part[] = t.parts;
  return (
    <main className={styles.privacy}>
      <header className={styles.header}>
        <Logo size={48} />
        <h1 className={styles.title}>{t.title}</h1>
      </header>
      <p>{t.intro}</p>
      {parts.map((part) => (
        <section key={part.title} className={common.section}>
          <h2 className={common.sectionTitle}>{part.title}</h2>
          <div className={`${common.card} ${common.stack}`}>
            {part.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </section>
      ))}
      <div className={common.stack}>
        <a href={MANAGE_CONSENT_URL} target="_blank" rel="noreferrer" className={common.buttonSoft}>
          {t.manage}
        </a>
        <a href={REPOSITORY_URL} target="_blank" rel="noreferrer" className={common.buttonSoft}>
          {t.source}
        </a>
        <a href="/" className={common.button}>
          {t.back}
        </a>
      </div>
      <p className={common.muted}>{t.updated(UPDATED)}</p>
    </main>
  );
}
