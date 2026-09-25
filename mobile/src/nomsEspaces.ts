import type { Domaine } from './types';

/**
 * Noms des espaces pour les libellés (sans dépendance à l'interface, pour les calculs purs comme les alertes) :
 * posés par l'application à chaque changement de la liste ou du filtre des espaces.
 */
let noms: Record<string, string> = {};
let plusieurs = false;

export function definirNomsEspaces(n: Record<string, string>, visibles: string[]): void {
  noms = n;
  plusieurs = visibles.length > 1;
}

/** « 🏢 ACME · » quand plusieurs espaces sont affichés, sinon rien */
export function prefixeEspace(espace: string | undefined): string {
  if (!plusieurs) return '';
  const n = noms[espace || 'moi'];
  return n ? `${n} · ` : '';
}

/**
 * Libellé d'un domaine : préfixe de son espace (plusieurs espaces affichés) et, pour un sous-domaine,
 * son domaine au-dessus (« 🔒 Moi · 🏠 Perso › 🩺 Santé »).
 */
export function nomDomaine(
  d: Domaine,
  domaines: Map<string, Domaine>,
  { espace = true, parent = true }: { espace?: boolean; parent?: boolean } = {},
): string {
  const p = parent && d.parent ? domaines.get(d.parent) : undefined;
  return `${espace ? prefixeEspace(d.espace) : ''}${p ? `${p.icone} ${p.nom} › ` : ''}${d.icone} ${d.nom}`;
}
