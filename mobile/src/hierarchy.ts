import type { Domaine, Epic, EntityKind, Feature, Ignoree, Item, Objectif, ObjectifPI } from './types';

/**
 * Hiérarchie Domaine > Objectif > Epic > Feature > Tâche.
 * Chaque élément garde seulement son lien le plus précis ; les niveaux supérieurs s'en déduisent.
 */

export interface Hierarchy {
  features: Map<string, Feature>;
  epics: Map<string, Epic>;
  objectifs: Map<string, Objectif>;
  domaines: Map<string, Domaine>;
}

export function buildHierarchy(epics: Epic[], objectifs: Objectif[], domaines: Domaine[], features: Feature[] = []): Hierarchy {
  return {
    features: new Map(features.map((f) => [f.id, f])),
    epics: new Map(epics.map((e) => [e.id, e])),
    objectifs: new Map(objectifs.map((o) => [o.id, o])),
    domaines: new Map(domaines.map((d) => [d.id, d])),
  };
}

type Links = Pick<Item, 'feature' | 'epic' | 'objectif' | 'domaine'>;

/** Epic effective : directe, ou celle de la feature. */
export function epicOf(x: Partial<Links>, h: Hierarchy): Epic | undefined {
  if (x.feature) {
    const f = h.features.get(x.feature);
    return f?.epic ? h.epics.get(f.epic) : undefined;
  }
  return x.epic ? h.epics.get(x.epic) : undefined;
}

/** Objectif effectif : direct, ou celui de l'epic. */
export function objectifOf(x: Partial<Links>, h: Hierarchy): Objectif | undefined {
  if (x.feature) {
    const e = epicOf(x, h);
    return e ? objectifOf({ epic: e.id }, h) : undefined;
  }
  if (x.epic) {
    const e = h.epics.get(x.epic);
    return e?.objectif ? h.objectifs.get(e.objectif) : undefined;
  }
  return x.objectif ? h.objectifs.get(x.objectif) : undefined;
}

/** Domaine effectif : direct, ou celui de l'objectif / de l'epic. */
export function domaineOf(x: Partial<Links>, h: Hierarchy): Domaine | undefined {
  if (x.feature) {
    const e = epicOf(x, h);
    return e ? domaineOf({ epic: e.id }, h) : undefined;
  }
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
  if (l.feature) return { ...x, epic: '', objectif: '', domaine: '' };
  if (l.epic) return { ...x, objectif: '', domaine: '' };
  if (l.objectif) return { ...x, domaine: '' };
  return x;
}

export interface Data {
  items: Item[];
  epics: Epic[];
  objectifs: Objectif[];
  domaines: Domaine[];
  features: Feature[];
  objectifsPI: ObjectifPI[];
  /** Alertes ignorées (v10) */
  ignorees?: Ignoree[];
}

export interface DeletionCounts {
  objectifs: number;
  epics: number;
  features?: number;
  taches: number;
}

/** Ce qui se trouve sous un élément (pour le message de confirmation). */
export function childrenOf(kind: EntityKind, id: string, d: Data) {
  let objIds = new Set<string>();
  let epicIds = new Set<string>();
  if (kind === 'domaine') {
    objIds = new Set(d.objectifs.filter((o) => o.domaine === id).map((o) => o.id));
    epicIds = new Set(d.epics.filter((e) => e.domaine === id || objIds.has(e.objectif)).map((e) => e.id));
  } else if (kind === 'objectif') {
    epicIds = new Set(d.epics.filter((e) => e.objectif === id).map((e) => e.id));
  } else if (kind === 'epic') {
    epicIds = new Set([id]);
  }
  const featIds =
    kind === 'feature' ? new Set([id]) : new Set(d.features.filter((f) => epicIds.has(f.epic)).map((f) => f.id));
  const taskIds =
    kind === 'objectifpi'
      ? new Set<string>()
      : new Set(
          d.items
            .filter(
              (t) =>
                featIds.has(t.feature) ||
                epicIds.has(t.epic) ||
                (kind === 'objectif' && t.objectif === id) ||
                (kind === 'domaine' && (t.domaine === id || objIds.has(t.objectif))),
            )
            .map((t) => t.id),
        );
  if (kind === 'epic') epicIds.delete(id);
  if (kind === 'feature') featIds.delete(id);
  return { objIds, epicIds, featIds, taskIds };
}

/**
 * Suppression (même règle que le script, deleteEntity_) :
 * - cascade : tout ce qui est en dessous est supprimé ;
 * - sinon : les enfants directs remontent d'un niveau (tâches d'une feature → son epic ; tâches d'une epic →
 *   objectif de l'epic ou son domaine, ses features sans epic ; epics et tâches d'un objectif → son domaine ;
 *   enfants d'un domaine → sans domaine).
 */
