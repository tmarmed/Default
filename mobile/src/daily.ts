import { addDays, toDateString } from './dates';
import { iterationOf, iterationOfItem, pointsOf } from './pi';
import { chargeOf, subtaskMap } from './subtasks';
import type { CatalogueParcours } from './reunions';
import { type Concretisation, type Echange, type Item, type PointReunion, type Reunion, type TypePoint, TYPES_REUNION } from './types';

/**
 * Daily (lot 6, validé le 01/10) : calculs sans affichage, communs à l'organisateur (Scrum Master) et au
 * participant. Les points notés vivent dans l'onglet PointsReunion du Sheet de l'espace de l'équipe ; un point
 * concrétisé (sous-tâche, tâche à part) garde l'id de sa tâche : tant qu'elle n'est pas finie, il est « suivi »
 * (section « Suivi » de la Situation du daily suivant) ; pour son responsable, c'est une tâche comme les autres
 * (étape « Hier », avec à droite « Action · 29/09 »).
 * Parcours (règle du 01/10) : une seule fenêtre qui enchaîne les étapes de chacun des rôles de la personne (membre,
 * PO, Scrum Master), voir `etapesParcours` (src/reunions.ts) et `PARCOURS_DAILY`.
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

/**
 * Parcours du daily par rôle : membre (Hier, Aujourd'hui, Blocages), PO (Stories à accepter, Backlog à préparer,
 * Questions de l'équipe ; s'il n'est pas membre, il fait aussi Hier et Aujourd'hui pour ses tâches), Scrum Master
 * (Situation, Tour de table, Concrétisation, Compte rendu) ; « Prêt » finit la partie participant.
 */
const [SITUATION, TOUR, CONCRETISATION, COMPTE_RENDU] = TYPES_REUNION.daily.etapes;
export const PARCOURS_DAILY: CatalogueParcours = {
  membre: [
    { cle: 'hier', nom: 'Hier' },
    { cle: 'aujourdhui', nom: 'Aujourd’hui' },
    { cle: 'blocages', nom: 'Blocages' },
  ],
  po: [
    { cle: 'accepter', nom: 'Stories à accepter' },
    { cle: 'backlog', nom: 'Backlog à préparer' },
    { cle: 'questions', nom: 'Questions de l’équipe' },
  ],
  poSansMembre: ['hier', 'aujourdhui'],
  sm: [
    { cle: 'situation', nom: SITUATION },
    { cle: 'tour', nom: TOUR },
    { cle: 'concretisation', nom: CONCRETISATION },
    { cle: 'compte_rendu', nom: COMPTE_RENDU },
  ],
  fin: { cle: 'pret', nom: 'Prêt' },
};

export const LIBELLE_TYPE_POINT: Record<TypePoint, string> = {
  hier: 'Hier',
  aujourdhui: 'Aujourd’hui',
  blocage: 'Blocage',
  decision: 'Décision',
  action: 'Action',
};
/** Pastille à droite d'un point : « Hier », « Aujourd'hui » (sans date, règle du 06/10), ou le type */
export function pastillePoint(type: TypePoint, _jour?: string): string {
  return LIBELLE_TYPE_POINT[type];
}
/**
 * Date relative d'un point (règle du 01/10) : « aujourd'hui », « hier » (veille ouvrée, ou la veille), sinon
 * « 29/09 », par rapport au jour de la réunion
 */
export function dateRelative(date: string, jour: string): string {
  if (date === jour) return 'aujourd’hui';
  if (date === veilleOuvree(jour) || date === toDateString(addDays(parse(jour), -1))) return 'hier';
  return dateCourte(date);
}
/** Jour où un point a été noté : celui de sa réunion */
export const jourPoint = (p: Pick<PointReunion, 'reunion'>) => p.reunion.slice(-10);
/**
 * Pastilles d'un point suivi (ou d'une tâche née d'une réunion) : le type et la date dans deux pastilles séparées
 * (règle du 06/10) — [Blocage] [Hier], [Action] [29/09]
 */
export const pastilleSuivi = (p: Pick<PointReunion, 'type' | 'reunion'>, jour: string) => ({ texte: LIBELLE_TYPE_POINT[p.type], date: majuscule(dateRelative(jourPoint(p), jour)) });
const majuscule = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);

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
  synchro: 'transmis',
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

/**
 * Échanges 🔄 Synchro suivis : ceux nés d'un blocage (concrétisation « synchro »), et ceux auxquels répond une décision
 * du PO concrétisée en « rien » ; tant qu'ils sont là : en attente de réponse, ou répondus mais pas encore pris en
 * compte (sans historique : un échange pris en compte disparaît, le point n'est plus suivi). Un échange n'est suivi
 * qu'une fois (le blocage d'abord).
 */
