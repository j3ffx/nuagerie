import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useMediaIndex } from '../../data/dataContext.ts';
import { albumNameProblem, moveTargets } from '../../data/edits/rules.ts';
import type { MediaIndex, MediaItem } from '../../data/model.ts';
import { formatItemCount } from '../../lib/format.ts';
import { locale, localized } from '../../lib/i18n.ts';
import common from '../../ui/common.module.css';
import confirmStyles from '../../ui/confirm.module.css';
import styles from './EditDialogs.module.css';
import { useEdits } from './editsContext.ts';
import { useCreateAlbum } from './useCreateAlbum.ts';

const t = localized({
  fr: {
    cancel: 'Annuler',
    name: 'Nom',
    problems: {
      empty: 'Donne-lui un nom.',
      tooLong: 'Ce nom est trop long.',
      characters: 'Pas de " * : < > ? / \\ | dans le nom, ni de point à la fin.',
      technical:
        'Ce nom en ferait un dossier technique (une année, un mois, « Sans date ») : choisis-en un autre.',
      taken: 'Un album de ce nom est déjà là.',
    },
    moveTitle: (count: string) => `Déplacer ${count}`,
    find: 'Chercher un album',
    targets: 'Albums',
    here: 'Déjà ici',
    newAlbum: 'Nouvel album…',
    newTitle: 'Nouvel album',
    create: 'Créer',
    none: 'Aucun album ne correspond.',
  },
  en: {
    cancel: 'Cancel',
    name: 'Name',
    problems: {
      empty: 'Give it a name.',
      tooLong: 'This name is too long.',
      characters: 'No " * : < > ? / \\ | in the name, nor a full stop at the end.',
      technical:
        'This name would make it a technical folder (a year, a month, “Undated”): pick another one.',
      taken: 'An album of that name is already there.',
    },
    moveTitle: (count: string) => `Move ${count}`,
    find: 'Find an album',
    targets: 'Albums',
    here: 'Already here',
    newAlbum: 'New album…',
    newTitle: 'New album',
    create: 'Create',
    none: 'No album matches.',
  },
});

/** A native modal dialog, opened once mounted; Escape and Android's back gesture call `onCancel`. */
function Modal({
  labelledBy,
  onCancel,
  children,
}: {
  labelledBy: string;
  onCancel: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className={confirmStyles.dialog}
      aria-labelledby={labelledBy}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onCancel();
      }}
    >
      {children}
    </dialog>
  );
}

/**
 * An album's name, new or changed: checked as it is typed (OneDrive's rules,
 * no technical name, none a sibling has), sent only once it is right.
 */
export function NameDialog({
  title,
  confirmLabel,
  parentId,
  initial = '',
  ignoreId = null,
  onDone,
  onCancel,
}: {
  title: string;
  confirmLabel: string;
  parentId: string;
  initial?: string;
  /** The album being renamed: its own name is not taken. */
  ignoreId?: string | null;
  /** Resolves once the change is done (or failed: the notice says why). */
  onDone: (name: string) => Promise<void>;
  onCancel: () => void;
}) {
  const index = useMediaIndex();
  const [name, setName] = useState(initial);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const problem = index ? albumNameProblem(index, parentId, name, ignoreId) : 'empty';
  const unchanged = initial !== '' && name.trim() === initial;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (problem || unchanged || busy) return;
    setBusy(true);
    try {
      await onDone(name);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal labelledBy="name-dialog-title" onCancel={onCancel}>
      <form className={confirmStyles.card} onSubmit={(event) => void submit(event)} noValidate>
        <h2 id="name-dialog-title" className={confirmStyles.title}>
          {title}
        </h2>
        <label className={styles.field}>
          {t.name}
          <input
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setTouched(true);
            }}
            autoFocus
            enterKeyHint="done"
            aria-invalid={touched && problem !== null}
            aria-describedby={touched && problem ? 'name-dialog-problem' : undefined}
            maxLength={200}
          />
        </label>
        {touched && problem && (
          <p id="name-dialog-problem" className={styles.problem}>
            {t.problems[problem]}
          </p>
        )}
        <div className={confirmStyles.actions}>
          <button type="button" className={common.buttonSoft} onClick={onCancel}>
            {t.cancel}
          </button>
          <button
            type="submit"
            className={common.button}
            disabled={busy || unchanged || (touched && problem !== null)}
            aria-busy={busy}
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** The root folder a photo is under: where a new album goes from the move dialog. */
function rootOf(index: MediaIndex, folderId: string): string | null {
  let current = index.folders.get(folderId);
  const seen = new Set<string>();
  while (current && current.parentId !== null && !seen.has(current.id)) {
    seen.add(current.id);
    current = index.folders.get(current.parentId);
  }
  return current?.id ?? index.rootFolderIds[0] ?? null;
}

/**
 * Where to move the photos: every album by its path, with a search for long
 * lists, and a new album made on the spot.
 */
export function MoveDialog({
  items,
  onMoved,
  onCancel,
}: {
  items: readonly MediaItem[];
  onMoved: () => void;
  onCancel: () => void;
}) {
  const index = useMediaIndex();
  const edits = useEdits();
  const createAlbum = useCreateAlbum();
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const targets = useMemo(() => (index ? moveTargets(index) : []), [index]);
  const shown = useMemo(() => {
    const words = query.trim().toLocaleLowerCase(locale);
    return words
      ? targets.filter((target) => target.path.join(' ').toLocaleLowerCase(locale).includes(words))
      : targets;
  }, [targets, query]);
  const allIn = (folderId: string) => items.every((item) => item.folderId === folderId);
  const newParent = index && items[0] ? rootOf(index, items[0].folderId) : null;

  const moveTo = async (folderId: string) => {
    if (await edits.movePhotos(items, folderId)) onMoved();
    else onCancel();
  };

  if (creating && newParent) {
    return (
      <NameDialog
        title={t.newTitle}
        confirmLabel={t.create}
        parentId={newParent}
        onCancel={() => setCreating(false)}
        onDone={async (name) => {
          const id = await createAlbum(newParent, name);
          if (id) await moveTo(id);
          else setCreating(false);
        }}
      />
    );
  }

  return (
    <Modal labelledBy="move-dialog-title" onCancel={onCancel}>
      <div className={confirmStyles.card}>
        <h2 id="move-dialog-title" className={confirmStyles.title}>
          {t.moveTitle(formatItemCount(items.length))}
        </h2>
        {targets.length > 8 && (
          <label className={styles.field}>
            <span className="visually-hidden">{t.find}</span>
            <input
              type="search"
              placeholder={t.find}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        )}
        <ul className={styles.targets} aria-label={t.targets}>
          {shown.map((target) => {
            const here = allIn(target.id);
            return (
              <li key={target.id}>
                <button
                  type="button"
                  className={styles.target}
                  disabled={here || !edits.usable}
                  onClick={() => void moveTo(target.id)}
                >
                  <span className={styles.targetName}>{target.path.at(-1)}</span>
                  <span className={styles.targetPath}>
                    {here ? t.here : target.path.slice(0, -1).join(' › ')}
                  </span>
                </button>
              </li>
            );
          })}
          {shown.length === 0 && <li className={common.muted}>{t.none}</li>}
        </ul>
        <div className={confirmStyles.actions}>
          <button type="button" className={common.buttonSoft} onClick={onCancel}>
            {t.cancel}
          </button>
          {newParent && (
            <button
              type="button"
              className={common.button}
              disabled={!edits.usable}
              onClick={() => setCreating(true)}
            >
              {t.newAlbum}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
