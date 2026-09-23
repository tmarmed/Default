import { AuthError, getIdToken } from './auth';
import { DEMO, demoApi } from './demo';
import type { Item, ItemInput, Settings } from './types';

type ApiResponse<T> = ({ ok: true } & T) | { ok: false; error: string; code?: string };

const TIMEOUT_MS = 20000;

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
        ? 'Le Google Sheet ne répond pas (délai dépassé).'
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

export async function listItems(settings: Settings): Promise<Item[]> {
  if (DEMO) return demoApi.list();
  return (await post<{ items: Item[] }>(settings, { action: 'list' })).items;
}

export async function createItem(settings: Settings, item: ItemInput): Promise<Item> {
  if (DEMO) return demoApi.create(item);
  return (await post<{ item: Item }>(settings, { action: 'create', item })).item;
}

export async function updateItem(settings: Settings, item: Partial<Item> & { id: string }): Promise<Item> {
  if (DEMO) return demoApi.update(item);
  return (await post<{ item: Item }>(settings, { action: 'update', item })).item;
}

export async function deleteItem(settings: Settings, id: string): Promise<void> {
  if (DEMO) return demoApi.remove(id);
  await post(settings, { action: 'delete', id });
}
