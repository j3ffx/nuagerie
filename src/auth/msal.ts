import {
  InteractionRequiredAuthError,
  PublicClientApplication,
  type AccountInfo,
} from '@azure/msal-browser';

/**
 * Microsoft sign-in (personal accounts only), authorization code flow + PKCE.
 * The scopes are read-only on purpose (CLAUDE.md → Invariants): never add a
 * write scope here.
 */
export const GRAPH_SCOPES = ['Files.Read', 'User.Read'];

/** Route of the redirect bridge page required by MSAL v5 (see main.tsx). */
export const REDIRECT_PATH = '/redirect';

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
      // localStorage keeps the session across restarts of the installed app.
      cache: { cacheLocation: 'localStorage' },
    });
  }
  return instance;
}

/** Initializes MSAL, completes a pending redirect and returns the signed-in account. */
export async function initAuth(): Promise<AccountInfo | null> {
  const msal = getMsal();
  await msal.initialize();
  const result = await msal.handleRedirectPromise();
  const account = result?.account ?? msal.getActiveAccount() ?? msal.getAllAccounts()[0] ?? null;
  if (account) msal.setActiveAccount(account);
  return account;
}

export function signIn(): Promise<void> {
  return getMsal().loginRedirect({ scopes: GRAPH_SCOPES, prompt: 'select_account' });
}

export function signOut(): Promise<void> {
  const msal = getMsal();
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
