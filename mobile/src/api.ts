import type { Item, ItemInput, Settings } from './types';

type ApiResponse<T> = ({ ok: true } & T) | { ok: false; error: string };

const TIMEOUT_MS = 20000;

async function request<T>(settings: Settings, init: RequestInit & { query?: string }): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const url = settings.url.trim() + (init.query ?? '');
  let res: Response;
  try {
    // Apps Script répond par une redirection vers googleusercontent.com : fetch la suit.
    res = await fetch(url, { ...init, redirect: 'follow', signal: controller.signal });
  } catch (e) {
    throw new Error(
      controller.signal.aborted
        ? 'Le Google Sheet ne répond pas (délai dépassé).'
        : 'Pas de connexion au Google Sheet. Vérifiez votre réseau.',
    );
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text();
  let data: ApiResponse<T>;
  try {
    data = JSON.parse(text);
  } catch {
    // Page HTML = mauvaise URL ou déploiement non accessible à « Tout le monde ».
    throw new Error("Réponse inattendue du serveur. Vérifiez l'URL et le déploiement du script.");
  }
  if (!data.ok) throw new Error(data.error);
  return data;
}

function post<T>(settings: Settings, body: object): Promise<T> {
  return request<T>(settings, {
    method: 'POST',
    // text/plain : format accepté par Apps Script sans requête préalable.
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ ...body, key: settings.key }),
  });
}

export async function ping(settings: Settings): Promise<void> {
  await request(settings, { method: 'GET', query: `?action=ping&key=${encodeURIComponent(settings.key)}` });
}

export async function listItems(settings: Settings): Promise<Item[]> {
  const data = await request<{ items: Item[] }>(settings, {
    method: 'GET',
    query: `?action=list&key=${encodeURIComponent(settings.key)}`,
  });
  return data.items;
}

export async function createItem(settings: Settings, item: ItemInput): Promise<Item> {
  return (await post<{ item: Item }>(settings, { action: 'create', item })).item;
}

export async function updateItem(settings: Settings, item: Partial<Item> & { id: string }): Promise<Item> {
  return (await post<{ item: Item }>(settings, { action: 'update', item })).item;
}

export async function deleteItem(settings: Settings, id: string): Promise<void> {
  await post(settings, { action: 'delete', id });
}
