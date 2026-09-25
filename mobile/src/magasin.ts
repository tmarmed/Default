import { toDateString } from './dates';
import { cleanLinks, type Data, type DeletionCounts, planDeletion } from './hierarchy';
import { cascadeLinks, checkParent } from './subtasks';
import type { Domaine, Epic, Feature, Ignoree, Item, ItemInput, Objectif, ObjectifPI } from './types';

/**
 * Règles d'enregistrement d'un espace (celles de l'ancien script Google Apps Script), communes à la démo
 * (données sur l'appareil) et aux Google Sheets (connexion Google directe) : vérifications, « terminé le »,
 * sous-tâches, rattachements, suppression en cascade.
 */

export type Kind = 'epic' | 'objectif' | 'domaine' | 'feature' | 'objectifpi' | 'ignoree';
export type Table = 'items' | Kind;
export type EntityOf<K extends Kind> = K extends 'epic'
  ? Epic
  : K extends 'objectif'
    ? Objectif
    : K extends 'domaine'
      ? Domaine
      : K extends 'feature'
        ? Feature
        : K extends 'objectifpi'
          ? ObjectifPI
          : Ignoree;
type RowOf<T extends Table> = T extends 'items' ? Item : T extends Kind ? EntityOf<T> : never;

/** Onglets du Google Sheet d'un espace et leurs colonnes (mêmes noms que l'ancien script : fichiers compatibles) */
export const ONGLETS: Record<Table, { nom: string; colonnes: string[] }> = {
  items: {
    nom: 'Taches',
    colonnes: [
      'id', 'titre', 'type', 'date', 'heure', 'lieu', 'description', 'priorite', 'statut', 'cree_le', 'modifie_le',
      'periodicite', 'echeance', 'debut', 'fin', 'faits', 'epic', 'objectif', 'domaine', 'points', 'iteration', 'feature',
      'telephone', 'parent', 'heure_fin', 'date_fin', 'termine_le', 'statut_avant',
    ],
  },
  epic: { nom: 'Epics', colonnes: ['id', 'titre', 'description', 'debut', 'fin', 'couleur', 'cree_le', 'modifie_le', 'objectif', 'domaine', 'etat'] },
  feature: { nom: 'Features', colonnes: ['id', 'titre', 'description', 'epic', 'pi', 'iteration', 'points', 'couleur', 'cree_le', 'modifie_le'] },
  objectifpi: { nom: 'ObjectifsPI', colonnes: ['id', 'titre', 'pi', 'type', 'valeur_prevue', 'valeur_obtenue', 'cree_le', 'modifie_le', 'domaine', 'epic'] },
  objectif: { nom: 'Objectifs', colonnes: ['id', 'titre', 'description', 'domaine', 'debut', 'fin', 'couleur', 'cible', 'actuel', 'unite', 'cree_le', 'modifie_le'] },
  domaine: { nom: 'Domaines', colonnes: ['id', 'nom', 'icone', 'couleur', 'cree_le', 'modifie_le', 'parent'] },
  ignoree: { nom: 'Ignorees', colonnes: ['id', 'cle', 'signature', 'cree_le', 'modifie_le'] },
};
export const TABLES = Object.keys(ONGLETS) as Table[];

/** Lecture et écriture d'une table : sur l'appareil (démo) ou dans un Google Sheet */
export interface Persistance {
  /** Lecture à jour de la table (avant chaque modification : on repart des données les plus récentes) */
  lire<T extends Table>(t: T): Promise<RowOf<T>[]>;
  /** Réécrit toute la table */
  ecrire<T extends Table>(t: T, rows: RowOf<T>[]): Promise<void>;
}

const RE_DATE = /^\d{4}-\d{2}-\d{2}$/;
const RE_HEURE = /^\d{2}:\d{2}$/;
const RE_ID = /^[0-9A-Za-z-]*$/;
const RE_NOMBRE = /^\d+([.,]\d+)?$/;
const RE_PI = /^\d{4}-T[1-4]$/;
const RE_ITERATION = /^\d{4}-T[1-4]-(IT[1-6]|IP)$/;
const TYPES = ['tache', 'rendez-vous', 'appel', 'demarche', 'mission', 'story', 'exploration', 'bug'];
const PERIODICITES = ['', 'hebdomadaire', 'mensuelle', 'trimestrielle', 'annuelle'];
const ETATS_EPIC = ['', 'idee', 'analyse', 'pret', 'en_cours', 'termine'];

