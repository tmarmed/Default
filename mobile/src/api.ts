import { Platform } from 'react-native';
import { AuthError, getIdToken } from './auth';
import { DEMO, demoApi } from './demo';
import type { Data, DeletionCounts } from './hierarchy';
import { Domaine, EntityKind, Epic, Item, ItemInput, Objectif, RECURRENCE_DEFAUTS, Settings } from './types';

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

const normalizeEpic = (e: Epic): Epic => ({ ...e, objectif: e.objectif ?? '', domaine: e.domaine ?? '' });

export async function listItems(settings: Settings): Promise<Data & { version: number }> {
  if (DEMO) {
    const all = await demoApi.listAll();
    return { items: (await demoApi.list()).map(normalize), ...all, version: API_VERSION_HIERARCHIE };
  }
  const data = await post<Partial<Data> & { items: Item[]; version?: number }>(settings, { action: 'list' });
  return {
    items: data.items.map(normalize),
    epics: (data.epics ?? []).map(normalizeEpic),
    objectifs: data.objectifs ?? [],
    domaines: data.domaines ?? [],
    version: data.version ?? 1,
  };
}

type EntityMap = { epic: Epic; objectif: Objectif; domaine: Domaine };

export async function createEntity<K extends EntityKind>(
  settings: Settings,
  kind: K,
  data: Omit<EntityMap[K], 'id' | 'cree_le' | 'modifie_le'>,
): Promise<EntityMap[K]> {
  if (DEMO) return demoApi.createEntity(kind, data as never) as Promise<EntityMap[K]>;
  return (await post<{ entity: EntityMap[K] }>(settings, { action: 'createEntity', kind, data })).entity;
}

export async function updateEntity<K extends EntityKind>(
  settings: Settings,
  kind: K,
  data: Partial<EntityMap[K]> & { id: string },
): Promise<EntityMap[K]> {
  if (DEMO) return demoApi.updateEntity(kind, data as never) as Promise<EntityMap[K]>;
  return (await post<{ entity: EntityMap[K] }>(settings, { action: 'updateEntity', kind, data })).entity;
}

/** Supprime un domaine / objectif / epic ; `cascade` supprime aussi ce qui est en dessous. */
export async function deleteEntity(settings: Settings, kind: EntityKind, id: string, cascade: boolean): Promise<DeletionCounts> {
  if (DEMO) return demoApi.deleteEntity(kind, id, cascade);
  return (await post<{ counts: DeletionCounts }>(settings, { action: 'deleteEntity', kind, id, cascade })).counts;
}

export async function createItem(settings: Settings, item: ItemInput): Promise<Item> {
  if (DEMO) return demoApi.create(item);
  return normalize((await post<{ item: Item }>(settings, { action: 'create', item })).item);
}
export async function updateItem(settings: Settings, item: Partial<Item> & { id: string }): Promise<Item> {
  if (DEMO) return demoApi.update(item);
  return normalize((await post<{ item: Item }>(settings, { action: 'update', item })).item);
}
export async function deleteItem(settings: Settings, id: string): Promise<void> {
  if (DEMO) return demoApi.remove(id);
  await post(settings, { action: 'delete', id });
}
