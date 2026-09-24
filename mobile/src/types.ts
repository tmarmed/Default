export type ItemType = 'tache' | 'mission' | 'rendez-vous';
export type Priorite = 'basse' | 'normale' | 'haute';
export type Statut = 'a_faire' | 'en_cours' | 'termine';
/** '' = pas de répétition */
export type Periodicite = '' | 'hebdomadaire' | 'mensuelle' | 'trimestrielle' | 'annuelle';

/** Une ligne de l'onglet « Taches » du Google Sheet. */
export interface Item {
  id: string;
  titre: string;
  type: ItemType;
  /** AAAA-MM-JJ ou vide */
  date: string;
  /** HH:MM ou vide */
  heure: string;
  lieu: string;
  description: string;
  priorite: Priorite;
  statut: Statut;
  cree_le: string;
  modifie_le: string;
  /** Répétition de l'élément */
  periodicite: Periodicite;
  /**
   * Moment dans la période, vide = « dans la période » :
   * semaine « 1 » (lundi) à « 7 » ; mois « 1 » à « 31 » ;
   * trimestre « m » ou « m-j » (m = 1er, 2e ou 3e mois) ; année « MM » ou « MM-JJ ».
   */
  echeance: string;
  /** Première période concernée (AAAA-MM-JJ), vide = date de création */
  debut: string;
  /** Fin de la répétition (AAAA-MM-JJ), vide = sans fin */
  fin: string;
  /** Périodes faites, séparées par « ; » (ex. « 2026-08;2026-09 ») */
  faits: string;
  /** Rattachement (le plus précis seulement) : epic, sinon objectif, sinon domaine (ids) */
  epic: string;
  objectif: string;
  domaine: string;

  // --- Champs calculés par l'application (non enregistrés) ---
  /** Occurrence affichée d'un élément répété : clé de sa période */
  occurrence?: string;
  /** Élément d'origine d'une occurrence */
  baseId?: string;
  /** Occurrence sans jour précis : étendue de la période */
  fenetre?: 'semaine' | 'mois' | 'trimestre' | 'annee';
  /** Libellé de la période (« sept. 2026 », « semaine du 21 sept. »…) */
  periodeLabel?: string;
  /** Périodes oubliées, regroupées sur une ligne « En retard » */
  retards?: string[];
}

export type ItemInput = Omit<
  Item,
  'id' | 'cree_le' | 'modifie_le' | 'occurrence' | 'baseId' | 'fenetre' | 'periodeLabel' | 'retards'
>;

/** Champs ajoutés avec la répétition : valeurs par défaut pour les anciennes données. */
export const RECURRENCE_DEFAUTS = {
  periodicite: '',
  echeance: '',
  debut: '',
  fin: '',
  faits: '',
  epic: '',
  objectif: '',
  domaine: '',
} as const;

/** Une ligne de l'onglet « Epics » : grand projet affiché dans la roadmap. */
export interface Epic {
  id: string;
  titre: string;
  description: string;
  /** AAAA-MM-JJ */
  debut: string;
  /** AAAA-MM-JJ, vide = epic sans fin (infinie) */
  fin: string;
  /** #RRGGBB */
  couleur: string;
  cree_le: string;
  modifie_le: string;
  /** Objectif (id), sinon domaine (id) */
  objectif: string;
  domaine: string;
}

export type EpicInput = Omit<Epic, 'id' | 'cree_le' | 'modifie_le'>;

/** Onglet « Objectifs » : résultat à atteindre, daté ou permanent. */
export interface Objectif {
  id: string;
  titre: string;
  description: string;
  domaine: string;
  debut: string;
  /** vide = objectif permanent */
  fin: string;
  couleur: string;
  /** Indicateur facultatif : valeur cible, valeur actuelle, unité */
  cible: string;
  actuel: string;
  unite: string;
  cree_le: string;
  modifie_le: string;
}

export type ObjectifInput = Omit<Objectif, 'id' | 'cree_le' | 'modifie_le'>;

/** Onglet « Domaines » : grande catégorie permanente (Pro, Perso…). */
export interface Domaine {
  id: string;
  nom: string;
  icone: string;
  couleur: string;
  cree_le: string;
  modifie_le: string;
}

export type DomaineInput = Omit<Domaine, 'id' | 'cree_le' | 'modifie_le'>;

export type EntityKind = 'epic' | 'objectif' | 'domaine';

/** Icônes proposées pour les domaines. */
export const DOMAINE_ICONES = ['💼', '🏠', '💶', '❤️', '🎓', '🛠️', '🌱', '✈️', '👪', '📦', '⚽', '🎨'];

/** Couleurs proposées pour les epics. */
export const EPIC_COULEURS = ['#1A73E8', '#8E24AA', '#E37400', '#188038', '#D93025', '#00897B', '#5E35B1', '#C2185B'];

export interface Settings {
  /** URL de l'application Web Apps Script (…/exec) */
  url: string;
  /** Clé d'accès (connexion sans compte Google) */
  key?: string;
  /** Connexion par compte Google : e-mail du compte */
  googleEmail?: string;
}

export const TYPE_LABELS: Record<ItemType, string> = {
  tache: 'Tâche',
  mission: 'Mission',
  'rendez-vous': 'Rendez-vous',
};

export const TYPE_ICONS: Record<ItemType, string> = {
  tache: '✓',
  mission: '🚩',
  'rendez-vous': '📅',
};

export const PRIORITE_LABELS: Record<Priorite, string> = {
  basse: 'Basse',
  normale: 'Normale',
  haute: 'Haute',
};

export const PERIODICITE_LABELS: Record<Exclude<Periodicite, ''>, string> = {
  hebdomadaire: 'Chaque semaine',
  mensuelle: 'Chaque mois',
  trimestrielle: 'Chaque trimestre',
  annuelle: 'Chaque année',
};

export const STATUT_LABELS: Record<Statut, string> = {
  a_faire: 'À faire',
  en_cours: 'En cours',
  termine: 'Terminé',
};
