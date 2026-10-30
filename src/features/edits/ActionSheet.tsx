import { useEffect, useRef, type ComponentType, type SVGProps } from 'react';
import { localized } from '../../lib/i18n.ts';
import menu from '../albums/AlbumMenu.module.css';

const t = localized({ fr: { cancel: 'Annuler' }, en: { cancel: 'Cancel' } });

export interface SheetAction {
  label: string;
  note?: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  onSelect: () => void;
  disabled?: boolean;
}

/**
 * A short list of actions over the screen, like an album's menu: a native
 * modal dialog that Escape, Android's back gesture or a tap beside it closes.
 */
export function ActionSheet({
  title,
  actions,
  onClose,
}: {
  title: string;
  actions: readonly SheetAction[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const pressedBeside = useRef(false);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      className={menu.dialog}
      aria-labelledby="action-sheet-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onPointerDown={(event) => {
        pressedBeside.current = event.target === ref.current;
      }}
      onClick={(event) => {
        if (event.target === ref.current && pressedBeside.current) onClose();
      }}
    >
      <div className={menu.sheet}>
        <h2 id="action-sheet-title" className={menu.title}>
          {title}
        </h2>
        <div className={menu.items}>
          {actions.map(({ label, note, icon: Icon, onSelect, disabled }) => (
            <button
              key={label}
              type="button"
              className={menu.item}
              disabled={disabled}
              onClick={() => {
                onClose();
                onSelect();
              }}
            >
              <Icon className={menu.icon} />
              <span className={menu.text}>
                {label}
                {note && <span className={menu.note}>{note}</span>}
              </span>
            </button>
          ))}
        </div>
        <button type="button" className={menu.cancel} onClick={onClose} autoFocus>
          {t.cancel}
        </button>
      </div>
    </dialog>
  );
}
