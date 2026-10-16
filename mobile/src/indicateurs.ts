import { estBruit, estRetouche } from './bruitRetouche';
import { pointsBruts } from './pi';
import type { Item } from './types';

/**
 * Indicateurs de qualité du sprint (lot 9 du 16/10, docs/regles-reunions.html bloc 17 : B3, B4) : Bruit, Écart
 * d'estimation (hors bruit et retouche), Retouche, Stabilité. Mêmes calculs partout (Rétrospective, Revue,
 * Planification, Inspect & Adapt, Pilotage ; l'écart aussi à l'Affinage). Rien ici n'appelle Google.
 */

export type TonIndicateur = 'vert' | 'orange' | 'rouge' | 'gris';
export interface Indicateur {
  /** « Bruit », « Écart d'estimation », « Retouche », « Stabilité » */
  nom: string;
  /** Pourcentage arrondi ; null = pas de données */
  pct: number | null;
  ton: TonIndicateur;
  /** « 1 pt sur 25 », « 3 changements (+8 pts, −5 pts) » */
  detail: string;
}
const r = (n: number) => Math.round(n);
const pts = (l: Item[]) => +l.reduce((n, t) => n + pointsBruts(t), 0).toFixed(1);
const unite = (n: number) => `${n} pt${Math.abs(n) > 1 ? 's' : ''}`;

/** Éléments d'une équipe dans un sprint (sous-tâches comprises : la retouche et le bruit en sont) */
export const duSprint = (items: Item[], equipes: string[], sprint: string) => items.filter((t) => t.iteration === sprint && equipes.includes(t.equipe ?? ''));
/** Faits « normaux » du sprint : terminés, hors bruit et retouche, hors sous-tâches (la story compte) */
const faitsNormaux = (l: Item[]) => l.filter((t) => t.statut === 'termine' && !estBruit(t) && !estRetouche(t) && !t.parent);

/** B3 · Bruit : points de bruit ÷ points faits ; vert < 5 %, orange < 15 % */
export function bruit(l: Item[]): Indicateur {
  const b = pts(l.filter(estBruit).filter((t) => !!t.parent));
  const f = pts(faitsNormaux(l));
  if (!f) return { nom: 'Bruit', pct: null, ton: 'gris', detail: 'pas encore de points faits' };
  const pct = r((b / f) * 100);
  return { nom: 'Bruit', pct, ton: pct < 5 ? 'vert' : pct < 15 ? 'orange' : 'rouge', detail: `${unite(b)} sur ${unite(f)}` };
}
/** B3 · Retouche : points de retouche (sous-tâches 🔧 et bugs) ÷ points faits ; vert < 5 %, orange < 10 % */
export function retouche(l: Item[]): Indicateur {
  const x = pts(l.filter((t) => estRetouche(t)));
  const f = pts(faitsNormaux(l));
  if (!f) return { nom: 'Retouche', pct: null, ton: 'gris', detail: 'pas encore de points faits' };
  const pct = r((x / f) * 100);
  return { nom: 'Retouche', pct, ton: pct < 5 ? 'vert' : pct < 10 ? 'orange' : 'rouge', detail: `${unite(x)} sur ${unite(f)}` };
}
/**
 * B3 · Écart d'estimation, hors bruit et retouche : (jours réels − jours estimés) ÷ jours estimés, jours estimés =
 * points faits × jours par point ; vert ±15 %, orange ±30 %. Jours réels : validés à la Rétrospective (en attendant le CRA)
 */
export function ecartEstimation(l: Item[], joursReels: number, joursParPoint: number): Indicateur {
  const estimes = pts(faitsNormaux(l)) * (joursParPoint || 1);
  if (!estimes || !joursReels) return { nom: 'Écart d’estimation', pct: null, ton: 'gris', detail: joursReels ? 'pas encore de points faits' : 'jours réels pas encore validés' };
  const pct = r(((joursReels - estimes) / estimes) * 100);
  const a = Math.abs(pct);
  return { nom: 'Écart d’estimation', pct, ton: a <= 15 ? 'vert' : a <= 30 ? 'orange' : 'rouge', detail: `${+joursReels.toFixed(1)} j réels pour ${+estimes.toFixed(1)} j estimés` };
}

/** Éléments engagés à la Planification : ceux qui étaient dans le sprint sur sa photo (clés « t:<id> », sprint en 4e champ) */
export function engagesDePhoto(photo: Record<string, string>, sprint: string): Set<string> {
  return new Set(
    Object.entries(photo)
      .filter(([k, v]) => k.startsWith('t:') && v.split('|')[3] === sprint)
      .map(([k]) => k.slice(2)),
  );
}
/**
 * B4 · Stabilité du sprint : points engagés à la Planification restés jusqu'à la fin ÷ points engagés ;
 * « Stabilité 85 % · 3 changements (+8 pts, −5 pts) » ; vert ≥ 90 %, orange ≥ 75 %
 */
export function stabilite(engages: Set<string> | null, l: Item[], tous: Item[]): Indicateur {
  if (!engages || !engages.size) return { nom: 'Stabilité', pct: null, ton: 'gris', detail: 'pas de photo de la Planification' };
  const parId = new Map(tous.map((t) => [t.id, t]));
  const dedans = new Set(l.filter((t) => !t.parent).map((t) => t.id));
  const eng = [...engages].map((id) => parId.get(id)).filter((t): t is Item => !!t && !t.parent);
  const total = pts(eng);
  const restes = pts(eng.filter((t) => dedans.has(t.id)));
  const sortis = eng.filter((t) => !dedans.has(t.id));
  const entres = l.filter((t) => !t.parent && !engages.has(t.id) && !estBruit(t) && pointsBruts(t) > 0);
  if (!total) return { nom: 'Stabilité', pct: null, ton: 'gris', detail: 'rien d’estimé à la Planification' };
  const pct = r((restes / total) * 100);
  const n = sortis.length + entres.length;
  const plus = pts(entres);
  const moins = pts(sortis);
  return { nom: 'Stabilité', pct, ton: pct >= 90 ? 'vert' : pct >= 75 ? 'orange' : 'rouge', detail: n ? `${n} changement${n > 1 ? 's' : ''} (${[plus ? `+${unite(plus)}` : '', moins ? `−${unite(moins)}` : ''].filter(Boolean).join(', ')})` : 'aucun changement' };
}
