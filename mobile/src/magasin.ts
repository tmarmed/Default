import { toDateString } from './dates';
import { lireCalendrier } from './pi';
import { COLONNES_SERIE, type SerieReunion } from './series';
import { cleanLinks, type Data, type DeletionCounts, planDeletion } from './hierarchy';
import { aPurger } from './stockage';
import { cascadeLinks, checkParent } from './subtasks';
import { type Concretisation, type Domaine, type Echange, type Epic, type Feature, type Ignoree, type Item, type ItemInput, NATURES_ECHANGE, type Objectif, type ObjectifPI, type PointReunion, type ResultatCle, TYPES_POINT, type ValueStream } from './types';
import { CLE_ORG, type EntiteOrg, type EquipeAgile, type KindOrg, membresDe, type Org, type Personne } from './organisation';

/**
 * Règles d'enregistrement d'un espace (celles de l'ancien script Google Apps Script), communes à la démo
 * (données sur l'appareil) et aux Google Sheets (connexion Google directe) : vérifications, « terminé le »,
 * sous-tâches, rattachements, suppression en cascade.
 */

export type Kind = 'epic' | 'objectif' | 'domaine' | 'feature' | 'objectifpi' | 'ignoree' | 'valuestream' | 'resultat' | 'echange';
/** Tables de base (tous les espaces) */
export type TableBase = 'items' | Kind;
/** Tables de l'Organisation (seulement dans le Google Sheet d'une entreprise, onglets créés au premier usage) */
export type Table = TableBase | KindOrg | 'piecejointe' | 'pointreunion' | 'serie';
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
          : K extends 'valuestream'
            ? ValueStream
            : K extends 'resultat'
              ? ResultatCle
              : K extends 'echange'
                ? Echange
                : Ignoree;
type RowOf<T extends Table> = T extends 'items' ? Item : T extends Kind ? EntityOf<T> : T extends KindOrg ? EntiteOrg<T> : T extends 'piecejointe' ? LignePiece : T extends 'pointreunion' ? PointReunion : T extends 'serie' ? SerieReunion : never;
/** Morceau d'une pièce jointe (onglet PiecesJointes) : une cellule contient au plus 50 000 caractères */
export interface LignePiece {
  id: string;
  piece: string;
  nom: string;
  type: string;
  taille: string;
  partie: string;
  total: string;
  donnees: string;
  cree_le: string;
  /** Contrôle du morceau « longueurxsomme » (somme des codes des caractères × leur rang) : un morceau abîmé est repéré */
  controle?: string;
}
/** Pièce jointe reconstituée (données en base64) */
export interface PieceJointe {
  id: string;
  nom: string;
  type: string;
  taille: number;
  donnees: string;
}
export interface PieceEntree {
  nom: string;
  type: string;
  donnees: string;
}
/** Contrôle d'un morceau : « longueurxsomme des codes × rang » (« x » : Google ne le prend pas pour une durée) (le même calcul existe en formule Google Sheets) */
export function controleMorceau(t: string): string {
  let somme = 0;
  for (let i = 0; i < t.length; i++) somme += t.charCodeAt(i) * (i + 1);
  return `${t.length}x${somme}`;
}
/** Limites : 1 Mo par fichier, 5 pièces par échange ; morceaux de 45 000 caractères */
export const PIECES = { tailleMax: 1_000_000, nombreMax: 5, morceau: 45_000 };

