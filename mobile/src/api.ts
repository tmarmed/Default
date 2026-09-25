import { Platform } from 'react-native';
import { AuthError, getIdToken } from './auth';
import { DEMO, demoApiFor } from './demo';
import type { Data, DeletionCounts } from './hierarchy';
import {
  Domaine,
  ModeleDomaine,
  EntityKind,
  Epic,
  Feature,
  Ignoree,
  Item,
  ItemInput,
  Objectif,
  ObjectifPI,
  RECURRENCE_DEFAUTS,
  Settings,
} from './types';

type ApiResponse<T> = ({ ok: true } & T) | { ok: false; error: string; code?: string };

// Apps Script peut mettre plus de 20 s à répondre au premier appel (script « endormi »).
const TIMEOUT_MS = 60000;

async function send<T>(settings: Settings, body: object): Promise<ApiResponse<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    // Tout passe en POST : la preuve de connexion n'apparaît jamais dans l'URL.
    // Apps Script répond par une redirection vers googleusercontent.com : fetch la suit.
    res = await fetch(settings.url.trim(), {
      method: 'POST',
      // text/plain : format accepté par Apps Script sans requête préalable.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow',
      signal: controller.signal,
    });
  } catch {
    throw new Error(
      controller.signal.aborted
        ? "Le Google Sheet n'a pas répondu en 60 secondes. Réessayez ; si ça persiste, ouvrez l'URL du script dans un onglet pour voir son message."
        : Platform.OS === 'web'
          ? "Le script n'a pas renvoyé de réponse lisible. Vérifiez le déploiement (Qui a accès : Tout le monde, nouvelle version déployée) et ouvrez l'URL dans un onglet pour voir son message."
          : 'Pas de connexion au Google Sheet. Vérifiez votre réseau.',
    );
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    // Page HTML = mauvaise URL ou déploiement non accessible à « Tout le monde ».
    throw new Error("Réponse inattendue du serveur. Vérifiez l'URL et le déploiement du script.");
  }
}

async function post<T>(settings: Settings, body: object): Promise<T> {
  if (!settings.googleEmail) {
    const data = await send<T>(settings, { ...body, key: settings.key });
    if (!data.ok) throw new Error(data.error);
    return data;
  }
  let data = await send<T>(settings, { ...body, idToken: await getIdToken() });
  if (!data.ok && data.code === 'auth') {
    // Jeton refusé (souvent expiré) : on le renouvelle et on réessaie une fois.
    data = await send<T>(settings, { ...body, idToken: await getIdToken(true) });
  }
  if (!data.ok) throw data.code === 'auth' ? new AuthError(data.error) : new Error(data.error);
  return data;
}

// ---------------------------------------------------------------------------
// Espaces : chaque espace est un Google Sheet. Chaque élément chargé est marqué de son espace (champ
// `espace`) et chaque écriture part vers le Sheet de son espace ; une création va vers l'espace indiqué
// (sinon l'espace par défaut). Pas de lien entre deux espaces.
// ---------------------------------------------------------------------------
const configs = new Map<string, Settings>();
const origine = new Map<string, string>();
let espaceParDefaut = 'moi';

/** Connexions des espaces (Moi = la connexion principale) et espace des nouvelles créations sans espace précisé */
export function definirEspaces(list: { id: string; settings: Settings }[], parDefaut = 'moi') {
  configs.clear();
  for (const e of list) configs.set(e.id, e.settings);
  espaceParDefaut = parDefaut;
}
export function definirEspaceParDefaut(id: string) {
  espaceParDefaut = id;
}
/** Retient l'espace d'éléments venus de la copie locale (hors connexion) */
export function retenirEspaces(list: { id: string; espace?: string }[]) {
  for (const x of list) if (x.espace) origine.set(x.id, x.espace);
}
/** Espace d'un élément déjà chargé */
export const espaceDe = (id: string | undefined) => (id ? origine.get(id) : undefined);

const route = (settings: Settings, espace: string | undefined) => {
  const e = espace || espaceParDefaut;
  return { e, s: configs.get(e) ?? settings };
};
function marquer<T extends { id: string }>(x: T, espace: string): T & { espace: string } {
  origine.set(x.id, espace);
  return { ...x, espace };
}
const LIENS_ITEM = ['parent', 'feature', 'epic', 'objectif', 'domaine'] as const;
/** Espace d'un rattachement (le premier trouvé) */
const espaceDesLiens = (data: Record<string, unknown>, champs: readonly string[]) =>
  champs.map((k) => (typeof data[k] === 'string' ? origine.get(data[k] as string) : undefined)).find(Boolean);
