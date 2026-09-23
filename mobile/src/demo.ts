import AsyncStorage from '@react-native-async-storage/async-storage';
import { addDays, toDateString } from './dates';
import type { Item, ItemInput } from './types';

/**
 * Mode démo (EXPO_PUBLIC_DEMO=1) : données d'exemple enregistrées sur l'appareil,
 * sans Google Sheet. Sert à essayer l'application en ligne.
 */
export const DEMO = process.env.EXPO_PUBLIC_DEMO === '1';

const KEY = 'mes-taches:demo';
let memory: Item[] | null = null;

function sample(): Item[] {
  const now = new Date();
  const d = (n: number) => toDateString(addDays(now, n));
  const stamp = now.toISOString();
  const mk = (id: string, titre: string, type: Item['type'], date: string, heure: string, extra: Partial<Item> = {}): Item => ({
    id, titre, type, date, heure, lieu: '', description: '', priorite: 'normale', statut: 'a_faire',
    cree_le: stamp, modifie_le: stamp, periodicite: '', echeance: '', debut: '', fin: '', faits: '', ...extra,
  });
  return [
    mk('d1', 'Rendez-vous client Dupont', 'rendez-vous', d(2), '10:30', {
      lieu: '12 rue de Paris, Lyon', description: 'Présenter le devis et prendre les mesures', priorite: 'haute',
    }),
    mk('d2', 'Préparer le rapport de mission', 'mission', d(3), '', {
      description: 'Rassembler les photos et les heures du chantier', statut: 'en_cours',
    }),
    mk('d3', 'Appeler le fournisseur', 'tache', d(0), '09:00'),
    mk('d4', 'Réunion équipe', 'rendez-vous', d(0), '14:00', { lieu: 'Bureau' }),
    mk('d5', 'Chantier Martin', 'mission', d(-1), '08:00', { lieu: 'Villeurbanne' }),
    mk('d6', 'Envoyer les factures', 'tache', d(-2), '', { statut: 'termine' }),
    mk('d7', 'Visite du dépôt', 'mission', d(8), '11:00'),
    mk('d8', 'Dentiste', 'rendez-vous', d(15), '17:30'),
    mk('d9', 'Commander le matériel', 'tache', d(1), '', { priorite: 'haute' }),
    mk('d10', 'Relancer le devis Bernard', 'tache', '', ''),
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
  async reset(): Promise<Item[]> {
    await store(sample());
    return [...memory!];
  },
};
