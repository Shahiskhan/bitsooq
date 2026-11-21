const FIREBASE_API_KEY = import.meta.env.VITE_FIREBASE_API_KEY ?? '';
const TOKEN_KEY = 'bitsooq.token';
const REFRESH_KEY = 'bitsooq.refreshToken';
const EXPIRY_KEY = 'bitsooq.tokenExpiry';
const USER_KEY = 'bitsooq.user';

interface FirebaseAuthResponse {
  localId?: string;
  user_id?: string;
  email?: string;
  displayName?: string;
  idToken: string;
  refreshToken: string;
  expiresIn: string;
  id_token?: string;
  refresh_token?: string;
  expires_in?: string;
  user_id?: string;
  localId?: string;
  error?: { message?: string };
}
let refreshTask: Promise<string | null> | null = null;

export class AuthError extends Error {
  constructor(message: string) { super(message); this.name = 'AuthError'; }
}

async function firebaseRequest(url: string, init: RequestInit): Promise<FirebaseAuthResponse> {
  if (!FIREBASE_API_KEY) throw new AuthError('Firebase client API key is not configured. Set VITE_FIREBASE_API_KEY and restart the frontend.');
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({})) as FirebaseAuthResponse;
  if (!response.ok) {
    const message = body.error?.message ?? 'Authentication service is unavailable.';
    const friendly: Record<string, string> = {
      EMAIL_NOT_FOUND: 'No account was found for that email.',
      INVALID_LOGIN_CREDENTIALS: 'Email or password is incorrect.',
      INVALID_PASSWORD: 'Email or password is incorrect.',
      USER_DISABLED: 'This account is disabled. Contact your administrator.',
      TOO_MANY_ATTEMPTS_TRY_LATER: 'Too many attempts. Wait a while and try again.',
      OPERATION_NOT_ALLOWED: 'Email and password sign-in is not enabled for this Firebase project.',
      TOKEN_EXPIRED: 'Your session expired. Sign in again.',
      INVALID_REFRESH_TOKEN: 'Your session expired. Sign in again.',
    };
    throw new AuthError(friendly[message] ?? 'Could not sign in. Check the email, password and Firebase configuration.');
  }
  return { ...body, idToken: body.idToken ?? body.id_token!, refreshToken: body.refreshToken ?? body.refresh_token!, expiresIn: body.expiresIn ?? body.expires_in! };
}

function storeSession(session: FirebaseAuthResponse) {
  sessionStorage.setItem(TOKEN_KEY, session.idToken);
  sessionStorage.setItem(REFRESH_KEY, session.refreshToken);
  sessionStorage.setItem(EXPIRY_KEY, String(Date.now() + Number(session.expiresIn) * 1000));
  if (session.email || session.displayName || session.localId || session.user_id) {
    sessionStorage.setItem(USER_KEY, JSON.stringify({ email: session.email, displayName: session.displayName, uid: session.localId ?? session.user_id }));
  }
}

export async function signInWithEmailPassword(email: string, password: string): Promise<void> {
  const session = await firebaseRequest(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(FIREBASE_API_KEY)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  storeSession(session);
}

export async function getFirebaseAccessToken(): Promise<string | null> {
  const current = sessionStorage.getItem(TOKEN_KEY);
  if (!current) return null;
  const expiry = Number(sessionStorage.getItem(EXPIRY_KEY) ?? 0);
  if (expiry > Date.now() + 60_000) return current;
  const refreshToken = sessionStorage.getItem(REFRESH_KEY);
  if (!refreshToken) { signOut(); return null; }
  if (!refreshTask) {
    refreshTask = (async () => {
      const form = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken });
      const refreshed = await firebaseRequest(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(FIREBASE_API_KEY)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString(),
      });
      storeSession(refreshed);
      return refreshed.idToken;
    })().finally(() => { refreshTask = null; });
  }
  return refreshTask;
}

export function signedInUser(): { uid?: string; email?: string; displayName?: string } | null {
  try { return JSON.parse(sessionStorage.getItem(USER_KEY) ?? 'null') as { uid?: string; email?: string; displayName?: string } | null; }
  catch { return null; }
}

export function signOut() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
  sessionStorage.removeItem(EXPIRY_KEY);
  sessionStorage.removeItem(USER_KEY);
}
