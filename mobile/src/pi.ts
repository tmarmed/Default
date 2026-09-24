import { addDays, toDateString } from './dates';
import { aDateFin, type Item } from './types';

/**
 * Calendrier SAFe : un PI = un trimestre civil, découpé en 6 itérations de 14 jours
 * à partir du 1er jour du trimestre ; les jours restants forment la semaine IP
 * (innovation et planification).
 */

export const ITERATIONS = ['IT1', 'IT2', 'IT3', 'IT4', 'IT5', 'IT6', 'IP'] as const;
export type IterationCode = (typeof ITERATIONS)[number];

const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const court = (d: Date) => `${d.getDate() === 1 ? '1er' : d.getDate()} ${MOIS[d.getMonth()]}`;
const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** « 2026-T4 » du jour donné */
export function piOf(date: string | Date): string {
  const d = typeof date === 'string' ? parse(date) : date;
  return `${d.getFullYear()}-T${Math.floor(d.getMonth() / 3) + 1}`;
}

export function piStart(pi: string): Date {
  const [y, q] = pi.split('-T').map(Number);
  return new Date(y, (q - 1) * 3, 1);
}

export function piEnd(pi: string): Date {
  const [y, q] = pi.split('-T').map(Number);
  return new Date(y, q * 3, 0);
}

export function shiftPi(pi: string, n: number): string {
  const s = piStart(pi);
  return piOf(new Date(s.getFullYear(), s.getMonth() + 3 * n, 1));
}

/** « T4 2026 » */
export const piLabel = (pi: string) => `${pi.split('-')[1]} ${pi.split('-')[0]}`;

export interface Iteration {
  /** « 2026-T4-IT3 » */
  key: string;
  pi: string;
  code: IterationCode;
  start: string;
  end: string;
  /** « IT3 · 29 oct. → 11 nov. » */
  label: string;
}

export function iterationsOf(pi: string): Iteration[] {
  const s = piStart(pi);
  const e = piEnd(pi);
  return ITERATIONS.map((code, i) => {
    const a = addDays(s, 14 * i);
    const b = code === 'IP' ? e : addDays(s, 14 * i + 13);
    return {
      key: `${pi}-${code}`,
      pi,
      code,
      start: toDateString(a),
      end: toDateString(b),
      label: `${code} · ${court(a)} → ${court(b)}`,
    };
  });
}

export function iterationByKey(key: string): Iteration | undefined {
  const m = /^(\d{4}-T[1-4])-(IT[1-6]|IP)$/.exec(key);
  return m ? iterationsOf(m[1]).find((it) => it.code === m[2]) : undefined;
}

/** Itération contenant le jour donné. */
export function iterationOf(date: string | Date): Iteration {
  const d = typeof date === 'string' ? date : toDateString(date);
  return iterationsOf(piOf(d)).find((it) => it.start <= d && d <= it.end)!;
}

export function shiftIteration(key: string, n: number): string {
  const it = iterationByKey(key)!;
  const d = n > 0 ? addDays(parse(it.end), 1) : addDays(parse(it.start), -1);
  const next = iterationOf(d).key;
  return Math.abs(n) > 1 ? shiftIteration(next, n - Math.sign(n)) : next;
}

/** Itération d'une tâche : d'après sa date, sinon celle choisie à la main. Les tâches répétées n'en ont pas. */
export function iterationOfItem(t: Item): string {
  if (t.periodicite) return '';
  if (t.date) return iterationOf(t.date).key;
  // Démarche sans date ni itération choisie : l'itération de sa date de fin
  if (!t.iteration && aDateFin(t.type) && t.date_fin) return iterationOf(t.date_fin).key;
  return t.iteration || '';
}

export const pointsOf = (x: { points?: string }) => {
  const n = parseFloat(x.points ?? '');
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** « 3 pts », ou « 3 j » quand 1 point = 1 jour */
export function fmtPoints(n: number, jours: boolean): string {
  const v = Math.round(n * 10) / 10;
  return jours ? `${v} j` : `${v} pt${v > 1 ? 's' : ''}`;
}
