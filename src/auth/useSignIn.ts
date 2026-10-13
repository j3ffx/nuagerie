import { useCallback, useState } from 'react';
import { microsoftReachable, signIn, startedUnreachable } from './msal.ts';

/** Said when Microsoft does not answer on this network (a plane's Wi-Fi, a portal). */
export const UNREACHABLE_MESSAGE = 'Microsoft ne répond pas sur ce réseau.';

/**
 * "Se connecter", wherever it is: Microsoft's page only if Microsoft answers,
 * as on a network that lets nothing through it would never load. Otherwise
 * the user stays put and is told why (`unreachable`); a new tap checks again.
 */
export function useSignIn() {
  const [checking, setChecking] = useState(false);
  // Started without Microsoft: say so from the start.
  const [unreachable, setUnreachable] = useState(startedUnreachable);

  const start = useCallback(async () => {
    setChecking(true);
    const reachable = await microsoftReachable();
    setChecking(false);
    setUnreachable(!reachable);
    if (reachable) await signIn();
  }, []);

  /** The network changed: what was said about it no longer holds. */
  const forget = useCallback(() => setUnreachable(false), []);

  return { start, checking, unreachable, forget };
}
