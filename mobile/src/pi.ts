import { addDays, toDateString } from './dates';
import { aDateFin, type Item } from './types';

/**
 * Calendrier agile (SAFe) : un PI par trimestre civil, découpé en sprints à partir de son premier jour ; les jours
 * restants forment la semaine IP (innovation et planification). Par défaut : 6 sprints de 2 semaines à partir du
 * 1er jour du trimestre. Réglable par équipe et par train (07/10, Organisation › 🗓️ Calendrier agile) : durée d'un
 * sprint, nombre de sprints, semaine IP, décalage du début du PI, et des exceptions occasionnelles (un PI qui commence
 * un autre jour). Le calendrier « courant » est celui de votre équipe (`definirCalendrier`) ; les clés des sprints
 * ne changent pas (« 2026-T4-IT3 »).
 */
export interface Calendrier {
  /** Durée d'un sprint, en semaines (1 à 4) */
  semaines: number;
  /** Nombre de sprints par PI, avant la semaine IP */
  sprints: number;
  /** Semaine IP en fin de PI (sinon le dernier sprint va jusqu'à la fin du PI) */
  ip: boolean;
  /** Le PI commence ce nombre de jours après le 1er jour du trimestre */
  decalage: number;
  /** Exceptions occasionnelles : ce PI commence un autre jour (AAAA-MM-JJ) */
  exceptions?: { pi: string; debut: string }[];
}
export const CALENDRIER_DEFAUT: Calendrier = { semaines: 2, sprints: 6, ip: true, decalage: 0 };
/** Calendrier lu depuis sa colonne (JSON), valeurs bornées ; vide ou invalide → par défaut */
export function lireCalendrier(x: string | Partial<Calendrier> | null | undefined): Calendrier {
  let c: Partial<Calendrier> = {};
  try {
    c = typeof x === 'string' ? (x.trim() ? JSON.parse(x) : {}) : (x ?? {});
  } catch {
    c = {};
  }
  const borne = (v: unknown, min: number, max: number, d: number) => (Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Math.round(Number(v)))) : d);
  return {
    semaines: borne(c.semaines, 1, 4, CALENDRIER_DEFAUT.semaines),
    sprints: borne(c.sprints, 1, 12, CALENDRIER_DEFAUT.sprints),
    ip: c.ip === undefined ? true : !!c.ip,
    decalage: borne(c.decalage, 0, 60, 0),
    exceptions: Array.isArray(c.exceptions) ? c.exceptions.filter((e) => /^\d{4}-T[1-4]$/.test(e?.pi ?? '') && /^\d{4}-\d{2}-\d{2}$/.test(e?.debut ?? '')) : [],
  };
}
/** Calendrier par défaut ? (rien à enregistrer) */
export const estDefaut = (c: Calendrier) => c.semaines === 2 && c.sprints === 6 && c.ip && !c.decalage && !c.exceptions?.length;
let courant: Calendrier = CALENDRIER_DEFAUT;
/** Calendrier courant (celui de votre équipe) : utilisé partout où l'on ne précise pas de calendrier */
export const definirCalendrier = (c?: Partial<Calendrier> | string | null) => void (courant = lireCalendrier(c ?? null));
export const calendrierCourant = () => courant;

export type IterationCode = string;

const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const court = (d: Date) => `${d.getDate() === 1 ? '1er' : d.getDate()} ${MOIS[d.getMonth()]}`;
const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** Trimestre civil d'un jour : « 2026-T4 » */
const trimestre = (d: Date) => `${d.getFullYear()}-T${Math.floor(d.getMonth() / 3) + 1}`;
/** PI d'un jour : « 2026-T4 » (avant le début décalé du PI : le PI d'avant) */
export function piOf(date: string | Date, cal: Calendrier = courant): string {
  const d = typeof date === 'string' ? parse(date) : date;
  const t = trimestre(d);
  return toDateString(d) < toDateString(piStart(t, cal)) ? shiftPi(t, -1) : t;
}

