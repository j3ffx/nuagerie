import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import common from './common.module.css';
import { ConfirmContext, type Confirm, type ConfirmOptions } from './confirmContext.ts';
import styles from './confirm.module.css';

interface Pending extends ConfirmOptions {
  resolve: (answer: boolean) => void;
}

/**
 * Hosts the confirmation dialog of the screens below it. A native modal
 * <dialog>: the rest of the page is inert, focus starts on "Annuler" (the
 * safe answer), and Escape or Android's back gesture cancel.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);

  const confirm = useCallback<Confirm>(
    (options) =>
      new Promise<boolean>((resolve) => {
        setPending((previous) => {
          previous?.resolve(false);
          return { ...options, resolve };
        });
      }),
    [],
  );

  const answer = (value: boolean) => {
    pending?.resolve(value);
    setPending(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && <ConfirmDialog options={pending} onAnswer={answer} />}
    </ConfirmContext.Provider>
  );
}

function ConfirmDialog({
  options,
  onAnswer,
}: {
  options: ConfirmOptions;
  onAnswer: (value: boolean) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby="confirm-title"
      aria-describedby={options.message ? 'confirm-message' : undefined}
      // Escape, Android's back gesture: the safe answer.
      onCancel={(event) => {
        event.preventDefault();
        onAnswer(false);
      }}
      // A tap on the dimmed backdrop (outside the card) cancels too.
      onClick={(event) => {
        if (event.target === ref.current) onAnswer(false);
      }}
    >
      <div className={styles.card}>
        <h2 id="confirm-title" className={styles.title}>
          {options.title}
        </h2>
        {options.message && (
          <p id="confirm-message" className={styles.message}>
            {options.message}
          </p>
        )}
        <div className={styles.actions}>
          <button
            type="button"
            className={common.buttonSoft}
            onClick={() => onAnswer(false)}
            autoFocus
          >
            {options.cancelLabel ?? 'Annuler'}
          </button>
          <button
            type="button"
            className={`${common.button} ${options.danger ? styles.danger : ''}`}
            onClick={() => onAnswer(true)}
          >
            {options.confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
