import { Link } from 'wouter';
import { useData } from '../../data/dataContext.ts';
import { formatCount } from '../../lib/format.ts';
import { localized } from '../../lib/i18n.ts';
import { useOnline } from '../../lib/online.ts';
import common from '../../ui/common.module.css';
import { useConfirm } from '../../ui/confirmContext.ts';
import { useEdits } from '../edits/editsContext.ts';

const t = localized({
  fr: {
    title: 'Modifications',
    what: 'Par défaut, Nuagerie ne fait que lire ton OneDrive. Active les modifications pour supprimer et déplacer des photos, et créer, renommer ou supprimer des albums vides, depuis l’appli.',
    demo: 'En démo, les modifications restent en mémoire : la démo revient comme avant au rechargement.',
    signIn: 'Connecte-toi pour modifier ton OneDrive.',
    onTitle: 'Activer les modifications ?',
    onMessage:
      'Microsoft va te demander d’autoriser Nuagerie à modifier tes fichiers (« accès complet ») : c’est la seule permission qui permet aussi de restaurer depuis la corbeille. Nuagerie ne touche qu’à tes photos et albums, et seulement quand tu le lui demandes. Une photo supprimée va dans la corbeille de OneDrive.',
    onConfirm: 'Activer',
    turnOn: 'Activer les modifications',
    on: 'Activées sur cet appareil. Une photo supprimée va dans la corbeille de OneDrive, qui la garde 30 jours.',
    grant: 'Redonner la permission',
    needsPermission: 'Microsoft ne donne plus la permission : redonne-la pour modifier.',
    turnOff: 'Désactiver',
    offNote:
      'Désactiver ne retire pas la permission chez Microsoft : passe par « Permissions » pour ça.',
    trash: 'Corbeille',
    trashCount: (count: string) => `Corbeille (${count})`,
  },
  en: {
    title: 'Changes',
    what: 'By default, Nuagerie only reads your OneDrive. Turn on the changes to delete and move photos, and create, rename or delete empty albums, from the app.',
    demo: 'In the demo, changes stay in memory: the demo is back as it was on reload.',
    signIn: 'Sign in to change your OneDrive.',
    onTitle: 'Turn on the changes?',
    onMessage:
      'Microsoft will ask you to let Nuagerie change your files (“full access”): it is the only permission that also allows restoring from the recycle bin. Nuagerie only touches your photos and albums, and only when you ask it to. A deleted photo goes to OneDrive’s recycle bin.',
    onConfirm: 'Turn on',
    turnOn: 'Turn on the changes',
    on: 'On for this device. A deleted photo goes to OneDrive’s recycle bin, which keeps it 30 days.',
    grant: 'Give the permission again',
    needsPermission: 'Microsoft no longer gives the permission: give it again to make changes.',
    turnOff: 'Turn off',
    offNote:
      'Turning off does not withdraw the permission at Microsoft: use “Permissions” for that.',
    trash: 'Recycle bin',
    trashCount: (count: string) => `Recycle bin (${count})`,
  },
});

/**
 * Réglages → Modifications: off by default, per device. Turning it on asks
 * Microsoft for the permission to change files; the app's list of what it put
 * in the recycle bin is one tap away.
 */
export function EditsSection() {
  const edits = useEdits();
  const { mode } = useData();
  const online = useOnline();
  const confirm = useConfirm();

  const turnOn = async () => {
    if (mode !== 'demo') {
      const answer = await confirm({
        title: t.onTitle,
        message: t.onMessage,
        confirmLabel: t.onConfirm,
      });
      if (!answer) return;
    }
    await edits.enable();
  };

  return (
    <section className={common.section} aria-labelledby="settings-edits">
      <h2 id="settings-edits" className={common.sectionTitle}>
        {t.title}
      </h2>
      <div className={`${common.card} ${common.stack}`}>
        {!edits.available ? (
          <p className={common.muted}>{t.signIn}</p>
        ) : edits.status === 'off' ? (
          <>
            <p className={common.muted}>{mode === 'demo' ? `${t.what} ${t.demo}` : t.what}</p>
            <button
              type="button"
              className={common.buttonSoft}
              onClick={() => void turnOn()}
              disabled={mode !== 'demo' && !online}
            >
              {t.turnOn}
            </button>
          </>
        ) : (
          <>
            <p className={common.muted} role="status">
              {edits.status === 'needs-permission'
                ? t.needsPermission
                : mode === 'demo'
                  ? t.demo
                  : t.on}
            </p>
            {edits.status === 'needs-permission' && (
              <button
                type="button"
                className={common.button}
                onClick={() => void edits.enable()}
                disabled={!online}
              >
                {t.grant}
              </button>
            )}
            {(edits.trash.length > 0 || mode === 'onedrive') && (
              <Link href="/corbeille" className={common.buttonSoft}>
                {edits.trash.length > 0 ? t.trashCount(formatCount(edits.trash.length)) : t.trash}
              </Link>
            )}
            <button type="button" className={common.buttonSoft} onClick={edits.disable}>
              {t.turnOff}
            </button>
            {mode === 'onedrive' && <p className={common.muted}>{t.offNote}</p>}
          </>
        )}
      </div>
    </section>
  );
}
