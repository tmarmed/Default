import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { GOOGLE_AUTH, GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID } from './config';

if (GOOGLE_AUTH) {
  GoogleSignin.configure({
    // L'idToken est émis pour l'ID client « Web » : c'est lui que vérifie le script.
    webClientId: GOOGLE_WEB_CLIENT_ID,
    ...(GOOGLE_IOS_CLIENT_ID ? { iosClientId: GOOGLE_IOS_CLIENT_ID } : {}),
  });
}

/** Compte déjà connecté sur ce téléphone, sans rien demander (au démarrage). */
export async function restoreSession(): Promise<string | null> {
  try {
    const res = await GoogleSignin.signInSilently();
    return res.type === 'success' ? res.data.user.email : null;
  } catch {
    return null;
  }
}

/** Fenêtre de connexion Google. Renvoie l'e-mail, ou null si l'utilisateur a annulé. */
export async function signIn(): Promise<string | null> {
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
    await GoogleSignin.signOut();
  } catch {
    // Déjà déconnecté.
  }
}

/**
 * Preuve d'identité Google à joindre à chaque appel du script.
 * Google la renouvelle tout seul (elle expire au bout d'une heure).
 */
export async function getIdToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh) {
    try {
      const { idToken } = await GoogleSignin.getTokens();
      if (idToken) return idToken;
    } catch {
      // Pas de session en mémoire : on passe par signInSilently.
    }
  }
  const res = await GoogleSignin.signInSilently();
  if (res.type === 'success' && res.data.idToken) return res.data.idToken;
  throw new AuthError('Session Google terminée : reconnectez-vous.');
}

/** Erreur de connexion : l'application renvoie alors vers l'écran de connexion. */
export class AuthError extends Error {}