const LIENS_ENTITE = ['epic', 'objectif', 'domaine'] as const;
/** Pas de lien vers un élément d'un autre espace */
function verifierLiens(espace: string, data: Record<string, unknown>, champs: readonly string[]) {
  for (const k of champs) {
    const v = data[k];
    const autre = typeof v === 'string' && v ? origine.get(v) : undefined;
    if (autre && autre !== espace) throw new Error('Rattachement impossible : cet élément est dans un autre espace.');
  }
}

export async function ping(settings: Settings): Promise<void> {
  if (DEMO) return;
  await post(settings, { action: 'ping' });
}

/** Version du script à partir de laquelle la répétition est enregistrée. */
export const API_VERSION_REPETITION = 2;
/** Version du script à partir de laquelle les epics sont enregistrées. */
export const API_VERSION_EPICS = 3;

/** Complète les éléments venant d'un ancien script (sans colonnes de répétition). */
export function normalize(item: Item): Item {
  return { ...RECURRENCE_DEFAUTS, ...item };
}

/** Version du script avec domaines, objectifs et suppression en cascade. */
export const API_VERSION_HIERARCHIE = 4;
/** Version du script avec features, objectifs du PI, points, itérations et état des epics. */
export const API_VERSION_SAFE = 5;
/** Version du script avec le domaine des objectifs du PI. */
export const API_VERSION_DOMAINE_PI = 6;
/** Version du script avec les nouveaux types (appel, démarche, story, exploration, bug) et le téléphone. */
export const API_VERSION_TYPES = 7;
/** Version du script avec les sous-tâches (colonne parent). */
export const API_VERSION_SOUS_TACHES = 8;
/** Version du script avec l'heure de fin des rendez-vous. */
export const API_VERSION_HEURE_FIN = 9;
/** Version du script avec les alertes ignorées (onglet Ignorees). */
export const API_VERSION_IGNOREES = 10;
/** Version du script avec l'epic des objectifs du PI. */
export const API_VERSION_EPIC_PI = 11;
/** Version du script avec la date de fin des démarches. */
export const API_VERSION_DATE_FIN = 12;
/** Version du script qui note le jour où une tâche est terminée. */
export const API_VERSION_TERMINE_LE = 13;
/** Version du script qui garde le statut d'avant « Terminé ». */
export const API_VERSION_STATUT_AVANT = 14;
/** Version du script avec les sous-domaines. */
export const API_VERSION_SOUS_DOMAINES = 15;
/** Version du script qui supprime les sous-domaines avec leur domaine (cascade) ou les libère. */
export const API_VERSION_SUPPR_SOUS_DOMAINES = 16;

const normalizeDomaine = (d: Domaine): Domaine => ({ ...d, parent: d.parent ?? '' });

const normalizeEpic = (e: Epic): Epic => ({ ...e, objectif: e.objectif ?? '', domaine: e.domaine ?? '', etat: e.etat ?? '' });

/** Charge un espace (par défaut : Moi) ; chaque élément est marqué de son espace. */
export async function listItems(settings: Settings, espace = 'moi'): Promise<Data & { version: number }> {
  const { s } = route(settings, espace);
  const m = <T extends { id: string }>(l: T[]) => l.map((x) => marquer(x, espace));
  if (DEMO) {
    const d = demoApiFor(espace);
    const all = await d.listAll();
    return {
      items: m((await d.list()).map(normalize)),
      epics: m(all.epics),
      objectifs: m(all.objectifs),
      domaines: m(all.domaines.map(normalizeDomaine)),
      features: m(all.features),
      objectifsPI: m(all.objectifsPI),
      ignorees: m(all.ignorees ?? []),
      version: API_VERSION_SUPPR_SOUS_DOMAINES,
    };
  }
  const data = await post<Partial<Data> & { items: Item[]; version?: number }>(s, { action: 'list' });
  return {
    items: m(data.items.map(normalize)),
    epics: m((data.epics ?? []).map(normalizeEpic)),
    objectifs: m(data.objectifs ?? []),
    domaines: m((data.domaines ?? []).map(normalizeDomaine)),
    features: m(data.features ?? []),
    objectifsPI: m((data.objectifsPI ?? []).map((o) => ({ ...o, domaine: o.domaine ?? '', epic: o.epic ?? '' }))),
    ignorees: m(data.ignorees ?? []),
    version: data.version ?? 1,
  };
}

