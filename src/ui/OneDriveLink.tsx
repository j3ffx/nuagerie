import { useEffect, useState, type ReactNode } from 'react';
import { useData } from '../data/dataContext.ts';
import { useOnline } from '../lib/online.ts';

/**
 * A file or folder (by id) on OneDrive's website, in a new tab (the OneDrive
 * app on a phone, when installed). Its address is asked for as soon as the
 * link shows, so the tap opens it at once. Nothing in the demo.
 */
export function OneDriveLink({
  id,
  className,
  children,
}: {
  id: string;
  className?: string | undefined;
  /** What goes before the words (an icon), when the link is a menu item. */
  children?: ReactNode;
}) {
  const { source } = useData();
  const online = useOnline();
  const [found, setFound] = useState<{ id: string; url: string | null } | null>(null);
  const available = source.getWebUrl !== undefined;

  useEffect(() => {
    if (!source.getWebUrl || !online) return;
    let cancelled = false;
    source.getWebUrl(id).then(
      (url) => {
        if (!cancelled) setFound({ id, url });
      },
      () => {
        if (!cancelled) setFound({ id, url: null });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [id, online, source]);

  if (!available) return null;
  const url = found?.id === id ? found.url : null;
  return url && online ? (
    <a className={className} href={url} target="_blank" rel="noopener noreferrer">
      {children}
      <span>Ouvrir dans OneDrive</span>
    </a>
  ) : (
    <span className={className} aria-disabled="true" data-disabled="">
      {children}
      <span>{online ? 'Ouvrir dans OneDrive…' : 'Ouvrir dans OneDrive (hors connexion)'}</span>
    </span>
  );
}
