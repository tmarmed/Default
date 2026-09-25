import { createContext, useContext } from 'react';
import { buildHierarchy, Data, Hierarchy } from './hierarchy';
import type { Domaine, Epic, Feature, Item, Objectif, ObjectifPI } from './types';

export interface HierarchyValue extends Hierarchy {
  /** Listes triées pour les choix (epics / objectifs par date de début, domaines par nom) */
  epicList: Epic[];
  objectifList: Objectif[];
  domaineList: Domaine[];
  featureList: Feature[];
  objectifsPI: ObjectifPI[];
  items: Item[];
  /** Toutes les données, pour les calculs (suppression, avancement…) */
  data: Data;
}

export function makeHierarchyValue(
  epics: Epic[],
  objectifs: Objectif[],
  domaines: Domaine[],
  items: Item[],
  features: Feature[] = [],
  objectifsPI: ObjectifPI[] = [],
): HierarchyValue {
  return {
    ...buildHierarchy(epics, objectifs, domaines, features),
    featureList: [...features].sort((a, b) => a.titre.localeCompare(b.titre)),
    objectifsPI,
    data: { items, epics, objectifs, domaines, features, objectifsPI },
    epicList: [...epics].sort((a, b) => a.debut.localeCompare(b.debut)),
    objectifList: [...objectifs].sort((a, b) => a.debut.localeCompare(b.debut)),
    domaineList: ordreDomaines(domaines),
    items,
  };
}

/** Domaines principaux par ordre alphabétique, chacun suivi de ses sous-domaines. */
export function ordreDomaines(domaines: Domaine[]): Domaine[] {
  const ids = new Set(domaines.map((d) => d.id));
  const tri = (l: Domaine[]) => [...l].sort((a, b) => a.nom.localeCompare(b.nom));
  const principal = (d: Domaine) => !d.parent || !ids.has(d.parent);
  return tri(domaines.filter(principal)).flatMap((p) => [p, ...tri(domaines.filter((d) => !principal(d) && d.parent === p.id))]);
}

/**
 * Domaines proposés dans un filtre : un seul par nom quand plusieurs espaces sont affichés
 * (chaque espace a sa copie des domaines ; « Pro » de Moi et « Pro » d'une équipe = le même domaine).
 */
export function domainesDistincts(h: HierarchyValue): Domaine[] {
  const vus = new Set<string>();
  return h.domaineList.filter((d) => {
    const k = cleDomaine(d, h);
    if (vus.has(k)) return false;
    vus.add(k);
    return true;
  });
}
const nomCle = (s: string) => s.trim().toLowerCase();
/** Clé d'un domaine d'un espace à l'autre : son nom (et celui de son domaine principal pour un sous-domaine). */
export function cleDomaine(d: Domaine, h: Pick<HierarchyValue, 'domaines'>): string {
  const p = d.parent ? h.domaines.get(d.parent) : undefined;
  return p ? `${nomCle(p.nom)}/${nomCle(d.nom)}` : nomCle(d.nom);
}

/**
 * Vrai si l'élément de domaine `dom` ('' = sans domaine) passe le filtre : même domaine, un de ses
 * sous-domaines (Perso montre aussi Santé), ou le même domaine d'un autre espace (même nom).
 */
export function inDomain(filter: string, dom: string | undefined, h: Pick<HierarchyValue, 'domaines'>): boolean {
  if (filter === 'tous' || (dom ?? '') === filter) return true;
  const x = dom ? h.domaines.get(dom) : undefined;
  const f = filter ? h.domaines.get(filter) : undefined;
  if (!x || !f) return false;
  const cf = cleDomaine(f, h);
  const p = x.parent ? h.domaines.get(x.parent) : undefined;
  return cleDomaine(x, h) === cf || (!!p && cleDomaine(p, h) === cf);
}

/** Seulement les éléments d'un espace (une fiche ne propose que des rattachements de son propre espace). */
export function filtrerEspace(h: HierarchyValue, espace: string): HierarchyValue {
  const dans = (x: { espace?: string }) => (x.espace || 'moi') === espace;
  const d = h.data;
  return makeHierarchyValue(
    d.epics.filter(dans),
    d.objectifs.filter(dans),
    d.domaines.filter(dans),
    d.items.filter(dans),
    (d.features ?? []).filter(dans),
    (d.objectifsPI ?? []).filter(dans),
  );
}

/** Domaines, objectifs et epics connus : partagés par la liste, les formulaires et la roadmap. */
export const HierarchyContext = createContext<HierarchyValue>(makeHierarchyValue([], [], [], []));

export const useHierarchy = () => useContext(HierarchyContext);
