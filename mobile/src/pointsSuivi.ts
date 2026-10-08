import { addDays, toDateString } from './dates';
import type { Echange, EchangeInput, Item, PointReunion, Reunion, StatutSuivi } from './types';

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

// ---------------------------------------------------------------------------
// Actions sur un point de suivi (feuille du Suivi, ou réponse « Valider ? » du Chat : le même point)
// ---------------------------------------------------------------------------
export type ActionSuivi = 'en_cours' | 'fait' | 'valider' | 'reconcretiser' | 'reprendre' | 'abandonner';
/** Choix de la question « Valider ? » du Chat (motif obligatoire pour les deux derniers) */
export const CHOIX_VALIDER = ['Valider', 'Re-concrétiser', 'À reprendre (motif)', 'Abandonner (motif)'];
export const actionDuChoix = (c: string): ActionSuivi | null =>
  c === CHOIX_VALIDER[0] ? 'valider' : c === CHOIX_VALIDER[1] ? 'reconcretiser' : c === CHOIX_VALIDER[2] ? 'reprendre' : c === CHOIX_VALIDER[3] ? 'abandonner' : null;
export const motifObligatoire = (a: ActionSuivi | null) => a === 'reprendre' || a === 'abandonner';
export const TITRE_VALIDER = 'Valider ?';
/**
 * Rappel envoyé au validateur (08/10) : message « 📌 À valider · … » ; ✅ Valider d'ici, ou laisser la validation à la
 * réunion : c'est le même suivi (il garde la référence du point, pour le refus d'une transmission)
 */
export const TITRE_RAPPEL = '📌 À valider ·';

/** Place d'un point dans une escalade : « bas » (il l'a envoyée, attend la réponse), « haut » (il l'a reçue) */
export const roleEscalade = (p: Pick<PointReunion, 'echange' | 'concretisation' | 'tache'>): '' | 'bas' | 'haut' =>
  !p.echange ? '' : p.concretisation === 'escalade' && p.tache === p.echange ? 'bas' : 'haut';

/** Référence « espace|id » d'un point (question « Valider ? », échange ⤴) */
export const refPoint = (espace: string, id: string) => `${espace}|${id}`;
/** « espace|id[|espaceHaut|idHaut] » → le point, et celui du dessus s'il y en a un */
export function lireRef(ref: string): { espace: string; id: string; haut?: { espace: string; id: string } } | null {
  const [espace, id, eh, ih] = (ref || '').split('|');
  if (!espace || !id) return null;
  return { espace, id, haut: eh && ih ? { espace: eh, id: ih } : undefined };
}

export interface PlanSuivi {
  /** Points à modifier, par espace (le point lui-même, et l'autre niveau d'une escalade) */
  points: { espace: string; patch: Partial<PointReunion> & { id: string } }[];
  /** Messages et questions du Chat à envoyer */
  envoyer: EchangeInput[];
  /** Échanges à modifier (questions « Valider ? » réglées, échange ⤴ de l'escalade) */
  echanges: { e: Echange; patch: Partial<Echange> }[];
}

/**
 * Ce qu'écrit une action sur un point de suivi (docs/regles-reunions.html blocs 7 et 8) :
 * - Fait (le responsable ou l'animateur) : « Valider ? » au validateur dans le Chat, si ce n'est pas vous ;
 * - Valider · À reprendre (motif) · Abandonner (motif) (le validateur) : le statut ; les « Valider ? » en attente
 *   sont réglés ; À reprendre et Abandonné sont envoyés au responsable ;
 * - escalade, niveau du dessus validé (ou abandonné) : le point du bas passe à « Fait » avec la réponse, et son
 *   validateur reçoit « Valider ? » ; niveau du bas « À reprendre » : le point du dessus est rouvert.
 * Re-concrétiser : rien ici (la feuille Concrétiser écrit le nouveau choix ; le point repart « En cours »).
 */
