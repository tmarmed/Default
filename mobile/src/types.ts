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
  /** SAFe : points (facultatif), itération choisie à la main (ex. 2026-T4-IT3), feature (id, le plus précis) */
  points: string;
  iteration: string;
  feature: string;

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
  points: '',
  iteration: '',
  feature: '',
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
  /** SAFe : état dans le Kanban du portefeuille ; vide = déduit des dates */
  etat: EtatEpic | '';
}

export type EtatEpic = 'idee' | 'analyse' | 'pret' | 'en_cours' | 'termine';

export const ETATS_EPIC: { value: EtatEpic; label: string; color: string }[] = [
  { value: 'idee', label: 'Idée', color: '#9AA3AF' },
  { value: 'analyse', label: 'Analyse', color: '#8E24AA' },
  { value: 'pret', label: 'Prêt', color: '#E37400' },
  { value: 'en_cours', label: 'En cours', color: '#1A73E8' },
  { value: 'termine', label: 'Terminé', color: '#188038' },
];

/** SAFe : sous-epic prévue dans un PI (trimestre), éventuellement dans une itération. */
export interface Feature {
  id: string;
  titre: string;
  description: string;
  epic: string;
  /** ex. 2026-T4 */
  pi: string;
  /** ex. 2026-T4-IT3 ou 2026-T4-IP */
  iteration: string;
  points: string;
  couleur: string;
  cree_le: string;
  modifie_le: string;
}

export type FeatureInput = Omit<Feature, 'id' | 'cree_le' | 'modifie_le'>;

/** SAFe : objectif du PI, engagement d'un trimestre. */
export interface ObjectifPI {
  id: string;
  titre: string;
  pi: string;
  type: 'engage' | 'bonus';
  /** 0 à 10, vide si non noté */
  valeur_prevue: string;
  valeur_obtenue: string;
  cree_le: string;
  modifie_le: string;
}

export type ObjectifPIInput = Omit<ObjectifPI, 'id' | 'cree_le' | 'modifie_le'>;

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

export type EntityKind = 'epic' | 'objectif' | 'domaine' | 'feature' | 'objectifpi';

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
