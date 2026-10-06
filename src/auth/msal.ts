import {
  InteractionRequiredAuthError,
  PublicClientApplication,
  type AccountInfo,
} from '@azure/msal-browser';
import { readPersistent, removePersistent, writePersistent } from '../lib/persistent.ts';

/**
 * Microsoft sign-in (personal accounts only), authorization code flow + PKCE.
 * The scopes are read-only on purpose (CLAUDE.md → Invariants): never add a
 * write scope here.
 */
export const GRAPH_SCOPES = ['Files.Read', 'User.Read'];

/** Route of the redirect bridge page required by MSAL v5 (see main.tsx). */
export const REDIRECT_PATH = '/redirect';

/** Account name of the last session on this device, to sign in again without asking. */
const LOGIN_HINT_KEY = 'loginHint';

let instance: PublicClientApplication | null = null;

export function getMsal(): PublicClientApplication {
  if (!instance) {
    const clientId = import.meta.env.VITE_MSAL_CLIENT_ID;
    if (!clientId) throw new Error('VITE_MSAL_CLIENT_ID is not configured');
    instance = new PublicClientApplication({
      auth: {
        clientId,
        authority: 'https://login.microsoftonline.com/consumers',
        redirectUri: `${window.location.origin}${REDIRECT_PATH}`,
        postLogoutRedirectUri: `${window.location.origin}/`,
      },
      // localStorage keeps the account across restarts of the installed app. MSAL
      // encrypts the tokens with a key held in a session cookie, though: once
      // the browser session ends (Android closes an idle app), they are lost,
      // and initAuth() signs in again silently.
      cache: { cacheLocation: 'localStorage' },
      // A silent sign-in that cannot finish (Microsoft wants the user) gives up
      // sooner than the default 10 s, so the sign-in screen shows quickly.
      system: { iframeBridgeTimeout: 6000 },
    });
  }
  return instance;
}

/** Initializes MSAL, completes a pending redirect and returns the signed-in account. */
export async function initAuth(): Promise<AccountInfo | null> {
  const msal = getMsal();
  await msal.initialize();
  const result = await msal.handleRedirectPromise();
  const account =
    result?.account ??
    msal.getActiveAccount() ??
    msal.getAllAccounts()[0] ??
    (await signInSilently(msal));
  if (account) {
    msal.setActiveAccount(account);
    writePersistent(LOGIN_HINT_KEY, account.username);
  }
  return account;
}

/**
 * The previous session's tokens are gone, but Microsoft's own session usually
 * is not: a hidden sign-in with the last account name needs no screen.
 */
async function signInSilently(msal: PublicClientApplication): Promise<AccountInfo | null> {
  const loginHint = readPersistent<string | null>(LOGIN_HINT_KEY, null);
  if (!loginHint) return null;
  try {
    return (await msal.ssoSilent({ scopes: GRAPH_SCOPES, loginHint })).account;
  } catch {
    return null; // Microsoft wants the user: the sign-in screen is shown.
  }
}

export function signIn(): Promise<void> {
  const loginHint = readPersistent<string | null>(LOGIN_HINT_KEY, null);
  // The same account as last time goes straight through; otherwise, let the user pick.
  return getMsal().loginRedirect(
    loginHint
      ? { scopes: GRAPH_SCOPES, loginHint }
      : { scopes: GRAPH_SCOPES, prompt: 'select_account' },
  );
}

export function signOut(): Promise<void> {
  const msal = getMsal();
  // Signing out on purpose: no silent sign-in next time.
  removePersistent(LOGIN_HINT_KEY);
  return msal.logoutRedirect({ account: msal.getActiveAccount() });
}

export class NotSignedInError extends Error {
  constructor() {
    super('Not signed in');
    this.name = 'NotSignedInError';
  }
}

/** Access token for Graph; silently refreshed, or a redirect to sign in again when needed. */
export async function getAccessToken(): Promise<string> {
  const msal = getMsal();
  const account = msal.getActiveAccount();
  if (!account) throw new NotSignedInError();
  try {
    const result = await msal.acquireTokenSilent({ scopes: GRAPH_SCOPES, account });
    return result.accessToken;
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
      await msal.acquireTokenRedirect({ scopes: GRAPH_SCOPES, account });
    }
    throw error;
  }
}
