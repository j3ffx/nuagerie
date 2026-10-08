import { useEffect } from 'react';
import { useSync } from '../../data/sync/syncContext.ts';
import { useConfirm } from '../../ui/confirmContext.ts';

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
      title: 'Favoris non activés',
      message: notice,
      confirmLabel: 'Réessayer',
      cancelLabel: 'Fermer',
    }).then((retry) => {
      if (active) dismissNotice(retry);
    });
    return () => {
      active = false;
    };
  }, [notice, confirm, dismissNotice]);

  return null;
}
