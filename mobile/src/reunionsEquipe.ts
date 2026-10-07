import { addDays, toDateString } from './dates';
import { iterationByKey, iterationOfItem, pointsOf, shiftIteration } from './pi';
import type { Item } from './types';

/**
 * Calculs des réunions d'équipe (07/10) : Planification, Revue, Rétrospective, Affinage. Sans affichage.
 */

const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

// ---------------------------------------------------------------------------
// Critères d'acceptation : rangés dans la description de la story, sous « Critères d'acceptation : »
// ---------------------------------------------------------------------------
const TITRE_CRITERES = /^\s*crit[eè]res d['’]acceptation\s*:?\s*$/i;
/** Critères d'acceptation d'une story (lignes « - … » ou « • … » sous « Critères d'acceptation : ») */
export function criteresDe(description: string): string[] {
  const l = (description || '').split('\n');
  const i = l.findIndex((x) => TITRE_CRITERES.test(x));
  if (i < 0) return [];
  const out: string[] = [];
  for (const x of l.slice(i + 1)) {
    const m = /^\s*[-•]\s*(.+)$/.exec(x);
    if (!m) break;
    out.push(m[1].trim());
  }
  return out;
}
/** Description avec ses critères remplacés (la section est ajoutée à la fin si elle n'existait pas) */
export function avecCriteres(description: string, criteres: string[]): string {
  const l = (description || '').split('\n');
  const i = l.findIndex((x) => TITRE_CRITERES.test(x));
  const bloc = criteres.length ? ['Critères d’acceptation :', ...criteres.map((c) => `- ${c}`)] : [];
  if (i < 0) return [...l.filter((x, k) => x.trim() || k < l.length - 1), ...(bloc.length && l.some((x) => x.trim()) ? [''] : []), ...bloc].join('\n').trim();
  let j = i + 1;
  while (j < l.length && /^\s*[-•]\s*/.test(l[j])) j++;
  return [...l.slice(0, i), ...bloc, ...l.slice(j)].join('\n').trim();
}

// ---------------------------------------------------------------------------
// Prête pour la planification (Definition of Ready, règle du 07/10)
// ---------------------------------------------------------------------------
export const MAX_POINTS_PRETE = 8;
/**
 * État « Prête » calculé : estimée par l'équipe, critères d'acceptation écrits, 8 pts au plus, rattachée à une
 * feature ; `manque` dit ce qui manque. `points` et `criteres` : valeurs en cours (vote retenu, critères du PO).
 */
export function etatPrete(o: { points: number; criteres: string[]; feature: string }): { ok: boolean; manque: string[] } {
  const manque: string[] = [];
  if (!(o.points > 0)) manque.push('estimation');
  if (!o.criteres.length) manque.push('critères d’acceptation');
  if (o.points > MAX_POINTS_PRETE) manque.push(`découpage (${o.points} pts, plus de ${MAX_POINTS_PRETE})`);
  if (!o.feature) manque.push('feature');
  return { ok: !manque.length, manque };
}

/**
 * Stories à affiner : stories de l'équipe pas terminées, dans le backlog (sans itération, ou d'une itération après
 * `itKey`), pas encore prêtes ; triées par rang du PO puis titre
 */
export function storiesAAffiner(items: Item[], dansEquipe: (t: Item) => boolean, itKey: string): Item[] {
  return items
    .filter((t) => t.type === 'story' && t.statut !== 'termine' && dansEquipe(t) && (!iterationOfItem(t) || iterationOfItem(t) > itKey))
    .filter((t) => !etatPrete({ points: pointsOf(t), criteres: criteresDe(t.description), feature: t.feature }).ok)
    .sort((a, b) => (Number(a.rang) || 9999) - (Number(b.rang) || 9999) || a.titre.localeCompare(b.titre));
}
/** Stories prêtes du backlog de l'équipe (sans itération, ou après `itKey`) */
export function storiesPretes(items: Item[], dansEquipe: (t: Item) => boolean, itKey: string): Item[] {
  return items
    .filter((t) => t.type === 'story' && t.statut !== 'termine' && dansEquipe(t) && (!iterationOfItem(t) || iterationOfItem(t) >= itKey))
    .filter((t) => etatPrete({ points: pointsOf(t), criteres: criteresDe(t.description), feature: t.feature }).ok)
    .sort((a, b) => (Number(a.rang) || 9999) - (Number(b.rang) || 9999) || a.titre.localeCompare(b.titre));
}

// ---------------------------------------------------------------------------
// Vélocité et capacité
// ---------------------------------------------------------------------------
/** Points terminés par l'équipe dans une itération (stories et tâches de premier niveau) */
export function pointsFaits(items: Item[], dansEquipe: (t: Item) => boolean, itKey: string): number {
  return items.filter((t) => !t.parent && dansEquipe(t) && iterationOfItem(t) === itKey && t.statut === 'termine').reduce((n, t) => n + pointsOf(t), 0);
}
/** Vélocité des `n` itérations avant `itKey` (la plus ancienne d'abord), et sa moyenne arrondie */
export function velocite(items: Item[], dansEquipe: (t: Item) => boolean, itKey: string, n = 3): { iterations: { key: string; points: number }[]; moyenne: number } {
  const its: string[] = [];
  let k = itKey;
  for (let i = 0; i < n; i++) {
    k = shiftIteration(k, -1);
    if (k.endsWith('-IP')) k = shiftIteration(k, -1);
    its.unshift(k);
  }
  const l = its.map((key) => ({ key, points: pointsFaits(items, dansEquipe, key) }));
  const vues = l.filter((x) => x.points > 0);
  return { iterations: l, moyenne: vues.length ? Math.round(vues.reduce((s, x) => s + x.points, 0) / vues.length) : 0 };
}

/** Jours fériés en France d'une année (fixes, Pâques, Ascension, Pentecôte) : AAAA-MM-JJ */
export function feriesFrance(annee: number): string[] {
  // Pâques (algorithme de Meeus)
  const a = annee % 19;
  const b = Math.floor(annee / 100);
  const c = annee % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mois = Math.floor((h + l - 7 * m + 114) / 31);
  const jour = ((h + l - 7 * m + 114) % 31) + 1;
  const paques = new Date(annee, mois - 1, jour);
  const fixes = ['01-01', '05-01', '05-08', '07-14', '08-15', '11-01', '11-11', '12-25'].map((x) => `${annee}-${x}`);
  return [...fixes, toDateString(addDays(paques, 1)), toDateString(addDays(paques, 39)), toDateString(addDays(paques, 50))].sort();
}
/** Jours ouvrés d'une période (du lundi au vendredi, jours fériés exclus), et les fériés rencontrés */
export function joursOuvres(debut: string, fin: string): { jours: number; feries: string[] } {
  let n = 0;
  const feries: string[] = [];
  const tous = new Set([...feriesFrance(Number(debut.slice(0, 4))), ...feriesFrance(Number(fin.slice(0, 4)))]);
  for (let d = parse(debut); toDateString(d) <= fin; d = addDays(d, 1)) {
    const s = toDateString(d);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    if (tous.has(s)) {
      feries.push(s);
      continue;
    }
    n++;
  }
  return { jours: n, feries };
}
/** Jours travaillés d'une itération pour une personne (jours ouvrés moins ses absences, en jours, 0,5 possible) */
export function joursTravailles(itKey: string, absences: number[]): { jours: number; feries: string[] } {
  const it = iterationByKey(itKey);
  if (!it) return { jours: 0, feries: [] };
  const o = joursOuvres(it.start, it.end);
  return { jours: Math.max(0, o.jours - absences.reduce((s, x) => s + (x > 0 ? x : 0), 0)), feries: o.feries };
}
/** Points par jour par défaut (modifiable par le SM pour chacun) */
export const PTS_JOUR_DEFAUT = 0.8;
/** Capacité en points (arrondie au point) */
export const capacite = (jours: number, ptsJour: number) => Math.round(jours * ptsJour);
/** « 0,8 » → 0.8 ; vide ou invalide → NaN */
export const lireNombre = (x: string) => (x.trim() ? Number(x.trim().replace(',', '.')) : NaN);
/** 0.8 → « 0,8 » */
export const nombreFr = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');
