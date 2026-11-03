interface GoogleIdentity {
  accounts: {
    id: {
      initialize: (config: { client_id: string; callback: (response: { credential: string }) => void; ux_mode?: string }) => void;
      renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
    };
    oauth2: {
      initTokenClient: (config: {
        client_id: string;
        scope: string;
        callback: (response: { access_token?: string; error?: string }) => void;
        error_callback?: () => void;
      }) => { requestAccessToken: (options?: { prompt?: string }) => void };
    };
  };
}
declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
let scriptPromise: Promise<void> | null = null;
export function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const el = document.createElement('script');
    el.src = SCRIPT_SRC;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => {
      scriptPromise = null;
      reject(new Error('google-script'));
    };
    document.head.appendChild(el);
  });
  return scriptPromise;
}


/**
 * Bitta ruxsat oynasida profil (ism, email, rasm) va — sozlangan bo‘lsa — telefon raqamiga ruxsat so‘raydi.
 * Access token serverga yuboriladi; server Google'dan hamma ma'lumotni o‘zi oladi.
 */
export function requestGoogleAccessToken(clientId: string, withPhone: boolean): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!window.google?.accounts.oauth2) return reject(new Error('google-oauth'));
    const scope = ['openid', 'email', 'profile', ...(withPhone ? ['https://www.googleapis.com/auth/user.phonenumbers.read'] : [])].join(' ');
    window.google.accounts.oauth2
      .initTokenClient({
        client_id: clientId,
        scope,
        callback: (response) => (response.access_token ? resolve(response.access_token) : reject(new Error(response.error ?? 'google-oauth'))),
        error_callback: () => reject(new Error('google-oauth')),
      })
      .requestAccessToken();
  });
}
