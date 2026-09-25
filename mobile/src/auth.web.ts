import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthError } from './authError';
import { GOOGLE_SCOPES, GOOGLE_WEB_CLIENT_ID } from './config';

/**
 * Connexion Google dans le navigateur (Google Identity Services) : un jeton d'accès (1 heure) aux fichiers
 * de l'application. Le jeton est gardé sur l'appareil jusqu'à son expiration ; ensuite, un appui sur
 * « Se connecter avec Google » en redonne un (sans ressaisir le mot de passe).
 */
type Jeton = { token: string; exp: number; email: string };
type ReponseJeton = { access_token?: string; expires_in?: number; error?: string; error_description?: string };
type ClientJeton = { requestAccessToken: () => void };
type Gis = {
  accounts: {
    oauth2: {
      initTokenClient: (o: {
        client_id: string;
        scope: string;
        prompt?: string;
        login_hint?: string;
        callback: (r: ReponseJeton) => void;
        error_callback?: (e: { type?: string; message?: string }) => void;
      }) => ClientJeton;
      hasGrantedAllScopes: (r: ReponseJeton, ...scopes: string[]) => boolean;
      revoke: (token: string, done?: () => void) => void;
    };
  };
};

const KEY = 'mes-taches:google';
let jeton: Jeton | null = null;
let gis: Promise<Gis> | null = null;

function chargerGis(): Promise<Gis> {
  return (gis ??= new Promise<Gis>((resolve, reject) => {
    const w = window as unknown as { google?: Gis };
    if (w.google?.accounts?.oauth2) return resolve(w.google);
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => (w.google?.accounts?.oauth2 ? resolve(w.google) : reject(new Error('Connexion Google indisponible.')));
    s.onerror = () => {
      gis = null;
      reject(new Error('Impossible de joindre Google. Vérifiez votre réseau.'));
    };
    document.head.appendChild(s);
  }));
}

async function lireJeton(): Promise<Jeton | null> {
  if (jeton) return jeton;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    jeton = raw ? (JSON.parse(raw) as Jeton) : null;
  } catch {
    jeton = null;
  }
  return jeton;
}
const valide = (j: Jeton | null) => !!j && j.exp > Date.now() + 60_000;

/** Fenêtre Google : demande un jeton (compte proposé : `email`) */
async function demanderJeton(email?: string): Promise<{ token: string; exp: number }> {
  const g = await chargerGis();
  return new Promise((resolve, reject) => {
    const client = g.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_WEB_CLIENT_ID,
      scope: GOOGLE_SCOPES.join(' '),
      ...(email ? { login_hint: email, prompt: '' } : {}),
      callback: (r) => {
        if (r.error || !r.access_token) return reject(new Error(r.error_description || r.error || 'Connexion Google refusée.'));
        if (!g.accounts.oauth2.hasGrantedAllScopes(r, GOOGLE_SCOPES[0])) {
          return reject(new Error('Autorisez l’accès aux fichiers de l’application (case « Google Drive ») pour continuer.'));
        }
        resolve({ token: r.access_token, exp: Date.now() + (r.expires_in ?? 3600) * 1000 });
      },
      error_callback: (e) => reject(new Error(e.type === 'popup_closed' ? '' : e.message || 'Connexion Google interrompue.')),
    });
    client.requestAccessToken();
  });
}

/** Compte déjà connecté (jeton encore valable), sans rien demander */
export async function restoreSession(): Promise<string | null> {
  const j = await lireJeton();
  return valide(j) ? j!.email : null;
}

/** Dernier compte utilisé sur cet appareil (proposé à la reconnexion) */
export async function dernierCompte(): Promise<string | null> {
  return (await lireJeton())?.email ?? null;
}

/** Fenêtre de connexion Google. Renvoie l'e-mail, ou null si l'utilisateur a fermé la fenêtre. */
export async function signIn(): Promise<string | null> {
  let t: { token: string; exp: number };
  try {
    t = await demanderJeton((await lireJeton())?.email);
  } catch (e) {
    if (!(e as Error).message) return null; // fenêtre fermée
    throw e;
  }
  const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${t.token}` } });
  const info = (await r.json().catch(() => ({}))) as { email?: string };
  if (!info.email) throw new Error('Adresse e-mail du compte Google introuvable.');
  jeton = { ...t, email: info.email.toLowerCase() };
  await AsyncStorage.setItem(KEY, JSON.stringify(jeton)).catch(() => {});
  return jeton.email;
}

export async function signOut(): Promise<void> {
  const j = await lireJeton();
  jeton = null;
  await AsyncStorage.removeItem(KEY).catch(() => {});
  if (j?.token) {
    try {
      (await chargerGis()).accounts.oauth2.revoke(j.token);
    } catch {
      // Déjà révoqué.
    }
  }
}

/** Jeton d'accès aux Google Sheets ; expiré : reconnexion (la fenêtre Google demande un appui) */
export async function getAccessToken(forceRefresh = false): Promise<string> {
  const j = await lireJeton();
  if (!forceRefresh && valide(j)) return j!.token;
  throw new AuthError('Session Google expirée : reconnectez-vous (un appui suffit).');
}

export { AuthError };
