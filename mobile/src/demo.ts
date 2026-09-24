import AsyncStorage from '@react-native-async-storage/async-storage';
import { addDays, toDateString } from './dates';
import { cleanLinks, Data, DeletionCounts, planDeletion } from './hierarchy';
import type { Domaine, Epic, Item, ItemInput, Objectif } from './types';

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
    cree_le: stamp, modifie_le: stamp, periodicite: '', echeance: '', debut: '', fin: '', faits: '', epic: '', objectif: '', domaine: '', ...extra,
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
    mk('d8', 'Dentiste', 'rendez-vous', d(15), '17:30', { domaine: 'dperso' }),
    mk('d9', 'Commander le matériel', 'tache', d(1), '', { priorite: 'haute', epic: 'e3' }),
    mk('d10', 'Relancer le devis Bernard', 'tache', '', '', { epic: 'e1' }),
    // Éléments répétés (débutent il y a deux mois pour montrer les retards à rattraper)
    mk('d11', 'Payer le loyer', 'tache', '', '', {
      domaine: 'dperso',
      periodicite: 'mensuelle', echeance: '5', priorite: 'haute', debut: toDateString(new Date(now.getFullYear(), now.getMonth() - 2, 1)),
      faits: toDateString(new Date(now.getFullYear(), now.getMonth() - 2, 1)).slice(0, 7),
    }),
    mk('d16', 'Mise en ligne du nouveau site', 'mission', d(110), '09:00', { epic: 'e1', priorite: 'haute' }),
    mk('d12', 'Faire les comptes du mois', 'tache', '', '', { periodicite: 'mensuelle', epic: 'e5' }),
    mk('d13', 'Point hebdo équipe', 'rendez-vous', '', '10:00', { periodicite: 'hebdomadaire', echeance: '1', lieu: 'Visio', domaine: 'dpro' }),
    mk('d17', 'Appeler 10 prospects', 'tache', d(5), '', { objectif: 'o1' }),
    mk('d14', 'Déclaration de TVA', 'mission', '', '', { periodicite: 'trimestrielle' }),
    mk('d15', 'Renouveler l\'assurance', 'tache', '', '', {
      domaine: 'dadmin',
      periodicite: 'annuelle', echeance: String(now.getMonth() + 1).padStart(2, '0'),
    }),
  ];
}

function sampleEntities(): { epic: Epic[]; objectif: Objectif[]; domaine: Domaine[] } {
  const now = new Date();
  const m = (months: number, day = 1) => toDateString(new Date(now.getFullYear(), now.getMonth() + months, day));
  const stamp = now.toISOString();
  const base = { cree_le: stamp, modifie_le: stamp };
  const dom = (id: string, nom: string, icone: string, couleur: string): Domaine => ({ id, nom, icone, couleur, ...base });
  const obj = (id: string, titre: string, domaine: string, debut: string, fin: string, couleur: string, extra: Partial<Objectif> = {}): Objectif => ({
    id, titre, domaine, debut, fin, couleur, description: '', cible: '', actuel: '', unite: '', ...base, ...extra,
  });
  const ep = (id: string, titre: string, debut: string, fin: string, couleur: string, links: Partial<Epic>, description = ''): Epic => ({
    id, titre, description, debut, fin, couleur, objectif: '', domaine: '', ...base, ...links,
  });
  return {
    domaine: [
      dom('dpro', 'Pro', '💼', '#1A73E8'),
      dom('dperso', 'Perso', '🏠', '#188038'),
      dom('dadmin', 'Administratif', '💶', '#E37400'),
    ],
    objectif: [
      obj('o1', 'Doubler le nombre de clients', 'dpro', m(-2), m(3, 0), '#1A73E8', { cible: '20', actuel: '8', unite: 'clients' }),
      obj('o2', 'Certification ISO 9001', 'dpro', m(4), m(15, 0), '#5E35B1'),
      obj('o3', 'Tenir ses comptes à jour', 'dadmin', m(-6), '', '#E37400', { description: 'Objectif permanent' }),
    ],
    epic: [
      ep('e1', 'Refonte du site web', m(-1), m(4, 0), '#1A73E8', { objectif: 'o1' }, 'Nouveau site vitrine et prise de rendez-vous en ligne'),
      ep('e2', 'Salon professionnel', m(0, 15), m(2, 10), '#E37400', { objectif: 'o1' }, 'Stand, supports et rendez-vous clients'),
      ep('e3', "Déménagement de l'entrepôt", m(-3), m(1, 15), '#8E24AA', { domaine: 'dpro' }),
      ep('e4', 'Audit et procédures qualité', m(5), m(14, 0), '#188038', { objectif: 'o2' }, 'Audit, procédures et formation'),
      ep('e5', 'Gestion courante', m(-2), '', '#00897B', { objectif: 'o3' }, 'Epic sans fin : tâches répétées du quotidien'),
    ],
  };
}

