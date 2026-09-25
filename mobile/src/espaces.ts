import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext } from 'react';

/**
 * Espaces : chaque espace est un Google Sheet, d'un type choisi à sa création.
 * - Moi : l'espace personnel (un seul, jamais partagé ; rendez-vous, appels et démarches y sont toujours) ;
 * - Équipe : une équipe indépendante ;
 * - Entreprise : une entreprise (qui contient ses propres équipes).
 * Un filtre en haut de l'application choisit les espaces affichés (un ou plusieurs).
 */
export type TypeEspace = 'moi' | 'equipe' | 'entreprise';

export interface Espace {
  id: string;
  type: TypeEspace;
  nom: string;
  /** Son Google Sheet (identifiant du fichier dans Google Drive) */
  fichier?: string;
}

export const ICONE_ESPACE: Record<TypeEspace, string> = { moi: '🔒', equipe: '👥', entreprise: '🏢' };
export const LIBELLE_ESPACE: Record<TypeEspace, string> = { moi: 'Moi', equipe: 'Équipe', entreprise: 'Entreprise' };
export const libelleEspace = (e: Pick<Espace, 'type' | 'nom'>) => (e.type === 'moi' ? 'Moi' : e.nom);

export const ESPACE_MOI: Espace = { id: 'moi', type: 'moi', nom: 'Moi' };

// ---------------------------------------------------------------------------
// Nom des fichiers : « <Nom de l'application> | Moi », « … | Équipe | Mobile », « … | Entreprise | ACME »
// ---------------------------------------------------------------------------
export const SEPARATEUR = ' | ';
const sansAccents = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/** Nom du Google Sheet d'un espace */
export function nomFichier(nomApp: string, e: Pick<Espace, 'type' | 'nom'>): string {
  return e.type === 'moi' ? `${nomApp}${SEPARATEUR}Moi` : `${nomApp}${SEPARATEUR}${LIBELLE_ESPACE[e.type]}${SEPARATEUR}${e.nom.trim()}`;
}

/**
 * Lit le nom d'un fichier : type et nom de l'espace, ou null s'il ne suit pas la règle.
 * Tolérant : majuscules, accents et espaces autour du séparateur ; `anciensNoms` = noms précédents de l'application.
 */
export function lireNomFichier(nomFichierDrive: string, nomApp: string, anciensNoms: string[] = []): { type: TypeEspace; nom: string } | null {
  const parts = nomFichierDrive.split('|').map((p) => p.trim());
  if (parts.length < 2) return null;
  if (![nomApp, ...anciensNoms].some((n) => sansAccents(n) === sansAccents(parts[0]))) return null;
  const t = sansAccents(parts[1]);
  if (t === 'moi' && parts.length === 2) return { type: 'moi', nom: 'Moi' };
  const nom = parts.slice(2).join(' | ').trim();
  if (!nom) return null;
  if (t === 'equipe') return { type: 'equipe', nom };
  if (t === 'entreprise') return { type: 'entreprise', nom };
  return null;
}

// ---------------------------------------------------------------------------
// Écrans (onglets) par type d'espace et par mode ; 5 dans la barre, les autres dans « ⋯ Plus »
// ---------------------------------------------------------------------------
export type Ecran =
  | 'taches'
  | 'iteration'
  | 'pi'
  | 'strategie'
  | 'backlog'
  | 'portefeuille'
  | 'roadmap'
  | 'equipe'
  | 'organisation'
  | 'pilotage';

/** Ordre de priorité quand plusieurs espaces sont affichés */
export const PRIORITE: Ecran[] = ['taches', 'iteration', 'pi', 'strategie', 'backlog', 'portefeuille', 'roadmap', 'equipe', 'organisation', 'pilotage'];

/** Pour chaque cas : les écrans, dans l'ordre de la barre (les 5 premiers), puis ceux de « Plus » */
export const ECRANS: Record<TypeEspace, { simple: Ecran[]; safe: Ecran[] }> = {
  moi: {
    simple: ['taches', 'roadmap'],
    safe: ['taches', 'iteration', 'pi', 'strategie', 'roadmap', 'backlog', 'portefeuille', 'pilotage'],
  },
  equipe: {
    simple: ['taches', 'roadmap', 'equipe', 'pilotage'],
    safe: ['taches', 'iteration', 'backlog', 'pi', 'equipe', 'roadmap', 'strategie', 'pilotage'],
  },
  entreprise: {
    simple: ['taches', 'roadmap', 'organisation', 'pilotage'],
    safe: ['taches', 'strategie', 'portefeuille', 'pi', 'pilotage', 'backlog', 'iteration', 'roadmap', 'organisation'],
  },
};

