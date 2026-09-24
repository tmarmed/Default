import { pointsOf } from './pi';
import type { Item, ItemType } from './types';

/**
 * Sous-tâches (même règle que le script, checkParent_) : un seul niveau ; parent de type story, démarche,
 * mission ou exploration, non répété ; une sous-tâche a toujours le rangement de son parent.
 */
export const PARENT_TYPES: ItemType[] = ['story', 'demarche', 'mission', 'exploration'];
export const LIENS = ['feature', 'epic', 'objectif', 'domaine'] as const;

export const canHaveSubtasks = (t: Pick<Item, 'type' | 'periodicite' | 'parent'>) =>
  PARENT_TYPES.includes(t.type) && !t.periodicite && !t.parent;

/** Sous-tâches par parent (ordre : non faites d'abord, puis date). */
export function subtaskMap(items: Item[]): Map<string, Item[]> {
  const m = new Map<string, Item[]>();
  for (const t of items) if (t.parent) m.set(t.parent, [...(m.get(t.parent) ?? []), t]);
  for (const list of m.values())
    list.sort(
      (a, b) =>
        +(a.statut === 'termine') - +(b.statut === 'termine') ||
        (a.date || '~').localeCompare(b.date || '~') ||
        a.cree_le.localeCompare(b.cree_le),
    );
  return m;
}

/** Vérifie le rattachement et copie le rangement du parent (lève une erreur lisible sinon). */
export function checkParent<T extends Partial<Item> & { parent?: string; type?: ItemType; periodicite?: string }>(
  item: T & { id?: string },
  items: Item[],
): T {
  const enfants = item.id ? items.filter((t) => t.parent === item.id) : [];
  if (enfants.length) {
    if (item.parent) throw new Error('cette tâche a des sous-tâches : elle ne peut pas devenir une sous-tâche.');
    if (item.type && !PARENT_TYPES.includes(item.type))
      throw new Error('cette tâche a des sous-tâches : gardez le type Story, Démarche, Mission ou Exploration.');
    if (item.periodicite) throw new Error('une tâche avec des sous-tâches ne peut pas être répétée.');
  }
  if (!item.parent) return item;
  if (item.parent === item.id) throw new Error('une tâche ne peut pas être sa propre sous-tâche.');
  const parent = items.find((t) => t.id === item.parent);
  if (!parent) throw new Error('tâche parente introuvable.');
  if (parent.parent) throw new Error('une sous-tâche ne peut pas avoir de sous-tâches.');
  if (!PARENT_TYPES.includes(parent.type)) throw new Error('seules les stories, démarches, missions et explorations ont des sous-tâches.');
  if (parent.periodicite) throw new Error('une tâche répétée ne peut pas avoir de sous-tâches.');
  if (item.periodicite) throw new Error('une sous-tâche ne peut pas être répétée.');
  const out = { ...item };
  for (const k of LIENS) (out as Record<string, unknown>)[k] = parent[k];
  return out;
}

/** Le rangement d'un parent s'applique à ses sous-tâches. */
export const cascadeLinks = (parent: Item, items: Item[]): Item[] =>
  items.map((t) => (t.parent === parent.id && LIENS.some((k) => t[k] !== parent[k]) ? { ...t, ...pick(parent) } : t));
const pick = (p: Item) => Object.fromEntries(LIENS.map((k) => [k, p[k]])) as Pick<Item, (typeof LIENS)[number]>;

/** Points du parent et total de ses sous-tâches ; alerte si les deux sont renseignés et différents. */
export function pointsCheck(parent: Item, enfants: Item[] = []) {
  const p = pointsOf(parent);
  const s = enfants.reduce((n, t) => n + pointsOf(t), 0);
  return { parent: p, sous: s, alerte: p > 0 && s > 0 && Math.abs(p - s) > 1e-9 };
}

/** Charge d'un élément : un parent dont les sous-tâches ont des points ne compte pas (ses sous-tâches comptent). */
export const chargeOf = (t: Item, subs: Map<string, Item[]>) =>
  (subs.get(t.id) ?? []).some((c) => pointsOf(c) > 0) ? 0 : pointsOf(t);
