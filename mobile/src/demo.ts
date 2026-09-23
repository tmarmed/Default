import AsyncStorage from '@react-native-async-storage/async-storage';
import { addDays, toDateString } from './dates';
import type { Epic, EpicInput, Item, ItemInput } from './types';

/**
 * Mode démo (EXPO_PUBLIC_DEMO=1) : données d'exemple enregistrées sur l'appareil,
 * sans Google Sheet. Sert à essayer l'application en ligne.
 */
export const DEMO = process.env.EXPO_PUBLIC_DEMO === '1';

const KEY = 'mes-taches:demo';
const EPICS_KEY = 'mes-taches:demo-epics';
let memory: Item[] | null = null;
let epicsMemory: Epic[] | null = null;

function sample(): Item[] {
  const now = new Date();
  const d = (n: number) => toDateString(addDays(now, n));
  const stamp = now.toISOString();
  const mk = (id: string, titre: string, type: Item['type'], date: string, heure: string, extra: Partial<Item> = {}): Item => ({
    id, titre, type, date, heure, lieu: '', description: '', priorite: 'normale', statut: 'a_faire',
    cree_le: stamp, modifie_le: stamp, periodicite: '', echeance: '', debut: '', fin: '', faits: '', epic: '', ...extra,
  });
  return [
    mk('d1', 'Rendez-vous client Dupont', 'rendez-vous', d(2), '10:30', {
      epic: 'e2',
      lieu: '12 rue de Paris, Lyon', description: 'Présenter le devis et prendre les mesures', priorite: 'haute',
    }),
    mk('d2', 'Préparer le rapport de mission', 'mission', d(3), '', {
      epic: 'e2',
      description: 'Rassembler les photos et les heures du chantier', statut: 'en_cours',
    }),
    mk('d3', 'Appeler le fournisseur', 'tache', d(0), '09:00'),
    mk('d4', 'Réunion équipe', 'rendez-vous', d(0), '14:00', { lieu: 'Bureau' }),
    mk('d5', 'Chantier Martin', 'mission', d(-1), '08:00', { lieu: 'Villeurbanne' }),
    mk('d6', 'Envoyer les factures', 'tache', d(-2), '', { statut: 'termine', epic: 'e1' }),
    mk('d7', 'Visite du dépôt', 'mission', d(8), '11:00', { epic: 'e3' }),
    mk('d8', 'Dentiste', 'rendez-vous', d(15), '17:30'),
    mk('d9', 'Commander le matériel', 'tache', d(1), '', { priorite: 'haute', epic: 'e3' }),
    mk('d10', 'Relancer le devis Bernard', 'tache', '', '', { epic: 'e1' }),
    // Éléments répétés (débutent il y a deux mois pour montrer les retards à rattraper)
    mk('d11', 'Payer le loyer', 'tache', '', '', {
      periodicite: 'mensuelle', echeance: '5', priorite: 'haute', debut: toDateString(new Date(now.getFullYear(), now.getMonth() - 2, 1)),
      faits: toDateString(new Date(now.getFullYear(), now.getMonth() - 2, 1)).slice(0, 7),
    }),
    mk('d12', 'Faire les comptes du mois', 'tache', '', '', { periodicite: 'mensuelle' }),
    mk('d13', 'Point hebdo équipe', 'rendez-vous', '', '10:00', { periodicite: 'hebdomadaire', echeance: '1', lieu: 'Visio' }),
    mk('d14', 'Déclaration de TVA', 'mission', '', '', { periodicite: 'trimestrielle' }),
    mk('d15', 'Renouveler l\'assurance', 'tache', '', '', {
      periodicite: 'annuelle', echeance: String(now.getMonth() + 1).padStart(2, '0'),
    }),
  ];
}

