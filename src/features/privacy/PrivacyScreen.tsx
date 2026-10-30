import { MANAGE_CONSENT_URL } from '../../auth/msal.ts';
import { localized } from '../../lib/i18n.ts';
import { REPOSITORY_URL } from '../../lib/report.ts';
import common from '../../ui/common.module.css';
import { Logo } from '../../ui/Logo.tsx';
import styles from './PrivacyScreen.module.css';

/** Where the page is served: the address given to Microsoft as the app's privacy statement. */
export const PRIVACY_PATH = '/confidentialite';

/** Updated with the page: the date it was last changed. */
const UPDATED = '2026-10-29';

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
          'Réglages → Permissions montre ce que Microsoft autorise vraiment, avec un lien pour le retirer.',
        ],
      },
      {
        title: 'Sur ton appareil',
        paragraphs: [
          'Pour s’ouvrir vite, et sans réseau, Nuagerie garde dans ton navigateur l’index de tes photos, leurs miniatures, les albums que tu gardes hors connexion, les lieux de tes photos, tes dernières recherches et tes préférences.',
          'Se déconnecter efface tout cela. Effacer les données du site dans le navigateur aussi.',
        ],
      },
      {
        title: 'Lieux et carte',
        paragraphs: [
          'Le lieu d’une photo est trouvé sur l’appareil, dans une liste de villes (GeoNames) : ses coordonnées ne sont envoyées nulle part.',
          'Les fonds de carte viennent d’OpenStreetMap : en affichant la carte, ton navigateur leur demande les images de la zone regardée, comme tout site qui montre leur carte.',
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
          'Le lien des réglages ouvre GitHub (compte nécessaire), avec la version de Nuagerie et le type d’appareil, rien de personnel. Ce que tu y écris est public.',
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
          'Settings → Permissions shows what Microsoft really allows, with a link to withdraw it.',
        ],
      },
      {
        title: 'On your device',
        paragraphs: [
          'To open fast, and without a network, Nuagerie keeps in your browser the index of your photos, their thumbnails, the albums you keep offline, the places of your photos, your latest searches and your preferences.',
          'Signing out erases all of it. So does clearing the site’s data in the browser.',
        ],
      },
      {
        title: 'Places and map',
        paragraphs: [
          'A photo’s place is found on the device, in a list of towns (GeoNames): its coordinates are sent nowhere.',
          'Map backgrounds come from OpenStreetMap: when the map shows, your browser asks them for the images of the area looked at, like any site that shows their map.',
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
          'The link in the settings opens GitHub (an account is needed), with Nuagerie’s version and the kind of device, nothing personal. What you write there is public.',
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
