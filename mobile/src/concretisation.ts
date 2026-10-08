import { elementDe } from './elementConcerne';
import type { HierarchyValue } from './hierarchyContext';
import { jourCourt } from './pointsSuivi';
import { PARENT_TYPES } from './subtasks';
import { type Concretisation, type ItemInput, type ItemType, type PointReunion, RECURRENCE_DEFAUTS, TYPE_LABELS } from './types';

/**
 * Feuille « Concrétiser » (08/10, docs/regles-reunions.html bloc 6) : une section par question.
 * - Que faire ? suivre (point de suivi) · créer (Type ›, Titre, Rattaché à ›) · rien (clos)
 * - Qui s'en charge ? moi (suivre) · mon équipe (transmettre) · niveau du dessus (escalader) ; le responsable
 * - Élément concerné · Validation (l'animateur par défaut) · Échéance (la prochaine réunion par défaut)
 * Ce qui est créé est toujours rattaché à l'élément du dessus, selon son type (rattachementPour).
 */
export type QueFaire = 'suivre' | 'creer' | 'rien';
export type QuiCharge = 'moi' | 'equipe' | 'dessus';
/** Type d'élément créé : un type de tâche, une story, une feature, ou une 🗓️ réunion ponctuelle */
export type TypeCree = ItemType | 'feature' | 'reunion';
export interface ChoixConcret {
  que: QueFaire;
  type: TypeCree;
  titre: string;
  qui: QuiCharge;
  /** Responsable (e-mail) */
  resp: string;
  element: string;
  /** Validateur (e-mail) */
  valid: string;
  /** Échéance (AAAA-MM-JJ) */
  ech: string;
  /** Rattaché à (id de l'élément du dessus) ; vide = rien de valide (à choisir) ou point général */
  ratt: string;
}

export const LIBELLE_TYPE_CREE = (t: TypeCree) => (t === 'feature' ? 'Feature' : t === 'reunion' ? 'Réunion' : TYPE_LABELS[t]);
export const TYPES_CREES: TypeCree[] = ['tache', 'rendez-vous', 'appel', 'story', 'bug', 'reunion', 'feature', 'demarche', 'mission', 'exploration'];

type H = Pick<HierarchyValue, 'items' | 'featureList' | 'epicList' | 'objectifList' | 'objectifsPI' | 'resultats'>;

/** Type proposé selon l'élément concerné : feature → story ; epic → feature ; sinon une tâche (sous l'élément) */
export function typeParDefaut(element: string, h: H): TypeCree {
  const x = elementDe(element, h);
  if (x?.genre === 'feature') return 'story';
  if (x?.genre === 'epic') return 'feature';
  return 'tache';
}

/**
 * Rattachement d'un élément créé, selon son type et l'élément concerné :
 * - tâche, rendez-vous, appel, bug… : sous l'élément concerné (sous son parent s'il est déjà une sous-tâche) ; lié à
 *   la feature, l'epic ou l'objectif concerné ;
 * - story : sous la feature (celle de l'élément, ou la feature elle-même) ;
 * - feature : sous l'epic (celle de l'élément, ou l'epic elle-même) ;
 * - réunion : liée à l'élément concerné.
 * Renvoie l'id de l'élément du dessus et son libellé ; null = aucun parent valide (« À choisir »).
 */
