import { createContext, useContext } from 'react';
import { addDays, toDateString } from './dates';
import { estOuvre } from './series';
import { CATEGORIES_DEPENSE, type CoutPersonne, type Depense, PERIODES_DEPENSE } from './types';

/**
 * 💶 Budget (lot 1, conception validée le 09/10, docs/maquette-budget.html).
 * Les montants vivent dans un Google Sheet « Budget » à part, un par entreprise, partagé seulement avec les personnes
 * qui ont le droit « Gérer le budget » (sans accès : aucun montant affiché). Une seule sorte de dépense pour tout :
 * motif, catégorie, montant, période (ponctuel, par jour, par mois, par an, en %), du … au, porteur (entreprise,
 * portfolio, train, équipe, epic, feature, tâche) et répartition sur les enfants (par effectif, parts égales, % à la
 * main ; toujours modifiable en %).
 */

export interface BudgetEspace {
  depenses: Depense[];
  couts: CoutPersonne[];
  /** Le Sheet Budget existe et vous est accessible */
  accessible: boolean;
}
export interface BudgetValue {
  /** Budget de chaque entreprise affichée (clé : espace) */
  parEspace: Record<string, BudgetEspace>;
  /** Coût annuel de chaque personne (toutes entreprises) */
  couts: Map<string, string>;
  depenses: Depense[];
  ecrireDepense: (espace: string, d: Partial<Depense> & { id?: string }) => Promise<Depense>;
  supprimerDepense: (espace: string, id: string) => Promise<void>;
  ecrireCout: (espace: string, personne: string, cout: string) => Promise<void>;
}
export const BUDGET_VIDE: BudgetValue = {
  parEspace: {},
  couts: new Map(),
  depenses: [],
  ecrireDepense: async () => {
    throw new Error('Budget indisponible.');
  },
  supprimerDepense: async () => {},
  ecrireCout: async () => {},
};
export const BudgetContext = createContext<BudgetValue>(BUDGET_VIDE);
export const useBudget = () => useContext(BudgetContext);

/** Assemble le contexte à partir des budgets chargés */
export function valeurBudget(parEspace: Record<string, BudgetEspace>, actions: Pick<BudgetValue, 'ecrireDepense' | 'supprimerDepense' | 'ecrireCout'>): BudgetValue {
  const all = Object.values(parEspace);
  return { parEspace, couts: new Map(all.flatMap((b) => b.couts.map((c) => [c.id, c.cout_annuel] as [string, string]))), depenses: all.flatMap((b) => b.depenses), ...actions };
}

/** Dépenses portées par un élément (« epic:<id> »…) */
export const depensesDe = (depenses: Depense[], porteur: string) => depenses.filter((d) => d.porteur === porteur);

const nombre = (v?: string) => Number(String(v ?? '').replace(/\s/g, '').replace(',', '.')) || 0;
export const iconeCategorie = (c: string) => CATEGORIES_DEPENSE.find((x) => x.value === c)?.icone ?? '📦';
export const libellePeriode = (p: string) => PERIODES_DEPENSE.find((x) => x.value === p)?.label ?? p;
const jourCourt = (j: string) => (j ? `${Number(j.slice(8, 10))}/${j.slice(5, 7)}/${j.slice(0, 4)}` : '');
const eurosTxt = (n: number) => `${Math.round(n).toLocaleString('fr-FR').replace(/ | /g, ' ')} €`;

/** « 300 € par mois · 1/09/2026 → 30/06/2027 », « 4 000 € ponctuel · 15/11/2026 », « 15 % » */
export function resumeDepense(d: Depense): string {
  if (d.periode === 'pct') return `${d.montant.replace('.', ',')} %${d.du ? ` · depuis le ${jourCourt(d.du)}` : ''}`;
  const m = eurosTxt(nombre(d.montant));
  if (d.periode === 'ponctuel') return `${m} ponctuel · ${jourCourt(d.du)}`;
  return `${m} ${libellePeriode(d.periode).toLowerCase()} · ${jourCourt(d.du)} → ${d.au ? jourCourt(d.au) : 'sans fin'}`;
}

/** Jours ouvrés (lundi-vendredi, hors fériés) entre deux dates incluses */
export function joursOuvres(du: string, au: string): number {
  if (!du || !au || au < du) return 0;
  let n = 0;
  for (let d = new Date(`${du}T12:00`); toDateString(d) <= au; d = addDays(d, 1)) if (estOuvre(toDateString(d))) n++;
  return n;
}

/**
 * Montant d'une dépense tombé dans une période [de, a] (dates incluses) : ponctuel si sa date y est ; par jour :
 * jours ouvrés communs × montant ; par mois et par an : au prorata des jours du calendrier. « En % » : 0 (calculé à
 * part, sur sa base).
 */
