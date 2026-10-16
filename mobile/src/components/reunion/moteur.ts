/**
 * Moteur commun des réunions (14/10, refactoring lot 5) : ce que le Daily et les autres réunions d'équipe (useReunion,
 * base.tsx) faisaient chacun de leur côté, à l'identique. Les textes propres à chaque réunion (compte rendu,
 * messages) restent chez elles ; ici, seulement les règles : choix de concrétisation par défaut, réponses du PO,
 * créations à l'envoi du compte rendu, points écrits, messages de suivi, demandes de budget.
 */
import type { BudgetValue } from '../../budget';
import { type ChoixConcret, choixParDefaut, concretisationDe, elementACreer, estSuivi, LIBELLE_TYPE_CREE, patchConcretise } from '../../concretisation';
export { texteCompteRenduReunion } from '../../concretisation';
import { titreEscalade } from '../../suiviEscalade';
import { aConcretiser, dateCourte, libelleNote, texteReponse } from '../../daily';
import { libelleElement } from '../../elementConcerne';
import { etatDe } from '../../etatReunion';
import { type Echange, type EchangeInput, type ItemInput, type PeriodeDepense, type PointReunion } from '../../types';
import type { ActionsDaily } from '../Daily';
import { reponsePrete } from '../EchangesView';

type H = Parameters<typeof choixParDefaut>[1]['h'];
type CtxCreer = Parameters<typeof elementACreer>[2];
type Decide = ChoixConcret & { pt: PointReunion; c: ReturnType<typeof concretisationDe>; a: string };

/** Dernier compte rendu de la série (aujourd'hui ou la réunion d'avant), pour l'onglet « Compte rendu · date » */
export function dernierCompteRendu(lus: PointReunion[], prefixe: string, jour: string): string {
  const ids = lus
    .filter((x) => x.reunion.startsWith(prefixe) && x.reunion.slice(-10) <= jour && (x.type === 'etat' ? !!etatDe([x], x.reunion)?.fin : aConcretiser(x) && !!x.concretisation))
    .map((x) => x.reunion);
  return ids.sort().pop() ?? '';
}

/**
 * Concrétisation d'un point (08/10, feuille « Concrétiser ») : les choix de l'animateur sur ceux proposés. Responsable
 * hors de la réunion (ex. point reçu d'ailleurs) : le PO, sinon l'animateur ; transmis au-dessus : une des personnes
 * proposées pour l'escalade.
 */
export function choixAvecDefauts(
  pt: PointReunion,
  choisi: Partial<ChoixConcret> | undefined,
  o: { animateur: string; echeance: string; h: H; mail: string; personnes: { email: string }[]; po?: string; escalades: { email: string }[] },
): ChoixConcret {
  const base = choixParDefaut(pt, { animateur: o.animateur, echeance: o.echeance, h: o.h, moi: o.mail });
  const x = { ...base, ...choisi };
  const dansEq = o.personnes.some((y) => y.email.toLowerCase() === x.resp);
  if (choisi?.resp === undefined && x.qui !== 'dessus' && !dansEq) x.resp = o.po?.toLowerCase() ?? o.mail;
  if (x.qui === 'dessus' && !o.escalades.some((y) => y.email === x.resp)) x.resp = o.escalades[0]?.email ?? x.resp;
  return x;
}

/**
 * Réponses du PO aux questions de l'équipe : celles données ici (envoyées à l'échange avec son point) et celles déjà
 * données dans le Chat, pas encore notées. Chacune devient un point « décision » de la réunion (`point`).
 */
export function reponsesAuPO<T>(questions: Echange[], reponses: Record<string, { c: string; note: string }>, tous: PointReunion[], mail: string, point: (q: Echange) => T) {
  const reponseNotee = (q: Echange) => tous.some((x) => x.type === 'decision' && x.personne === mail && (x.tache === q.id || x.texte === texteReponse(q)));
  return questions.flatMap((q) => {
    const r = reponses[q.id];
    const ici = q.statut === 'envoye' && !!r && reponsePrete(r.c, r.note);
    if (!ici && (q.statut !== 'repondu' || reponseNotee(q))) return [];
    const e = ici ? { ...q, reponse: r.c, note: r.note.trim() } : q;
    return [{ q: e, ici, pt: point(e) }];
  });
}

/** 💶 Demandes de budget nées des notes (13/10) : une par note, soumises au niveau du dessus ; la note est close */
export async function soumettreDemandesBudget(
  decides: Decide[],
  budgetConcret: { pour: { value: string }[] } | undefined,
  budget: Pick<BudgetValue, 'soumettreDemande'>,
  o: { espace: string; jour: string; demandeur: string; mail: string; origine: string },
) {
  for (const d of decides.filter((x) => x.que === 'budget' && !!budgetConcret))
    await budget.soumettreDemande(o.espace, { motif: d.pt.texte, montant: String(d.montant ?? '').replace(',', '.'), periode: (d.periode || 'ponctuel') as PeriodeDepense, du: o.jour, au: '', pour: d.pour || budgetConcret!.pour[0].value, demandeur: o.demandeur, soumis_par: o.mail, origine: o.origine });
}

/**
 * « Créer » (08/10) : tâches de tout type (un lot), features (un lot), réunions ponctuelles (un lot), chacune
 * rattachée à l'élément du dessus. `tacheDe` : point → id de l'élément créé.
 */
