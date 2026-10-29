import { useEffect } from 'react';
import { useSync } from '../../data/sync/syncContext.ts';
import { useConfirm } from '../../ui/confirmContext.ts';
import { localized } from '../../lib/i18n.ts';

const t = localized({
  fr: { title: 'Synchronisation non activée', retry: 'Réessayer', close: 'Fermer' },
  en: { title: 'Sync not turned on', retry: 'Try again', close: 'Close' },
});

/**
 * Back from Microsoft's page without the permission (or the sync could not
 * start): says so in the app's dialog, which shows above any screen, the
 * viewer included, and offers to try again.
 */
export function SyncNotice() {
  const { notice, dismissNotice } = useSync();
  const confirm = useConfirm();

  useEffect(() => {
    if (!notice) return;
    let active = true;
    void confirm({
      title: t.title,
      message: notice,
      confirmLabel: t.retry,
      cancelLabel: t.close,
    }).then((retry) => {
      if (active) dismissNotice(retry);
    });
    return () => {
      active = false;
    };
  }, [notice, confirm, dismissNotice]);

  return null;
}
