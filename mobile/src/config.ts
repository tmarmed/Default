import { Platform } from 'react-native';
import { DEMO } from './demo';

/**
 * Réglages fixés à la compilation (fichier mobile/.env, voir .env.example).
 * Quand l'URL du script et l'ID client Google sont renseignés, l'application
 * se connecte avec le compte Google : plus d'URL ni de clé à saisir.
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';
export const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';

/** Connexion Google (iPhone / Android uniquement ; la démo web n'en a pas besoin). */
export const GOOGLE_AUTH = !DEMO && Platform.OS !== 'web' && !!API_URL && !!GOOGLE_WEB_CLIENT_ID;
