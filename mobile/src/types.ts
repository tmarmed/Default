export type ItemType = 'tache' | 'mission' | 'rendez-vous';
export type Priorite = 'basse' | 'normale' | 'haute';
export type Statut = 'a_faire' | 'en_cours' | 'termine';

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
}

export type ItemInput = Omit<Item, 'id' | 'cree_le' | 'modifie_le'>;

export interface Settings {
  url: string;
  key: string;
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

export const STATUT_LABELS: Record<Statut, string> = {
  a_faire: 'À faire',
  en_cours: 'En cours',
  termine: 'Terminé',
};
