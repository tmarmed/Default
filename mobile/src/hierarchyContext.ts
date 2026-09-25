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

/**
 * Domaines rangés par espace (Moi d'abord), puis domaines principaux par ordre alphabétique, chacun suivi de ses
 * sous-domaines. Les domaines de deux espaces restent séparés, même s'ils ont le même nom.
 */
export function ordreDomaines(domaines: Domaine[]): Domaine[] {
  const ids = new Set(domaines.map((d) => d.id));
  const esp = (d: Domaine) => d.espace || 'moi';
  const tri = (l: Domaine[]) =>
    [...l].sort((a, b) => (esp(a) === esp(b) ? a.nom.localeCompare(b.nom) : esp(a) === 'moi' ? -1 : esp(b) === 'moi' ? 1 : esp(a).localeCompare(esp(b))));
  const principal = (d: Domaine) => !d.parent || !ids.has(d.parent);
  return tri(domaines.filter(principal)).flatMap((p) => [p, ...tri(domaines.filter((d) => !principal(d) && d.parent === p.id))]);
}

/**
 * Vrai si l'élément de domaine `dom` ('' = sans domaine) passe le filtre : même domaine, ou un de ses
 * sous-domaines (Perso montre aussi Santé). Chaque espace a ses domaines : pas de lien entre deux espaces.
 */
export function inDomain(filter: string, dom: string | undefined, h: Pick<HierarchyValue, 'domaines'>): boolean {
  if (filter === 'tous' || (dom ?? '') === filter) return true;
  const x = dom ? h.domaines.get(dom) : undefined;
  return !!x && !!filter && x.parent === filter;
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
