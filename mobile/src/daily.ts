import { jourMois } from './format';
import { addDays, toDateString } from './dates';
import { iterationOf, iterationOfItem, pointsOf } from './pi';
import { chargeOf, subtaskMap } from './subtasks';
import type { CatalogueParcours } from './reunions';
import { type Concretisation, type Echange, estTechnique, type Item, type PointReunion, type Reunion, type TypePoint, type TypeReunion, TYPES_REUNION } from './types';

/**
 * Daily (lot 6, validé le 01/10) : calculs sans affichage, communs à l'organisateur (Scrum Master) et au
 * participant. Les points notés vivent dans l'onglet PointsReunion du Sheet de l'espace de l'équipe ; un point
 * concrétisé (sous-tâche, tâche à part) garde l'id de sa tâche : tant qu'elle n'est pas finie, il est « suivi »
 * (section « Suivi » de la Situation du daily suivant) ; pour son responsable, c'est une tâche comme les autres
 * (étape « Hier », avec à droite « Action · 29/09 »).
 * Parcours séparés (règle du 06/10) : chaque rôle de la personne (membre, PO, Scrum Master) a son parcours dans un
 * onglet de la fenêtre, voir `etapesParcours` (src/reunions.ts) et `PARCOURS_DAILY`.
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
export const dateCourte = jourMois;
/** Préfixe de toutes les réunions du même type et du même niveau (ex. tous les dailies d'une équipe) */
export const prefixeReunion = (r: Pick<Reunion, 'id'>) => r.id.slice(0, -10);

/**
 * Parcours du daily par rôle : membre (Hier, Aujourd'hui avec « Mes notes » en bas, Résumé — 13/10), PO (Stories à accepter, Backlog à préparer,
 * Questions de l'équipe ; s'il n'est pas membre, il fait aussi Hier et Aujourd'hui pour ses tâches), Scrum Master
 * (Situation, Tour de table, Concrétisation, Compte rendu). Plus d'étape « Prêt » (07/10) : le membre envoie depuis
 * Blocages, le PO depuis Questions de l'équipe.
 */
