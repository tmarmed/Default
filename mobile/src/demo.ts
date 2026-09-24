import AsyncStorage from '@react-native-async-storage/async-storage';
import { addDays, toDateString } from './dates';
import { cleanLinks, Data, DeletionCounts, planDeletion } from './hierarchy';
import { iterationOf, piOf, shiftPi } from './pi';
import { cascadeLinks, checkParent } from './subtasks';
import type { Domaine, Epic, Feature, Item, ItemInput, Objectif, ObjectifPI } from './types';

/**
 * Mode démo (EXPO_PUBLIC_DEMO=1) : données d'exemple enregistrées sur l'appareil,
 * sans Google Sheet. Sert à essayer l'application en ligne.
 */
export const DEMO = process.env.EXPO_PUBLIC_DEMO === '1';

const KEY = 'mes-taches:demo';
/**
 * Version des données d'exemple : à augmenter quand leur forme change (nouveaux champs, nouveaux niveaux).
 * Des données enregistrées par une version plus ancienne de la démo sont remplacées par les nouvelles.
 */
const DEMO_DATA_VERSION = '8';
const VERSION_KEY = `${KEY}-version`;
let versionChecked: Promise<void> | null = null;

function checkVersion(): Promise<void> {
  versionChecked ??= (async () => {
    try {
      if ((await AsyncStorage.getItem(VERSION_KEY)) === DEMO_DATA_VERSION) return;
      await AsyncStorage.multiRemove([
        KEY,
        `${KEY}-epics`,
        `${KEY}-epic`,
        `${KEY}-objectif`,
        `${KEY}-domaine`,
        `${KEY}-feature`,
        `${KEY}-objectifpi`,
      ]);
      await AsyncStorage.setItem(VERSION_KEY, DEMO_DATA_VERSION);
    } catch {
      // Stockage indisponible : la démo repart des exemples en mémoire.
    }
  })();
  return versionChecked;
}
let memory: Item[] | null = null;