export const MAX_ONGLETS = 5;

/**
 * Onglets des espaces affichés : un seul type → l'ordre de ce cas ; plusieurs types → l'union, dans l'ordre
 * de priorité. Les 5 premiers vont dans la barre, les autres dans « ⋯ Plus ».
 */
export function onglets(types: TypeEspace[], safe: boolean): { barre: Ecran[]; plus: Ecran[] } {
  const distincts = [...new Set(types)];
  const liste = distincts.length === 1 ? ECRANS[distincts[0]][safe ? 'safe' : 'simple'] : PRIORITE.filter((e) => distincts.some((t) => ECRANS[t][safe ? 'safe' : 'simple'].includes(e)));
  return { barre: liste.slice(0, MAX_ONGLETS), plus: liste.slice(MAX_ONGLETS) };
}

// ---------------------------------------------------------------------------
// Liste des espaces et filtre, gardés sur l'appareil
// ---------------------------------------------------------------------------
const ESPACES_KEY = 'mes-taches:espaces';
const VISIBLES_KEY = 'mes-taches:espaces-visibles';

export async function loadEspaces(defaut: Espace[]): Promise<Espace[]> {
  try {
    const raw = await AsyncStorage.getItem(ESPACES_KEY);
    const list: Espace[] = raw ? JSON.parse(raw) : defaut;
    // « Moi » existe toujours, en premier (avec son Google Sheet s'il est connu)
    const moi = list.find((e) => e.id === 'moi');
    return [{ ...ESPACE_MOI, ...(moi?.fichier ? { fichier: moi.fichier } : {}) }, ...list.filter((e) => e.id !== 'moi')];
  } catch {
    return defaut;
  }
}
export async function saveEspaces(list: Espace[]): Promise<void> {
  await AsyncStorage.setItem(ESPACES_KEY, JSON.stringify(list)).catch(() => {});
}
/**
 * Espaces retirés de l'application (leur Google Sheet est gardé) : plus ajoutés automatiquement à la connexion,
 * rétablis depuis « ＋ Espace ».
 */
const RETIRES_KEY = 'mes-taches:espaces-retires';
export async function loadRetires(): Promise<Espace[]> {
  try {
    const v = JSON.parse((await AsyncStorage.getItem(RETIRES_KEY)) ?? '[]');
    // Ancien format : identifiants de fichiers seulement
    return Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? { id: `equipe-${x}`, type: 'equipe' as const, nom: '?', fichier: x } : x)) : [];
  } catch {
    return [];
  }
}
export async function saveRetires(v: Espace[]): Promise<void> {
  await AsyncStorage.setItem(RETIRES_KEY, JSON.stringify(v)).catch(() => {});
}

/** Démo : espaces supprimés (corbeille simulée, 30 jours) */
const SUPPRIMES_KEY = 'mes-taches:espaces-supprimes';
export type EspaceSupprime = Espace & { supprime_le: string };
export async function loadSupprimes(): Promise<EspaceSupprime[]> {
  try {
    const v = JSON.parse((await AsyncStorage.getItem(SUPPRIMES_KEY)) ?? '[]') as EspaceSupprime[];
    const limite = Date.now() - 30 * 86400000;
    return Array.isArray(v) ? v.filter((e) => new Date(e.supprime_le).getTime() > limite) : [];
  } catch {
    return [];
  }
}
export async function saveSupprimes(v: EspaceSupprime[]): Promise<void> {
  await AsyncStorage.setItem(SUPPRIMES_KEY, JSON.stringify(v)).catch(() => {});
}

export async function loadVisibles(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(VISIBLES_KEY);
    const v = raw ? JSON.parse(raw) : null;
    return Array.isArray(v) && v.length ? v : ['moi'];
  } catch {
    return ['moi'];
  }
}
export async function saveVisibles(v: string[]): Promise<void> {
  await AsyncStorage.setItem(VISIBLES_KEY, JSON.stringify(v)).catch(() => {});
}

/** Espaces connus et espaces affichés (filtre du haut) */
export interface EspacesValue {
  liste: Espace[];
  visibles: string[];
}
export const EspacesContext = createContext<EspacesValue>({ liste: [ESPACE_MOI], visibles: ['moi'] });
export const useEspaces = () => useContext(EspacesContext);
export const espaceParId = (liste: Espace[], id: string | undefined) => liste.find((e) => e.id === (id || 'moi'));
