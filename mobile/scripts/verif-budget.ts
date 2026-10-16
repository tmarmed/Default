/**
 * Vérification du lot 4 du 16/10 (docs/regles-reunions.html bloc 16 : L3 Rassembler) : src/rassembler.ts et
 * l'écriture groupée des demandes (src/magasin.ts : une lecture, une écriture). Lancer : npm run verif:budget
 */
import { creerMagasin } from '../src/magasin';
import { aRepartir, libelleRassemblee, rassembler, rassembleesDans, repartir, repercuter, sortir } from '../src/rassembler';
import type { DemandeBudget } from '../src/types';

let erreurs = 0;
const ok = (c: boolean, m: string) => {
  if (!c) erreurs++;
  console.log(`${c ? '✓' : '✗'} ${m}`);
};
const dem = (id: string, x: Partial<DemandeBudget>): DemandeBudget => ({ id, motif: id, montant: '0', periode: 'ponctuel', du: '2026-10-20', au: '', pour: 'equipeagile:a', demandeur: 'equipeagile:a', destination: 'train:t', soumis_par: 'sm@x', origine: 'Rétrospective', statut: 'soumise', montant_accorde: '', motif_decision: '', decide_par: '', decide_le: '', hors_reunion: '', en_reunion: '1', rassemblee_dans: '', cree_le: '', modifie_le: '', ...x });

(async () => {
  let lectures = 0;
  let ecritures = 0;
  const mem: Record<string, unknown[]> = {};
  const mag = creerMagasin({ lire: async (t) => (lectures++, [...((mem[t] ?? []) as never[])]), ecrire: async (t, rows) => void (ecritures++, (mem[t] = rows)) });
  const [a, b, c] = await mag.ecrireDemandes([
    { ...dem('', { motif: 'Licence', montant: '1200', demandeur: 'equipeagile:mob' }), id: undefined },
    { ...dem('', { motif: 'Écrans', montant: '900', demandeur: 'equipeagile:web' }), id: undefined },
    { ...dem('', { motif: 'Casques', montant: '450', demandeur: 'equipeagile:web' }), id: undefined },
  ]);
  ok(lectures === 1 && ecritures === 1 && (mem.demande ?? []).length === 3, `écriture groupée : 3 demandes en ${lectures} lecture et ${ecritures} écriture`);

  const r = rassembler([a, b], { niveau: 'train:t', destination: 'portfolio:p', par: 'rte@x', origine: 'ART sync du 21/10', aujourdhui: '2026-10-16' });
  ok(r.parent.montant === '2100' && r.parent.demandeur === 'train:t' && r.parent.destination === 'portfolio:p' && r.parent.motif === 'Rassemblée : Licence + Écrans', 'L3 : plusieurs demandes reçues → une seule vers le haut (somme, motifs listés), par celui qui les a reçues');
  const [parent] = await mag.ecrireDemandes([r.parent]);
  await mag.ecrireDemandes(r.lier(parent.id));
  const liste = () => mem.demande as DemandeBudget[];
  ok(rassembleesDans(parent.id, liste()).length === 2 && rassembleesDans(parent.id, liste()).every((d) => d.statut === 'soumise'), 'L3 : les originales restent et attendent la réponse');
  let refus = false;
  try {
    rassembler([a], { niveau: 'train:t', destination: 'portfolio:p', par: 'rte@x', origine: '', aujourdhui: '' });
  } catch {
    refus = true;
  }
  ok(refus, 'L3 : rassembler demande au moins deux demandes');
  ok(libelleRassemblee('Synchronisation du portfolio') === 'Rassemblée avec d’autres · envoyée à Synchronisation du portfolio', 'L3 : chaque équipe voit « Rassemblée avec d’autres · envoyée à … » (sans savoir avec qui)');

  const s1 = sortir(parent, liste().find((d) => d.id === b.id)!);
  ok(s1[0].rassemblee_dans === '' && s1[1].montant === '1200', 'L3 : on sort une demande tant que le haut n’a rien décidé (le montant du parent baisse)');
  let refusSortie = false;
  try {
    sortir({ ...parent, statut: 'accordee' }, b);
  } catch {
    refusSortie = true;
  }
  ok(refusSortie, 'L3 : une fois décidé en haut, on ne sort plus');

  const enfants = rassembleesDans(parent.id, liste());
  const refusee = repercuter({ ...parent, statut: 'refusee', motif_decision: 'Pas de budget cette année' }, enfants);
  ok(refusee.length === 2 && refusee.every((p) => p.statut === 'refusee' && p.motif_decision === 'Pas de budget cette année'), 'L3 : la réponse redescend vers chacune (refus avec son motif)');
  const total = repercuter({ ...parent, statut: 'accordee', montant_accorde: '2100' }, enfants);
  ok(total.every((p) => p.statut === 'accordee') && total.find((p) => p.id === a.id)?.montant_accorde === '1200', 'L3 : accord total → chacune accordée de son montant');
  const partiel = { ...parent, statut: 'accordee' as const, montant_accorde: '1500' };
  ok(repercuter(partiel, enfants).length === 0 && aRepartir(partiel, enfants), 'L3 : accord partiel → rien d’automatique, à répartir par celui qui a rassemblé');
  const rep = repartir(partiel, enfants, { [a.id]: 1000, [b.id]: 500 }, 'rte@x', '2026-10-21');
  ok(rep.find((p) => p.id === a.id)?.montant_accorde === '1000' && rep.find((p) => p.id === b.id)?.montant_accorde === '500', 'L3 : répartition en montants (pas de pourcentage), chaque équipe ne reçoit que son chiffre');
  let trop = false;
  try {
    repartir(partiel, enfants, { [a.id]: 1200, [b.id]: 900 }, 'rte@x', '');
  } catch {
    trop = true;
  }
  ok(trop, 'L3 : on ne répartit pas plus que l’accord');
  ok(repartir(partiel, enfants, { [a.id]: 1200 }, 'rte@x', '').find((p) => p.id === b.id)?.statut === 'refusee', 'L3 : une demande à 0 € est refusée (avec la raison)');
  void c;
  console.log(erreurs ? `${erreurs} erreur(s)` : 'Budget : OK');
  process.exit(erreurs ? 1 : 0);
})();