/** Onglets du Google Sheet d'un espace et leurs colonnes (mêmes noms que l'ancien script : fichiers compatibles) */
export const ONGLETS: Record<TableBase, { nom: string; colonnes: string[] }> = {
  items: {
    nom: 'Taches',
    colonnes: [
      'id', 'titre', 'type', 'date', 'heure', 'lieu', 'description', 'priorite', 'statut', 'cree_le', 'modifie_le',
      'periodicite', 'echeance', 'debut', 'fin', 'faits', 'epic', 'objectif', 'domaine', 'points', 'iteration', 'feature',
      'telephone', 'parent', 'heure_fin', 'date_fin', 'termine_le', 'statut_avant', 'equipe', 'responsable', 'rang',
    ],
  },
  epic: { nom: 'Epics', colonnes: ['id', 'titre', 'description', 'debut', 'fin', 'couleur', 'cree_le', 'modifie_le', 'objectif', 'domaine', 'etat', 'portfolio', 'value_streams', 'okrs', 'rang'] },
  feature: { nom: 'Features', colonnes: ['id', 'titre', 'description', 'epic', 'pi', 'iteration', 'points', 'couleur', 'cree_le', 'modifie_le', 'train', 'equipe', 'rang'] },
  objectifpi: { nom: 'ObjectifsPI', colonnes: ['id', 'titre', 'pi', 'type', 'valeur_prevue', 'valeur_obtenue', 'cree_le', 'modifie_le', 'domaine', 'epic'] },
  objectif: { nom: 'Objectifs', colonnes: ['id', 'titre', 'description', 'domaine', 'debut', 'fin', 'couleur', 'cible', 'actuel', 'unite', 'cree_le', 'modifie_le'] },
  domaine: { nom: 'Domaines', colonnes: ['id', 'nom', 'icone', 'couleur', 'cree_le', 'modifie_le', 'parent'] },
  ignoree: { nom: 'Ignorees', colonnes: ['id', 'cle', 'signature', 'cree_le', 'modifie_le'] },
  valuestream: { nom: 'ValueStreams', colonnes: ['id', 'nom', 'type', 'description', 'portfolio', 'trains', 'okrs', 'cree_le', 'modifie_le'] },
  resultat: { nom: 'ResultatsCles', colonnes: ['id', 'objectif', 'titre', 'actuel', 'cible', 'unite', 'cree_le', 'modifie_le'] },
  echange: { nom: 'Echanges', colonnes: ['id', 'de', 'a', 'type', 'titre', 'texte', 'choix', 'reponse', 'note', 'statut', 'element', 'cree_le', 'modifie_le', 'niveau', 'transmis_par', 'prive', 'pieces_jointes', 'point', 'parent', 'nature'] },
};
export const TABLES = Object.keys(ONGLETS) as TableBase[];

