import { addDays, toDateString } from './dates';
import { iterationOf, iterationOfItem, pointsOf } from './pi';
import { chargeOf, subtaskMap } from './subtasks';
import type { Concretisation, Item, PointReunion, Reunion, TypePoint } from './types';

/**
 * Daily (lot 6, validé le 01/10) : calculs sans affichage, communs à l'organisateur (Scrum Master) et au
 * participant. Les points notés vivent dans l'onglet PointsReunion du Sheet de l'espace de l'équipe ; un point
 * concrétisé (sous-tâche, tâche à part) garde l'id de sa tâche : tant qu'elle n'est pas finie, il est « suivi »
 * (Situation du daily suivant, « Mes suivis » de son responsable).
 */

const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
/** Jour de la réunion (AAAA-MM-JJ) */
export const jourReunion = (r: Pick<Reunion, 'debut'>) => r.debut.slice(0, 10);
/** Veille ouvrée de la réunion (le lundi : le vendredi d'avant) */
export function veilleOuvree(jour: string): string {
  let d = addDays(parse(jour), -1);
  while (d.getDay() === 0 || d.getDay() === 6) d = addDays(d, -1);
  return toDateString(d);
}
/** « 30/09 », « 1/10 » */
export const dateCourte = (jour: string) => `${Number(jour.slice(8, 10))}/${jour.slice(5, 7)}`;
/** Préfixe de toutes les réunions du même type et du même niveau (ex. tous les dailies d'une équipe) */
export const prefixeReunion = (r: Pick<Reunion, 'id'>) => r.id.slice(0, -10);

export const LIBELLE_TYPE_POINT: Record<TypePoint, string> = {
  hier: 'Hier',
  aujourdhui: 'Aujourd’hui',
  blocage: 'Blocage',
  decision: 'Décision',
  action: 'Action',
};
/** Pastille à droite d'un point : « Hier · 30/09 », « Aujourd'hui · 1/10 », ou le type */
export function pastillePoint(type: TypePoint, jour: string): string {
  if (type === 'hier') return `Hier · ${dateCourte(veilleOuvree(jour))}`;
  if (type === 'aujourdhui') return `Aujourd’hui · ${dateCourte(jour)}`;
  return LIBELLE_TYPE_POINT[type];
}
/** Points à concrétiser : blocages, décisions, actions */
export const aConcretiser = (p: Pick<PointReunion, 'type'>) => p.type === 'blocage' || p.type === 'decision' || p.type === 'action';

/** Concrétisation proposée : sous-tâche de la story (sinon tâche à part) pour un blocage ou une action ; rien pour une décision */
export function concretisationParDefaut(p: Pick<PointReunion, 'type' | 'element'>): Concretisation {
  if (p.type === 'decision') return 'rien';
  return p.element ? 'sous_tache' : 'tache';
}
export const LIBELLE_CONCRETISATION: Record<Concretisation, string> = {
  '': 'à décider',
  sous_tache: 'sous-tâche',
  tache: 'tâche à part',
  rien: 'noté seulement',
  escalade: 'escaladé au RTE',
};

/**
 * Suivis : points concrétisés (sous-tâche, tâche à part) dont la tâche n'est pas terminée. `items` : les tâches
 * chargées (une tâche introuvable, supprimée ou d'un espace masqué, n'est pas suivie).
 */
export function suivis(points: PointReunion[], items: Item[]): { point: PointReunion; tache: Item }[] {
  const parId = new Map(items.map((t) => [t.id, t]));
  const out: { point: PointReunion; tache: Item }[] = [];
  for (const p of points) {
    if ((p.concretisation !== 'sous_tache' && p.concretisation !== 'tache') || !p.tache) continue;
    const t = parId.get(p.tache);
    if (t && t.statut !== 'termine') out.push({ point: p, tache: t });
  }
  return out.sort((a, b) => a.point.cree_le.localeCompare(b.point.cree_le));
}

/** Story bloquée : un blocage noté sur elle, pas encore réglé (pas concrétisé, ou sa tâche pas terminée) */
export function storiesBloquees(points: PointReunion[], items: Item[]): Set<string> {
  const parId = new Map(items.map((t) => [t.id, t]));
  const out = new Set<string>();
  for (const p of points) {
    if (p.type !== 'blocage' || !p.element || p.concretisation === 'rien') continue;
    const t = p.tache ? parId.get(p.tache) : undefined;
    if (p.concretisation === 'escalade' || !p.tache || (t && t.statut !== 'termine')) out.add(p.element);
  }
  return out;
}

/** En retard : date passée, pas terminée (même règle que l'alerte de retard) */
export const enRetard = (t: Item, aujourdhui: string) => t.statut !== 'termine' && !!t.date && t.date < aujourdhui && !t.periodicite;

/**
 * Situation de l'itération en cours de l'équipe : points faits / prévus (même calcul que la charge de l'Itération :
 * un parent dont les sous-tâches ont des points ne compte pas), stories bloquées, en retard.
 * `dansEquipe` : l'élément est-il porté par l'équipe ?
 */
export function situationIteration(items: Item[], dansEquipe: (t: Item) => boolean, jour: string, bloquees: Set<string>, aujourdhui: string) {
  const it = iterationOf(jour);
  const subs = subtaskMap(items);
  const dansIt = items.filter((t) => dansEquipe(t) && iterationOfItem(t) === it.key);
  const prevus = dansIt.reduce((n, t) => n + chargeOf(t, subs), 0);
  const faits = dansIt.filter((t) => t.statut === 'termine').reduce((n, t) => n + chargeOf(t, subs), 0);
  const cartes = dansIt.filter((t) => !t.parent);
  return {
    iteration: it,
    elements: dansIt,
    cartes,
    prevus,
    faits,
    sansPoints: cartes.filter((t) => !pointsOf(t) && !(subs.get(t.id) ?? []).some((c) => pointsOf(c) > 0)).length,
    bloquees: cartes.filter((t) => bloquees.has(t.id)).length,
    retard: dansIt.filter((t) => enRetard(t, aujourdhui)).length,
  };
}

/** Texte du compte rendu envoyé au RTE : décisions, actions créées, blocages escaladés */
export function texteCompteRendu(o: {
  equipe: string;
  jour: string;
  decisions: string[];
  creees: { titre: string; sous: string }[];
  escalades: string[];
  notes: number;
}): string {
  const l: string[] = [`Daily ${o.equipe} du ${dateCourte(o.jour)}.`];
  const bloc = (titre: string, lignes: string[]) => lignes.length && l.push('', `${titre} · ${lignes.length}`, ...lignes.map((x) => `• ${x}`));
  bloc('Décisions', o.decisions);
  bloc('Actions créées', o.creees.map((c) => `${c.titre} (${c.sous})`));
  bloc('Blocages escaladés', o.escalades);
  if (!o.decisions.length && !o.creees.length && !o.escalades.length) l.push('', 'Rien à signaler : ni décision, ni action, ni blocage.');
  if (o.notes) l.push('', `${o.notes} autre${o.notes > 1 ? 's' : ''} point${o.notes > 1 ? 's' : ''} noté${o.notes > 1 ? 's' : ''} seulement.`);
  return l.join('\n');
}