type EntityMap = { epic: Epic; objectif: Objectif; domaine: Domaine; feature: Feature; objectifpi: ObjectifPI; ignoree: Ignoree };

export async function createEntity<K extends EntityKind>(
  settings: Settings,
  kind: K,
  data: Omit<EntityMap[K], 'id' | 'cree_le' | 'modifie_le'>,
): Promise<EntityMap[K]> {
  // Les alertes ignorées sont personnelles : toujours dans l'espace Moi
  const { e, s } = route(
    settings,
    kind === 'ignoree' ? 'moi' : ((data as { espace?: string }).espace ?? espaceDesLiens(data as Record<string, unknown>, LIENS_ENTITE)),
  );
  verifierLiens(e, data as Record<string, unknown>, LIENS_ENTITE);
  if (DEMO) return marquer(await demoApiFor(e).createEntity(kind, data as never), e) as unknown as EntityMap[K];
  return marquer((await post<{ entity: EntityMap[K] }>(s, { action: 'createEntity', kind, data })).entity, e);
}

export async function updateEntity<K extends EntityKind>(
  settings: Settings,
  kind: K,
  data: Partial<EntityMap[K]> & { id: string },
): Promise<EntityMap[K]> {
  const { e, s } = route(settings, espaceDe(data.id));
  verifierLiens(e, data as Record<string, unknown>, LIENS_ENTITE);
  if (DEMO) return marquer(await demoApiFor(e).updateEntity(kind, data as never), e) as unknown as EntityMap[K];
  return marquer((await post<{ entity: EntityMap[K] }>(s, { action: 'updateEntity', kind, data })).entity, e);
}

/**
 * Crée des domaines (et leurs sous-domaines) dans un espace : domaines de base de Moi, ou copie à la création
 * d'un espace. Ceux que l'espace a déjà (même nom) ne sont pas recréés.
 */
export async function copierDomaines(settings: Settings, espace: string, modeles: ModeleDomaine[], existants: Domaine[] = []): Promise<Domaine[]> {
  const crees: Domaine[] = [];
  const meme = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  for (const m of modeles) {
    let p = existants.find((d) => !d.parent && meme(d.nom, m.nom));
    if (!p) {
      p = await createEntity(settings, 'domaine', { nom: m.nom, icone: m.icone, couleur: m.couleur, parent: '', espace });
      crees.push(p);
    }
    for (const x of m.sous ?? []) {
      if (existants.some((d) => d.parent === p.id && meme(d.nom, x.nom))) continue;
      crees.push(await createEntity(settings, 'domaine', { nom: x.nom, icone: x.icone, couleur: x.couleur, parent: p.id, espace }));
    }
  }
  return crees.map(normalizeDomaine);
}

/** Supprime un domaine / objectif / epic ; `cascade` supprime aussi ce qui est en dessous. */
export async function deleteEntity(settings: Settings, kind: EntityKind, id: string, cascade: boolean): Promise<DeletionCounts> {
  const { e, s } = route(settings, espaceDe(id));
  if (DEMO) return demoApiFor(e).deleteEntity(kind, id, cascade);
  return (await post<{ counts: DeletionCounts }>(s, { action: 'deleteEntity', kind, id, cascade })).counts;
}

export async function createItem(settings: Settings, item: ItemInput): Promise<Item> {
  const { e, s } = route(settings, item.espace || espaceDesLiens(item as unknown as Record<string, unknown>, LIENS_ITEM));
  verifierLiens(e, item as unknown as Record<string, unknown>, LIENS_ITEM);
  if (DEMO) return marquer(await demoApiFor(e).create(item), e);
  return marquer(normalize((await post<{ item: Item }>(s, { action: 'create', item })).item), e);
}
export async function updateItem(settings: Settings, item: Partial<Item> & { id: string }): Promise<Item> {
  const { e, s } = route(settings, espaceDe(item.id));
  verifierLiens(e, item as unknown as Record<string, unknown>, LIENS_ITEM);
  if (DEMO) return marquer(await demoApiFor(e).update(item), e);
  return marquer(normalize((await post<{ item: Item }>(s, { action: 'update', item })).item), e);
}
/** Supprime une tâche ; ses sous-tâches sont supprimées (cascade) ou deviennent des tâches normales. */
export async function deleteItem(settings: Settings, id: string, cascade = false): Promise<void> {
  const { e, s } = route(settings, espaceDe(id));
  if (DEMO) return demoApiFor(e).remove(id, cascade);
  await post(s, { action: 'delete', id, cascade });
}
