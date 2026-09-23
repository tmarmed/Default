import AsyncStorage from '@react-native-async-storage/async-storage';
import { GOOGLE_AUTH } from './config';
import { DEMO } from './demo';
import type { Epic, Item, Settings } from './types';

const SETTINGS_KEY = 'mes-taches:settings';
const CACHE_KEY = 'mes-taches:cache';
const EPICS_CACHE_KEY = 'mes-taches:cache-epics';

export async function loadSettings(): Promise<Settings | null> {
  if (DEMO) return { url: 'demo', key: 'demo' };
  // Avec la connexion Google, l'URL est intégrée à l'application et rien n'est saisi.
  if (GOOGLE_AUTH) return null;
  const raw = await AsyncStorage.getItem(SETTINGS_KEY);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Settings;
    return s.url && s.key ? s : null;
  } catch {
    return null;
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export async function clearSettings(): Promise<void> {
  await AsyncStorage.multiRemove([SETTINGS_KEY, CACHE_KEY, EPICS_CACHE_KEY]);
}

/** Dernière liste reçue du Google Sheet, affichée hors connexion. */
export async function loadCache(): Promise<{ items: Item[]; savedAt: string } | null> {
  const raw = await AsyncStorage.getItem(CACHE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function saveCache(items: Item[]): Promise<void> {
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ items, savedAt: new Date().toISOString() }));
}

/** Dernières epics reçues, affichées hors connexion. */
export async function loadEpicsCache(): Promise<Epic[]> {
  try {
    const raw = await AsyncStorage.getItem(EPICS_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveEpicsCache(epics: Epic[]): Promise<void> {
  await AsyncStorage.setItem(EPICS_CACHE_KEY, JSON.stringify(epics));
}
