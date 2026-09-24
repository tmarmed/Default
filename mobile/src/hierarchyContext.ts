import { createContext, useContext } from 'react';
import { buildHierarchy, Hierarchy } from './hierarchy';
import type { Domaine, Epic, Item, Objectif } from './types';

export interface HierarchyValue extends Hierarchy {
  /** Listes triées pour les choix (epics / objectifs par date de début, domaines par nom) */
  epicList: Epic[];
  objectifList: Objectif[];
  domaineList: Domaine[];
  items: Item[];
}

export function makeHierarchyValue(epics: Epic[], objectifs: Objectif[], domaines: Domaine[], items: Item[]): HierarchyValue {
  return {
    ...buildHierarchy(epics, objectifs, domaines),
    epicList: [...epics].sort((a, b) => a.debut.localeCompare(b.debut)),
    objectifList: [...objectifs].sort((a, b) => a.debut.localeCompare(b.debut)),
    domaineList: [...domaines].sort((a, b) => a.nom.localeCompare(b.nom)),
    items,
  };
}

/** Domaines, objectifs et epics connus : partagés par la liste, les formulaires et la roadmap. */
export const HierarchyContext = createContext<HierarchyValue>(makeHierarchyValue([], [], [], []));

export const useHierarchy = () => useContext(HierarchyContext);