/** Identifiant unique (lettres, chiffres, tirets : accepté comme lien) */
export function nouvelId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  const h = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');
  return `${h()}${h()}-${h()}-4${h().slice(1)}-${h()}-${h()}${h()}${h()}`;
}

const txt = (v: unknown) => (v === null || v === undefined ? '' : String(v).slice(0, 5000));

/** Liens : format, et seul le plus précis est gardé (feature > epic > objectif > domaine) */
function verifierLiens(o: Record<string, string>) {
  for (const k of ['feature', 'epic', 'objectif', 'domaine', 'parent']) {
    if (o[k] !== undefined && !RE_ID.test(o[k])) throw new Error(`Lien « ${k} » invalide.`);
  }
}
function verifierSafe(o: Record<string, string>) {
  if (o.points !== undefined) {
    o.points = o.points.replace(',', '.');
    if (o.points && !RE_NOMBRE.test(o.points)) throw new Error('Points : nombre attendu.');
  }
  if (o.iteration && !RE_ITERATION.test(o.iteration)) throw new Error('Itération invalide (ex. 2026-T4-IT3).');
  if (o.pi && !RE_PI.test(o.pi)) throw new Error('PI invalide (ex. 2026-T4).');
}

/** Tâche enregistrée : champs connus, formats vérifiés, « terminé le » et statut d'avant calculés */
export function nettoyerItem(input: Partial<Item>, base?: Item): Item {
  const out = {} as Record<string, string>;
  for (const k of ONGLETS.items.colonnes) out[k] = txt((input as Record<string, unknown>)[k] ?? (base as Record<string, unknown> | undefined)?.[k]);
  if (!out.titre.trim()) throw new Error('Le titre est obligatoire.');
  if (!TYPES.includes(out.type)) out.type = 'tache';
  if (out.telephone && !/^[0-9+().\s-]{3,30}$/.test(out.telephone)) throw new Error('Numéro de téléphone invalide.');
  if (!['basse', 'normale', 'haute'].includes(out.priorite)) out.priorite = 'normale';
  if (!['a_faire', 'en_cours', 'termine'].includes(out.statut)) out.statut = 'a_faire';
  // « Terminé le » : posé en passant à « Terminé », gardé tant que la tâche l'est, vidé en sortant
  const avant = base?.statut ?? '';
  out.termine_le = out.statut !== 'termine' ? '' : avant !== 'termine' ? toDateString(new Date()) : base?.termine_le || '';
  // Statut d'avant « Terminé » (« en_cours » ou vide) : décocher le remet
  out.statut_avant = out.statut !== 'termine' ? '' : avant !== 'termine' ? (avant === 'en_cours' ? 'en_cours' : '') : base?.statut_avant || '';
  if (out.date && !RE_DATE.test(out.date)) throw new Error('Date invalide (AAAA-MM-JJ).');
  if (out.heure && !RE_HEURE.test(out.heure)) throw new Error('Heure invalide (HH:MM).');
  if (out.heure_fin && !RE_HEURE.test(out.heure_fin)) throw new Error('Heure de fin invalide (HH:MM).');
  if (out.heure_fin && out.heure && out.heure_fin <= out.heure) throw new Error("L'heure de fin doit être après l'heure de début.");
  if (out.date_fin && !RE_DATE.test(out.date_fin)) throw new Error('Date de fin invalide (AAAA-MM-JJ).');
  if (!PERIODICITES.includes(out.periodicite)) out.periodicite = '';
  if (out.echeance && !/^\d{1,2}(-\d{1,2})?$/.test(out.echeance)) throw new Error('Échéance invalide.');
  if (out.debut && !RE_DATE.test(out.debut)) throw new Error('Date de début invalide (AAAA-MM-JJ).');
  if (out.fin && !RE_DATE.test(out.fin)) throw new Error('Date de fin invalide (AAAA-MM-JJ).');
  if (!/^[0-9A-Za-z;-]*$/.test(out.faits)) throw new Error('Liste des périodes faites invalide.');
  verifierLiens(out);
  verifierSafe(out);
  if (!out.periodicite) Object.assign(out, { echeance: '', debut: '', fin: '', faits: '' });
  return out as unknown as Item;
}

