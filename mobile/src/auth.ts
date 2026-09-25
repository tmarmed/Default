import { AuthError } from './authError';
import { GOOGLE_IOS_CLIENT_ID, GOOGLE_SCOPES, GOOGLE_WEB_CLIENT_ID } from './config';

/**
 * Connexion Google sur iPhone / Android (module natif). La version web est dans auth.web.ts.
 * Le module natif n'existe pas dans Expo Go : il n'est chargé qu'au premier usage.
 */
type GoogleSigninModule = typeof import('@react-native-google-signin/google-signin');
let lib: GoogleSigninModule | null = null;

function google(): GoogleSigninModule {
  if (!lib) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    lib = require('@react-native-google-signin/google-signin') as GoogleSigninModule;
    lib.GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      scopes: GOOGLE_SCOPES,
      ...(GOOGLE_IOS_CLIENT_ID ? { iosClientId: GOOGLE_IOS_CLIENT_ID } : {}),
    });
  }
  return lib;
}

/** Compte déjà connecté sur ce téléphone, sans rien demander (au démarrage). */
export async function restoreSession(): Promise<string | null> {
  try {
    const res = await google().GoogleSignin.signInSilently();
    return res.type === 'success' ? res.data.user.email : null;
  } catch {
    return null;
  }
}

/** Fenêtre de connexion Google. Renvoie l'e-mail, ou null si l'utilisateur a annulé. */
export async function signIn(): Promise<string | null> {
  const { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } = google();
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const res = await GoogleSignin.signIn();
    return isSuccessResponse(res) ? res.data.user.email : null;
  } catch (e) {
    if (isErrorWithCode(e)) {
      if (e.code === statusCodes.IN_PROGRESS) return null;
      if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new Error('Les services Google Play sont absents ou à mettre à jour sur ce téléphone.');
      }
    }
    throw new Error(`Connexion Google impossible : ${(e as Error).message}`);
  }
}

export async function signOut(): Promise<void> {
  try {
    await google().GoogleSignin.signOut();
  } catch {
    // Déjà déconnecté.
  }
}

/** Jeton d'accès aux Google Sheets (renouvelé par Google quand il expire). */
export async function getAccessToken(forceRefresh = false): Promise<string> {
  const { GoogleSignin } = google();
  try {
    if (forceRefresh) await GoogleSignin.signInSilently();
    const { accessToken } = await GoogleSignin.getTokens();
    if (accessToken) return accessToken;
  } catch {
    // Pas de session : reconnexion nécessaire
  }
  throw new AuthError('Session Google terminée : reconnectez-vous.');
}

export { AuthError };

/** Dernier compte utilisé (proposé à la reconnexion) : géré par Google sur téléphone */
export async function dernierCompte(): Promise<string | null> {
  return null;
}