export function planSuivi(o: {
  pt: PointReunion;
  espace: string;
  action: ActionSuivi;
  note: string;
  moi: string;
  animateur: string;
  nomDe: (email: string) => string;
  echanges: Echange[];
  /** Niveau de l'Organisation des échanges envoyés (« equipeagile:id »…) */
  niveau: string;
  /** Question « Valider ? » à laquelle on répond (Chat) : réglée par l'appelant */
  question?: Echange;
}): PlanSuivi {
  const { pt, espace, action, moi } = o;
  const m = moi.toLowerCase();
  const note = o.note.trim();
  const plan: PlanSuivi = { points: [], envoyer: [], echanges: [] };
  const ref = refPoint(espace, pt.id);
  const resp = (pt.responsable || pt.personne).toLowerCase();
  const valid = validateurDe(pt, o.animateur);
  const msg = (a: string, type: 'message' | 'question', titre: string, texte: string, point = ''): EchangeInput => ({
    de: m,
    a,
    type,
    titre: titre.slice(0, 200),
    texte,
    choix: type === 'question' ? CHOIX_VALIDER.join(';') : '',
    reponse: '',
    note: '',
    statut: 'envoye',
    element: pt.element,
    niveau: o.niveau,
    transmis_par: '',
    prive: '1',
    pieces_jointes: '',
    point,
    espace,
  });
  // Rappels « À valider » (et anciennes questions « Valider ? ») encore ouverts sur ce point : réglés dès qu'on décide
  const ouvertes = o.echanges.filter((e) => e.statut === 'envoye' && !!e.point && (e.point === ref || e.point.startsWith(`${ref}|`)) && e.id !== o.question?.id && (e.type === 'question' || e.titre.startsWith(TITRE_RAPPEL)));
  const question = o.question ?? ouvertes[0];
  const statut = action === 'en_cours' ? 'en_cours' : action === 'fait' ? 'fait' : action === 'valider' ? 'valide' : action === 'reprendre' ? 'a_reprendre' : action === 'abandonner' ? 'abandonne' : '';
  if (!statut) return plan;
  const role = roleEscalade(pt);
  const haut = lireRef(question?.point ?? '')?.haut;
  // Niveau du bas qui refuse la réponse : il attend de nouveau (En cours), le niveau du dessus est rouvert
  const refusEscalade = action === 'reprendre' && role === 'bas' && !!haut;
  plan.points.push({ espace, patch: { id: pt.id, statut: refusEscalade ? 'en_cours' : statut, note } });
  if (action === 'valider' || action === 'reprendre' || action === 'abandonner')
    for (const q of ouvertes) plan.echanges.push({ e: q, patch: { statut: 'pris_en_compte', reponse: action === 'valider' ? CHOIX_VALIDER[0] : action === 'reprendre' ? CHOIX_VALIDER[2] : CHOIX_VALIDER[3], note } });

  if (action === 'fait' && valid && valid !== m)
    plan.envoyer.push(msg(valid, 'message', `${TITRE_RAPPEL} ${pt.texte}`, `${o.nomDe(m)} a passé le suivi à « Fait »${note ? ` : ${note}` : '.'} Validez-le ici (✅ Valider) ou dans la Situation de la réunion (« À valider »).`, ref));
  if ((action === 'reprendre' || action === 'abandonner') && resp && resp !== m && !refusEscalade)
    plan.envoyer.push(msg(resp, 'message', `${action === 'reprendre' ? '↩ À reprendre' : '⊘ Abandonné'} · ${pt.texte}`, `${o.nomDe(m)} : ${note}`));
  if (refusEscalade && haut) {
    plan.points.push({ espace: haut.espace, patch: { id: haut.id, statut: 'a_reprendre', note: `Refusé par ${o.nomDe(m)} : ${note}` } });
    if (question?.de && question.de !== m) plan.envoyer.push(msg(question.de, 'message', `↩ À reprendre · ${pt.texte}`, `${o.nomDe(m)} (niveau du dessous) : ${note}`));
  }
  // Niveau du dessus qui valide ou abandonne : la réponse redescend par l'échange ⤴
  if (role === 'haut' && (action === 'valider' || action === 'abandonner')) {
    const ech = o.echanges.find((e) => e.id === pt.echange);
    const bas = lireRef(ech?.point ?? '');
    const reponse = action === 'valider' ? `Réponse de ${o.nomDe(m)} : ${note || 'réglé'}` : `Abandonné au niveau du dessus par ${o.nomDe(m)} : ${note}`;
    if (ech && bas) {
      plan.points.push({ espace: bas.espace, patch: { id: bas.id, statut: 'fait', note: reponse } });
      const qui = (ech.transmis_par || ech.de).toLowerCase();
      if (qui && qui !== m) plan.envoyer.push(msg(qui, 'message', `${TITRE_RAPPEL} ${pt.texte}`, `${reponse} Validez-le ici (✅ Valider) ou dans la Situation de votre réunion (« À valider »).`, `${ech.point}|${ref}`));
      plan.echanges.push({ e: ech, patch: { statut: 'pris_en_compte', reponse: action === 'valider' ? 'Validé' : 'Abandonné', note } });
    } else if (ech && ech.statut === 'envoye') plan.echanges.push({ e: ech, patch: { statut: 'repondu', reponse: action === 'valider' ? 'Validé' : 'Abandonné', note } });
  }
  return plan;
}