/** Élément (epic, objectif, domaine…) enregistré : champs connus et formats vérifiés */
export function nettoyerEntite<K extends Kind>(kind: K, data: Partial<EntityOf<K>>, base: EntityOf<K> | undefined, domaines: Domaine[]): EntityOf<K> {
  const out = {} as Record<string, string>;
  for (const k of ONGLETS[kind].colonnes) out[k] = txt((data as Record<string, unknown>)[k] ?? (base as Record<string, unknown> | undefined)?.[k]);
  if (kind === 'domaine') {
    if (!out.nom.trim()) throw new Error('Le nom du domaine est obligatoire.');
    out.icone = out.icone.slice(0, 8);
    // Sous-domaine : un seul niveau, sous un domaine principal qui existe ; un domaine qui a des sous-domaines reste principal
    if (out.parent) {
      const id = base?.id ?? '';
      if (!RE_ID.test(out.parent) || out.parent === id) throw new Error('Domaine parent invalide.');
      const p = domaines.find((d) => d.id === out.parent);
      if (!p) throw new Error('Domaine parent introuvable (peut-être supprimé).');
      if (p.parent) throw new Error('Un sous-domaine ne peut pas avoir de sous-domaine.');
      if (id && domaines.some((d) => d.parent === id)) throw new Error('Ce domaine a des sous-domaines : il reste un domaine principal.');
    }
  } else if (kind === 'feature') {
    if (!out.titre.trim()) throw new Error('Le titre est obligatoire.');
    verifierSafe(out);
  } else if (kind === 'ignoree') {
    if (!out.cle.trim()) throw new Error("La clé de l'alerte est obligatoire.");
    out.cle = out.cle.slice(0, 300);
    out.signature = out.signature.slice(0, 2000);
  } else if (kind === 'objectifpi') {
    if (!out.titre.trim()) throw new Error('Le titre est obligatoire.');
    if (!RE_PI.test(out.pi)) throw new Error('PI invalide (ex. 2026-T4).');
    if (out.type !== 'bonus') out.type = 'engage';
    for (const k of ['valeur_prevue', 'valeur_obtenue']) {
      if (out[k] && !(/^\d+$/.test(out[k]) && +out[k] <= 10)) throw new Error('Valeur : entier de 0 à 10.');
    }
  } else {
    if (!out.titre.trim()) throw new Error('Le titre est obligatoire.');
    if (!RE_DATE.test(out.debut)) throw new Error('Date de début invalide (AAAA-MM-JJ).');
    if (out.fin && !RE_DATE.test(out.fin)) throw new Error('Date de fin invalide (AAAA-MM-JJ).');
    if (out.fin && out.fin < out.debut) throw new Error('La date de fin est avant la date de début.');
  }
  if (kind === 'objectif') {
    for (const k of ['cible', 'actuel']) {
      if (out[k] && !/^-?\d+([.,]\d+)?$/.test(out[k])) throw new Error(`Indicateur : « ${k} » doit être un nombre.`);
      out[k] = out[k].replace(',', '.');
    }
    out.unite = out.unite.slice(0, 30);
  }
  if (kind === 'epic' && !ETATS_EPIC.includes(out.etat)) out.etat = '';
  if (out.couleur !== undefined && out.couleur !== '' && !/^#[0-9A-Fa-f]{6}$/.test(out.couleur)) out.couleur = '#1A73E8';
  verifierLiens(out);
  return cleanLinks(out) as unknown as EntityOf<K>;
}

/** Opérations d'un espace, sur une persistance donnée */
export function creerMagasin(p: Persistance) {
  return {
    async list(): Promise<Item[]> {
      return p.lire('items');
    },
    async create(input: ItemInput): Promise<Item> {
      const items = await p.lire('items');
      const now = new Date().toISOString();
      const item = cleanLinks(checkParent({ ...nettoyerItem(input), id: nouvelId(), cree_le: now, modifie_le: now }, items));
      await p.ecrire('items', [...items, item]);
      return item;
    },
    async update(patch: Partial<Item> & { id: string }): Promise<Item> {
      const items = await p.lire('items');
      const current = items.find((i) => i.id === patch.id);
      if (!current) throw new Error('Élément introuvable (peut-être supprimé).');
      const item = cleanLinks(checkParent({ ...nettoyerItem(patch, current), id: current.id, cree_le: current.cree_le, modifie_le: new Date().toISOString() }, items));
      // Le rangement d'un parent s'applique à ses sous-tâches
      await p.ecrire('items', cascadeLinks(item, items.map((i) => (i.id === item.id ? item : i))));
      return item;
    },
    /** Supprime une tâche ; ses sous-tâches sont supprimées (cascade) ou deviennent des tâches normales */
    async remove(id: string, cascade = false): Promise<void> {
      const items = await p.lire('items');
      if (!items.some((i) => i.id === id)) throw new Error('Élément introuvable (peut-être déjà supprimé).');
      await p.ecrire(
        'items',
        items.filter((i) => i.id !== id && !(cascade && i.parent === id)).map((i) => (i.parent === id ? { ...i, parent: '' } : i)),
      );
    },
    async listAll(): Promise<Omit<Data, 'items'>> {
      const [epics, objectifs, domaines, features, objectifsPI, ignorees] = await Promise.all([
        p.lire('epic'),
        p.lire('objectif'),
        p.lire('domaine'),
        p.lire('feature'),
        p.lire('objectifpi'),
        p.lire('ignoree'),
      ]);
      return { epics, objectifs, domaines, features, objectifsPI, ignorees };
    },
    async createEntity<K extends Kind>(kind: K, input: Omit<EntityOf<K>, 'id' | 'cree_le' | 'modifie_le'>): Promise<EntityOf<K>> {
      const list = await p.lire(kind);
      const domaines = kind === 'domaine' ? (list as Domaine[]) : [];
      const now = new Date().toISOString();
      const o = { ...nettoyerEntite(kind, input as Partial<EntityOf<K>>, undefined, domaines), id: nouvelId(), cree_le: now, modifie_le: now } as EntityOf<K>;
      await p.ecrire(kind, [...(list as EntityOf<K>[]), o] as never);
      return o;
    },
    async updateEntity<K extends Kind>(kind: K, patch: Partial<EntityOf<K>> & { id: string }): Promise<EntityOf<K>> {
      const list = (await p.lire(kind)) as EntityOf<K>[];
      const current = list.find((e) => e.id === patch.id);
      if (!current) throw new Error('Élément introuvable (peut-être supprimé).');
      const domaines = kind === 'domaine' ? (list as unknown as Domaine[]) : [];
      const o = { ...nettoyerEntite(kind, patch, current, domaines), id: current.id, cree_le: current.cree_le, modifie_le: new Date().toISOString() } as EntityOf<K>;
      await p.ecrire(kind, list.map((e) => (e.id === o.id ? o : e)) as never);
      return o;
    },
    async deleteEntity(kind: Kind, id: string, cascade: boolean): Promise<DeletionCounts> {
      const [items, all] = await Promise.all([p.lire('items'), this.listAll()]);
      const r = planDeletion(kind, id, cascade, { items, ...all });
      // Seules les tables modifiées sont réécrites
      const pairs: [Table, unknown[], unknown[]][] = [
        ['items', items, r.items],
        ['epic', all.epics, r.epics],
        ['objectif', all.objectifs, r.objectifs],
        ['domaine', all.domaines, r.domaines],
        ['feature', all.features, r.features],
        ['objectifpi', all.objectifsPI, r.objectifsPI],
        ['ignoree', all.ignorees ?? [], r.ignorees ?? []],
      ];
      await Promise.all(pairs.filter(([, a, b]) => JSON.stringify(a) !== JSON.stringify(b)).map(([t, , b]) => p.ecrire(t, b as never)));
      return r.counts;
    },
  };
}
export type Magasin = ReturnType<typeof creerMagasin>;