/** Premier jour du PI : le 1er du trimestre, plus le décalage ; ou le jour d'une exception */
export function piStart(pi: string, cal: Calendrier = courant): Date {
  const ex = cal.exceptions?.find((e) => e.pi === pi);
  if (ex) return parse(ex.debut);
  const [y, q] = pi.split('-T').map(Number);
  return addDays(new Date(y, (q - 1) * 3, 1), cal.decalage || 0);
}

/** Dernier jour du PI : la veille du début du PI suivant */
export function piEnd(pi: string, cal: Calendrier = courant): Date {
  return addDays(piStart(shiftPi(pi, 1), cal), -1);
}

export function shiftPi(pi: string, n: number): string {
  const [y, q] = pi.split('-T').map(Number);
  return trimestre(new Date(y, (q - 1) * 3 + 3 * n, 1));
}

/** « T4 2026 » */
export const piLabel = (pi: string) => `${pi.split('-')[1]} ${pi.split('-')[0]}`;

/** Nom affiché d'un sprint (07/10 : « Itération » devient « Sprint » partout) : « IT3 » → « S3 » ; « IP » reste */
export const nomSprint = (code: string) => code.replace(/^IT(\d+)$/, 'S$1');
/** « S3 » d'après une clé « 2026-T4-IT3 » */
export const nomSprintDe = (key: string) => nomSprint(key.split('-').pop() ?? key);
/** « S1 · T4 2026 » : nom d'un sprint, le même partout (clé interne inchangée : « 2026-T4-IT1 ») */
export const iterationNom = (key: string) => {
  const m = /^(\d{4})-(T[1-4])-(IT[1-6]|IP)$/.exec(key);
  return m ? `${nomSprint(m[3])} · ${m[2]} ${m[1]}` : key;
};

export interface Iteration {
  /** « 2026-T4-IT3 » */
  key: string;
  pi: string;
  code: IterationCode;
  /** Nom affiché (07/10 : « Sprint ») : « S3 », « IP » */
  nom: string;
  start: string;
  end: string;
  /** « IT3 · 29 oct. → 11 nov. » */
  label: string;
}

/** Sprints d'un PI (puis la semaine IP), selon le calendrier */
export function iterationsOf(pi: string, cal: Calendrier = courant): Iteration[] {
  const s = piStart(pi, cal);
  const e = piEnd(pi, cal);
  const fin = toDateString(e);
  const long = 7 * cal.semaines;
  const out: Iteration[] = [];
  const ajouter = (code: string, a: Date, b: Date) =>
    out.push({ key: `${pi}-${code}`, pi, code, nom: nomSprint(code), start: toDateString(a), end: toDateString(b), label: `${nomSprint(code)} · ${court(a)} → ${court(b)}` });
  for (let i = 0; i < cal.sprints; i++) {
    const a = addDays(s, long * i);
    if (toDateString(a) > fin) break;
    let b = addDays(s, long * i + long - 1);
    if (toDateString(b) > fin || (i === cal.sprints - 1 && !cal.ip)) b = e;
    ajouter(`IT${i + 1}`, a, b);
  }
  const apres = addDays(parse(out[out.length - 1]?.end ?? toDateString(addDays(s, -1))), 1);
  if (toDateString(apres) <= fin) ajouter('IP', apres, e);
  return out;
}

export function iterationByKey(key: string, cal: Calendrier = courant): Iteration | undefined {
  const m = /^(\d{4}-T[1-4])-(IT\d{1,2}|IP)$/.exec(key);
  return m ? iterationsOf(m[1], cal).find((it) => it.code === m[2]) : undefined;
}

/** Sprint (ou semaine IP) contenant le jour donné */
export function iterationOf(date: string | Date, cal: Calendrier = courant): Iteration {
  const d = typeof date === 'string' ? date : toDateString(date);
  const l = iterationsOf(piOf(d, cal), cal);
  return l.find((it) => it.start <= d && d <= it.end) ?? l[l.length - 1];
}

export function shiftIteration(key: string, n: number, cal: Calendrier = courant): string {
  const it = iterationByKey(key, cal);
  if (!it) return key;
  const d = n > 0 ? addDays(parse(it.end), 1) : addDays(parse(it.start), -1);
  const next = iterationOf(d, cal).key;
  return Math.abs(n) > 1 ? shiftIteration(next, n - Math.sign(n), cal) : next;
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