/** Onglets de l'Organisation d'une entreprise (vue Entreprise et vue Delivery SAFe) */
export const ONGLETS_ORG: Record<KindOrg, { nom: string; colonnes: string[] }> = {
  personne: { nom: 'Personnes', colonnes: ['id', 'nom', 'email', 'unite', 'manager', 'capacite', 'metier', 'cree_le', 'modifie_le', 'nature'] },
  unite: { nom: 'Unites', colonnes: ['id', 'nom', 'type', 'parent', 'responsable', 'cree_le', 'modifie_le'] },
  portfolio: { nom: 'Portfolios', colonnes: ['id', 'nom', 'epic_owner', 'cree_le', 'modifie_le'] },
  train: { nom: 'Trains', colonnes: ['id', 'nom', 'portfolio', 'rte', 'pm', 'cree_le', 'modifie_le', 'calendrier'] },
  equipeagile: { nom: 'EquipesAgiles', colonnes: ['id', 'nom', 'train', 'po', 'sm', 'membres', 'cree_le', 'modifie_le', 'calendrier'] },
};
export const TABLES_ORG = Object.keys(ONGLETS_ORG) as KindOrg[];
/** Toutes les tables et leurs onglets */
/** Pièces jointes des échanges : onglet créé au premier usage */
export const ONGLET_PIECES = { nom: 'PiecesJointes', colonnes: ['id', 'piece', 'nom', 'type', 'taille', 'partie', 'total', 'donnees', 'cree_le', 'controle'] };
/** Points notés pendant les réunions (daily…) : onglet créé au premier usage, dans le Sheet de l'espace de l'équipe */
export const ONGLET_POINTS = {
  nom: 'PointsReunion',
  colonnes: ['id', 'reunion', 'personne', 'auteur', 'type', 'texte', 'element', 'concretisation', 'tache', 'responsable', 'cree_le', 'statut', 'validateur', 'echeance', 'note', 'type_cree', 'rattache', 'echange', 'sous_type'],
};
/** Séries de réunions (07/10) : une ligne par série (règle + exceptions), onglet créé au premier usage */
export const ONGLET_SERIES = { nom: 'Reunions', colonnes: [...COLONNES_SERIE] as string[] };
export const ONGLETS_TOUS: Record<Table, { nom: string; colonnes: string[] }> = { ...ONGLETS, ...ONGLETS_ORG, piecejointe: ONGLET_PIECES, pointreunion: ONGLET_POINTS, serie: ONGLET_SERIES };

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
    if (o.rang && !/^\d+$/.test(o.rang)) o.rang = '';
  }
  if (o.iteration && !RE_ITERATION.test(o.iteration)) throw new Error('Sprint invalide (ex. 2026-T4-IT3).');
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
  } else if (kind === 'valuestream') {
    out.nom = out.nom.trim();
    if (!out.nom) throw new Error('Le nom du value stream est obligatoire.');
    if (out.type !== 'developpement') out.type = 'operationnel';
    for (const k of ['trains', 'okrs']) if (!/^[0-9A-Za-z;-]*$/.test(out[k])) throw new Error(`Liste « ${k} » invalide.`);
  } else if (kind === 'echange') {
    out.de = out.de.trim().toLowerCase();
    out.a = out.a.trim().toLowerCase();
    if (!out.de || !out.a) throw new Error('Message : auteur et destinataire obligatoires.');
    if (out.type !== 'question') out.type = 'message';
    out.pieces_jointes = (out.pieces_jointes ?? '').split(';').map((x: string) => x.trim()).filter(Boolean).join(';');
    if (out.pieces_jointes && !/^[0-9A-Za-z;-]+$/.test(out.pieces_jointes)) throw new Error('Pièces jointes invalides.');
    if (!out.titre.trim() && !out.texte.trim() && !out.pieces_jointes) throw new Error("Le message est vide.");
    if (out.type === 'question' && !out.choix.split(';').filter((c: string) => c.trim()).length) throw new Error('Une question a au moins un choix.');
    if (out.statut !== 'repondu' && out.statut !== 'pris_en_compte' && out.statut !== 'transmis') out.statut = 'envoye';
    out.texte = out.texte.slice(0, 4000);
    if (out.element && !RE_ID.test(out.element)) throw new Error('Élément lié invalide.');
    if (out.niveau && !/^(equipeagile|train|portfolio|unite):[0-9A-Za-z-]+$/.test(out.niveau)) throw new Error('Niveau du message invalide.');
    out.transmis_par = (out.transmis_par ?? '').trim().toLowerCase();
    out.prive = out.prive === '0' ? '0' : '1';
    // « Valider ? » d'un point de suivi : « espace|id du point »
    out.point = (out.point ?? '').trim();
    if (out.point && !/^[0-9A-Za-z_-]+\|[0-9A-Za-z_-]+(\|[0-9A-Za-z_-]+\|[0-9A-Za-z_-]+)?$/.test(out.point)) throw new Error('Point lié invalide.');
    // Transmettre (validation du 08/10) : maillon précédent de la chaîne ; nature du message
    out.parent = (out.parent ?? '').trim();
    if (out.parent && !RE_ID.test(out.parent)) throw new Error('Maillon précédent invalide.');
    if (!(NATURES_ECHANGE as string[]).includes(out.nature ?? '')) out.nature = '';
  } else if (kind === 'resultat') {
    if (!out.titre.trim()) throw new Error('Le titre du résultat clé est obligatoire.');
    if (!out.objectif || !RE_ID.test(out.objectif)) throw new Error('Résultat clé : OKR manquant.');
    for (const k of ['cible', 'actuel']) {
      if (out[k] && !/^-?\d+([.,]\d+)?$/.test(out[k])) throw new Error(`Résultat clé : « ${k} » doit être un nombre.`);
      out[k] = out[k].replace(',', '.');
    }
    out.unite = out.unite.slice(0, 30);
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
  if (kind === 'epic') for (const k of ['value_streams', 'okrs']) if (!/^[0-9A-Za-z;-]*$/.test(out[k])) throw new Error(`Liste « ${k} » invalide.`);
  if ((kind === 'epic' || kind === 'feature') && out.rang && !/^\d+$/.test(out.rang)) out.rang = '';
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
    if (!['ia_chat', 'agent_ia'].includes(out.nature ?? '')) out.nature = 'humain';
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
  // Calendrier agile (train, équipe) : JSON borné ; vide = celui du train, ou par défaut
  if (kind === 'train' || kind === 'equipeagile') out.calendrier = out.calendrier?.trim() ? JSON.stringify(lireCalendrier(out.calendrier)) : '';
  const liste = org[CLE_ORG[kind]] as { id: string; nom: string }[];
  if (liste.some((x) => x.id !== id && x.nom.trim().toLowerCase() === out.nom.toLowerCase()))
    throw new Error(`Ce nom existe déjà (${out.nom}).`);
  return out as unknown as EntiteOrg<K>;
}

