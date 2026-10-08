import { addDays, toDateString } from './dates';
import type { Item, PointReunion, Reunion, StatutSuivi } from './types';

/**
 * Points de suivi (08/10, docs/regles-reunions.html blocs 6 à 8) : tout point concrétisé (sauf « Rien ») est suivi
 * jusqu'à sa validation. En cours → Fait (le responsable, ou l'animateur pour lui) → Validé (le validateur) ; le
 * validateur peut aussi re-concrétiser, faire reprendre (motif) ou abandonner (motif). Une tâche créée terminée fait
 * passer le point à « Fait ». Échéance passée et pas fait : « en retard ».
 */
export const LIBELLE_STATUT: Record<Exclude<StatutSuivi, ''>, string> = {
  en_cours: 'En cours',
  fait: 'Fait',
  valide: 'Validé',
  a_reprendre: 'À reprendre',
  abandonne: 'Abandonné',
};
export const TON_STATUT: Record<Exclude<StatutSuivi, ''>, 'bleu' | 'vert' | 'orange' | 'gris' | 'rouge'> = {
  en_cours: 'bleu',
  fait: 'vert',
  valide: 'vert',
  a_reprendre: 'orange',
  abandonne: 'gris',
};

/** Statut d'un point concrétisé : le sien ; une tâche créée terminée → « Fait » ; ancien point sans statut → déduit */
export function statutEffectif(p: Pick<PointReunion, 'statut' | 'concretisation' | 'tache'>, items: Map<string, Item> | Item[]): StatutSuivi {
  const parId = items instanceof Map ? items : new Map(items.map((t) => [t.id, t]));
  const t = p.tache ? parId.get(p.tache) : undefined;
  const tacheFinie = !!t && t.statut === 'termine';
  if (p.statut) return (p.statut === 'en_cours' || p.statut === 'a_reprendre') && tacheFinie ? 'fait' : p.statut;
  if (!p.concretisation) return '';
  if (p.concretisation === 'rien') return 'valide';
  if (p.concretisation === 'sous_tache' || p.concretisation === 'tache') return tacheFinie || !t ? 'valide' : 'en_cours';
  return 'en_cours';
}
export const estFini = (s: StatutSuivi) => s === 'valide' || s === 'abandonne';
/** Échéance passée et pas encore fait */
export const enRetardSuivi = (p: Pick<PointReunion, 'echeance'>, s: StatutSuivi, jour: string) => !!p.echeance && p.echeance < jour && (s === 'en_cours' || s === 'a_reprendre');

/** Peut passer le point à « Fait » : le responsable, ou l'animateur pour lui */
export const peutFaire = (p: Pick<PointReunion, 'responsable' | 'personne'>, moi: string, animateur: string) => {
  const m = moi.toLowerCase();
  return m === (p.responsable || p.personne).toLowerCase() || m === animateur.toLowerCase();
};
/** Valide le point : son validateur (sinon l'animateur de la réunion) */
export const validateurDe = (p: Pick<PointReunion, 'validateur'>, animateur: string) => (p.validateur || animateur).toLowerCase();

/** Échéance proposée : la prochaine réunion de la même série (selon sa répétition), en jours ouvrés */
export function echeanceParDefaut(r: Pick<Reunion, 'debut' | 'repetition'>): string {
  const d = new Date(`${r.debut.slice(0, 10)}T12:00`);
  const n = r.repetition === 'quotidienne' ? 1 : r.repetition === 'hebdomadaire' ? 7 : r.repetition === 'iteration' ? 14 : r.repetition === 'mensuelle' ? 30 : r.repetition === 'trimestrielle' || r.repetition === 'pi' ? 91 : 7;
  let x = addDays(d, n);
  while (x.getDay() === 0 || x.getDay() === 6) x = addDays(x, 1);
  return toDateString(x);
}

/** « 14/10 » */
export const jourCourt = (j: string) => (j ? `${Number(j.slice(8, 10))}/${j.slice(5, 7)}` : '');