const [SITUATION, TOUR, CONCRETISATION, COMPTE_RENDU] = TYPES_REUNION.daily.etapes;
export const PARCOURS_DAILY: CatalogueParcours = {
  membre: [
    { cle: 'hier', nom: 'Hier' },
    { cle: 'aujourdhui', nom: 'Aujourd’hui' },
    // 13/10 : l'emploi du temps de la journée (vu par moi seul), entre Aujourd'hui et le Résumé
    { cle: 'plan', nom: 'Plan du jour' },
    // 13/10 : plus d'écran Blocages ; les notes (tous types, Information par défaut) se prennent sous Hier et
    // Aujourd'hui ; « Résumé » récapitule et envoie au Scrum Master
    { cle: 'resume', nom: 'Résumé' },
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
};

export const LIBELLE_TYPE_POINT: Record<TypePoint, string> = {
  hier: 'Hier',
  aujourdhui: 'Aujourd’hui',
  blocage: 'Blocage',
  decision: 'Décision',
  action: 'Demande d’action',
  information: 'Information',
  risque: 'Risque',
  dependance: 'Dépendance',
  proposition: '💡 Proposition',
  etat: 'État',
  vote: 'Vote',
  donnee: 'Préparation',
};
/** Pastille à droite d'un point : « Hier », « Aujourd'hui » (sans date, règle du 06/10), ou le type */
/** Libellé d'une note : « Décision à prendre », « Décision prise » (sous-type, 08/10), sinon le type */
export const libelleNote = (p: Pick<PointReunion, 'type' | 'sous_type'>) =>
  p.type === 'decision' && p.sous_type ? `Décision ${p.sous_type === 'a_prendre' ? 'à prendre' : 'prise'}` : LIBELLE_TYPE_POINT[p.type];
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
/** Âge en jours (calendaires) d'une date AAAA-MM-JJ au jour `jour` */
export const ageJours = (date: string, jour: string) => Math.round((parse(jour).getTime() - parse(date).getTime()) / 86_400_000);
/** Âge affiché d'un point (règle du 07/10) : rien les premiers jours ; à partir de 2 jours, « depuis 3 j » (orange) */
export const ageAffiche = (date: string, jour: string) => {
  const n = ageJours(date, jour);
  return n >= 2 ? `depuis ${n} j` : '';
};
/**
 * Pastilles d'un point suivi (ou d'une tâche née d'une réunion) : le type, et son âge seulement s'il a 2 jours ou plus
 * (règle du 07/10 : plus de « Hier » / « Aujourd'hui » à côté d'un blocage) — [Blocage], [Action] [depuis 3 j]
 */
export const pastilleSuivi = (p: Pick<PointReunion, 'type' | 'reunion' | 'sous_type'>, jour: string) => ({ texte: libelleNote(p), age: ageAffiche(jourPoint(p), jour) });

/** Points à concrétiser : blocages, décisions, actions */
export const aConcretiser = (p: Pick<PointReunion, 'type'>) => (TYPES_NOTE_TRAIN as string[]).includes(p.type) || p.type === 'proposition';
/** Types de note (validation du 08/10) ; au train (PI Planning, ART sync…), aussi Risque et Dépendance */
// Information d'abord : type par défaut des notes (validé le 13/10), fermée d'office (rien à concrétiser)
export const TYPES_NOTE: TypePoint[] = ['information', 'blocage', 'decision', 'action'];
export const TYPES_NOTE_TRAIN: TypePoint[] = [...TYPES_NOTE, 'risque', 'dependance'];
/** Note qui attend une concrétisation : pas une Information (fermée d'office, sauf si on choisit de la concrétiser) */
export const attendConcretisation = (p: Pick<PointReunion, 'type'>) => aConcretiser(p) && p.type !== 'information';

/** Concrétisation proposée : sous-tâche de la story (sinon tâche à part) pour un blocage ou une action ; rien pour une décision */
export function concretisationParDefaut(p: Pick<PointReunion, 'type' | 'element' | 'sous_type'>): Concretisation {
  if (p.type === 'decision' && p.sous_type !== 'a_prendre') return 'rien';
  return p.element ? 'sous_tache' : 'tache';
}
/** Sous-titre d'une ligne de suivi en toutes lettres : « 📌 Suivi · tâche à part · Responsable : Emma Roy · à faire » */
export const sousLigneSuivi = (quoi: string, qui: string, etat: string, role = 'Responsable') => ['📌 Suivi', quoi, qui ? `${role} : ${qui}` : '', etat].filter(Boolean).join(' · ');
export const LIBELLE_CONCRETISATION: Record<Concretisation, string> = {
  '': 'à décider',
  sous_tache: 'sous-tâche',
  tache: 'tâche à part',
  rien: 'noté seulement',
  escalade: 'transmis',
  synchro: 'transmis',
  suivi: 'suivi',
  budget: 'demande de budget',
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
 * Réunion qui supprime les points au suivi fini, par niveau (décidé 06/10) : la rétro du niveau si elle existe, sinon
 * sa démo. Jusque-là, les points finis restent dans le Sheet (montrés dans « Réglé pendant l'itération » de la démo,
 * analysés à la rétro), sans s'afficher dans le Suivi. Suppression dans l'écriture groupée du compte rendu.
 */
export const NETTOYAGE = { equipeagile: 'retro', train: 'inspect_adapt', portfolio: 'revue_portfolio' } as const;

/**
 * Points dont le suivi est fini, à supprimer par la réunion de NETTOYAGE (pour tous les éléments d'une réunion). Fini =
 * d'une réunion précédente de la série (préfixe de `reunionId`, ou toutes les séries du niveau passées dans `points`) et : « Rien », ou sa tâche terminée (ou supprimée) ; un point transmis ou escaladé est fini quand la réponse
 * revenue dans la réunion (Décision liée au même échange) est concrétisée — ici, ou dans `concretisesIci` (ids
 * d'échanges dont la réponse est concrétisée dans la réunion en cours).
 */
export function pointsFinis(points: PointReunion[], reunionId: string, items: Item[], concretisesIci: string[] = []): string[] {
  const serie = reunionId.slice(0, -10);
  const parId = new Map(items.map((t) => [t.id, t]));
  const repondus = new Set([...points.filter((p) => p.reunion.startsWith(serie) && p.type === 'decision' && !!p.tache && !!p.concretisation).map((p) => p.tache), ...concretisesIci]);
  return points
    .filter((p) => p.reunion.startsWith(serie) && p.reunion !== reunionId && !p.id.startsWith('local-'))
    .filter((p) => {
      // Point de suivi (08/10) : fini quand il est validé ou abandonné (son statut fait foi)
      if (p.statut) return p.statut === 'valide' || p.statut === 'abandonne' || p.statut === 'plus_suivi';
      return (
        p.concretisation === 'rien' ||
        ((p.concretisation === 'sous_tache' || p.concretisation === 'tache') && (!parId.get(p.tache) || parId.get(p.tache)?.statut === 'termine')) ||
        ((p.concretisation === 'synchro' || p.concretisation === 'escalade') && repondus.has(p.tache))
      );
    })
    .map((p) => p.id);
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
  // Transmis (Transmettre à), escaladés (suivis jusqu'à la réponse), puis réponses du PO notées « rien »
  const candidats = [...points.filter((p) => p.concretisation === 'synchro' || p.concretisation === 'escalade'), ...points.filter((p) => p.type === 'decision' && p.concretisation === 'rien')];
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

// ---------------------------------------------------------------------------
// 📌 Mes suivis (lot 5, 09/10) : écran de l'onglet Réunions (src/components/reunion/MesSuivis.tsx)
// ---------------------------------------------------------------------------
/** Ouverte : note à concrétiser, ou suivi pas encore validé / abandonné */
export const estOuverte = (p: PointReunion) => (p.statut ? p.statut !== 'valide' && p.statut !== 'abandonne' && p.statut !== 'plus_suivi' : aConcretiser(p) && !p.concretisation);
export const estFermee = (p: PointReunion) => p.statut === 'valide' || p.statut === 'abandonne' || p.statut === 'plus_suivi';

/** Mes notes : responsable, valideur, ou noté par / pour moi (pas encore concrétisé) */
export function mesSuivis(points: PointReunion[], moi: string): { ouvertes: PointReunion[]; fermees: PointReunion[] } {
  const m = moi.toLowerCase();
  const miens = points.filter((p) => !estTechnique(p) && (p.statut || aConcretiser(p)) && [p.responsable, p.validateur, p.statut ? '' : p.personne, p.statut ? '' : p.auteur].some((x) => (x ?? '').toLowerCase() === m));
  const vus = new Set<string>();
  const uniques = miens.filter((p) => !vus.has(p.id) && vus.add(p.id));
  const tri = (a: PointReunion, b: PointReunion) => (a.echeance || a.reunion.slice(-10)).localeCompare(b.echeance || b.reunion.slice(-10));
  return { ouvertes: uniques.filter(estOuverte).sort(tri), fermees: uniques.filter(estFermee).sort(tri).reverse() };
}

/** « Daily du 2/10 » d'après l'id de la réunion (type-niveau-AAAA-MM-JJ) */
export function reunionDeNote(p: PointReunion): string {
  const type = (Object.keys(TYPES_REUNION) as TypeReunion[]).filter((k) => p.reunion.startsWith(`${k}-`)).sort((a, b) => b.length - a.length)[0];
  const jour = p.reunion.slice(-10);
  const lib = type ? TYPES_REUNION[type].libelle : 'Réunion';
  return /^\d{4}-\d{2}-\d{2}$/.test(jour) ? `${lib} du ${`${Number(jour.slice(8, 10))}/${jour.slice(5, 7)}`}` : lib;
}


// ---------------------------------------------------------------------------
// Plan du jour (13/10, docs/regles-reunions.html bloc 12) : une intention, jamais un statut
// ---------------------------------------------------------------------------
/** R1 : éléments proposés : pas terminés, ceux en cours en haut */
export const elementsDuPlan = (l: Item[]) => l.filter((t) => t.statut !== 'termine').sort((a, b) => Number(b.statut === 'en_cours') - Number(a.statut === 'en_cours'));
/** Plan du jour d'une personne à une réunion : ses points « aujourd'hui » liés à un élément (id de l'élément) */
export const planDe = (points: Pick<PointReunion, 'reunion' | 'personne' | 'type' | 'element'>[], reunion: string, personne: string) =>
  new Set(points.filter((x) => x.reunion === reunion && x.personne === personne && x.type === 'aujourdhui' && !!x.element).map((x) => x.element));
/** Réunion précédente de la série où la personne avait un plan (« Hier » : le plan de la veille) */
export function reunionPrecedenteAvecPlan(points: Pick<PointReunion, 'reunion' | 'personne' | 'type' | 'element'>[], reunion: string, personne: string): string {
  const prefixe = reunion.slice(0, -10);
  return points
    .filter((x) => x.reunion.startsWith(prefixe) && x.reunion < reunion && x.personne === personne && x.type === 'aujourdhui' && !!x.element)
    .map((x) => x.reunion)
    .sort()
    .pop() ?? '';
}

// Créneaux (13/10, R5, R6) : facultatifs, rangés dans 🔒 Moi (privés), autour des événements de la journée
/** Réunion technique du plan d'une journée dans 🔒 Moi : créneaux et événements perso (points « donnee ») */
export const reunionPlanJour = (jour: string) => `plan_jour-moi-${jour}`;
/** Plan du Point perso du matin (gardé sur l'appareil) : clé du stockage local, lue par le Bilan du soir */
export const clePlanPerso = (jour: string) => `president:plan-${jour}`;
export interface EvenementJour {
  /** HH:MM */
  heure: string;
  /** HH:MM (sinon début + 30 min) */
  fin?: string;
  titre: string;
  /** Événement perso ajouté à la main (sinon : réunion de l'application) */
  perso?: boolean;
  id?: string;
}
/** Journée de travail (réglable par chacun) : défaut 9:00 → 18:00, déjeuner 12:00 → 14:00 */
export interface Journee {
  debut: string;
  fin: string;
  dejDebut: string;
  dejFin: string;
}
export const JOURNEE_DEFAUT: Journee = { debut: '9:00', fin: '18:00', dejDebut: '12:00', dejFin: '14:00' };
const minutes = (h: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(h.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
};
const hhmm = (n: number) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
/** Fin d'un événement : sa fin, sinon début + 30 min */
export const finDe = (e: Pick<EvenementJour, 'heure' | 'fin'>) => (e.fin && minutes(e.fin) > minutes(e.heure) ? e.fin : hhmm(minutes(e.heure) + 30));
/**
 * Créneaux libres (R5, deux niveaux) : par demi-journée (Matin = début → déjeuner, Après-midi = déjeuner → fin),
 * les trous d'au moins `min` minutes entre les événements, « 9:45 → 11:00 »
 */
export function creneauxLibres(j: Journee, evenements: Pick<EvenementJour, 'heure' | 'fin'>[], min = 30): { matin: string[]; apresMidi: string[] } {
  const occupe = evenements
    .map((e) => [minutes(e.heure), minutes(finDe(e))] as [number, number])
    .filter(([a, b]) => !isNaN(a) && !isNaN(b))
    .sort((x, y) => x[0] - y[0]);
  const libres = (de: number, a: number) => {
    const out: string[] = [];
    let t = de;
    for (const [x, y] of occupe) {
      if (y <= t || x >= a) continue;
      if (x - t >= min) out.push(`${hhmm(t)} → ${hhmm(x)}`);
      t = Math.max(t, y);
    }
    if (a - t >= min) out.push(`${hhmm(t)} → ${hhmm(a)}`);
    return out;
  };
  return { matin: libres(minutes(j.debut), minutes(j.dejDebut)), apresMidi: libres(minutes(j.dejFin), minutes(j.fin)) };
}

/** Place d'un élément dans le plan du jour (R5) : demi-journée, et heure si placé dans l'emploi du temps */
export interface PlaceJour {
  demi: '' | 'Matin' | 'Après-midi';
  /** HH:MM (vide = pas encore dans l'emploi du temps) */
  debut?: string;
  fin?: string;
}
export const enMinutes = (h: string) => minutes(h);
export const enHeure = (n: number) => hhmm(n);
/** Demi-journée d'une heure : avant la fin du déjeuner → Matin si avant son début */
export const demiDe = (j: Journee, h: string): 'Matin' | 'Après-midi' => (minutes(h) < minutes(j.dejDebut) ? 'Matin' : 'Après-midi');
/** Moments libres de la journée (≥ `min` minutes), hors déjeuner et hors temps occupé, dans l'ordre */
export function momentsLibres(j: Journee, occupes: Pick<EvenementJour, 'heure' | 'fin'>[], min = 30): { de: string; a: string; demi: 'Matin' | 'Après-midi' }[] {
  const l = creneauxLibres(j, occupes, min);
  const vers = (x: string, demi: 'Matin' | 'Après-midi') => {
    const [de, a] = x.split(' → ');
    return { de, a, demi };
  };
  return [...l.matin.map((x) => vers(x, 'Matin')), ...l.apresMidi.map((x) => vers(x, 'Après-midi'))];
}
/** Fin la plus tardive possible pour un élément commençant à `debut` : le prochain temps occupé, le déjeuner ou la fin de journée */
export function finMax(j: Journee, debut: string, occupes: Pick<EvenementJour, 'heure' | 'fin'>[]): string {
  const d = minutes(debut);
  const bornes = [minutes(j.fin), ...(d < minutes(j.dejDebut) ? [minutes(j.dejDebut)] : []), ...occupes.map((e) => minutes(e.heure)).filter((x) => x > d)];
  return hhmm(Math.min(...bornes));
}
