/**
 * Vérification automatique de l'alerte de stockage Google Drive (src/stockage.ts) : seuil de 85 %, espace à
 * libérer pour repasser sous 80 %, choix de la solution recommandée, période la plus courte qui suffit, tâches
 * gardées (récentes, répétées, parents de sous-tâches restantes), textes.
 * Lancer : npm run verif:stockage (échoue au premier écart).
 */
import { donneesDemo } from '../src/demo';
import { aPurger, copieCsv, moisAnnee, octetsLignes, planifier, quotaSimule, taille } from '../src/stockage';
import type { Item } from '../src/types';

let erreurs = 0;
const ok = (cond: boolean, msg: string) => {
  if (!cond) {
    erreurs++;
    console.error(`✗ ${msg}`);
  } else console.log(`✓ ${msg}`);
};

const GO = 1024 ** 3;
const auj = new Date(2026, 8, 26);
const base = donneesDemo('moi').items[0];
const tache = (id: string, termine_le: string, extra: Partial<Item> = {}): Item => ({
  ...base,
  id,
  titre: `Tâche ${id}`,
  statut: termine_le ? 'termine' : 'a_faire',
  termine_le,
  periodicite: '',
  parent: '',
  description: 'x'.repeat(200),
  ...extra,
});

// Historique : une tâche terminée par mois de 2025-01 à 2026-09, plus des cas à garder
const taches: Item[] = [];
for (let i = 0; i < 21; i++) {
  const d = new Date(2025, i, 10);
  taches.push(tache(`t${i}`, `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-10`));
}
taches.push(tache('rep', '2025-01-05', { periodicite: 'mensuelle' }));
taches.push(tache('parent', '2025-01-03'));
taches.push(tache('enfant', '', { parent: 'parent' }));
taches.push(tache('encours', ''));

// Tâches gardées
const tout = aPurger(taches, '2026-06-01');
ok(!tout.some((t) => t.id === 'rep'), 'une tâche répétée n’est jamais supprimée');
ok(!tout.some((t) => t.id === 'parent'), 'un parent dont une sous-tâche reste est gardé');
ok(!tout.some((t) => !t.termine_le), 'seules les tâches terminées sont supprimées');
ok(tout.length === 17, `tâches terminées avant juin 2026 : 17 (trouvé ${tout.length})`);

// Sous 85 % : pas d'alerte
const sous = planifier({ limite: 15 * GO, utilise: 12.6 * GO }, { corbeille: { nb: 0, octets: 0 }, taches, president: 0 }, auj);
ok(!sous.alerte && sous.recommande === null, '84 % : pas d’alerte');
ok(planifier({ limite: 15 * GO, utilise: 12.75 * GO }, { corbeille: { nb: 0, octets: 0 }, taches, president: 0 }, auj).alerte, '85 % : alerte');
ok(!planifier({ limite: 0, utilise: 99 * GO }, { corbeille: { nb: 0, octets: 0 }, taches, president: 0 }, auj).alerte, 'stockage illimité : pas d’alerte');

// Drive plein d'autres fichiers : President ne suffit pas → voir le stockage Google
const autres = planifier({ limite: 15 * GO, utilise: 13.1 * GO }, { corbeille: { nb: 2, octets: 20000 }, taches, president: 80000 }, auj);
ok(Math.abs(autres.aLiberer - 1.1 * GO) < 1024 ** 2, `à libérer : ${taille(autres.aLiberer)} (attendu 1,1 Go)`);
ok(autres.recommande === 'google', 'Drive plein d’autres fichiers : « Voir le stockage Google » recommandé');
ok(autres.options.some((o) => o.kind === 'google' && o.autres), 'message « la plupart de l’espace est pris par d’autres fichiers »');
ok(autres.options.some((o) => o.kind === 'corbeille' && !o.suffit), 'corbeille proposée mais « ne suffit pas seul »');

// President remplit le Drive : la période la plus courte qui suffit
const poids = octetsLignes(taches);
const besoin = octetsLignes(aPurger(taches, '2025-05-01')); // janvier à avril 2025
// Drive à 87 % : il faut libérer 7 % du Drive, soit exactement le poids de janvier à avril 2025
const limite = Math.floor(besoin / 0.07);
const plan = planifier({ limite, utilise: 0.8 * limite + besoin }, { corbeille: { nb: 0, octets: 0 }, taches, president: poids }, auj);
const periode = plan.options.find((o) => o.kind === 'periode');
ok(plan.recommande === 'periode', 'President remplit le Drive : suppression d’une période recommandée');
ok(periode?.kind === 'periode' && periode.avant === '2025-05-01', `période la plus courte qui suffit : avant mai 2025 (trouvé ${periode?.kind === 'periode' ? periode.avant : '—'})`);
ok(periode?.kind === 'periode' && periode.mois === 4 && periode.nb === 4, 'période : 4 mois, 4 tâches');

// Jamais les 3 derniers mois
const enorme = planifier({ limite, utilise: 10 * limite }, { corbeille: { nb: 0, octets: 0 }, taches, president: poids }, auj);
const p2 = enorme.options.find((o) => o.kind === 'periode');
ok(p2?.kind === 'periode' && p2.avant <= '2026-06-01' && !p2.suffit, 'les tâches des 3 derniers mois ne sont jamais proposées');
ok(enorme.recommande === 'google', 'rien ne suffit : « Voir le stockage Google » recommandé');

// La corbeille qui suffit passe avant la suppression de tâches (rien de vivant n'est perdu)
const corb = planifier({ limite, utilise: 0.87 * limite }, { corbeille: { nb: 1, octets: 0.08 * limite }, taches, president: poids }, auj);
ok(corb.recommande === 'corbeille', 'la corbeille suffit : « Vider la corbeille » recommandé');

// Démo : test « Plein : President » à 87 %, puis le taux baisse quand on libère
const q = quotaSimule('president', 50000);
ok(Math.round((q.utilise / q.limite) * 100) === 87, 'démo « Plein : President » : 87 %');
ok(quotaSimule('president', 40000, q.limite).utilise / q.limite < 0.8, 'démo : après suppression, le taux repasse sous 80 %');
ok(Math.round((quotaSimule('normal', 1).utilise / quotaSimule('normal', 1).limite) * 100) === 41, 'démo « Normal » : 41 %');

// Textes
ok(taille(13.1 * GO) === '13,1 Go' && taille(2048) === '2 Ko' && taille(1) === '1 octet', 'tailles : « 13,1 Go », « 2 Ko », « 1 octet »');
ok(moisAnnee('2025-03-01') === 'mars 2025', 'mois : « mars 2025 »');
const csv = copieCsv([{ titre: 'A "B"', statut: 'termine' }]);
ok(csv === 'titre;statut\n"A ""B""";"termine"', 'copie CSV (guillemets doublés)');

// Données de la démo : l'historique permet d'essayer « Supprimer les tâches terminées avant … »
const demo = donneesDemo('moi').items;
const hist = aPurger(demo, '2099-01-01').filter((t) => t.id.startsWith('h'));
ok(hist.length >= 15, `démo : ${hist.length} tâches terminées d’historique`);

console.log(erreurs ? `${erreurs} erreur(s)` : 'Stockage : OK');
process.exit(erreurs ? 1 : 0);
