import {
  CacheLookupPolicy,
  InteractionRequiredAuthError,
  PublicClientApplication,
  type AccountInfo,
  type AuthenticationResult,
} from '@azure/msal-browser';
import { isOnline } from '../lib/online.ts';
import { readPersistent, removePersistent, writePersistent } from '../lib/persistent.ts';

/**
 * Microsoft sign-in (personal accounts only), authorization code flow + PKCE.
 * The scopes are read-only on purpose (CLAUDE.md → Invariants): never add a
 * write scope here.
 */
export const GRAPH_SCOPES = ['Files.Read', 'User.Read'];

/**
 * Opt-in, asked for only when the user turns on the sync of favourites
 * (Réglages): write access to the app's own folder, Apps/Nuagerie, and
 * nowhere else. Never requested at sign-in.
 */
export const SYNC_SCOPE = 'Files.ReadWrite.AppFolder';

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

/**
 * Initializes MSAL, completes a pending redirect and returns the signed-in
 * account. Offline, only an account still in the local cache counts: signing
 * in again needs Microsoft, so the app starts without an account and shows
 * the index kept on the device.
 */
export async function initAuth(): Promise<AccountInfo | null> {
  const msal = getMsal();
  await msal.initialize();
  let result: AuthenticationResult | null = null;
  try {
    result = await msal.handleRedirectPromise();
  } catch (error) {
    // Back from Microsoft's page without what was asked (e.g. the sync
    // permission declined): still signed in when an account is known.
    if (!msal.getActiveAccount() && msal.getAllAccounts().length === 0) throw error;
  }
  const cached = result?.account ?? msal.getActiveAccount() ?? msal.getAllAccounts()[0] ?? null;
  if (!cached && !isOnline()) return null;
  const account = cached ?? (await signInSilently(msal));
  if (account) {
    msal.setActiveAccount(account);
    writePersistent(LOGIN_HINT_KEY, account.username);
    sessionStorage.removeItem(AUTO_SIGN_IN_KEY);
    return account;
  }
  await signInAgain();
  return null;
}

/** Signed in on this device before, and not signed out since. */
export function hasSignedInBefore(): boolean {
  return readPersistent<string | null>(LOGIN_HINT_KEY, null) !== null;
}

/** Set while an automatic sign-in redirect is under way, so a failed one is not repeated. */
const AUTO_SIGN_IN_KEY = 'nuagerie.autoSignIn';

/**
 * Signed in before and never signed out: go back through Microsoft's page,
 * which lets a known account straight through (what tapping "Se connecter"
 * did). Only once per session: if Microsoft sends the user back without an
 * account, the sign-in screen is shown instead of looping.
 */
async function signInAgain(): Promise<void> {
  const loginHint = readPersistent<string | null>(LOGIN_HINT_KEY, null);
  if (!loginHint || sessionStorage.getItem(AUTO_SIGN_IN_KEY)) return;
  sessionStorage.setItem(AUTO_SIGN_IN_KEY, '1');
  await getMsal().loginRedirect({ scopes: GRAPH_SCOPES, loginHint });
  // The page is leaving for Microsoft: keep the connecting screen until then.
  await new Promise(() => undefined);
}

/**
 * The previous session's tokens are gone, but Microsoft's own session usually
 * is not: a hidden sign-in with the last account name needs no screen. It
 * runs in an iframe, where browsers that partition third-party cookies (as on
 * the phone) hide that session; signInAgain() then takes over.
 */
async function signInSilently(msal: PublicClientApplication): Promise<AccountInfo | null> {
  const loginHint = readPersistent<string | null>(LOGIN_HINT_KEY, null);
  // Failed before on this device: don't wait for it again, redirect at once.
  if (!loginHint || !readPersistent(SILENT_SIGN_IN_KEY, true)) return null;
  try {
    return (await msal.ssoSilent({ scopes: GRAPH_SCOPES, loginHint })).account;
  } catch {
    writePersistent(SILENT_SIGN_IN_KEY, false);
    return null;
  }
}

/**
 * Whether the hidden sign-in can work in this browser (false once it failed).
 * Renamed when the site stopped refusing to be framed by itself, which made it
 * fail everywhere: each device tries again once.
 */
const SILENT_SIGN_IN_KEY = 'silentSignIn.v2';

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
    // Offline, Microsoft's page cannot load: keep the app (and its local index) on screen.
    if (error instanceof InteractionRequiredAuthError && isOnline()) {
      await msal.acquireTokenRedirect({ scopes: GRAPH_SCOPES, account });
    }
    throw error;
  }
}

/** The user has not (or no longer) granted the sync permission: asking is theirs to do. */
export class SyncPermissionMissing extends Error {
  constructor() {
    super('The sync permission is not granted');
    this.name = 'SyncPermissionMissing';
  }
}

/**
 * A token allowing the sync, without ever sending the user to Microsoft's page.
 * `deviceOnly` uses only the tokens kept on the device, never MSAL's hidden
 * iframe: quick to say no, when asking Microsoft is the next step anyway.
 */
export async function getSyncToken({ deviceOnly = false } = {}): Promise<string> {
  const msal = getMsal();
  const account = msal.getActiveAccount();
  if (!account) throw new NotSignedInError();
  try {
    return (
      await msal.acquireTokenSilent({
        scopes: [SYNC_SCOPE],
        account,
        ...(deviceOnly ? { cacheLookupPolicy: CacheLookupPolicy.AccessTokenAndRefreshToken } : {}),
      })
    ).accessToken;
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) throw new SyncPermissionMissing();
    throw error;
  }
}

/** Asks Microsoft for the sync permission (the page shows what it allows); comes back to `returnTo`. */
export function requestSyncPermission(): Promise<void> {
  const msal = getMsal();
  const account = msal.getActiveAccount() ?? undefined;
  return msal.acquireTokenRedirect({
    scopes: [...GRAPH_SCOPES, SYNC_SCOPE],
    ...(account ? { account } : {}),
  });
}

/** The permissions Microsoft has granted the app, as its tokens state them. */
export async function grantedScopes(): Promise<string[]> {
  const msal = getMsal();
  const account = msal.getActiveAccount();
  if (!account) return [];
  // Fresh from Microsoft when online: a cached token may predate a grant or a withdrawal.
  const result = await msal.acquireTokenSilent({
    scopes: GRAPH_SCOPES,
    account,
    forceRefresh: isOnline(),
  });
  return result.scopes;
}

/** Where the user can see and withdraw what they granted the app, on Microsoft's side. */
export const MANAGE_CONSENT_URL = 'https://account.live.com/consent/Manage';