const UNITES = ['jour', 'semaine', 'mois', 'trimestre', 'annee', 'sprint', 'pi'];
/** Série de réunions enregistrée : champs connus et vérifiés (règle, heure, durée, e-mails, exceptions) */
export function nettoyerSerie(data: Partial<SerieReunion>, base?: SerieReunion): SerieReunion {
  const out = {} as Record<string, string>;
  for (const k of ONGLET_SERIES.colonnes) out[k] = txt((data as Record<string, unknown>)[k] ?? (base as Record<string, unknown> | undefined)?.[k]);
  if (!/^[0-9A-Za-z:~_-]{1,120}$/.test(out.id)) throw new Error('Série : identifiant invalide.');
  if (!UNITES.includes(out.unite)) throw new Error('Série : périodicité invalide.');
  if (!['', 'debut', 'milieu', 'fin', 'ip'].includes(out.ancre)) out.ancre = '';
  if (!/^-?\d{0,3}$/.test(out.ecart)) out.ecart = '';
  if (!/^(ouvres|[1-7](;[1-7])*)?$/.test(out.jours)) throw new Error('Série : jours invalides.');
  if (!/^\d{0,2}$/.test(out.tous)) out.tous = '';
  out.sauf = out.sauf.split(';').filter((x) => ['debut_pi', 'fin_pi', 'sprint1', 'ip', 'trimestre', 'annee'].includes(x)).join(';');
  if (!/^\d{1,2}:\d{2}$/.test(out.heure)) throw new Error('Série : heure invalide (ex. 9:30).');
  if (!/^\d{1,3}$/.test(out.duree) || Number(out.duree) < 5) throw new Error('Série : durée invalide (minutes).');
  for (const k of ['debut', 'fin']) if (out[k] && !/^\d{4}-\d{2}-\d{2}$/.test(out[k])) throw new Error('Série : date invalide.');
  out.animateur = out.animateur.trim().toLowerCase();
  if (out.animateur && !RE_EMAIL.test(out.animateur)) throw new Error('Série : e-mail de l’animateur invalide.');
  for (const k of ['editeurs', 'participants']) {
    const l = [...new Set(out[k].split(';').map((x) => x.trim().toLowerCase()).filter(Boolean))];
    if (l.some((x) => !RE_EMAIL.test(x))) throw new Error('Série : e-mail invalide.');
    out[k] = l.join(';');
  }
  if (out.exceptions) {
    let ok = false;
    try {
      ok = Array.isArray(JSON.parse(out.exceptions));
    } catch {
      ok = false;
    }
    if (!ok) throw new Error('Série : exceptions invalides.');
  }
  out.titre = out.titre.trim().slice(0, 200);
  if (!out.type_reunion && !out.titre) throw new Error('Donnez un titre à la réunion.');
  if (out.actif !== 'non') out.actif = '';
  return out as unknown as SerieReunion;
}

const CONCRETISATIONS: Concretisation[] = ['', 'sous_tache', 'tache', 'rien', 'escalade', 'synchro', 'suivi'];
/** Point de réunion enregistré : champs connus et vérifiés (type, texte, e-mails, liens) */
export function nettoyerPoint(data: Partial<PointReunion>, base?: PointReunion): PointReunion {
  const out = {} as Record<string, string>;
  for (const k of ONGLET_POINTS.colonnes) out[k] = txt((data as Record<string, unknown>)[k] ?? (base as Record<string, unknown> | undefined)?.[k]);
  out.texte = out.texte.trim().slice(0, 1000);
  if (!out.texte) throw new Error('Point vide.');
  if (!(TYPES_POINT as string[]).includes(out.type)) throw new Error('Type de point invalide.');
  if (!/^[a-z_]+-[0-9A-Za-z:-]*\d{4}-\d{2}-\d{2}$/.test(out.reunion)) throw new Error('Réunion du point invalide.');
  for (const k of ['personne', 'auteur', 'responsable']) out[k] = out[k].trim().toLowerCase();
  if (!out.personne || !out.auteur) throw new Error('Point : personne et auteur obligatoires.');
  for (const k of ['element', 'tache']) if (!RE_ID.test(out[k])) throw new Error(`Lien « ${k} » invalide.`);
  if (!(CONCRETISATIONS as string[]).includes(out.concretisation)) out.concretisation = '';
  // Point de suivi (08/10) : statut, validateur, échéance, mot ou motif ; type créé et rattachement
  if (!['', 'en_cours', 'fait', 'valide', 'a_reprendre', 'abandonne'].includes(out.statut)) out.statut = '';
  out.validateur = out.validateur.trim().toLowerCase();
  if (out.echeance && !/^\d{4}-\d{2}-\d{2}$/.test(out.echeance)) out.echeance = '';
  out.note = out.note.trim().slice(0, 1000);
  if (out.rattache && !RE_ID.test(out.rattache)) throw new Error('Rattachement invalide.');
  if (out.echange && !RE_ID.test(out.echange)) throw new Error('Échange lié invalide.');
  if (!['', 'a_prendre', 'prise'].includes(out.sous_type)) out.sous_type = '';
  if (out.type !== 'decision') out.sous_type = '';
  out.type_cree = out.type_cree.replace(/[^a-z_-]/g, '').slice(0, 30);
  return out as unknown as PointReunion;
}