export function planDeletion(kind: EntityKind, id: string, cascade: boolean, d: Data): Data & { counts: DeletionCounts } {
  const { objIds, epicIds, featIds, taskIds } = childrenOf(kind, id, d);
  const counts = { objectifs: objIds.size, epics: epicIds.size, features: featIds.size, taches: taskIds.size };
  const not = <T extends { id: string }>(k: EntityKind, list: T[]) => list.filter((x) => !(kind === k && x.id === id));
  let items = d.items;
  let epics = not('epic', d.epics);
  let objectifs = not('objectif', d.objectifs);
  // Les sous-domaines d'un domaine supprimé deviennent des domaines principaux (jamais supprimés avec lui)
  const domaines = not('domaine', d.domaines).map((x) => (kind === 'domaine' && x.parent === id ? { ...x, parent: '' } : x));
  let features = not('feature', d.features);
  // Objectifs du PI : jamais supprimés avec un domaine ou une epic, ils perdent le rattachement supprimé
  // (une epic supprimée : ils gardent leur domaine), comme dans le script
  const epicsPerdues = new Set([...(cascade ? epicIds : []), ...(kind === 'epic' ? [id] : [])]);
  const objectifsPI = not('objectifpi', d.objectifsPI).map((o) => {
    let x = kind === 'domaine' && o.domaine === id ? { ...o, domaine: '' } : o;
    if (x.epic && epicsPerdues.has(x.epic)) x = { ...x, epic: '' };
    return x;
  });

  if (cascade) {
    return {
      items: items.filter((t) => !taskIds.has(t.id)),
      epics: epics.filter((e) => !epicIds.has(e.id)),
      objectifs: objectifs.filter((o) => !objIds.has(o.id)),
      features: features.filter((f) => !featIds.has(f.id)),
      domaines,
      objectifsPI,
      ignorees: not('ignoree', d.ignorees ?? []),
      counts,
    };
  }
  if (kind === 'feature') {
    const self = d.features.find((f) => f.id === id);
    items = items.map((t) => (t.feature === id ? { ...t, feature: '', epic: self?.epic ?? '' } : t));
  } else if (kind === 'epic') {
    const self = d.epics.find((e) => e.id === id);
    items = items.map((t) =>
      t.epic === id
        ? { ...t, epic: '', objectif: self?.objectif ?? '', domaine: self?.objectif ? '' : (self?.domaine ?? '') }
        : t,
    );
    features = features.map((f) => (f.epic === id ? { ...f, epic: '' } : f));
  } else if (kind === 'objectif') {
    const self = d.objectifs.find((o) => o.id === id);
    const up = <T extends { objectif: string; domaine: string }>(x: T): T =>
      x.objectif === id ? { ...x, objectif: '', domaine: self?.domaine ?? '' } : x;
    epics = epics.map(up);
    items = items.map(up);
  } else if (kind === 'domaine') {
    const clear = <T extends { domaine: string }>(x: T): T => (x.domaine === id ? { ...x, domaine: '' } : x);
    objectifs = objectifs.map(clear);
    epics = epics.map(clear);
    items = items.map(clear);
  }
  return { items, epics, objectifs, domaines, features, objectifsPI, ignorees: not('ignoree', d.ignorees ?? []), counts };
}

/** Tâches d'une epic : directes et celles de ses features. */
export function tasksOfEpic(epicId: string, items: Item[], features: Feature[] = []): Item[] {
  const feats = new Set(features.filter((f) => f.epic === epicId).map((f) => f.id));
  return items.filter((t) => t.epic === epicId || (t.feature && feats.has(t.feature)));
}

/** « 2 epics et 5 tâches » */
export function describeCounts(c: DeletionCounts): string {
  const parts: string[] = [];
  const p = (n: number, one: string, many: string) => n && parts.push(`${n} ${n > 1 ? many : one}`);
  p(c.objectifs, 'objectif', 'objectifs');
  p(c.epics, 'epic', 'epics');
  p(c.features ?? 0, 'feature', 'features');
  p(c.taches, 'tâche', 'tâches');
  if (!parts.length) return 'aucun élément';
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} et ${parts[parts.length - 1]}`;
}

/** Avancement d'un objectif : indicateur s'il existe, sinon tâches terminées (epics + tâches directes). */
export function progressObjectif(o: Objectif, d: Pick<Data, 'items' | 'epics'> & { features?: Feature[] }): { ratio: number; label: string } {
  const cible = parseFloat(o.cible);
  if (o.cible && cible > 0) {
    const actuel = parseFloat(o.actuel) || 0;
    return { ratio: Math.min(1, Math.max(0, actuel / cible)), label: `${o.actuel || 0}/${o.cible}${o.unite ? ` ${o.unite}` : ''}` };
  }
  const epicIds = new Set(d.epics.filter((e) => e.objectif === o.id).map((e) => e.id));
  const featIds = new Set((d.features ?? []).filter((f) => epicIds.has(f.epic)).map((f) => f.id));
  const tasks = d.items.filter(
    (t) => !t.periodicite && (t.objectif === o.id || epicIds.has(t.epic) || featIds.has(t.feature)),
  );
  const done = tasks.filter((t) => t.statut === 'termine').length;
  return { ratio: tasks.length ? done / tasks.length : 0, label: tasks.length ? `${done}/${tasks.length}` : '' };
}
