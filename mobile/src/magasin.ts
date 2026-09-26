import { toDateString } from './dates';
import { cleanLinks, type Data, type DeletionCounts, planDeletion } from './hierarchy';
import { aPurger } from './stockage';
import { cascadeLinks, checkParent } from './subtasks';
import type { Domaine, Epic, Feature, Ignoree, Item, ItemInput, Objectif, ObjectifPI } from './types';
import { CLE_ORG, type EntiteOrg, type KindOrg, membresDe, type Org } from './organisation';

/**
 * Règles d'enregistrement d'un espace (celles de l'ancien script Google Apps Script), communes à la démo
 * (données sur l'appareil) et aux Google Sheets (connexion Google directe) : vérifications, « terminé le »,
 * sous-tâches, rattachements, suppression en cascade.
 */

export type Kind = 'epic' | 'objectif' | 'domaine' | 'feature' | 'objectifpi' | 'ignoree';
/** Tables de base (tous les espaces) */
export type TableBase = 'items' | Kind;
/** Tables de l'Organisation (seulement dans le Google Sheet d'une entreprise, onglets créés au premier usage) */
export type Table = TableBase | KindOrg;
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
type RowOf<T extends Table> = T extends 'items' ? Item : T extends Kind ? EntityOf<T> : T extends KindOrg ? EntiteOrg<T> : never;

/** Onglets du Google Sheet d'un espace et leurs colonnes (mêmes noms que l'ancien script : fichiers compatibles) */
export const ONGLETS: Record<TableBase, { nom: string; colonnes: string[] }> = {
  items: {
    nom: 'Taches',
    colonnes: [
      'id', 'titre', 'type', 'date', 'heure', 'lieu', 'description', 'priorite', 'statut', 'cree_le', 'modifie_le',
      'periodicite', 'echeance', 'debut', 'fin', 'faits', 'epic', 'objectif', 'domaine', 'points', 'iteration', 'feature',
      'telephone', 'parent', 'heure_fin', 'date_fin', 'termine_le', 'statut_avant', 'equipe', 'responsable',
    ],
  },
  epic: { nom: 'Epics', colonnes: ['id', 'titre', 'description', 'debut', 'fin', 'couleur', 'cree_le', 'modifie_le', 'objectif', 'domaine', 'etat', 'portfolio'] },
  feature: { nom: 'Features', colonnes: ['id', 'titre', 'description', 'epic', 'pi', 'iteration', 'points', 'couleur', 'cree_le', 'modifie_le', 'train', 'equipe'] },
  objectifpi: { nom: 'ObjectifsPI', colonnes: ['id', 'titre', 'pi', 'type', 'valeur_prevue', 'valeur_obtenue', 'cree_le', 'modifie_le', 'domaine', 'epic'] },
  objectif: { nom: 'Objectifs', colonnes: ['id', 'titre', 'description', 'domaine', 'debut', 'fin', 'couleur', 'cible', 'actuel', 'unite', 'cree_le', 'modifie_le'] },
  domaine: { nom: 'Domaines', colonnes: ['id', 'nom', 'icone', 'couleur', 'cree_le', 'modifie_le', 'parent'] },
  ignoree: { nom: 'Ignorees', colonnes: ['id', 'cle', 'signature', 'cree_le', 'modifie_le'] },
};
export const TABLES = Object.keys(ONGLETS) as TableBase[];