export function montantSurPeriode(d: Depense, de: string, a: string): number {
  const m = nombre(d.montant);
  if (d.periode === 'pct' || !d.du) return 0;
  if (d.periode === 'ponctuel') return d.du >= de && d.du <= a ? m : 0;
  const debut = d.du > de ? d.du : de;
  const fin = d.au && d.au < a ? d.au : a;
  if (fin < debut) return 0;
  if (d.periode === 'jour') return m * joursOuvres(debut, fin);
  const jours = Math.round((new Date(`${fin}T12:00`).getTime() - new Date(`${debut}T12:00`).getTime()) / 86400000) + 1;
  return d.periode === 'mois' ? (m * 12 * jours) / 365 : (m * jours) / 365;
}

/** Clé de répartition effective : celle choisie, sinon par effectif pour les frais généraux, sinon parts égales */
export const cleDe = (d: Pick<Depense, 'cle' | 'categorie'>) => d.cle || (d.categorie === 'frais_generaux' ? 'effectif' : 'egal');

/**
 * Parts d'une dépense entre les enfants de son porteur (somme 1) : % à la main (s'ils sont donnés), sinon par effectif
 * (personnes de chaque enfant), sinon parts égales.
 */
export function partsDe(d: Pick<Depense, 'cle' | 'categorie' | 'parts'>, enfants: { cle: string; effectif: number }[]): Map<string, number> {
  const out = new Map<string, number>();
  if (!enfants.length) return out;
  const cle = cleDe(d);
  let main: Record<string, number> = {};
  try {
    main = d.parts ? (JSON.parse(d.parts) as Record<string, number>) : {};
  } catch {
    main = {};
  }
  if (cle === 'pct' && Object.keys(main).length) {
    for (const e of enfants) out.set(e.cle, (main[e.cle] ?? 0) / 100);
    return out;
  }
  const total = enfants.reduce((s, e) => s + e.effectif, 0);
  for (const e of enfants) out.set(e.cle, cle === 'effectif' && total ? e.effectif / total : 1 / enfants.length);
  return out;
}

/**
 * Enfants entre lesquels se répartit une dépense de ce porteur : entreprise → ses portfolios (effectif : personnes de
 * leurs trains et équipes) ; portfolio → ses epics ; train → les epics de ses features ; équipe → les epics de son
 * travail. Epic, feature, tâche : pas de répartition (le coût reste sur l'élément et remonte au-dessus).
 */
export function enfantsRepartition(
  porteur: string,
  org: { portfolios: { id: string; nom: string; espace?: string; epic_owner: string }[]; trains: { id: string; portfolio: string; rte: string; pm: string }[]; equipes: { id: string; train: string; po: string; sm: string; membres: string }[] },
  h: { epicList: { id: string; titre: string; portfolio?: string }[]; featureList: { id: string; epic: string; train?: string; equipe?: string }[]; items: { epic: string; feature: string; equipe?: string }[] },
): { cle: string; nom: string; effectif: number }[] {
  const [kind, id] = [porteur.slice(0, porteur.indexOf(':')), porteur.slice(porteur.indexOf(':') + 1)];
  const epics = (ids: Set<string>) => h.epicList.filter((e) => ids.has(e.id)).map((e) => ({ cle: `epic:${e.id}`, nom: `🗂️ ${e.titre}`, effectif: 0 }));
  if (kind === 'entreprise')
    return org.portfolios
      .filter((p) => (p.espace || 'moi') === id)
      .map((p) => {
        const trains = org.trains.filter((t) => t.portfolio === p.id);
        const gens = new Set([p.epic_owner, ...trains.flatMap((t) => [t.rte, t.pm]), ...org.equipes.filter((e) => trains.some((t) => t.id === e.train)).flatMap((e) => [e.po, e.sm, ...e.membres.split(';')])].filter(Boolean));
        return { cle: `portfolio:${p.id}`, nom: `💼 ${p.nom}`, effectif: gens.size };
      });
  if (kind === 'portfolio') return epics(new Set(h.epicList.filter((e) => e.portfolio === id).map((e) => e.id)));
  if (kind === 'train') return epics(new Set(h.featureList.filter((f) => f.train === id).map((f) => f.epic)));
  if (kind === 'equipeagile') {
    const fs = new Map(h.featureList.map((f) => [f.id, f.epic]));
    return epics(new Set([...h.featureList.filter((f) => f.equipe === id).map((f) => f.epic), ...h.items.filter((t) => t.equipe === id).map((t) => t.epic || fs.get(t.feature) || '')].filter(Boolean)));
  }
  return [];
}