export function suivisSynchro(points: PointReunion[], echanges: Echange[]): { point: PointReunion; echange: Echange }[] {
  const parId = new Map(echanges.map((e) => [e.id, e]));
  const out: { point: PointReunion; echange: Echange }[] = [];
  const vus = new Set<string>();
  const candidats = [...points.filter((p) => p.concretisation === 'synchro'), ...points.filter((p) => p.type === 'decision' && p.concretisation === 'rien')];
  for (const p of candidats) {
    const e = p.tache && !vus.has(p.tache) ? parId.get(p.tache) : undefined;
    if (e && e.statut !== 'pris_en_compte') {
      vus.add(e.id);
      out.push({ point: p, echange: e });
    }
  }
  return out.sort((a, b) => a.point.cree_le.localeCompare(b.point.cree_le));
}

/**
 * Story bloquée : un blocage noté sur elle, pas encore réglé (pas concrétisé, sa tâche pas terminée, ou son échange
 * 🔄 Synchro encore en attente de réponse)
 */
export function storiesBloquees(points: PointReunion[], items: Item[], echanges: Echange[] = []): Set<string> {
  const parId = new Map(items.map((t) => [t.id, t]));
  const ech = new Map(echanges.map((e) => [e.id, e]));
  const out = new Set<string>();
  for (const p of points) {
    if (p.type !== 'blocage' || !p.element || p.concretisation === 'rien') continue;
    if (p.concretisation === 'synchro') {
      if (ech.get(p.tache)?.statut === 'envoye') out.add(p.element);
      continue;
    }
    const t = p.tache ? parId.get(p.tache) : undefined;
    if (p.concretisation === 'escalade' || !p.tache || (t && t.statut !== 'termine')) out.add(p.element);
  }
  return out;
}

/**
 * Questions de l'équipe (parcours du PO) : échanges 🔄 Synchro adressés au PO par des membres de l'équipe (`de` parmi
 * `membres`, e-mails) sur des stories de l'itération (`stories`), en attente de réponse ou répondus (pas encore pris
 * en compte), du plus ancien au plus récent. Lecture seule de ce qui existe déjà.
 */
export function questionsEquipe(echanges: Echange[], po: string, membres: string[], stories: Set<string>): Echange[] {
  const m = new Set(membres.map((x) => x.toLowerCase()));
  return echanges
    .filter((e) => e.a === po.toLowerCase() && m.has(e.de) && e.de !== e.a && !!e.element && stories.has(e.element) && (e.statut === 'envoye' || e.statut === 'repondu'))
    .sort((a, b) => a.cree_le.localeCompare(b.cree_le));
}
/** Réponse du PO notée comme décision : « sujet » : réponse (la remarque remplace « Autre ») */
export function texteReponse(e: Pick<Echange, 'titre' | 'reponse' | 'note'>): string {
  const sujet = e.titre.replace(/^Blocage · /, '');
  const rep = e.reponse.trim().toLowerCase() === 'autre' ? e.note.trim() : [e.reponse.trim(), e.note.trim()].filter(Boolean).join(' — ');
  return `« ${sujet} » : ${rep}`;
}

/**
 * Backlog à préparer (PO) : stories pas terminées, sans estimation ou trop grosses (plus de `max` points, à
 * découper). Il n'existe pas de marque « non prête » sur une story : seules ces deux règles comptent.
 */
export type RaisonBacklog = 'sans_estimation' | 'trop_grosse';
export function backlogAPreparer(stories: Item[], max = 8): { story: Item; raison: RaisonBacklog }[] {
  return stories
    .filter((t) => t.type === 'story' && t.statut !== 'termine')
    .flatMap((t): { story: Item; raison: RaisonBacklog }[] => {
      const p = pointsOf(t);
      return !p ? [{ story: t, raison: 'sans_estimation' }] : p > max ? [{ story: t, raison: 'trop_grosse' }] : [];
    });
}

/**
 * Stories à accepter (PO) : stories terminées de l'itération en cours. Il n'existe pas encore de notion
 * d'acceptation : toutes les stories terminées de l'itération sont proposées.
 */
export const storiesAAccepter = (elements: Item[]) => elements.filter((t) => t.type === 'story' && t.statut === 'termine');

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
  /** Blocages passés en échange 🔄 Synchro (« texte (Tom → Paul) ») */
  synchros?: string[];
  notes: number;
}): string {
  const l: string[] = [`Daily ${o.equipe} du ${dateCourte(o.jour)}.`];
  const bloc = (titre: string, lignes: string[]) => lignes.length && l.push('', `${titre} · ${lignes.length}`, ...lignes.map((x) => `• ${x}`));
  bloc('Décisions', o.decisions);
  bloc('Actions créées', o.creees.map((c) => `${c.titre} (${c.sous})`));
  bloc('Blocages escaladés', o.escalades);
  bloc('Blocages transmis', o.synchros ?? []);
  if (!o.decisions.length && !o.creees.length && !o.escalades.length && !o.synchros?.length) l.push('', 'Rien à signaler : ni décision, ni action, ni blocage.');
  if (o.notes) l.push('', `${o.notes} autre${o.notes > 1 ? 's' : ''} point${o.notes > 1 ? 's' : ''} noté${o.notes > 1 ? 's' : ''} seulement.`);
  return l.join('\n');
}