/** Onglets de l'Organisation d'une entreprise (vue Entreprise et vue Delivery SAFe) */
export const ONGLETS_ORG: Record<KindOrg, { nom: string; colonnes: string[] }> = {
  personne: { nom: 'Personnes', colonnes: ['id', 'nom', 'email', 'unite', 'manager', 'capacite', 'cree_le', 'modifie_le'] },
  unite: { nom: 'Unites', colonnes: ['id', 'nom', 'type', 'parent', 'responsable', 'cree_le', 'modifie_le'] },
  portfolio: { nom: 'Portfolios', colonnes: ['id', 'nom', 'epic_owner', 'cree_le', 'modifie_le'] },
  train: { nom: 'Trains', colonnes: ['id', 'nom', 'portfolio', 'rte', 'pm', 'cree_le', 'modifie_le'] },
  equipeagile: { nom: 'EquipesAgiles', colonnes: ['id', 'nom', 'train', 'po', 'sm', 'membres', 'cree_le', 'modifie_le'] },
};
export const TABLES_ORG = Object.keys(ONGLETS_ORG) as KindOrg[];
/** Toutes les tables et leurs onglets */
export const ONGLETS_TOUS: Record<Table, { nom: string; colonnes: string[] }> = { ...ONGLETS, ...ONGLETS_ORG };

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
  for (const k of ['feature', 'epic', 'objectif', 'domaine', 'parent', 'equipe', 'responsable', 'portfolio', 'train']) {
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

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Élément de l'Organisation enregistré : champs connus et vérifiés (noms, e-mail, liens, pas de boucle) */
export function nettoyerOrg<K extends KindOrg>(kind: K, data: Partial<EntiteOrg<K>>, base: EntiteOrg<K> | undefined, org: Org): EntiteOrg<K> {
  const out = {} as Record<string, string>;
  for (const k of ONGLETS_ORG[kind].colonnes) out[k] = txt((data as Record<string, unknown>)[k] ?? (base as Record<string, unknown> | undefined)?.[k]);
  out.nom = out.nom.trim();
  if (!out.nom) throw new Error('Le nom est obligatoire.');
  const id = base?.id ?? '';
  for (const k of ['unite', 'manager', 'parent', 'responsable', 'epic_owner', 'portfolio', 'rte', 'pm', 'train', 'po', 'sm']) {
    if (out[k] !== undefined && !RE_ID.test(out[k])) throw new Error(`Lien « ${k} » invalide.`);
  }
  if (kind === 'personne') {
    out.email = out.email.trim().toLowerCase();
    if (out.email && !RE_EMAIL.test(out.email)) throw new Error('Adresse e-mail invalide.');
    if (out.email && org.personnes.some((p) => p.id !== id && p.email.toLowerCase() === out.email)) throw new Error('Une personne a déjà cette adresse e-mail.');
    if (out.manager === id && id) throw new Error('Une personne ne peut pas être son propre manager.');
    out.capacite = out.capacite.replace(',', '.');
    if (out.capacite && !RE_NOMBRE.test(out.capacite)) throw new Error('Capacité : nombre de jours attendu.');
  } else if (kind === 'unite') {
    if (out.type !== 'direction') out.type = 'service';
    // Pas de boucle : une unité ne peut pas être placée sous elle-même ou sous une de ses sous-unités
    for (let p = out.parent, n = 0; p; n++) {
      if (p === id || n > 50) throw new Error('Une unité ne peut pas être placée sous elle-même.');
      p = org.unites.find((u) => u.id === p)?.parent ?? '';
    }
  } else if (kind === 'equipeagile') {
    out.membres = [...new Set(out.membres.split(';').map((m) => m.trim()).filter(Boolean))].join(';');
    if (!/^[0-9A-Za-z;-]*$/.test(out.membres)) throw new Error('Liste des membres invalide.');
  }
  const liste = org[CLE_ORG[kind]] as { id: string; nom: string }[];
  if (liste.some((x) => x.id !== id && x.nom.trim().toLowerCase() === out.nom.toLowerCase()))
    throw new Error(`Ce nom existe déjà (${out.nom}).`);
  return out as unknown as EntiteOrg<K>;
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
    /** Stockage : supprime les tâches terminées avant `avant` (mêmes règles que le calcul de l'alerte) ; renvoie les supprimées */
    async purgerTerminees(avant: string): Promise<Item[]> {
      const items = await p.lire('items');
      const parties = aPurger(items, avant);
      if (parties.length) {
        const ids = new Set(parties.map((t) => t.id));
        await p.ecrire('items', items.filter((i) => !ids.has(i.id)));
      }
      return parties;
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
    /** Organisation de l'entreprise (onglets créés au premier usage) */
    async listOrg(): Promise<Org> {
      const [personnes, unites, portfolios, trains, equipes] = await Promise.all([p.lire('personne'), p.lire('unite'), p.lire('portfolio'), p.lire('train'), p.lire('equipeagile')]);
      return { personnes, unites, portfolios, trains, equipes };
    },
    /** Crée (sans id) ou modifie (avec id) un élément de l'Organisation */
    async saveOrg<K extends KindOrg>(kind: K, data: Partial<EntiteOrg<K>> & { id?: string }): Promise<EntiteOrg<K>> {
      const org = await this.listOrg();
      const liste = org[CLE_ORG[kind]] as unknown as EntiteOrg<K>[];
      const now = new Date().toISOString();
      const base = data.id ? liste.find((x) => x.id === data.id) : undefined;
      if (data.id && !base) throw new Error('Élément introuvable (peut-être supprimé).');
      const o = {
        ...nettoyerOrg(kind, data, base, org),
        id: base?.id ?? nouvelId(),
        cree_le: base?.cree_le ?? now,
        modifie_le: now,
      } as EntiteOrg<K>;
      await p.ecrire(kind, (base ? liste.map((x) => (x.id === o.id ? o : x)) : [...liste, o]) as never);
      return o;
    },
    /**
     * Supprime un élément de l'Organisation ; ce qui le désignait est vidé (rien d'autre n'est supprimé) :
     * personne → rôles, manager, responsable, membres, tâches ; unité → sous-unités remontées, personnes sans
     * service ; portfolio → trains et epics sans portfolio ; train → équipes et features sans train ; équipe →
     * features et tâches sans équipe.
     */
    async deleteOrg(kind: KindOrg, id: string): Promise<void> {
      const org = await this.listOrg();
      const vide = <T extends object>(l: T[], champs: string[]) => l.map((x) => (champs.some((c) => (x as Record<string, string>)[c] === id) ? { ...x, ...Object.fromEntries(champs.filter((c) => (x as Record<string, string>)[c] === id).map((c) => [c, ''])) } : x));
      const ecrireSiChange = async (t: Table, avant: unknown[], apres: unknown[]) => {
        if (JSON.stringify(avant) !== JSON.stringify(apres)) await p.ecrire(t, apres as never);
      };
      const sans = <T extends { id: string }>(l: T[]) => l.filter((x) => x.id !== id);
      if (kind === 'personne') {
        await ecrireSiChange('personne', org.personnes, vide(sans(org.personnes), ['manager']));
        await ecrireSiChange('unite', org.unites, vide(org.unites, ['responsable']));
        await ecrireSiChange('portfolio', org.portfolios, vide(org.portfolios, ['epic_owner']));
        await ecrireSiChange('train', org.trains, vide(org.trains, ['rte', 'pm']));
        await ecrireSiChange('equipeagile', org.equipes, vide(org.equipes, ['po', 'sm']).map((e) => ({ ...e, membres: membresDe(e).filter((m) => m !== id).join(';') })));
        const items = await p.lire('items');
        await ecrireSiChange('items', items, vide(items, ['responsable']));
      } else if (kind === 'unite') {
        const u = org.unites.find((x) => x.id === id);
        await ecrireSiChange('unite', org.unites, sans(org.unites).map((x) => (x.parent === id ? { ...x, parent: u?.parent ?? '' } : x)));
        await ecrireSiChange('personne', org.personnes, vide(org.personnes, ['unite']));
      } else if (kind === 'portfolio') {
        await ecrireSiChange('portfolio', org.portfolios, sans(org.portfolios));
        await ecrireSiChange('train', org.trains, vide(org.trains, ['portfolio']));
        const epics = await p.lire('epic');
        await ecrireSiChange('epic', epics, vide(epics, ['portfolio']));
      } else if (kind === 'train') {
        await ecrireSiChange('train', org.trains, sans(org.trains));
        await ecrireSiChange('equipeagile', org.equipes, vide(org.equipes, ['train']));
        const features = await p.lire('feature');
        await ecrireSiChange('feature', features, vide(features, ['train']));
      } else {
        await ecrireSiChange('equipeagile', org.equipes, sans(org.equipes));
        const [features, items] = await Promise.all([p.lire('feature'), p.lire('items')]);
        await ecrireSiChange('feature', features, vide(features, ['equipe']));
        await ecrireSiChange('items', items, vide(items, ['equipe']));
      }
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
