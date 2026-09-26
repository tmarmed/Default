import { toDateString } from './dates';
import type { Item } from './types';

/**
 * Alerte de stockage Google Drive : dès 85 % du Drive rempli, l'application calcule l'espace à libérer pour
 * repasser sous 80 % et propose la meilleure solution :
 * 1. vider la corbeille de President (espaces de travail supprimés) si cela suffit : rien de vivant n'est perdu ;
 * 2. sinon, supprimer la plus courte période ancienne de tâches terminées qui suffit (copie proposée avant) ;
 * 3. sinon (President pèse trop peu), voir le stockage Google : l'espace est pris par d'autres fichiers.
 * Calcul pur (sans Google) : vérifié par scripts/verif-stockage.ts.
 */
export const SEUIL_ALERTE = 0.85;
export const SEUIL_CIBLE = 0.8;
/** Les tâches terminées depuis moins de 3 mois ne sont jamais proposées à la suppression */
export const MOIS_GARDES = 3;

export interface Quota {
  /** Taille du Drive en octets (0 = illimité) */
  limite: number;
  /** Octets utilisés (Drive, Gmail, Photos) */
  utilise: number;
}

export interface Sources {
  /** Espaces de travail supprimés (corbeille de President) */
  corbeille: { nb: number; octets: number };
  /** Toutes les tâches des espaces de travail, avec leur espace */
  taches: (Item & { espace?: string })[];
  /** Poids total des espaces de travail (hors corbeille) */
  president: number;
}

export type Option =
  | { kind: 'corbeille'; nb: number; octets: number; suffit: boolean }
  | { kind: 'periode'; avant: string; nb: number; mois: number; octets: number; suffit: boolean }
  | { kind: 'google'; autres: boolean };

export interface Plan {
  taux: number;
  /** Octets à libérer pour repasser sous 80 % (0 si déjà dessous) */
  aLiberer: number;
  alerte: boolean;
  options: Option[];
  recommande: Option['kind'] | null;
}

/** Poids estimé d'une ligne de Google Sheet : ses valeurs, plus un peu pour la ligne elle-même */
export const octetsLigne = (r: object) => Object.values(r).reduce((n: number, v) => n + (v === null || v === undefined ? 0 : String(v).length) + 1, 0) + 16;
export const octetsLignes = (rows: object[]) => rows.reduce((n, r) => n + octetsLigne(r), 0);

/**
 * Tâches terminées avant `avant` (AAAA-MM-JJ) qu'on peut supprimer : pas les tâches répétées, et pas un parent
 * dont une sous-tâche reste (elle perdrait son parent).
 */
export function aPurger<T extends Item>(items: T[], avant: string): T[] {
  const ids = new Set(items.filter((t) => t.statut === 'termine' && !!t.termine_le && t.termine_le < avant && !t.periodicite).map((t) => t.id));
  for (let change = true; change; ) {
    change = false;
    for (const t of items) {
      if (t.parent && ids.has(t.parent) && !ids.has(t.id)) {
        ids.delete(t.parent);
        change = true;
      }
    }
  }
  return items.filter((t) => ids.has(t.id));
}

const premierDuMois = (d: Date) => toDateString(new Date(d.getFullYear(), d.getMonth(), 1));

export function planifier(q: Quota, s: Sources, aujourdhui = new Date()): Plan {
  const taux = q.limite > 0 ? q.utilise / q.limite : 0;
  const aLiberer = q.limite > 0 ? Math.max(0, Math.ceil(q.utilise - SEUIL_CIBLE * q.limite)) : 0;
  const alerte = taux >= SEUIL_ALERTE;
  const options: Option[] = [];
  if (s.corbeille.nb > 0) options.push({ kind: 'corbeille', ...s.corbeille, suffit: s.corbeille.octets >= aLiberer });

  // Périodes : du plus ancien mois terminé jusqu'à 3 mois avant aujourd'hui ; la plus courte qui suffit
  const limite = premierDuMois(new Date(aujourdhui.getFullYear(), aujourdhui.getMonth() - MOIS_GARDES, 1));
  const mois = [...new Set(aPurger(s.taches, limite).map((t) => t.termine_le.slice(0, 7)))].sort();
  let periode: Extract<Option, { kind: 'periode' }> | null = null;
  for (const m of mois) {
    const [y, mm] = m.split('-').map(Number);
    const avant = premierDuMois(new Date(y, mm, 1));
    const liste = aPurger(s.taches, avant);
    periode = { kind: 'periode', avant, nb: liste.length, mois: mois.indexOf(m) + 1, octets: octetsLignes(liste), suffit: octetsLignes(liste) >= aLiberer };
    if (periode.suffit) break;
  }
  if (periode) options.push(periode);
  options.push({ kind: 'google', autres: s.president + s.corbeille.octets < aLiberer });

  const corbeille = options.find((o) => o.kind === 'corbeille');
  const recommande: Plan['recommande'] = !alerte
    ? null
    : corbeille && corbeille.kind === 'corbeille' && corbeille.suffit
      ? 'corbeille'
      : periode?.suffit
        ? 'periode'
        : 'google';
  return { taux, aLiberer, alerte, options, recommande };
}

/** Démo : Drive simulé pour essayer l'alerte (le poids des données de President, lui, est réel) */
export type TestStockage = 'normal' | 'autres' | 'president';
const GO = 1024 ** 3;
export function quotaSimule(test: TestStockage, presidentEtCorbeille: number, limiteFixee?: number): Quota {
  if (test === 'normal') return { limite: 15 * GO, utilise: 6.2 * GO };
  if (test === 'autres') return { limite: 15 * GO, utilise: 13.1 * GO };
  // Drive rempli par President seul : un petit Drive, fixé au choix du test à 87 % des données ; ce qu'on libère
  // ensuite fait baisser le taux
  return { limite: limiteFixee ?? Math.ceil(presidentEtCorbeille / 0.87), utilise: presidentEtCorbeille };
}

// ---------------------------------------------------------------------------
// Textes
// ---------------------------------------------------------------------------
const nombre = (n: number, d = 1) => (Math.round(n * 10 ** d) / 10 ** d).toString().replace('.', ',');
/** « 13,1 Go », « 250 Ko », « 12 octets » */
export function taille(o: number): string {
  if (o >= 1024 ** 3) return `${nombre(o / 1024 ** 3)} Go`;
  if (o >= 1024 ** 2) return `${nombre(o / 1024 ** 2)} Mo`;
  if (o >= 1024) return `${nombre(o / 1024, 0)} Ko`;
  return `${Math.round(o)} octet${o >= 2 ? 's' : ''}`;
}
export const pourcent = (t: number) => `${Math.round(t * 100)} %`;
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
/** « mars 2025 » */
export const moisAnnee = (d: string) => `${MOIS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;

/** Copie des tâches supprimées (CSV, séparateur « ; », lisible par Google Sheets et Excel) */
export function copieCsv(taches: object[]): string {
  if (!taches.length) return '';
  // Colonnes utiles d'abord (titre, type, terminé le, espace de travail…), puis les autres
  const premieres = ['titre', 'type', 'statut', 'termine_le', 'date', 'espace', 'description'].filter((c) => c in taches[0]);
  const cols = [...premieres, ...Object.keys(taches[0]).filter((c) => !premieres.includes(c))];
  const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [cols.join(';'), ...taches.map((t) => cols.map((c) => cell((t as Record<string, unknown>)[c])).join(';'))].join('\n');
}
