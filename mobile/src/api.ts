import { Platform } from 'react-native';
import { AuthError, getIdToken } from './auth';
import { DEMO, demoApi } from './demo';
import { Epic, EpicInput, Item, ItemInput, RECURRENCE_DEFAUTS, Settings } from './types';

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

export async function listItems(settings: Settings): Promise<{ items: Item[]; epics: Epic[]; version: number }> {
  if (DEMO) {
    return { items: (await demoApi.list()).map(normalize), epics: await demoApi.listEpics(), version: API_VERSION_EPICS };
  }
  const data = await post<{ items: Item[]; epics?: Epic[]; version?: number }>(settings, { action: 'list' });
  return { items: data.items.map(normalize), epics: data.epics ?? [], version: data.version ?? 1 };
}

export async function createEpic(settings: Settings, epic: EpicInput): Promise<Epic> {
  if (DEMO) return demoApi.createEpic(epic);
  return (await post<{ epic: Epic }>(settings, { action: 'createEpic', epic })).epic;
}

export async function updateEpic(settings: Settings, epic: Partial<Epic> & { id: string }): Promise<Epic> {
  if (DEMO) return demoApi.updateEpic(epic);
  return (await post<{ epic: Epic }>(settings, { action: 'updateEpic', epic })).epic;
}

/** Supprime l'epic ; ses tâches sont conservées et détachées. Renvoie leur nombre. */
export async function deleteEpic(settings: Settings, id: string): Promise<number> {
  if (DEMO) return demoApi.deleteEpic(id);
  return (await post<{ detached: number }>(settings, { action: 'deleteEpic', id })).detached;
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