export function rattachementPour(type: TypeCree, element: string, h: H): { id: string; libelle: string } | null {
  const x = elementDe(element, h);
  if (!x) return type === 'story' || type === 'feature' ? null : { id: '', libelle: 'Aucun · dans l’équipe et le sprint' };
  const lib = (id: string) => {
    const y = elementDe(id, h);
    return y ? `${y.icone} ${y.titre}` : '';
  };
  if (type === 'reunion') return { id: x.id, libelle: lib(x.id) };
  // Feature d'un élément : la sienne, ou celle de son parent (sous-tâche) ; epic : la sienne, ou celle de sa feature
  const parentDe = x.genre === 'item' && x.item?.parent ? h.items.find((i) => i.id === x.item?.parent) : undefined;
  const featureItem = x.genre === 'item' ? x.item?.feature || parentDe?.feature || '' : '';
  if (type === 'story') {
    const f = x.genre === 'feature' ? x.id : featureItem;
    return f ? { id: f, libelle: lib(f) } : null;
  }
  if (type === 'feature') {
    const epicDeFeature = (f: string) => h.featureList.find((y) => y.id === f)?.epic ?? '';
    const ep =
      x.genre === 'epic' ? x.id : x.genre === 'feature' ? epicDeFeature(x.id) : x.genre === 'item' ? x.item?.epic || parentDe?.epic || (featureItem ? epicDeFeature(featureItem) : '') : '';
    return ep ? { id: ep, libelle: lib(ep) } : null;
  }
  // Tâche (tout type) : sous l'élément s'il peut avoir des sous-tâches ; sous son parent s'il est déjà une sous-tâche
  if (x.genre === 'item' && x.item) {
    const parent = x.item.parent || (PARENT_TYPES.includes(x.item.type) ? x.id : '');
    return parent ? { id: parent, libelle: lib(parent) } : { id: '', libelle: 'Aucun' };
  }
  return { id: x.id, libelle: lib(x.id) };
}

/** Choix proposé pour un point : action → créer une tâche ; blocage, décision → suivre ; responsable = qui l'a noté */
export function choixParDefaut(
  pt: Pick<PointReunion, 'type' | 'texte' | 'element' | 'personne' | 'responsable'>,
  o: { animateur: string; echeance: string; h: H; moi: string },
): ChoixConcret {
  const que: QueFaire = pt.type === 'action' ? 'creer' : 'suivre';
  const type = typeParDefaut(pt.element, o.h);
  const resp = (pt.responsable || pt.personne).toLowerCase();
  return {
    que,
    type,
    titre: pt.texte,
    qui: resp === o.moi.toLowerCase() ? 'moi' : 'equipe',
    resp,
    element: pt.element,
    valid: o.animateur.toLowerCase(),
    ech: o.echeance,
    ratt: rattachementPour(type, pt.element, o.h)?.id ?? '',
  };
}

/** Concrétisation enregistrée dans le point (colonne « concretisation ») */
export function concretisationDe(c: ChoixConcret): Concretisation {
  if (c.que === 'rien') return 'rien';
  if (c.qui === 'dessus') return 'escalade';
  if (c.que === 'suivre') return 'suivi';
  return c.type !== 'feature' && c.type !== 'reunion' && !!c.ratt && !!c.element ? 'sous_tache' : 'tache';
}

/** Choix complet et cohérent ? (créer : un titre et un rattachement valide ; escalader : un responsable) */
export function erreurChoix(c: ChoixConcret, h: H): string | null {
  if (c.que === 'rien') return null;
  if (!c.resp) return 'Choisissez le responsable.';
  if (c.que === 'creer') {
    if (!c.titre.trim()) return 'Donnez un titre.';
    if ((c.type === 'story' || c.type === 'feature') && !rattachementPour(c.type, c.element, h)) return 'Choisissez à quoi la rattacher.';
  }
  return null;
}

/**
 * Résumé en toutes lettres (bouton du point) : « Point de suivi · Responsable : Sara Martin · Validation : Nina
 * Dupont · Échéance : 14/10 », « Story · sous 🧩 Commande · Responsable : … », « Rien (clos) »
 */
export function resumeChoix(c: ChoixConcret, nomDe: (email: string) => string, h: H): string {
  if (c.que === 'rien') return 'Rien (clos)';
  const quoi =
    c.qui === 'dessus'
      ? '⤴ Escaladé'
      : c.que === 'suivre'
        ? '📌 Point de suivi'
        : `✓ ${LIBELLE_TYPE_CREE(c.type)}${c.ratt ? ` · ${c.type === 'reunion' ? 'liée à' : 'sous'} ${(() => {
            const y = elementDe(c.ratt, h);
            return y ? `${y.icone} ${y.titre}` : '';
          })()}` : ''}`;
  return [quoi, `Responsable : ${nomDe(c.resp)}`, `Validation : ${nomDe(c.valid)}`, c.ech ? `Échéance : ${jourCourt(c.ech)}` : ''].filter(Boolean).join(' · ');
}

