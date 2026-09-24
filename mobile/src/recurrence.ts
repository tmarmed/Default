import { addDays, addMonths, startOfWeek, toDateString } from './dates';
import { aDateFin, dateRepere, type Item, type Periodicite } from './types';

/** Une échéance d'un élément répété, dans une période donnée. */
export interface Occurrence {
  /** Clé de la période, enregistrée dans « faits » : 2026-09-21 (semaine), 2026-09, 2026-T3, 2026 */
  key: string;
  /** Fenêtre où l'échéance tombe (AAAA-MM-JJ) : un seul jour si l'échéance est précise */
  start: string;
  end: string;
  /** Jour précis, ou vide si « dans la période » */
  date: string;
  /** Visible dans la liste à partir de ce jour (pas de rappel en avance) */
  visibleFrom: string;
  fenetre?: Item['fenetre'];
  label: string;
}

type P = Exclude<Periodicite, ''>;

const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

const firstOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const lastOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
const fromString = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export function periodStart(p: P, d: Date): Date {
  switch (p) {
    case 'hebdomadaire':
      return startOfWeek(d);
    case 'mensuelle':
      return firstOfMonth(d);
    case 'trimestrielle':
      return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1);
    case 'annuelle':
      return new Date(d.getFullYear(), 0, 1);
  }
}

function nextPeriod(p: P, start: Date): Date {
  if (p === 'hebdomadaire') return addDays(start, 7);
  return addMonths(start, p === 'mensuelle' ? 1 : p === 'trimestrielle' ? 3 : 12);
}

function periodKey(p: P, start: Date): string {
  const y = start.getFullYear();
  if (p === 'hebdomadaire') return toDateString(start);
  if (p === 'mensuelle') return toDateString(start).slice(0, 7);
  if (p === 'trimestrielle') return `${y}-T${Math.floor(start.getMonth() / 3) + 1}`;
  return String(y);
}

/** Jour du mois borné à la longueur du mois (31 → 28 en février). */
function dayIn(month: Date, day: number): Date {
  return new Date(month.getFullYear(), month.getMonth(), Math.min(day, lastOfMonth(month).getDate()));
}

const num = (s: string | undefined) => {
  const n = parseInt(s ?? '', 10);
  return Number.isFinite(n) ? n : 0;
};

/** Échéance de l'élément dans la période qui commence à `start`. */
export function occurrenceIn(item: Item, start: Date): Occurrence {
  const p = item.periodicite as P;
  const key = periodKey(p, start);
  const end = addDays(nextPeriod(p, start), -1);
  const [a, b] = (item.echeance ?? '').split('-');
  let date: Date | null = null;
  let winStart = start;
  let winEnd = end;
  let fenetre: Item['fenetre'];

  if (p === 'hebdomadaire') {
    const wd = num(a);
    if (wd >= 1 && wd <= 7) date = addDays(start, wd - 1);
    else fenetre = 'semaine';
  } else if (p === 'mensuelle') {
    const d = num(a);
    if (d >= 1) date = dayIn(start, d);
    else fenetre = 'mois';
  } else if (p === 'trimestrielle') {
    const m = num(a);
    if (m >= 1 && m <= 3) {
      const month = addMonths(start, m - 1);
      const d = num(b);
      if (d >= 1) date = dayIn(month, d);
      else {
        winStart = month;
        winEnd = lastOfMonth(month);
        fenetre = 'mois';
      }
    } else fenetre = 'trimestre';
  } else {
    const m = num(a);
    if (m >= 1 && m <= 12) {
      const month = new Date(start.getFullYear(), m - 1, 1);
      const d = num(b);
      if (d >= 1) date = dayIn(month, d);
      else {
        winStart = month;
        winEnd = lastOfMonth(month);
        fenetre = 'mois';
      }
    } else fenetre = 'annee';
  }

  if (date) winStart = winEnd = date;
  // Annuel : visible à partir du mois de l'échéance ; sinon dès le début de la période.
  const visible = p === 'annuelle' ? firstOfMonth(winStart) : start;

  return {
    key,
    start: toDateString(winStart),
    end: toDateString(winEnd),
    date: date ? toDateString(date) : '',
    visibleFrom: toDateString(visible),
    fenetre,
    label: periodLabel(p, start, winStart, fenetre === 'annee'),
  };
}

function periodLabel(p: P, start: Date, win: Date, wholeYear: boolean): string {
  const y = start.getFullYear();
  if (p === 'hebdomadaire') return `semaine du ${start.getDate()} ${MOIS[start.getMonth()]}`;
  if (p === 'mensuelle') return `${MOIS[start.getMonth()]} ${y}`;
  if (p === 'trimestrielle') return `T${Math.floor(start.getMonth() / 3) + 1} ${y}`;
  return wholeYear ? String(y) : `${MOIS[win.getMonth()]} ${y}`;
}

export function isRecurring(item: Item): boolean {
  return !!item.periodicite;
}

export function doneKeys(item: Item): Set<string> {
  return new Set((item.faits ?? '').split(';').map((k) => k.trim()).filter(Boolean));
}

export function toggleDone(item: Item, key: string): string {
  const keys = doneKeys(item);
  if (keys.has(key)) keys.delete(key);
  else keys.add(key);
  return [...keys].sort().join(';');
}

/** Premier jour pris en compte : date de début, sinon jour de création. */
function startDate(item: Item, today: string): string {
  return item.debut || (item.cree_le ? toDateString(new Date(item.cree_le)) : '') || today;
}

