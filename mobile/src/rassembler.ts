import type { DemandeBudget } from './types';

/**
 * Rassembler (lot 4 du 16/10, docs/regles-reunions.html bloc 16 : L3) : plusieurs demandes de budget reçues
 * deviennent une seule demande vers le haut (le nouveau parent) ; les originales restent et attendent. La réponse
 * redescend vers chacune ; un accord partiel est réparti en montant par celui qui a rassemblé (pas de pourcentage),
 * chaque équipe ne reçoit que son chiffre. On sort une demande tant que le haut n'a rien décidé. Rien n'appelle Google.
 */

type Patch = Partial<DemandeBudget> & { id: string };
const n = (s: string | undefined) => Number(String(s ?? '').replace(',', '.')) || 0;

/** Demandes rassemblées dans une demande (ses enfants) */
export const rassembleesDans = (parentId: string, demandes: DemandeBudget[]) => demandes.filter((d) => d.rassemblee_dans === parentId);

/** La demande rassemblée : la nouvelle demande vers le haut (somme des montants, motifs listés), et les originales liées */
export function rassembler(
  l: DemandeBudget[],
  o: { niveau: string; destination: string; par: string; origine: string; motif?: string; aujourdhui: string },
): { parent: Omit<DemandeBudget, 'id' | 'cree_le' | 'modifie_le'>; lier: (parentId: string) => Patch[] } {
  if (l.length < 2) throw new Error('Rassembler : au moins deux demandes.');
  if (l.some((d) => d.statut !== 'soumise' || !!d.rassemblee_dans)) throw new Error('Rassembler : seulement des demandes à décider, pas déjà rassemblées.');
  const total = l.reduce((s, d) => s + n(d.montant), 0);
  return {
    parent: {
      motif: (o.motif || `Rassemblée : ${l.map((d) => d.motif).join(' + ')}`).slice(0, 300),
      montant: String(total),
      periode: l.every((d) => d.periode === l[0].periode) ? l[0].periode : 'ponctuel',
      du: l.map((d) => d.du).sort()[0] || o.aujourdhui,
      au: '',
      pour: o.niveau,
      demandeur: o.niveau,
      destination: o.destination,
      soumis_par: o.par,
      origine: o.origine,
      statut: 'soumise',
      montant_accorde: '',
      motif_decision: '',
      decide_par: '',
      decide_le: '',
      hors_reunion: '',
      en_reunion: '',
      rassemblee_dans: '',
    },
    lier: (parentId) => l.map((d) => ({ id: d.id, rassemblee_dans: parentId })),
  };
}

/** Sortir une demande du rassemblement, tant que le haut n'a rien décidé : le parent perd son montant */
export function sortir(parent: DemandeBudget, enfant: DemandeBudget): Patch[] {
  if (parent.statut !== 'soumise') throw new Error('Le niveau du dessus a déjà décidé : on ne sort plus une demande.');
  return [
    { id: enfant.id, rassemblee_dans: '' },
    { id: parent.id, montant: String(Math.max(0, n(parent.montant) - n(enfant.montant))) },
  ];
}

/**
 * La réponse du haut redescend : refusée ou à reprendre → chaque demande pareil (même motif) ; accordée en totalité →
 * chacune accordée de son montant ; accordée en partie → rien (celui qui a rassemblé répartit, voir `repartir`)
 */
export function repercuter(parent: DemandeBudget, enfants: DemandeBudget[]): Patch[] {
  if (parent.statut === 'soumise') return [];
  const base = { decide_par: parent.decide_par, decide_le: parent.decide_le };
  if (parent.statut === 'refusee' || parent.statut === 'a_reprendre') return enfants.map((d) => ({ id: d.id, statut: parent.statut, motif_decision: parent.motif_decision, ...base }));
  if (n(parent.montant_accorde) >= n(parent.montant)) return enfants.map((d) => ({ id: d.id, statut: 'accordee' as const, montant_accorde: d.montant, motif_decision: parent.motif_decision, ...base }));
  return [];
}
/** Accord partiel encore à répartir entre les demandes rassemblées */
export const aRepartir = (parent: DemandeBudget, enfants: DemandeBudget[]) => parent.statut === 'accordee' && n(parent.montant_accorde) < n(parent.montant) && enfants.some((d) => d.statut === 'soumise');

/** Répartir un accord partiel en montants (au plus ce qui a été accordé ; 0 = refusée) */
export function repartir(parent: DemandeBudget, enfants: DemandeBudget[], montants: Record<string, number>, par: string, jour: string): Patch[] {
  const total = enfants.reduce((s, d) => s + (montants[d.id] ?? 0), 0);
  if (total > n(parent.montant_accorde) + 0.001) throw new Error(`Répartition : au plus ${n(parent.montant_accorde)} € accordés.`);
  for (const d of enfants) if ((montants[d.id] ?? 0) > n(d.montant) || (montants[d.id] ?? 0) < 0) throw new Error(`« ${d.motif} » : entre 0 et le montant demandé.`);
  return enfants.map((d) => {
    const m = montants[d.id] ?? 0;
    return m > 0
      ? { id: d.id, statut: 'accordee' as const, montant_accorde: String(m), motif_decision: `Accord partiel réparti par ${par}`, decide_par: par, decide_le: jour }
      : { id: d.id, statut: 'refusee' as const, montant_accorde: '', motif_decision: `Accord partiel : rien pour cette demande (réparti par ${par})`, decide_par: par, decide_le: jour };
  });
}

/** Ce que voit l'équipe d'une demande rassemblée (sans savoir avec qui) */
export const libelleRassemblee = (vers: string) => `Rassemblée avec d’autres · envoyée ${vers ? `à ${vers}` : 'plus haut'}`;