/** Espace Équipe : ses personnes et sa ligne d'équipe */
export type EquipeEspace = Pick<Org, 'personnes' | 'equipes'>;
export type RoleEquipe = 'membre' | 'po' | 'sm';

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
    /**
     * Plusieurs tâches créées d'un coup (une lecture, une écriture) : sous-tâches et tâches nées d'une réunion.
     * Renvoie les tâches créées, dans l'ordre demandé.
     */
    async creerItems(inputs: ItemInput[]): Promise<Item[]> {
      if (!inputs.length) return [];
      const items = await p.lire('items');
      const now = new Date().toISOString();
      const crees: Item[] = [];
      for (const input of inputs) crees.push(cleanLinks(checkParent({ ...nettoyerItem(input), id: nouvelId(), cree_le: now, modifie_le: now }, [...items, ...crees])));
      await p.ecrire('items', [...items, ...crees]);
      return crees;
    },
    /**
     * Plusieurs tâches modifiées d'un coup (une lecture, une écriture) : stories engagées en planification,
     * acceptées en revue, estimées en affinage… Renvoie les tâches modifiées, dans l'ordre demandé.
     */
    async modifierItems(patches: (Partial<Item> & { id: string })[]): Promise<Item[]> {
      if (!patches.length) return [];
      let items = await p.lire('items');
      const out: Item[] = [];
      for (const patch of patches) {
        const current = items.find((i) => i.id === patch.id);
        if (!current) throw new Error('Élément introuvable (peut-être supprimé).');
        const item = cleanLinks(checkParent({ ...nettoyerItem(patch, current), id: current.id, cree_le: current.cree_le, modifie_le: new Date().toISOString() }, items));
        items = cascadeLinks(item, items.map((i) => (i.id === item.id ? item : i)));
        out.push(item);
      }
      await p.ecrire('items', items);
      return out;
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
      const [epics, objectifs, domaines, features, objectifsPI, ignorees, valueStreams, resultats, echanges, series] = await Promise.all([
        p.lire('epic'),
        p.lire('objectif'),
        p.lire('domaine'),
        p.lire('feature'),
        p.lire('objectifpi'),
        p.lire('ignoree'),
        p.lire('valuestream'),
        p.lire('resultat'),
        p.lire('echange'),
        p.lire('serie'),
      ]);
      return { epics, objectifs, domaines, features, objectifsPI, ignorees, valueStreams, resultats, echanges, series };
    },
    async createEntity<K extends Kind>(kind: K, input: Omit<EntityOf<K>, 'id' | 'cree_le' | 'modifie_le'>): Promise<EntityOf<K>> {
      const list = await p.lire(kind);
      const domaines = kind === 'domaine' ? (list as Domaine[]) : [];
      const now = new Date().toISOString();
      const o = { ...nettoyerEntite(kind, input as Partial<EntityOf<K>>, undefined, domaines), id: nouvelId(), cree_le: now, modifie_le: now } as EntityOf<K>;
      await p.ecrire(kind, [...(list as EntityOf<K>[]), o] as never);
      return o;
    },
    /**
     * Plusieurs créations et modifications d'une même table en un seul passage (une lecture, une écriture) :
     * évite de dépasser le quota de Google (environ 60 écritures par minute) quand on écrit beaucoup d'éléments.
     */
    async ecrireLot<K extends Kind>(
      kind: K,
      creer: Omit<EntityOf<K>, 'id' | 'cree_le' | 'modifie_le'>[],
      modifier: (Partial<EntityOf<K>> & { id: string })[],
    ): Promise<{ crees: EntityOf<K>[]; modifies: EntityOf<K>[] }> {
      if (!creer.length && !modifier.length) return { crees: [], modifies: [] };
      let list = (await p.lire(kind)) as EntityOf<K>[];
      const now = new Date().toISOString();
      const domaines = () => (kind === 'domaine' ? (list as unknown as Domaine[]) : []);
      const modifies: EntityOf<K>[] = [];
      for (const patch of modifier) {
        const current = list.find((e) => e.id === patch.id);
        if (!current) throw new Error('Élément introuvable (peut-être supprimé).');
        const o = { ...nettoyerEntite(kind, patch, current, domaines()), id: current.id, cree_le: current.cree_le, modifie_le: now } as EntityOf<K>;
        list = list.map((e) => (e.id === o.id ? o : e));
        modifies.push(o);
      }
      const crees = creer.map((input) => ({ ...nettoyerEntite(kind, input as Partial<EntityOf<K>>, undefined, domaines()), id: nouvelId(), cree_le: now, modifie_le: now }) as EntityOf<K>);
      await p.ecrire(kind, [...list, ...crees] as never);
      return { crees, modifies };
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
    /**
     * Modifier un échange envoyé : tant qu'il n'est pas lu (toujours là, statut « envoye »), il est modifié sur
     * place ; déjà lu (répondu, pris en compte ou supprimé), la modification part en nouvel échange. Une lecture,
     * une écriture.
     */
    async modifierEchange(patch: Partial<Echange> & { id: string }): Promise<{ e: Echange; nouveau: boolean }> {
      const list = (await p.lire('echange')) as Echange[];
      const now = new Date().toISOString();
      const current = list.find((e) => e.id === patch.id);
      if (current && current.statut === 'envoye') {
        const o = { ...nettoyerEntite('echange', patch, current, []), id: current.id, cree_le: current.cree_le, modifie_le: now } as Echange;
        await p.ecrire('echange', list.map((e) => (e.id === o.id ? o : e)) as never);
        return { e: o, nouveau: false };
      }
      const { id: _id, ...reste } = patch;
      const o = { ...nettoyerEntite('echange', { ...reste, reponse: '', note: '', statut: 'envoye' }, undefined, []), id: nouvelId(), cree_le: now, modifie_le: now } as Echange;
      await p.ecrire('echange', [...list, o] as never);
      return { e: o, nouveau: true };
    },
    /**
     * Pièces jointes d'un échange : chaque fichier (base64) est découpé en morceaux de moins de 50 000 caractères
     * (limite d'une cellule) dans l'onglet PiecesJointes. Une lecture et une écriture ; renvoie les ids.
     */
    async ajouterPieces(pieces: PieceEntree[]): Promise<string[]> {
      if (!pieces.length) return [];
      if (pieces.length > PIECES.nombreMax) throw new Error(`Au plus ${PIECES.nombreMax} pièces jointes.`);
      const now = new Date().toISOString();
      const lignes: LignePiece[] = [];
      const ids: string[] = [];
      for (const x of pieces) {
        const taille = Math.floor((x.donnees.length * 3) / 4);
        if (taille > PIECES.tailleMax) throw new Error(`« ${x.nom} » dépasse 1 Mo.`);
        if (!/^[A-Za-z0-9+/=]*$/.test(x.donnees)) throw new Error(`« ${x.nom} » : données invalides.`);
        const id = nouvelId();
        ids.push(id);
        const total = Math.max(1, Math.ceil(x.donnees.length / PIECES.morceau));
        for (let k = 0; k < total; k++)
          lignes.push({ id: `${id}-${k}`, piece: id, nom: x.nom.slice(0, 200), type: x.type.slice(0, 100), taille: String(taille), partie: String(k), total: String(total), donnees: x.donnees.slice(k * PIECES.morceau, (k + 1) * PIECES.morceau), cree_le: now, controle: '' });
      for (const l of lignes) if (!l.controle) l.controle = controleMorceau(l.donnees);
      }
      const avant = await p.lire('piecejointe');
      await p.ecrire('piecejointe', [...avant, ...lignes]);
      return ids;
    },
    /**
     * Séries de réunions créées ou modifiées en un seul passage (une lecture, une écriture), quel que soit leur
     * nombre (création des séries au démarrage, « celle-ci et les suivantes »…). Jamais de suppression : une série
     * arrêtée garde sa ligne (`actif` = « non »).
     */
    async ecrireSeries(lot: SerieReunion[]): Promise<SerieReunion[]> {
      if (!lot.length) return [];
      let list = await p.lire('serie');
      const now = new Date().toISOString();
      const out: SerieReunion[] = [];
      for (const x of lot) {
        const base = list.find((y) => y.id === x.id);
        const o = { ...nettoyerSerie(x, base), cree_le: base?.cree_le || x.cree_le || now, modifie_le: now };
        list = base ? list.map((y) => (y.id === o.id ? o : y)) : [...list, o];
        out.push(o);
      }
      await p.ecrire('serie', list);
      return out;
    },
    /** Points des réunions dont l'id commence par `prefixe` (ex. tous les dailies d'une équipe) : une lecture */
    async lirePoints(prefixe: string): Promise<PointReunion[]> {
      return (await p.lire('pointreunion')).filter((x) => x.reunion.startsWith(prefixe));
    },
    /**
     * « ↻ Actualiser » d'une réunion : ses points (id commençant par `prefixe`), les tâches et les échanges de
     * l'espace, lus en même temps (une seule lecture groupée)
     */
    async lireReunion(prefixe: string): Promise<{ points: PointReunion[]; items: Item[]; echanges: Echange[] }> {
      const [points, items, echanges] = await Promise.all([p.lire('pointreunion'), p.lire('items'), p.lire('echange')]);
      return { points: points.filter((x) => x.reunion.startsWith(prefixe)), items, echanges };
    },
    /**
     * Points d'une réunion en un seul passage (une lecture, une écriture) : `creer` (nouveaux points), `modifier`
     * (concrétisation, tâche créée, responsable…), `retirer` (ids : point repris par le participant qui renvoie sa
     * préparation). Renvoie les points créés et modifiés.
     */
    async ecrirePoints(creer: Omit<PointReunion, 'id' | 'cree_le'>[], modifier: (Partial<PointReunion> & { id: string })[], retirer: string[] = []): Promise<{ crees: PointReunion[]; modifies: PointReunion[] }> {
      if (!creer.length && !modifier.length && !retirer.length) return { crees: [], modifies: [] };
      const sans = new Set(retirer);
      let list = (await p.lire('pointreunion')).filter((x) => !sans.has(x.id));
      const now = new Date().toISOString();
      const modifies: PointReunion[] = [];
      for (const patch of modifier) {
        const current = list.find((x) => x.id === patch.id);
        if (!current) throw new Error('Point introuvable (peut-être retiré).');
        const o = { ...nettoyerPoint(patch, current), id: current.id, cree_le: current.cree_le };
        list = list.map((x) => (x.id === o.id ? o : x));
        modifies.push(o);
      }
      const crees = creer.map((x) => ({ ...nettoyerPoint(x), id: nouvelId(), cree_le: now }));
      await p.ecrire('pointreunion', [...list, ...crees]);
      return { crees, modifies };
    },
    /** Pièces jointes reconstituées (une lecture) ; une pièce incomplète est ignorée */
    async lirePieces(ids: string[]): Promise<PieceJointe[]> {
      if (!ids.length) return [];
      const lignes = await p.lire('piecejointe');
      return ids.flatMap((id) => {
        const l = lignes.filter((x) => x.piece === id).sort((a, b) => Number(a.partie) - Number(b.partie));
        if (!l.length || l.length !== Number(l[0].total)) return [];
        // Un morceau abîmé (recopie fausse) : la pièce n'est pas montrée, plutôt qu'une image cassée
        if (l.some((x) => x.controle && x.controle !== controleMorceau(x.donnees))) return [];
        return [{ id, nom: l[0].nom, type: l[0].type, taille: Number(l[0].taille) || 0, donnees: l.map((x) => x.donnees).join('') }];
      });
    },
    /**
     * Pas d'historique : les pièces qu'aucun échange ne cite plus (échange lu, pris en compte) sont effacées. Celles
     * de moins de 10 minutes restent (échange en cours d'envoi). Une lecture, une écriture s'il y a à effacer.
     */
    async purgerPieces(): Promise<number> {
      const [lignes, echanges] = await Promise.all([p.lire('piecejointe'), p.lire('echange')]);
      const citees = new Set(echanges.flatMap((e) => (e.pieces_jointes ?? '').split(';').filter(Boolean)));
      const limite = Date.now() - 10 * 60_000;
      const garde = lignes.filter((x) => citees.has(x.piece) || Date.parse(x.cree_le) > limite);
      if (garde.length !== lignes.length) await p.ecrire('piecejointe', garde);
      return lignes.length - garde.length;
    },
    /**
     * Changer sa réponse à une question : possible tant que l'autre ne l'a pas prise en compte (ligne encore là,
     * statut « repondu »). Une lecture, une écriture.
     */
    async changerReponse(id: string, reponse: string, note: string): Promise<Echange> {
      const list = (await p.lire('echange')) as Echange[];
      const current = list.find((e) => e.id === id);
      if (!current || current.statut !== 'repondu') throw new Error('Déjà prise en compte par l’autre personne : la réponse ne peut plus changer.');
      const o = { ...nettoyerEntite('echange', { reponse, note }, current, []), id: current.id, cree_le: current.cree_le, modifie_le: new Date().toISOString() } as Echange;
      await p.ecrire('echange', list.map((e) => (e.id === o.id ? o : e)) as never);
      return o;
    },
    /** Espace Équipe (hors entreprise) : ses personnes et sa ligne d'équipe (rôles, membres) — une lecture */
    async listEquipe(): Promise<EquipeEspace> {
      const [personnes, equipes] = await Promise.all([p.lire('personne'), p.lire('equipeagile')]);
      return { personnes, equipes };
    },
    /**
     * Espace Équipe : ajoute ou modifie un membre (`personne`, avec son rôle), ou le retire (`retirer`). La ligne
     * d'équipe est créée au premier membre ; un seul PO et un seul SM (le nouveau remplace l'ancien, qui reste
     * membre). Une lecture et au plus deux écritures.
     */
    async ecrireMembre(nomEquipe: string, m: { personne?: Partial<Personne> & { id?: string }; role?: RoleEquipe; retirer?: string }): Promise<EquipeEspace> {
      const { personnes, equipes } = await this.listEquipe();
      const now = new Date().toISOString();
      let ps = personnes;
      let pid = m.retirer ?? '';
      if (m.retirer) ps = personnes.filter((x) => x.id !== m.retirer);
      else if (m.personne) {
        const base = m.personne.id ? personnes.find((x) => x.id === m.personne!.id) : undefined;
        if (m.personne.id && !base) throw new Error('Membre introuvable (peut-être retiré).');
        const o = { ...nettoyerOrg('personne', m.personne, base, { personnes, equipes, unites: [], portfolios: [], trains: [] }), id: base?.id ?? nouvelId(), cree_le: base?.cree_le ?? now, modifie_le: now } as Personne;
        ps = base ? personnes.map((x) => (x.id === o.id ? o : x)) : [...personnes, o];
        pid = o.id;
      }
      if (!pid) throw new Error('Membre manquant.');
      const avant = equipes[0];
      const eq0: EquipeAgile = avant ?? { id: nouvelId(), nom: nomEquipe.trim() || 'Équipe', train: '', po: '', sm: '', membres: '', cree_le: now, modifie_le: now };
      const membres = membresDe(eq0).filter((x) => x !== pid);
      let po = eq0.po === pid ? '' : eq0.po;
      let sm = eq0.sm === pid ? '' : eq0.sm;
      if (!m.retirer) {
        membres.push(pid);
        if (m.role === 'po') po = pid;
        if (m.role === 'sm') sm = pid;
        // Rôle non précisé (nom, e-mail…) : on garde celui qu'il avait
        if (!m.role) {
          if (eq0.po === pid) po = pid;
          if (eq0.sm === pid) sm = pid;
        }
      }
      const eq = { ...eq0, po, sm, membres: membres.join(';'), modifie_le: now };
      if (ps !== personnes) await p.ecrire('personne', ps as never);
      const eqs = avant ? equipes.map((x) => (x.id === eq.id ? eq : x)) : [...equipes, eq];
      await p.ecrire('equipeagile', eqs as never);
      return { personnes: ps, equipes: eqs };
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
        ['valuestream', all.valueStreams ?? [], r.valueStreams ?? []],
        ['resultat', all.resultats ?? [], r.resultats ?? []],
        ['echange', all.echanges ?? [], r.echanges ?? []],
      ];
      await Promise.all(pairs.filter(([, a, b]) => JSON.stringify(a) !== JSON.stringify(b)).map(([t, , b]) => p.ecrire(t, b as never)));
      return r.counts;
    },
  };
}
export type Magasin = ReturnType<typeof creerMagasin>;