function sample(): Item[] {
  const now = new Date();
  const d = (n: number) => toDateString(addDays(now, n));
  const stamp = now.toISOString();
  const pi2 = shiftPi(piOf(now), 1);
  const mk = (id: string, titre: string, type: Item['type'], date: string, heure: string, extra: Partial<Item> = {}): Item => ({
    id, titre, type, date, heure, lieu: '', description: '', priorite: 'normale', statut: 'a_faire',
    cree_le: stamp, modifie_le: stamp, periodicite: '', echeance: '', debut: '', fin: '', faits: '', epic: '', objectif: '', domaine: '',
    points: '', iteration: '', feature: '', telephone: '', parent: '', ...extra,
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
    mk('d3', 'Appeler le fournisseur', 'tache', d(0), '09:00', { points: '1' }),
    // SAFe : tâches de la feature « Maquettes des pages », dans l'itération en cours
    mk('d18', 'Maquette de la page d\'accueil', 'tache', d(1), '', { feature: 'f1', points: '3', statut: 'en_cours' }),
    mk('d19', 'Maquette de la page contact', 'tache', '', '', { feature: 'f1', points: '2', iteration: iterationOf(now).key }),
    mk('d20', 'Choisir la palette de couleurs', 'tache', d(-1), '', { feature: 'f1', points: '1', statut: 'termine' }),
    // Nouveaux types (v7)
    mk('d21', 'Appeler le plombier', 'appel', d(0), '11:00', {
      telephone: '06 12 34 56 78', domaine: 'dperso', description: 'Fuite sous l’évier : demander un rendez-vous cette semaine',
    }),
    mk('d22', 'Renouveler la carte d’identité', 'demarche', d(10), '', {
      domaine: 'dadmin', description: 'Prendre rendez-vous en mairie, photo d’identité, justificatif de domicile',
    }),
    mk('d23', 'En tant que client, je vois les tarifs en ligne', 'story', '', '', { feature: 'f3', points: '3' }),
    // Sous-tâches (v8) : la démarche « carte d'identité » et la story « tarifs » (5 j de sous-tâches pour 3 j → alerte)
    mk('d26', 'Faire les photos d’identité', 'tache', d(-3), '', { parent: 'd22', domaine: 'dadmin', statut: 'termine' }),
    mk('d27', 'Appeler la mairie pour un rendez-vous', 'appel', d(0), '10:00', { parent: 'd22', domaine: 'dadmin', telephone: '01 23 45 67 89' }),
    mk('d28', 'Déposer le dossier en mairie', 'tache', d(18), '', { parent: 'd22', domaine: 'dadmin' }),
    mk('d29', 'Rédiger les textes des tarifs', 'tache', '', '', { parent: 'd23', feature: 'f3', points: '1', statut: 'termine', iteration: `${pi2}-IT4` }),
    mk('d30', 'Mettre en page la grille', 'tache', '', '', { parent: 'd23', feature: 'f3', points: '2', iteration: `${pi2}-IT4` }),
    mk('d31', 'Relire et publier', 'tache', '', '', { parent: 'd23', feature: 'f3', points: '2', iteration: `${pi2}-IT5` }),
    mk('d24', 'Comparer 3 outils de prise de rendez-vous', 'exploration', '', '', { feature: 'f3', points: '1' }),
    mk('d25', 'Le formulaire de contact n’envoie rien', 'bug', d(1), '', { epic: 'e1', priorite: 'haute', points: '1' }),
    mk('d4', 'Réunion équipe', 'rendez-vous', d(0), '14:00', { lieu: 'Bureau' }),
    mk('d5', 'Chantier Martin', 'mission', d(-1), '08:00', { lieu: 'Villeurbanne' }),
    mk('d6', 'Envoyer les factures', 'tache', d(-2), '', { statut: 'termine', epic: 'e1' }),
    mk('d7', 'Visite du dépôt', 'mission', d(8), '11:00', { epic: 'e3' }),
    mk('d8', 'Dentiste', 'rendez-vous', d(15), '17:30', { domaine: 'dperso' }),
    mk('d9', 'Commander le matériel', 'tache', d(1), '', { priorite: 'haute', epic: 'e3', points: '2' }),
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

function sampleEntities(): {
  epic: Epic[];
  objectif: Objectif[];
  domaine: Domaine[];
  feature: Feature[];
  objectifpi: ObjectifPI[];
} {
  const now = new Date();
  const m = (months: number, day = 1) => toDateString(new Date(now.getFullYear(), now.getMonth() + months, day));
  const stamp = now.toISOString();
  const base = { cree_le: stamp, modifie_le: stamp };
  const dom = (id: string, nom: string, icone: string, couleur: string): Domaine => ({ id, nom, icone, couleur, ...base });
  const obj = (id: string, titre: string, domaine: string, debut: string, fin: string, couleur: string, extra: Partial<Objectif> = {}): Objectif => ({
    id, titre, domaine, debut, fin, couleur, description: '', cible: '', actuel: '', unite: '', ...base, ...extra,
  });
  const ep = (id: string, titre: string, debut: string, fin: string, couleur: string, links: Partial<Epic>, description = ''): Epic => ({
    id, titre, description, debut, fin, couleur, objectif: '', domaine: '', etat: '', ...base, ...links,
  });
  // SAFe : PI en cours et suivant, itération en cours
  const pi = piOf(now);
  const pi2 = shiftPi(pi, 1);
  const it = iterationOf(now).key;
  const feat = (id: string, titre: string, epic: string, fpi: string, iteration: string, points: string): Feature => ({
    id, titre, description: '', epic, pi: fpi, iteration, points, couleur: '', ...base,
  });
  const opi = (id: string, titre: string, opiPi: string, type: ObjectifPI['type'], prevue: string, obtenue = '', domaine = 'dpro'): ObjectifPI => ({
    id, titre, pi: opiPi, type, valeur_prevue: prevue, valeur_obtenue: obtenue, domaine, ...base,
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
      ep('e1', 'Refonte du site web', m(-1), m(4, 0), '#1A73E8', { objectif: 'o1', etat: 'en_cours' }, 'Nouveau site vitrine et prise de rendez-vous en ligne'),
      ep('e2', 'Salon professionnel', m(0, 15), m(2, 10), '#E37400', { objectif: 'o1', etat: 'pret' }, 'Stand, supports et rendez-vous clients'),
      ep('e3', "Déménagement de l'entrepôt", m(-3), m(1, 15), '#8E24AA', { domaine: 'dpro', etat: 'en_cours' }),
      ep('e6', 'Application mobile clients', m(6), m(12, 0), '#C2185B', { domaine: 'dpro', etat: 'idee' }),
      ep('e7', 'Nouveau fournisseur', m(2), m(5, 0), '#5E35B1', { domaine: 'dpro', etat: 'analyse' }),
      ep('e4', 'Audit et procédures qualité', m(5), m(14, 0), '#188038', { objectif: 'o2', etat: 'idee' }, 'Audit, procédures et formation'),
      ep('e5', 'Gestion courante', m(-2), '', '#00897B', { objectif: 'o3', etat: 'en_cours' }, 'Epic sans fin : tâches répétées du quotidien'),
    ],
    feature: [
      feat('f1', 'Maquettes des pages', 'e1', pi, it, '5'),
      feat('f2', 'Développement du site', 'e1', pi2, `${pi2}-IT2`, '13'),
      feat('f3', 'Prise de rendez-vous en ligne', 'e1', pi2, `${pi2}-IT4`, '8'),
      feat('f4', 'Stand et supports', 'e2', pi2, `${pi2}-IT1`, '5'),
    ],
    objectifpi: [
      opi('p1', 'Maquettes validées par 3 clients', pi, 'engage', '8', '6'),
      opi('p2', 'Nouveau site en ligne', pi2, 'engage', '10'),
      opi('p3', 'Prise de rendez-vous en ligne', pi2, 'bonus', '6'),
      opi('p4', 'Stand prêt pour le salon', pi2, 'engage', '7'),
      opi('p5', 'Comptes du trimestre clôturés', pi, 'engage', '5', '5', 'dadmin'),
      opi('p6', 'Déclaration de TVA sans retard', pi2, 'engage', '6', '', 'dadmin'),
    ],
  };
}

type Kind = 'epic' | 'objectif' | 'domaine' | 'feature' | 'objectifpi';
type EntityOf<K extends Kind> = K extends 'epic'
  ? Epic
  : K extends 'objectif'
    ? Objectif
    : K extends 'domaine'
      ? Domaine
      : K extends 'feature'
        ? Feature
        : ObjectifPI;
const entityMemory: Partial<Record<Kind, unknown[]>> = {};

async function loadEntities<K extends Kind>(kind: K): Promise<EntityOf<K>[]> {
  if (entityMemory[kind]) return entityMemory[kind] as EntityOf<K>[];
  await checkVersion();
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
  await checkVersion();
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
    const items = await load();
    const item: Item = cleanLinks(checkParent({ ...input, id: `d${Date.now()}`, cree_le: now, modifie_le: now }, items));
    await store([...items, item]);
    return item;
  },
  async update(patch: Partial<Item> & { id: string }): Promise<Item> {
    const items = await load();
    const current = items.find((i) => i.id === patch.id);
    if (!current) throw new Error('Élément introuvable.');
    const item = cleanLinks(checkParent({ ...current, ...patch, modifie_le: new Date().toISOString() }, items));
    await store(cascadeLinks(item, items.map((i) => (i.id === item.id ? item : i))));
    return item;
  },
  async remove(id: string, cascade = false): Promise<void> {
    await store(
      (await load())
        .filter((i) => i.id !== id && !(cascade && i.parent === id))
        .map((i) => (i.parent === id ? { ...i, parent: '' } : i)),
    );
  },
  async reset(): Promise<Data> {
    await store(sample());
    const e = sampleEntities();
    await storeEntities('epic', e.epic);
    await storeEntities('objectif', e.objectif);
    await storeEntities('domaine', e.domaine);
    await storeEntities('feature', e.feature);
    await storeEntities('objectifpi', e.objectifpi);
    return {
      items: [...memory!],
      epics: e.epic,
      objectifs: e.objectif,
      domaines: e.domaine,
      features: e.feature,
      objectifsPI: e.objectifpi,
    };
  },
  async listAll(): Promise<Omit<Data, 'items'>> {
    return {
      epics: [...(await loadEntities('epic'))],
      objectifs: [...(await loadEntities('objectif'))],
      domaines: [...(await loadEntities('domaine'))],
      features: [...(await loadEntities('feature'))],
      objectifsPI: [...(await loadEntities('objectifpi'))],
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
      features: await loadEntities('feature'),
      objectifsPI: await loadEntities('objectifpi'),
    });
    await store(r.items);
    await storeEntities('epic', r.epics);
    await storeEntities('objectif', r.objectifs);
    await storeEntities('domaine', r.domaines);
    await storeEntities('feature', r.features);
    await storeEntities('objectifpi', r.objectifsPI);
    return r.counts;
  },
};
