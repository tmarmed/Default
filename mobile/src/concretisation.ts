import { elementDe } from './elementConcerne';
import type { HierarchyValue } from './hierarchyContext';
import { jourCourt } from './pointsSuivi';
import { PARENT_TYPES } from './subtasks';
import { type Concretisation, type ItemType, type PointReunion, TYPE_LABELS } from './types';

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
  if (type === 'story') {
    const f = x.genre === 'feature' ? x.id : x.genre === 'item' ? x.item?.feature || '' : '';
    return f ? { id: f, libelle: lib(f) } : null;
  }
  if (type === 'feature') {
    const ep = x.genre === 'epic' ? x.id : x.genre === 'feature' ? (h.featureList.find((f) => f.id === x.id)?.epic ?? '') : x.genre === 'item' ? x.item?.epic || '' : '';
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
