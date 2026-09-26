import { DEMO } from './demo';

/**
 * Connexion Google directe (projet Google Cloud « Mes taches ») : l'application lit et écrit elle-même les
 * Google Sheets des espaces. L'ID client n'est pas secret ; il peut être remplacé à la compilation
 * (EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID).
 */
export const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '395045425554-bf52efnae8jja0r6st01tk6v0h5mmrhc.apps.googleusercontent.com';
export const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';

/** Accès demandés : seulement les fichiers créés ou ouverts par l'application, et l'adresse e-mail du compte */
export const GOOGLE_SCOPES = ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/userinfo.email'];

/** Version publiée (commit), pour vérifier ce qu'affiche le navigateur */
export const VERSION = process.env.EXPO_PUBLIC_VERSION || 'locale';

/** Connexion Google (hors démo) */
export const GOOGLE_AUTH = !DEMO;
