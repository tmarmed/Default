import { addDays, addMonths, toDateString } from './dates';
import { tasksOfEpic } from './hierarchy';
import type { Epic, Feature, Item } from './types';

/** Échelles de la roadmap. */
export type Zoom = '3ans' | 'annee' | 'trimestre' | 'mois';

export interface Column {
  label: string;
  /** Position et largeur en fraction de la fenêtre (0 à 1) */
  left: number;
  width: number;
}

export interface Window {
  start: string;
  /** Dernier jour inclus */
  end: string;
  title: string;
  /** Graduations principales (années, mois…) */
  columns: Column[];
  /** Graduations secondaires, plus discrètes (trimestres, semaines…) */
  ticks: number[];
}

const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const MOIS_LETTRE = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const MOIS_LONGS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

const DAY = 86400000;
/** Nombre de jours depuis une origine fixe (sans effet des changements d'heure). */
export function dayNumber(s: string): number {
  const [y, m, d] = s.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY);
}

/** Début de la fenêtre contenant `d` pour l'échelle choisie. */
function windowStart(zoom: Zoom, d: Date): Date {
  if (zoom === '3ans' || zoom === 'annee') return new Date(d.getFullYear(), 0, 1);
  if (zoom === 'trimestre') return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1);
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

const MONTHS_SPAN: Record<Zoom, number> = { '3ans': 36, annee: 12, trimestre: 3, mois: 1 };
/** Déplacement d'un glissement / d'une flèche, en mois. */
const STEP: Record<Zoom, number> = { '3ans': 12, annee: 12, trimestre: 3, mois: 1 };

export function shift(zoom: Zoom, anchor: Date, n: number): Date {
  return addMonths(windowStart(zoom, anchor), STEP[zoom] * n);
}

export function roadmapWindow(zoom: Zoom, anchor: Date): Window {
  const s = windowStart(zoom, anchor);
  const e = addDays(addMonths(s, MONTHS_SPAN[zoom]), -1);
  const start = toDateString(s);
  const end = toDateString(e);
  const total = dayNumber(end) - dayNumber(start) + 1;
  const frac = (d: Date) => (dayNumber(toDateString(d)) - dayNumber(start)) / total;
  const col = (a: Date, b: Date, label: string): Column => ({ label, left: frac(a), width: frac(b) - frac(a) });

  const columns: Column[] = [];
  const ticks: number[] = [];
  let title: string;

  if (zoom === '3ans') {
    title = `${s.getFullYear()} – ${s.getFullYear() + 2}`;
    for (let i = 0; i < 3; i++) {
      const a = addMonths(s, 12 * i);
      columns.push(col(a, addMonths(a, 12), String(a.getFullYear())));
      for (let q = 1; q < 4; q++) ticks.push(frac(addMonths(a, 3 * q)));
    }
  } else if (zoom === 'annee') {
    title = String(s.getFullYear());
    for (let i = 0; i < 12; i++) {
      const a = addMonths(s, i);
      columns.push(col(a, addMonths(a, 1), MOIS_LETTRE[i]));
    }
  } else if (zoom === 'trimestre') {
    const q = Math.floor(s.getMonth() / 3) + 1;
    title = `T${q} ${s.getFullYear()}`;
    for (let i = 0; i < 3; i++) {
      const a = addMonths(s, i);
      columns.push(col(a, addMonths(a, 1), MOIS[a.getMonth()]));
    }
    // Un repère par lundi
    for (let d = s; d <= e; d = addDays(d, 1)) if (d.getDay() === 1 && d.getDate() !== 1) ticks.push(frac(d));
  } else {
    title = `${MOIS_LONGS[s.getMonth()]} ${s.getFullYear()}`;
    // Colonnes = semaines (lundi → dimanche), coupées au mois
    let a = s;
    while (a <= e) {
      let b = addDays(a, 1);
      while (b <= e && b.getDay() !== 1) b = addDays(b, 1);
      columns.push(col(a, b, String(a.getDate())));
      a = b;
    }
  }
  return { start, end, title, columns, ticks };
}

export interface Bar {
  left: number;
  width: number;
  /** L'epic commence avant / finit après la fenêtre */
  cutStart: boolean;
  cutEnd: boolean;
  /** Epic sans fin : la barre va jusqu'au bout de la fenêtre */
  infinite: boolean;
}

/** Position de la barre d'une epic dans la fenêtre, ou null si elle est en dehors. */
export function barFor(epic: Pick<Epic, 'debut' | 'fin'>, win: Pick<Window, 'start' | 'end'>): Bar | null {
  const infinite = !epic.fin;
  if ((!infinite && epic.fin < win.start) || epic.debut > win.end) return null;
  const w0 = dayNumber(win.start);
  const total = dayNumber(win.end) - w0 + 1;
  const a = Math.max(dayNumber(epic.debut), w0);
  const b = (infinite ? dayNumber(win.end) : Math.min(dayNumber(epic.fin), dayNumber(win.end))) + 1;
  return {
    left: (a - w0) / total,
    width: (b - a) / total,
    cutStart: epic.debut < win.start,
    cutEnd: infinite || epic.fin > win.end,
    infinite,
  };
}

/** Position d'un jour dans la fenêtre (pour le trait « aujourd'hui »), ou null. */
export function positionOf(day: string, win: Pick<Window, 'start' | 'end'>): number | null {
  if (day < win.start || day > win.end) return null;
  const w0 = dayNumber(win.start);
  return (dayNumber(day) - w0 + 0.5) / (dayNumber(win.end) - w0 + 1);
}

/** Avancement d'une epic : tâches ponctuelles terminées / total (les tâches répétées ne comptent pas). */
export function progress(epicId: string, items: Item[], features: Feature[] = []): { done: number; total: number; repeated: number } {
  let done = 0;
  let total = 0;
  let repeated = 0;
  for (const i of tasksOfEpic(epicId, items, features)) {
    if (i.periodicite) repeated++;
    else {
      total++;
      if (i.statut === 'termine') done++;
    }
  }
  return { done, total, repeated };
}

/** « 1 oct. 2026 → 31 mars 2027 · 6 mois » */
export function formatEpicDates(epic: Pick<Epic, 'debut' | 'fin'>): string {
  const f = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return `${d === 1 ? '1er' : d} ${MOIS[m - 1]} ${y}`;
  };
  if (!epic.fin) return `${f(epic.debut)} → sans fin`;
  const days = dayNumber(epic.fin) - dayNumber(epic.debut) + 1;
  const duree =
    days < 14 ? `${days} j` : days < 28 ? `${Math.round(days / 7)} sem.` : `${Math.round(days / 30.44)} mois`;
  return `${f(epic.debut)} → ${f(epic.fin)} · ${duree}`;
}