/** Ce que la concrétisation crée au compte rendu : une tâche (tout type), une feature, ou une réunion ponctuelle */
export type ACreer = { kind: 'item'; input: ItemInput } | { kind: 'feature'; input: Record<string, string> } | { kind: 'reunion'; titre: string; jour: string; animateur: string; participants: string[] };

/**
 * L'élément à créer pour un point concrétisé en « Créer » (rattaché à l'élément du dessus selon son type).
 * `ctx` : espace et sprint de la réunion, équipe, id d'une personne d'après son e-mail, description.
 */
export function elementACreer(
  c: ChoixConcret,
  pt: Pick<PointReunion, 'type'>,
  ctx: { espace: string; iteration: string; equipe: string; train?: string; idDe: (email: string) => string; description: string; h: H; moi: string },
): ACreer {
  const ratt = c.ratt;
  const x = elementDe(ratt, ctx.h);
  if (c.type === 'reunion') return { kind: 'reunion', titre: c.titre, jour: c.ech, animateur: c.resp, participants: [...new Set([c.resp, ctx.moi].filter(Boolean))] };
  if (c.type === 'feature')
    return { kind: 'feature', input: { titre: c.titre, description: ctx.description, epic: x?.genre === 'epic' ? ratt : '', pi: '', iteration: '', points: '', couleur: '', train: ctx.train ?? '', equipe: ctx.equipe, rang: '' } };
  const sousItem = x?.genre === 'item' ? ratt : '';
  const input: ItemInput = {
    ...RECURRENCE_DEFAUTS,
    espace: ctx.espace,
    titre: c.titre,
    type: c.type,
    date: c.type === 'rendez-vous' || c.type === 'appel' ? c.ech : '',
    heure: '',
    heure_fin: '',
    date_fin: '',
    lieu: '',
    description: ctx.description,
    priorite: pt.type === 'blocage' ? 'haute' : 'normale',
    statut: 'a_faire',
    // Story : sous la feature ; tâche (tout type) : sous l'élément ; lien vers l'epic ou l'objectif concerné
    parent: c.type === 'story' ? '' : sousItem,
    feature: c.type === 'story' || x?.genre === 'feature' ? (x?.genre === 'feature' ? ratt : '') : '',
    epic: x?.genre === 'epic' ? ratt : '',
    objectif: x?.genre === 'objectif' ? ratt : '',
    domaine: '',
    points: '',
    iteration: c.type === 'rendez-vous' || c.type === 'appel' ? '' : ctx.iteration,
    telephone: '',
    equipe: ctx.equipe,
    responsable: ctx.idDe(c.resp),
  } as ItemInput;
  return { kind: 'item', input };
}

/** Colonnes du point après concrétisation (statut En cours, sauf « Rien ») */
export function patchConcretise(c: ChoixConcret, lien: string): Partial<PointReunion> {
  return {
    concretisation: concretisationDe(c),
    tache: lien,
    responsable: c.que === 'rien' ? '' : c.resp,
    element: c.element,
    statut: c.que === 'rien' ? '' : 'en_cours',
    validateur: c.que === 'rien' ? '' : c.valid,
    echeance: c.que === 'rien' ? '' : c.ech,
    type_cree: c.que === 'creer' ? c.type : '',
    rattache: c.que === 'creer' ? c.ratt : '',
  };
}

/** Résumé d'un point déjà concrétisé (lecture, compte rendu, suivi) */
export function resumePoint(pt: PointReunion, nomDe: (email: string) => string, h: H): string {
  if (pt.concretisation === 'rien') return 'Rien (clos)';
  const c: ChoixConcret = {
    que: pt.concretisation === 'suivi' || pt.concretisation === 'escalade' || pt.concretisation === 'synchro' ? 'suivre' : 'creer',
    type: (pt.type_cree as TypeCree) || 'tache',
    titre: pt.texte,
    qui: pt.concretisation === 'escalade' ? 'dessus' : 'equipe',
    resp: pt.responsable || pt.personne,
    element: pt.element,
    valid: pt.validateur ?? '',
    ech: pt.echeance ?? '',
    ratt: pt.rattache ?? '',
  };
  if (!c.valid) return resumeChoix({ ...c, valid: c.resp }, nomDe, h).replace(/ · Validation : [^·]+/, '');
  return resumeChoix(c, nomDe, h);
}
