import type { Domaine, Epic, EntityKind, Item, Objectif } from './types';

/**
 * Hiérarchie Domaine > Objectif > Epic > Tâche.
 * Chaque élément garde seulement son lien le plus précis ; les niveaux supérieurs s'en déduisent.
 */

export interface Hierarchy {
  epics: Map<string, Epic>;
  objectifs: Map<string, Objectif>;
  domaines: Map<string, Domaine>;
}

export function buildHierarchy(epics: Epic[], objectifs: Objectif[], domaines: Domaine[]): Hierarchy {
  return {
    epics: new Map(epics.map((e) => [e.id, e])),
    objectifs: new Map(objectifs.map((o) => [o.id, o])),
    domaines: new Map(domaines.map((d) => [d.id, d])),
  };
}

type Links = Pick<Item, 'epic' | 'objectif' | 'domaine'>;

/** Objectif effectif : direct, ou celui de l'epic. */
export function objectifOf(x: Partial<Links>, h: Hierarchy): Objectif | undefined {
  if (x.epic) {
    const e = h.epics.get(x.epic);
    return e?.objectif ? h.objectifs.get(e.objectif) : undefined;
  }
  return x.objectif ? h.objectifs.get(x.objectif) : undefined;
}

/** Domaine effectif : direct, ou celui de l'objectif / de l'epic. */
export function domaineOf(x: Partial<Links>, h: Hierarchy): Domaine | undefined {
  if (x.epic) {
    const e = h.epics.get(x.epic);
    if (!e) return undefined;
    return domaineOf({ objectif: e.objectif, domaine: e.domaine }, h);
  }
  if (x.objectif) {
    const o = h.objectifs.get(x.objectif);
    return o?.domaine ? h.domaines.get(o.domaine) : undefined;
  }
  return x.domaine ? h.domaines.get(x.domaine) : undefined;
}

/** Garde seulement le lien le plus précis (même règle que le script). */
export function cleanLinks<T extends object>(x: T): T {
  const l = x as Partial<Links>;
  if (l.epic) return { ...x, objectif: '', domaine: '' };
  if (l.objectif) return { ...x, domaine: '' };
  return x;
}

export interface Data {
  items: Item[];
  epics: Epic[];
  objectifs: Objectif[];
  domaines: Domaine[];
}

export interface DeletionCounts {
  objectifs: number;
  epics: number;
  taches: number;
}

/** Ce qui se trouve sous un élément (pour le message de confirmation). */
export function childrenOf(kind: EntityKind, id: string, d: Data) {
  let objIds = new Set<string>();
  let epicIds = new Set<string>();
  let taskIds = new Set<string>();
  if (kind === 'domaine') {
    objIds = new Set(d.objectifs.filter((o) => o.domaine === id).map((o) => o.id));
    epicIds = new Set(d.epics.filter((e) => e.domaine === id || objIds.has(e.objectif)).map((e) => e.id));
    taskIds = new Set(
      d.items.filter((t) => t.domaine === id || objIds.has(t.objectif) || epicIds.has(t.epic)).map((t) => t.id),
    );
  } else if (kind === 'objectif') {
    epicIds = new Set(d.epics.filter((e) => e.objectif === id).map((e) => e.id));
    taskIds = new Set(d.items.filter((t) => t.objectif === id || epicIds.has(t.epic)).map((t) => t.id));
  } else {
    taskIds = new Set(d.items.filter((t) => t.epic === id).map((t) => t.id));
  }
  return { objIds, epicIds, taskIds };
}

/**
 * Suppression d'un domaine, d'un objectif ou d'une epic (même règle que le script, deleteEntity_) :
 * - cascade : tout ce qui est en dessous est supprimé ;
 * - sinon : les enfants directs remontent d'un niveau (tâches d'une epic → objectif de l'epic ou son domaine ;
 *   epics et tâches d'un objectif → son domaine ; enfants d'un domaine → sans domaine).
 */
export function planDeletion(kind: EntityKind, id: string, cascade: boolean, d: Data): Data & { counts: DeletionCounts } {
  const { objIds, epicIds, taskIds } = childrenOf(kind, id, d);
  const counts = { objectifs: objIds.size, epics: epicIds.size, taches: taskIds.size };
  let { items, epics, objectifs, domaines } = d;
  if (kind === 'domaine') domaines = domaines.filter((x) => x.id !== id);
  if (kind === 'objectif') objectifs = objectifs.filter((x) => x.id !== id);
  if (kind === 'epic') epics = epics.filter((x) => x.id !== id);

  if (cascade) {
    return {
      items: items.filter((t) => !taskIds.has(t.id)),
      epics: epics.filter((e) => !epicIds.has(e.id)),
      objectifs: objectifs.filter((o) => !objIds.has(o.id)),
      domaines,
      counts,
    };
  }
  if (kind === 'epic') {
    const self = d.epics.find((e) => e.id === id);
    items = items.map((t) =>
      t.epic === id
        ? { ...t, epic: '', objectif: self?.objectif ?? '', domaine: self?.objectif ? '' : (self?.domaine ?? '') }
        : t,
    );
  } else if (kind === 'objectif') {
    const self = d.objectifs.find((o) => o.id === id);
    const up = <T extends { objectif: string; domaine: string }>(x: T): T =>
      x.objectif === id ? { ...x, objectif: '', domaine: self?.domaine ?? '' } : x;
    epics = epics.map(up);
    items = items.map(up);
  } else {
    const clear = <T extends { domaine: string }>(x: T): T => (x.domaine === id ? { ...x, domaine: '' } : x);
    objectifs = objectifs.map(clear);
    epics = epics.map(clear);
    items = items.map(clear);
  }
  return { items, epics, objectifs, domaines, counts };
}

/** « 2 epics et 5 tâches » */
export function describeCounts(c: DeletionCounts): string {
  const parts: string[] = [];
  const p = (n: number, one: string, many: string) => n && parts.push(`${n} ${n > 1 ? many : one}`);
  p(c.objectifs, 'objectif', 'objectifs');
  p(c.epics, 'epic', 'epics');
  p(c.taches, 'tâche', 'tâches');
  if (!parts.length) return 'aucun élément';
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} et ${parts[parts.length - 1]}`;
}

/** Avancement d'un objectif : indicateur s'il existe, sinon tâches terminées (epics + tâches directes). */
export function progressObjectif(o: Objectif, d: Pick<Data, 'items' | 'epics'>): { ratio: number; label: string } {
  const cible = parseFloat(o.cible);
  if (o.cible && cible > 0) {
    const actuel = parseFloat(o.actuel) || 0;
    return { ratio: Math.min(1, Math.max(0, actuel / cible)), label: `${o.actuel || 0}/${o.cible}${o.unite ? ` ${o.unite}` : ''}` };
  }
  const epicIds = new Set(d.epics.filter((e) => e.objectif === o.id).map((e) => e.id));
  const tasks = d.items.filter((t) => !t.periodicite && (t.objectif === o.id || epicIds.has(t.epic)));
  const done = tasks.filter((t) => t.statut === 'termine').length;
  return { ratio: tasks.length ? done / tasks.length : 0, label: tasks.length ? `${done}/${tasks.length}` : '' };
}
