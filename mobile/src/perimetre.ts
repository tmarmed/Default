import { pointsOf } from './pi';
import type { EchangeInput, Item } from './types';

/**
 * Changement de périmètre (lot 7 du 16/10, docs/regles-reunions.html bloc 17 : P0, P1). Règle unique (P0) : toute
 * modification, hors Planification, qui fait varier les points engagés du sprint. N'importe qui propose, le PO
 * valide, le Scrum Master confirme (au Chat, sans point de suivi d'office) ; l'élément ne change qu'après la
 * confirmation. Rien ici n'appelle Google.
 */

type Avant = Pick<Item, 'iteration' | 'points' | 'parent' | 'equipe'> & { statut?: string };

/** P0 · Le changement fait-il varier les points engagés du sprint `sprint` ? Delta en points (+ entre, − sort) */
export function changementPerimetre(avant: Avant, apres: Avant, sprint: string): { oui: boolean; delta: number; quoi: string } {
  const non = { oui: false, delta: 0, quoi: '' };
  // Sous-tâche : organisation perso (dans la limite de la story : K4), jamais un changement de périmètre
  if (avant.parent || apres.parent) return non;
  const dedans = (x: Avant) => x.iteration === sprint && x.statut !== 'abandonne';
  const pAvant = dedans(avant) ? pointsOf(avant) : 0;
  const pApres = dedans(apres) ? pointsOf(apres) : 0;
  const delta = +(pApres - pAvant).toFixed(1);
  if (!delta) return non;
  const quoi = !dedans(avant) && dedans(apres) ? 'entre dans le sprint' : dedans(avant) && !dedans(apres) ? 'sort du sprint' : 'réestimée';
  return { oui: true, delta, quoi };
}

/** Ce que la demande changerait sur l'élément (appliqué à la confirmation) */
export interface PatchPerimetre {
  id: string;
  iteration?: string;
  points?: string;
}
export const TITRE_PERIMETRE = '🎯 Changement de périmètre ·';
export const estPerimetre = (e: { titre: string }) => e.titre.startsWith(TITRE_PERIMETRE);
export const CHOIX_PO = ['Valider', 'Refuser (motif)'];
export const CHOIX_SM = ['Confirmer', 'Refuser (motif)'];
const OUVRE = '⟦';
const FERME = '⟧';
/** Le changement, rangé à la fin du texte de la demande (relu à la confirmation) */
export const encoderPatch = (p: PatchPerimetre) => `${OUVRE}${JSON.stringify(p)}${FERME}`;
export function lirePatch(texte: string): PatchPerimetre | null {
  const i = texte.lastIndexOf(OUVRE);
  const j = texte.lastIndexOf(FERME);
  if (i < 0 || j < i) return null;
  try {
    const p = JSON.parse(texte.slice(i + 1, j)) as PatchPerimetre;
    return p && typeof p.id === 'string' ? p : null;
  } catch {
    return null;
  }
}
/** Texte lisible d'une demande (sans le changement encodé) */
export const texteLisible = (texte: string) => (texte.includes(OUVRE) ? texte.slice(0, texte.lastIndexOf(OUVRE)).trim() : texte);

/** P1 · Qui reste à décider : le PO valide, le SM confirme ; celui qui propose ne se répond pas à lui-même */
export function etapesPerimetre(par: string, po: string, sm: string): ('po' | 'sm')[] {
  const m = par.toLowerCase();
  return [...(po && po.toLowerCase() !== m ? (['po'] as const) : []), ...(sm && sm.toLowerCase() !== m && sm.toLowerCase() !== po.toLowerCase() ? (['sm'] as const) : [])];
}

/** « +5 pts · entre dans le sprint » */
export const libelleImpact = (c: { delta: number; quoi: string }, unite = 'pts') => `${c.delta > 0 ? '+' : '−'}${Math.abs(c.delta)} ${unite} · ${c.quoi}`;

/** P1 · La demande au Chat de celui qui décide (PO pour valider, SM pour confirmer) */
export function demandePerimetre(o: { de: string; a: string; etape: 'po' | 'sm'; item: Pick<Item, 'titre' | 'id'>; impact: string; raison: string; patch: PatchPerimetre; niveau: string; espace: string; avant?: string }): EchangeInput {
  return {
    de: o.de.toLowerCase(),
    a: o.a.toLowerCase(),
    type: 'question',
    nature: 'decision_a_prendre',
    titre: `${TITRE_PERIMETRE} ${o.item.titre}`.slice(0, 200),
    texte: `${o.impact}\nRaison : ${o.raison}${o.avant ? `\n${o.avant}` : ''}\n${o.etape === 'po' ? 'Le PO valide, puis le Scrum Master confirme.' : 'Validé par le PO : à confirmer.'} L’élément ne change qu’après la confirmation.\n${encoderPatch(o.patch)}`,
    choix: (o.etape === 'po' ? CHOIX_PO : CHOIX_SM).join(';'),
    reponse: '',
    note: '',
    statut: 'envoye',
    element: o.item.id,
    niveau: o.niveau,
    transmis_par: '',
    prive: '1',
    pieces_jointes: '',
    point: '',
    parent: '',
    espace: o.espace,
  };
}
/** P1 · À la baisse, proposer de compléter avec le backlog */
export const conseilBaisse = (delta: number, unite = 'pts') => (delta < 0 ? `${Math.abs(delta)} ${unite} libérés : complétez avec le backlog (Affinage) si l’équipe le peut.` : '');
