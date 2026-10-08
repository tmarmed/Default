import type { HierarchyValue } from './hierarchyContext';
import { TYPE_ICONS, type Item } from './types';

/**
 * Élément concerné par un point de réunion (08/10) : un seul élément — tâche (tout type), feature, epic, objectif,
 * objectif du PI, résultat clé — ou aucun (point général). Le type se déduit de l'id.
 */
export type GenreElement = 'item' | 'feature' | 'epic' | 'objectif' | 'objectifpi' | 'resultat';
export interface ElementConcerne {
  id: string;
  genre: GenreElement;
  titre: string;
  icone: string;
  item?: Item;
}

/** L'élément d'un id (introuvable : undefined) */
export function elementDe(id: string, h: Pick<HierarchyValue, 'items' | 'featureList' | 'epicList' | 'objectifList' | 'objectifsPI' | 'resultats'>): ElementConcerne | undefined {
  if (!id) return undefined;
  const t = h.items.find((x) => x.id === id);
  if (t) return { id, genre: 'item', titre: t.titre, icone: TYPE_ICONS[t.type] ?? '✓', item: t };
  const f = h.featureList.find((x) => x.id === id);
  if (f) return { id, genre: 'feature', titre: f.titre, icone: '🧩' };
  const e = h.epicList.find((x) => x.id === id);
  if (e) return { id, genre: 'epic', titre: e.titre, icone: '🗂️' };
  const o = h.objectifList.find((x) => x.id === id);
  if (o) return { id, genre: 'objectif', titre: o.titre, icone: '🎯' };
  const op = h.objectifsPI.find((x) => x.id === id);
  if (op) return { id, genre: 'objectifpi', titre: op.titre, icone: '🏁' };
  const k = h.resultats.find((x) => x.id === id);
  if (k) return { id, genre: 'resultat', titre: k.titre, icone: '📈' };
  return undefined;
}
/** « 📖 Paiement en ligne » ; vide si aucun */
export const libelleElement = (id: string, h: Parameters<typeof elementDe>[1]) => {
  const x = elementDe(id, h);
  return x ? `${x.icone} ${x.titre}` : '';
};

/** Tous les éléments (pour « Autre élément… ») : tâches ouvertes, features, epics, objectifs, objectifs du PI, résultats clés */
export function tousLesElements(h: Parameters<typeof elementDe>[1]): ElementConcerne[] {
  return [
    ...h.items.filter((t) => t.statut !== 'termine').map((t) => ({ id: t.id, genre: 'item' as const, titre: t.titre, icone: TYPE_ICONS[t.type] ?? '✓', item: t })),
    ...h.featureList.map((f) => ({ id: f.id, genre: 'feature' as const, titre: f.titre, icone: '🧩' })),
    ...h.epicList.map((e) => ({ id: e.id, genre: 'epic' as const, titre: e.titre, icone: '🗂️' })),
    ...h.objectifList.map((o) => ({ id: o.id, genre: 'objectif' as const, titre: o.titre, icone: '🎯' })),
    ...h.objectifsPI.map((o) => ({ id: o.id, genre: 'objectifpi' as const, titre: o.titre, icone: '🏁' })),
    ...h.resultats.map((k) => ({ id: k.id, genre: 'resultat' as const, titre: k.titre, icone: '📈' })),
  ];
}