export async function creerConcretisations(decides: Decide[], o: { actions: ActionsDaily; espace: string; niveau: string; ctxCreer: (pt: PointReunion) => CtxCreer }) {
  const aCreerTout = decides.filter((d) => d.que === 'creer' && d.qui !== 'dessus').map((d) => ({ d, x: elementACreer(d, d.pt, o.ctxCreer(d.pt)) }));
  const items = aCreerTout.filter((a) => a.x.kind === 'item');
  const features = aCreerTout.filter((a) => a.x.kind === 'feature');
  const reunions = aCreerTout.filter((a) => a.x.kind === 'reunion');
  const creees = await o.actions.creerTaches(o.espace, items.map((a) => (a.x as { input: ItemInput }).input));
  const tacheDe = new Map(items.map((a, i) => [a.d.pt.id, creees[i]?.id ?? '']));
  if (features.length && o.actions.creerEntites) {
    const fs = await o.actions.creerEntites(o.espace, 'feature', features.map((a) => (a.x as { input: Record<string, string> }).input));
    features.forEach((a, i) => tacheDe.set(a.d.pt.id, fs[i]?.id ?? ''));
  }
  if (reunions.length && o.actions.creerReunions) {
    const ids = await o.actions.creerReunions(o.espace, reunions.map((a) => ({ ...(a.x as Extract<typeof a.x, { kind: 'reunion' }>), niveau: o.niveau })));
    reunions.forEach((a, i) => tacheDe.set(a.d.pt.id, ids[i] ?? ''));
  }
  return { aCreer: aCreerTout.map((a) => a.d), creees, tacheDe };
}

/**
 * Point de suivi confié à quelqu'un qui n'est pas de la réunion : prévenu dans le Chat (règle du 08/10). `quand` :
 * « au daily Mobile du 14/10 », « à la revue de sprint Mobile du 14/10 »…
 */
export function messagesSuivis(synchros: Decide[], o: { mail: string; quand: string; nomDe: (m: string) => string; h: H; niveau: string; espace: string }): EchangeInput[] {
  const story = (id: string) => (id ? libelleElement(id, o.h) || undefined : undefined);
  return synchros.map((d) => ({
    de: o.mail,
    a: d.resp,
    type: 'message' as const,
    titre: `${estSuivi(d) ? '📌 Suivi reçu' : `✓ ${LIBELLE_TYPE_CREE(d.type)} pour vous`} · ${d.pt.texte}`.slice(0, 200),
    texte: `${libelleNote(d.pt)} noté ${o.quand} par ${o.nomDe(d.pt.personne)}${story(d.element) ? ` (${story(d.element)})` : ''}. Responsable : ${o.nomDe(d.resp)}${estSuivi(d) ? ` · Validation : ${o.nomDe(d.valid)}${d.ech ? ` · Échéance : ${dateCourte(d.ech)}` : ''}` : ' · sans suivi'}.`,
    choix: '',
    reponse: '',
    note: '',
    statut: 'envoye' as const,
    element: d.element,
    niveau: o.niveau,
    transmis_par: '',
    prive: '1',
    pieces_jointes: '',
    espace: o.espace,
  }));
}

/**
 * Points écrits avec le compte rendu : la préparation et les notes de séance (`lignes`, en `creer`) et les points
 * déjà enregistrés (en `modifier`), avec leur concrétisation et le lien vers ce qu'elle a créé (tâche, échange). Une
 * réponse du PO (décision) garde le lien vers sa question, sauf si elle devient une tâche.
 */
export function ecrituresConcretisation<L extends { id: string }>(decides: Decide[], tacheDe: Map<string, string>, echangeDuPoint: Map<string, string>, lignes: L[], aEcrire: (y: L) => Omit<PointReunion, 'id' | 'cree_le'>) {
  const patch = (d: Decide) => ({
    ...patchConcretise(d, tacheDe.get(d.pt.id) || echangeDuPoint.get(d.pt.id) || (d.pt.type === 'decision' && d.c === 'rien' ? d.pt.tache : '') || (d.c === 'escalade' || d.c === 'suivi' ? d.pt.tache : '')),
    ...(echangeDuPoint.get(d.pt.id) ? { echange: echangeDuPoint.get(d.pt.id) } : {}),
  });
  const parPoint = new Map(decides.map((d) => [d.pt.id, d]));
  const creer = lignes.map((y) => {
    const d = parPoint.get(y.id);
    return d ? { ...aEcrire(y), ...patch(d) } : aEcrire(y);
  });
  const modifier = decides.filter((d) => !d.pt.id.startsWith('local-')).map((d) => ({ id: d.pt.id, ...patch(d) }));
  return { creer, modifier };
}


/** Notes transmises au-dessus (escalades) : un message chacune, avec le vrai type de la note (« Risque noté… », 14/10) */
export function messagesEscalade(escalades: Decide[], base: Omit<EchangeInput, 'a' | 'titre' | 'texte' | 'element'>, o: { quand: string; nomDe: (m: string) => string; h: H }): EchangeInput[] {
  const story = (id: string) => (id ? libelleElement(id, o.h) || undefined : undefined);
  return escalades.map((d) => ({
    ...base,
    a: d.a,
    titre: titreEscalade(`${libelleNote(d.pt)} · ${d.pt.texte}`),
    texte: `${libelleNote(d.pt)} noté ${o.quand} pour ${o.nomDe(d.pt.personne)}${story(d.pt.element) ? ` (story « ${story(d.pt.element)} »)` : ''} : l'équipe ne peut pas le lever seule.`,
    element: d.pt.element,
  }));
}
