import { jourMois } from './format';
import { iterationByKey, pointsOf } from './pi';
import type { Feature, Item } from './types';

/**
 * Calcul automatique (lot 6 du 16/10, docs/regles-reunions.html bloc 17 : K1-K4) : pièce commune des fiches, de
 * l'Itération, du PI et des alertes. Vers le bas : seulement les dates. Vers le haut : points (et dates), arrêt à
 * l'epic. Rien ici n'appelle Google.
 */

const pas = (n: number) => +n.toFixed(1);

/**
 * K1 · Date d'un élément pour l'affichage : la sienne ; sinon son sprint (rien à afficher : il est rangé dans le
 * sprint) ; sinon celle de son parent, en gris, qu'il suit. `source` dit d'où elle vient.
 */
export function dateHeritee(t: Pick<Item, 'date' | 'iteration' | 'parent'>, items: Pick<Item, 'id' | 'date' | 'date_fin' | 'titre'>[]): { date: string; source: 'propre' | 'sprint' | 'parent' | '' ; de?: string } {
  if (t.date) return { date: t.date, source: 'propre' };
  if (t.iteration) return { date: '', source: 'sprint' };
  const p = t.parent ? items.find((x) => x.id === t.parent) : undefined;
  const d = p?.date || p?.date_fin || '';
  return d ? { date: d, source: 'parent', de: p!.titre } : { date: '', source: '' };
}
/** K1 · « comme « Écran de connexion » : 18/10 » (gris, dans le champ Date vide) */
export const libelleDateHeritee = (x: ReturnType<typeof dateHeritee>) => (x.source === 'parent' ? `Comme « ${x.de} » : ${jourMois(x.date)}` : '');
/** K1 · Un enfant qui a sa propre date et sort de celle de son parent : alerte (texte) ; '' sinon */
export function sortDuParent(t: Pick<Item, 'date' | 'titre'>, parent: Pick<Item, 'date' | 'date_fin' | 'titre'> | undefined): string {
  const limite = parent?.date_fin || parent?.date || '';
  return t.date && limite && t.date > limite ? `« ${t.titre} » (${jourMois(t.date)}) sort de « ${parent!.titre} » (${jourMois(limite)}).` : '';
}

/** K2 · Points d'une feature : les siens ; vide → la somme de ses tâches (calculée sans rien dire) */
export function pointsFeature(f: Pick<Feature, 'points'>, taches: Item[]): { valeur: number; calcule: boolean } {
  const propre = pointsOf(f);
  if (propre > 0) return { valeur: propre, calcule: false };
  return { valeur: pas(taches.filter((t) => !t.parent).reduce((n, t) => n + pointsOf(t), 0)), calcule: true };
}
/** K2 · Points d'une epic : la somme de ses features (chacune avec sa valeur ou sa valeur calculée) ; arrêt à l'epic */
export function pointsEpic(features: Pick<Feature, 'id' | 'points'>[], taches: Item[]): number {
  return pas(features.reduce((n, f) => n + pointsFeature(f, taches.filter((t) => t.feature === f.id)).valeur, 0));
}
/** K2 · Dates vers le haut : parent sans date → du plus tôt au plus tard de ses enfants */
export function datesDesEnfants(enfants: Pick<Item, 'date' | 'date_fin' | 'iteration'>[]): { debut: string; fin: string } {
  const debuts = enfants.map((t) => t.date || (t.iteration ? iterationByKey(t.iteration)?.start ?? '' : '')).filter(Boolean).sort();
  const fins = enfants.map((t) => t.date_fin || t.date || (t.iteration ? iterationByKey(t.iteration)?.end ?? '' : '')).filter(Boolean).sort();
  return { debut: debuts[0] ?? '', fin: fins[fins.length - 1] ?? '' };
}

/**
 * K4 · Sous-tâches (un seul niveau, organisation perso) : leur somme ≤ estimation de la story → rien ; au-delà →
 * alerte « Passer à n · Garder » au responsable de la story ; story sans estimation → calculée sans rien dire
 */
export function depassementSousTaches(story: Pick<Item, 'points'>, sous: Pick<Item, 'points'>[]): { estimation: number; somme: number; alerte: boolean } {
  const e = pointsOf(story);
  const s = pas(sous.reduce((n, t) => n + pointsOf(t), 0));
  return { estimation: e, somme: s, alerte: e > 0 && s > e + 1e-9 };
}

/** K3 · Jours réels : jamais saisis sur une story, une feature ou une epic (calculés depuis les tâches ou le CRA) */
export const joursReelsSaisissables = (type: string) => type !== 'story' && type !== 'feature' && type !== 'epic';