type Kind = 'epic' | 'objectif' | 'domaine';
type EntityOf<K extends Kind> = K extends 'epic' ? Epic : K extends 'objectif' ? Objectif : Domaine;
const entityMemory: Partial<Record<Kind, unknown[]>> = {};

async function loadEntities<K extends Kind>(kind: K): Promise<EntityOf<K>[]> {
  if (entityMemory[kind]) return entityMemory[kind] as EntityOf<K>[];
  let list: EntityOf<K>[];
  try {
    const raw = await AsyncStorage.getItem(`${KEY}-${kind}`);
    list = raw ? JSON.parse(raw) : (sampleEntities()[kind] as EntityOf<K>[]);
  } catch {
    list = sampleEntities()[kind] as EntityOf<K>[];
  }
  entityMemory[kind] = list;
  return list;
}

async function storeEntities<K extends Kind>(kind: K, list: EntityOf<K>[]): Promise<void> {
  entityMemory[kind] = list;
  try {
    await AsyncStorage.setItem(`${KEY}-${kind}`, JSON.stringify(list));
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
    const item: Item = cleanLinks({ ...input, id: `d${Date.now()}`, cree_le: now, modifie_le: now });
    await store([...(await load()), item]);
    return item;
  },
  async update(patch: Partial<Item> & { id: string }): Promise<Item> {
    const items = await load();
    const current = items.find((i) => i.id === patch.id);
    if (!current) throw new Error('Élément introuvable.');
    const item = cleanLinks({ ...current, ...patch, modifie_le: new Date().toISOString() });
    await store(items.map((i) => (i.id === item.id ? item : i)));
    return item;
  },
  async remove(id: string): Promise<void> {
    await store((await load()).filter((i) => i.id !== id));
  },
  async reset(): Promise<Data> {
    await store(sample());
    const e = sampleEntities();
    await storeEntities('epic', e.epic);
    await storeEntities('objectif', e.objectif);
    await storeEntities('domaine', e.domaine);
    return { items: [...memory!], epics: e.epic, objectifs: e.objectif, domaines: e.domaine };
  },
  async listAll(): Promise<Omit<Data, 'items'>> {
    return {
      epics: [...(await loadEntities('epic'))],
      objectifs: [...(await loadEntities('objectif'))],
      domaines: [...(await loadEntities('domaine'))],
    };
  },
  async createEntity<K extends Kind>(kind: K, input: Omit<EntityOf<K>, 'id' | 'cree_le' | 'modifie_le'>): Promise<EntityOf<K>> {
    const now = new Date().toISOString();
    const o = cleanLinks({ ...input, id: `${kind[0]}${Date.now()}`, cree_le: now, modifie_le: now }) as unknown as EntityOf<K>;
    await storeEntities(kind, [...(await loadEntities(kind)), o]);
    return o;
  },
  async updateEntity<K extends Kind>(kind: K, patch: Partial<EntityOf<K>> & { id: string }): Promise<EntityOf<K>> {
    const list = await loadEntities(kind);
    const current = list.find((e) => e.id === patch.id);
    if (!current) throw new Error('Élément introuvable.');
    const o = cleanLinks({ ...current, ...patch, modifie_le: new Date().toISOString() }) as EntityOf<K>;
    await storeEntities(kind, list.map((e) => (e.id === o.id ? o : e)));
    return o;
  },
  async deleteEntity(kind: Kind, id: string, cascade: boolean): Promise<DeletionCounts> {
    const r = planDeletion(kind, id, cascade, {
      items: await load(),
      epics: await loadEntities('epic'),
      objectifs: await loadEntities('objectif'),
      domaines: await loadEntities('domaine'),
    });
    await store(r.items);
    await storeEntities('epic', r.epics);
    await storeEntities('objectif', r.objectifs);
    await storeEntities('domaine', r.domaines);
    return r.counts;
  },
};