/** Points de suivi à valider par vous (Fait, ou tâche créée terminée) */
export const aValiderPar = (p: PointReunion, s: StatutSuivi, moi: string, animateur: string) => s === 'fait' && validateurDe(p, animateur) === moi.toLowerCase();

/**
 * Après le compte rendu : chaque échange ⤴ envoyé garde la référence du point du bas (« espace|id »), pour que la
 * validation du niveau du dessus redescende sur lui. Un point noté pendant la réunion n'a son id qu'une fois écrit.
 */
export async function relierEscalades(
  actions: { modifierEchanges?: (l: { e: Echange; patch: Partial<Echange> }[]) => Promise<void> },
  espace: string,
  envoyes: Echange[],
  pointsEscalades: string[],
  ecritsIds: string[],
  crees: PointReunion[],
  echangeDuPoint: Map<string, string>,
) {
  if (!actions.modifierEchanges || !pointsEscalades.length) return;
  const l = pointsEscalades.flatMap((pid) => {
    const e = envoyes.find((x) => x.id === echangeDuPoint.get(pid));
    const k = ecritsIds.indexOf(pid);
    const id = k >= 0 ? crees[k]?.id : pid;
    return e && id && !id.startsWith('local-') ? [{ e: { ...e, espace: e.espace ?? espace }, patch: { point: refPoint(espace, id) } }] : [];
  });
  if (l.length) await actions.modifierEchanges(l);
}

/** Écrit un plan de suivi : points par espace (une écriture chacun), messages (une par espace), échanges modifiés */
export async function appliquerPlan(
  plan: PlanSuivi,
  a: {
    ecrirePoints: (espace: string, creer: never[], modifier: (Partial<PointReunion> & { id: string })[], retirer: string[]) => Promise<{ modifies: PointReunion[] }>;
    envoyerEchanges: (espace: string, inputs: EchangeInput[]) => Promise<Echange[]>;
    modifierEchanges?: (l: { e: Echange; patch: Partial<Echange> }[]) => Promise<void>;
  },
): Promise<PointReunion[]> {
  const parEsp = new Map<string, (Partial<PointReunion> & { id: string })[]>();
  for (const x of plan.points) parEsp.set(x.espace, [...(parEsp.get(x.espace) ?? []), x.patch]);
  const modifies: PointReunion[] = [];
  for (const [esp, l] of parEsp) modifies.push(...(await a.ecrirePoints(esp, [], l, [])).modifies.map((p) => ({ ...p, espace: esp })));
  const msgs = new Map<string, EchangeInput[]>();
  for (const x of plan.envoyer) msgs.set(x.espace ?? 'moi', [...(msgs.get(x.espace ?? 'moi') ?? []), x]);
  for (const [esp, l] of msgs) await a.envoyerEchanges(esp, l);
  if (plan.echanges.length && a.modifierEchanges) await a.modifierEchanges(plan.echanges);
  return modifies;
}