/** Échéances comprises (même partiellement) entre `from` et `to`, dans les limites début / fin. */
export function occurrencesBetween(item: Item, from: string, to: string, today = toDateString(new Date())): Occurrence[] {
  const p = item.periodicite as P;
  const first = startDate(item, today);
  const lo = first > from ? first : from;
  const out: Occurrence[] = [];
  let start = periodStart(p, fromString(lo));
  for (let i = 0; i < 2000 && toDateString(start) <= to; i++, start = nextPeriod(p, start)) {
    const occ = occurrenceIn(item, start);
    if (occ.end < first || occ.end < from || occ.start > to) continue;
    if (item.fin && occ.start > item.fin) break;
    out.push(occ);
  }
  return out;
}

/** Ce qui est à faire aujourd'hui : périodes oubliées et échéance en cours. */
export function recurrenceState(item: Item, today: string): { missed: Occurrence[]; current?: Occurrence } {
  const done = doneKeys(item);
  // Jusqu'à un an plus tard : l'échéance de la période en cours peut tomber après aujourd'hui.
  const horizon = toDateString(addDays(fromString(today), 400));
  const occs = occurrencesBetween(item, '0000-01-01', horizon, today).filter((o) => !done.has(o.key));
  const missed = occs.filter((o) => o.end < today);
  const current = occs.find((o) => o.end >= today && o.visibleFrom <= today);
  return { missed, current };
}

/** Transforme un élément répété en lignes à afficher dans la liste. */
export function listEntries(item: Item, today: string): Item[] {
  const { missed, current } = recurrenceState(item, today);
  const out: Item[] = [];
  if (missed.length) {
    const oldest = missed[0];
    out.push({
      ...item,
      id: `${item.id}#retard`,
      baseId: item.id,
      occurrence: oldest.key,
      date: oldest.date || oldest.end,
      statut: 'a_faire',
      periodeLabel: oldest.label,
      retards: missed.map((o) => o.label),
    });
  }
  if (current) out.push(occurrenceEntry(item, current, false));
  return out;
}

/** Ligne affichée pour une échéance donnée. */
export function occurrenceEntry(item: Item, occ: Occurrence, done: boolean): Item {
  return {
    ...item,
    id: `${item.id}#${occ.key}`,
    baseId: item.id,
    occurrence: occ.key,
    date: occ.date,
    statut: done ? 'termine' : 'a_faire',
    fenetre: occ.date ? undefined : occ.fenetre,
    periodeLabel: occ.label,
  };
}

const JOURS_LONGS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const MOIS_LONGS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** Phrase courte : « Chaque mois, le 5 », « Chaque année, en mai »… */
export function describeRecurrence(item: Pick<Item, 'periodicite' | 'echeance' | 'fin'>): string {
  const [a, b] = (item.echeance ?? '').split('-');
  const x = num(a);
  const y = num(b);
  let s = '';
  switch (item.periodicite) {
    case 'hebdomadaire':
      s = 'Chaque semaine' + (x >= 1 && x <= 7 ? `, le ${JOURS_LONGS[x - 1]}` : '');
      break;
    case 'mensuelle':
      s = 'Chaque mois' + (x >= 1 ? `, le ${x === 1 ? '1er' : x}` : ', dans le mois');
      break;
    case 'trimestrielle':
      s = 'Chaque trimestre' + (x >= 1 && x <= 3 ? `, ${x === 1 ? '1er' : `${x}e`} mois` + (y >= 1 ? ` le ${y}` : '') : '');
      break;
    case 'annuelle':
      s = 'Chaque année' + (x >= 1 && x <= 12 ? (y >= 1 ? `, le ${y} ${MOIS[x - 1]}` : `, en ${MOIS_LONGS[x - 1]}`) : '');
      break;
    default:
      return '';
  }
  if (item.fin) {
    const [yy, mm, dd] = item.fin.split('-').map(Number);
    s += `, jusqu'au ${dd} ${MOIS[mm - 1]} ${yy}`;
  }
  return s;
}

/**
 * Vues Jour / Semaine / Mois : échéances des éléments répétés entre `from` et `to`.
 * Celles à jour précis vont dans `byDate` ; celles « dans la période » dans `fenetres`.
 */
export function expandRange(
  items: Item[],
  from: string,
  to: string,
  today = toDateString(new Date()),
): { byDate: Map<string, Item[]>; fenetres: { entry: Item; start: string; end: string }[] } {
  const byDate = new Map<string, Item[]>();
  const fenetres: { entry: Item; start: string; end: string }[] = [];
  for (const item of items) {
    if (!item.periodicite) {
      // (date, sinon date de fin d'une démarche)
      const d = dateRepere(item);
      if (!d) continue;
      const list = byDate.get(d);
      if (list) list.push(item);
      else byDate.set(d, [item]);
      // Démarche avec une date ET une date de fin : repère « ⏳ Fin » le jour de sa date de fin (tant qu'elle n'est pas finie)
      if (aDateFin(item.type) && item.date && item.date_fin && item.date_fin !== item.date && item.statut !== 'termine') {
        const fin = { ...item, repereFin: true };
        const l2 = byDate.get(item.date_fin);
        if (l2) l2.push(fin);
        else byDate.set(item.date_fin, [fin]);
      }
      continue;
    }
    const done = doneKeys(item);
    for (const occ of occurrencesBetween(item, from, to, today)) {
      const entry = occurrenceEntry(item, occ, done.has(occ.key));
      if (occ.date) {
        const list = byDate.get(occ.date);
        if (list) list.push(entry);
        else byDate.set(occ.date, [entry]);
      } else {
        fenetres.push({ entry, start: occ.start, end: occ.end });
      }
    }
  }
  return { byDate, fenetres };
}
