import type { Item } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

export function toDateString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function toTimeString(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function parseDate(date: string, heure = ''): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = heure ? heure.split(':').map(Number) : [9, 0];
  return new Date(y, m - 1, d, h, min);
}

const JOURS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

export function formatDate(date: string): string {
  const d = parseDate(date);
  return `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;
}

export function isOverdue(item: Item, today = toDateString(new Date())): boolean {
  return item.statut !== 'termine' && !!item.date && item.date < today;
}

export interface Section {
  title: string;
  data: Item[];
}

const PRIO_ORDER = { haute: 0, normale: 1, basse: 2 } as const;

function compare(a: Item, b: Item): number {
  return (
    (a.date || '9999').localeCompare(b.date || '9999') ||
    (a.heure || '99').localeCompare(b.heure || '99') ||
    PRIO_ORDER[a.priorite] - PRIO_ORDER[b.priorite] ||
    a.titre.localeCompare(b.titre)
  );
}

/** Regroupe les éléments : En retard, Aujourd'hui, Demain, dates suivantes, Sans date, Terminés. */
export function groupItems(items: Item[], now = new Date()): Section[] {
  const today = toDateString(now);
  const tomorrow = toDateString(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  const groups = new Map<string, Item[]>();
  const add = (key: string, item: Item) => {
    const list = groups.get(key);
    if (list) list.push(item);
    else groups.set(key, [item]);
  };

  for (const item of [...items].sort(compare)) {
    if (item.statut === 'termine') add('~z_done', item);
    else if (!item.date) add('~a_none', item);
    else if (item.date < today) add('!late', item);
    else add(item.date, item);
  }

  const keys = [...groups.keys()].sort();
  return keys.map((key) => {
    let title: string;
    if (key === '!late') title = 'En retard';
    else if (key === '~a_none') title = 'Sans date';
    else if (key === '~z_done') title = 'Terminés';
    else if (key === today) title = "Aujourd'hui";
    else if (key === tomorrow) title = 'Demain';
    else title = formatDate(key);
    return { title, data: groups.get(key)! };
  });
}
