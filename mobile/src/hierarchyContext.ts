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
    domaineList: [...domaines].sort((a, b) => a.nom.localeCompare(b.nom)),
    items,
  };
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