function sampleEpics(): Epic[] {
  const now = new Date();
  const m = (months: number, day = 1) => toDateString(new Date(now.getFullYear(), now.getMonth() + months, day));
  const stamp = now.toISOString();
  const mk = (id: string, titre: string, debut: string, fin: string, couleur: string, description = ''): Epic => ({
    id, titre, description, debut, fin, couleur, cree_le: stamp, modifie_le: stamp,
  });
  return [
    mk('e1', 'Refonte du site web', m(-1), m(4, 0), '#1A73E8', 'Nouveau site vitrine et prise de rendez-vous en ligne'),
    mk('e2', 'Salon professionnel', m(0, 15), m(2, 10), '#E37400', 'Stand, supports et rendez-vous clients'),
    mk('e3', 'Déménagement de l\'entrepôt', m(-3), m(1, 0), '#8E24AA'),
    mk('e4', 'Certification qualité', m(5), m(14, 0), '#188038', 'Audit, procédures et formation'),
  ];
}

async function loadEpics(): Promise<Epic[]> {
  if (epicsMemory) return epicsMemory;
  try {
    const raw = await AsyncStorage.getItem(EPICS_KEY);
    epicsMemory = raw ? JSON.parse(raw) : sampleEpics();
  } catch {
    epicsMemory = sampleEpics();
  }
  return epicsMemory!;
}

async function storeEpics(epics: Epic[]): Promise<void> {
  epicsMemory = epics;
  try {
    await AsyncStorage.setItem(EPICS_KEY, JSON.stringify(epics));
  } catch {
    // Stockage indisponible : la démo reste en mémoire.
  }
}

async function load(): Promise<Item[]> {
  if (memory) return memory;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    memory = raw ? JSON.parse(raw) : sample();
  } catch {
    memory = sample();
  }
  return memory!;
}

async function store(items: Item[]): Promise<void> {
  memory = items;
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // Stockage indisponible (navigation privée) : la démo reste en mémoire.
  }
}

export const demoApi = {
  async list(): Promise<Item[]> {
    return [...(await load())];
  },
  async create(input: ItemInput): Promise<Item> {
    const now = new Date().toISOString();
    const item: Item = { ...input, id: `d${Date.now()}`, cree_le: now, modifie_le: now };
    await store([...(await load()), item]);
    return item;
  },
  async update(patch: Partial<Item> & { id: string }): Promise<Item> {
    const items = await load();
    const current = items.find((i) => i.id === patch.id);
    if (!current) throw new Error('Élément introuvable.');
    const item = { ...current, ...patch, modifie_le: new Date().toISOString() };
    await store(items.map((i) => (i.id === item.id ? item : i)));
    return item;
  },
  async remove(id: string): Promise<void> {
    await store((await load()).filter((i) => i.id !== id));
  },
  async reset(): Promise<{ items: Item[]; epics: Epic[] }> {
    await store(sample());
    await storeEpics(sampleEpics());
    return { items: [...memory!], epics: [...epicsMemory!] };
  },
  async listEpics(): Promise<Epic[]> {
    return [...(await loadEpics())];
  },
  async createEpic(input: EpicInput): Promise<Epic> {
    const now = new Date().toISOString();
    const epic: Epic = { ...input, id: `e${Date.now()}`, cree_le: now, modifie_le: now };
    await storeEpics([...(await loadEpics()), epic]);
    return epic;
  },
  async updateEpic(patch: Partial<Epic> & { id: string }): Promise<Epic> {
    const epics = await loadEpics();
    const current = epics.find((e) => e.id === patch.id);
    if (!current) throw new Error('Epic introuvable.');
    const epic = { ...current, ...patch, modifie_le: new Date().toISOString() };
    await storeEpics(epics.map((e) => (e.id === epic.id ? epic : e)));
    return epic;
  },
  async deleteEpic(id: string): Promise<number> {
    await storeEpics((await loadEpics()).filter((e) => e.id !== id));
    const items = await load();
    const detached = items.filter((i) => i.epic === id).length;
    await store(items.map((i) => (i.epic === id ? { ...i, epic: '' } : i)));
    return detached;
  },
};
