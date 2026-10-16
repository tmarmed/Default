/**
 * Vérification des lots 8 et 9 du 16/10 (docs/regles-reunions.html bloc 17 : B1, B2, M1, B3, B4) : bruit, retouche,
 * réimputation, indicateurs. Lancer : npm run verif:qualite
 */
import { estRetouche, libellePayePar, payePar, planBruit, planRetouche, texteCause, traceReimputation } from '../src/bruitRetouche';
import { nettoyerItem } from '../src/magasin';
import { bruit, duSprint, ecartEstimation, engagesDePhoto, retouche, stabilite } from '../src/indicateurs';
import type { Item } from '../src/types';

let erreurs = 0;
const ok = (c: boolean, m: string) => {
  if (!c) erreurs++;
  console.log(`${c ? '✓' : '✗'} ${m}`);
};
const it = (id: string, x: Partial<Item>) => ({ id, titre: id, type: 'tache', statut: 'a_faire', points: '', iteration: '', feature: '', epic: '', parent: '', equipe: 'mob', nature: '', ...x }) as Item;

// ---- Lot 8 · B1 Bruit ----
const items = [it('f-bruit', { titre: '🧹 Bruit', nature: 'bruit', feature: 'f1' }), it('s1', { feature: 'f1', statut: 'en_cours' })];
const b = planBruit(items[1], items, { jours: 3, joursParPoint: 1.5, cause: 'Besoin abandonné', commentaire: 'le client a changé d’avis', aujourdhui: '2026-10-16', quoi: 'supprimé' });
ok(b.parentExistant?.id === 'f-bruit' && b.sous.points === '2' && b.sous.cause === 'Besoin abandonné — le client a changé d’avis' && b.sous.statut === 'termine', 'B1 : une sous-tâche de bruit sous la tâche « 🧹 Bruit » de la feature ; points = jours ÷ jours par point ; cause');
const orph = planBruit(it('x', {}), [], { jours: 1, joursParPoint: 1, cause: 'Doublon', commentaire: '', aujourdhui: '2026-10-16', quoi: 'supprimé' });
ok(!orph.parentExistant && !orph.parent.feature && !orph.parent.epic && !!orph.parent.iteration && orph.parent.equipe === 'mob', 'B1 : sans feature ni epic → « 🧹 Bruit » orpheline, par équipe et par sprint');
const parEpic = planBruit(it('y', { epic: 'e1' }), [], { jours: 1, joursParPoint: 1, cause: 'Doublon', commentaire: '', aujourdhui: '2026-10-16', quoi: 'abandonné' });
ok(parEpic.parent.epic === 'e1' && !parEpic.parent.feature, 'B1 : sans feature → sous l’epic');
let sansCause = false;
try {
  planBruit(it('z', {}), [], { jours: 1, joursParPoint: 1, cause: '', commentaire: '', aujourdhui: '2026-10-16', quoi: 'supprimé' });
} catch {
  sansCause = true;
}
ok(sansCause, 'B1 : cause obligatoire');

// ---- B2 Retouche ----
const story = it('st', { type: 'story', statut: 'termine', titre: 'Écran de connexion', feature: 'f1' });
const r = planRetouche(story, { estimation: '2', cause: 'Refusée à la revue', commentaire: '', iteration: '2026-T4-IT3' });
ok(r.parent === 'st' && r.nature === 'retouche' && r.points === '2' && r.titre === '🔧 Retouche · Écran de connexion' && r.iteration === '2026-T4-IT3', 'B2 : une sous-tâche « 🔧 Retouche » avec estimation et cause, planifiée où l’on veut ; la story reste terminée');
ok(estRetouche({ nature: '', type: 'bug' }) && estRetouche({ nature: 'retouche', type: 'tache' }) && !estRetouche({ nature: '', type: 'story' }), 'B2 : tout Bug est une retouche');

// ---- M1 Réimputation ----
const ctx = { items: [], features: [{ id: 'f1', epic: 'e1', train: 'tr1' }], epics: [{ id: 'e1', etat: 'en_cours' as const }, { id: 'e2', etat: 'termine' as const }], trainDe: () => 'tr1' };
ok(payePar(it('a', { feature: 'f1' }), ctx).valeur === 'epic:e1', 'M1 : règle automatique : l’epic de l’élément');
ok(payePar(it('a', { type: 'bug', feature: 'f1' }), ctx).valeur === 'epic:e1' && payePar(it('a', { type: 'bug', epic: 'e2' }), ctx).valeur === 'tma:tr1' && payePar(it('a', { type: 'bug' }), ctx).valeur === 'tma:tr1', 'B2 / M1 : retouche sur epic en cours → l’epic ; epic terminée ou bug orphelin → TMA du train');
ok(payePar(it('a', { feature: 'f1', paye_par: 'tma:tr1' }), ctx).valeur === 'tma:tr1' && !payePar(it('a', { feature: 'f1', paye_par: 'tma:tr1' }), ctx).auto, 'M1 : « Payé par » choisi à la main l’emporte (↺ Revenir à la règle automatique = vide)');
ok(libellePayePar('tma:tr1', (k, id) => (k === 'train' ? 'Clients' : id)) === 'TMA du train Clients', 'M1 : libellé « TMA du train Clients »');
ok(traceReimputation('Epic A', 'TMA du train Clients', 'Nina Dupont', '2026-10-16', 'Maintenance (TMA)') === '2026-10-16 · Nina Dupont : Epic A → TMA du train Clients · Maintenance (TMA)', 'M1 : trace datée avec la raison');
let refusPaye = false;
try {
  nettoyerItem({ titre: 't', paye_par: 'n’importe quoi' });
} catch {
  refusPaye = true;
}
ok(refusPaye && nettoyerItem({ titre: 't', nature: 'bruit', paye_par: 'epic:e1' }).nature === 'bruit' && nettoyerItem({ titre: 't', nature: 'autre' }).nature === '', 'Enregistrement : nature (bruit, retouche) et « Payé par » vérifiés');
ok(texteCause('Autre', '  ') === 'Autre', 'Cause : choix rapide + commentaire');

// ---- Lot 9 · B3 indicateurs, B4 stabilité ----
const S = '2026-T4-IT2';
const sp = [
  it('a', { type: 'story', statut: 'termine', points: '10', iteration: S }),
  it('b', { type: 'story', statut: 'termine', points: '10', iteration: S }),
  it('c', { type: 'story', statut: 'en_cours', points: '5', iteration: S }),
  it('br', { nature: 'bruit', parent: 'brp', points: '1', statut: 'termine', iteration: S }),
  it('rt', { nature: 'retouche', parent: 'a', points: '1', iteration: S }),
  it('bug', { type: 'bug', points: '1', iteration: S }),
  it('autre', { type: 'story', statut: 'termine', points: '8', iteration: S, equipe: 'web' }),
];
const l = duSprint(sp, ['mob'], S);
ok(l.length === 6 && !l.some((t) => t.id === 'autre'), 'Indicateurs : éléments de l’équipe dans le sprint');
const b3 = bruit(l);
ok(b3.pct === 5 && b3.ton === 'orange' && b3.detail === '1 pt sur 20 pts', 'B3 : Bruit = points de bruit ÷ points faits (5 % → orange ; vert < 5 %, orange < 15 %)');
const r3 = retouche(l);
ok(r3.pct === 10 && r3.ton === 'rouge', 'B3 : Retouche = sous-tâches 🔧 et bugs ÷ points faits (10 % → rouge ; vert < 5 %, orange < 10 %)');
const e3 = ecartEstimation(l, 26, 1.2);
ok(e3.pct === 8 && e3.ton === 'vert' && ecartEstimation(l, 0, 1).pct === null, 'B3 : Écart d’estimation hors bruit et retouche = (jours réels − estimés) ÷ estimés (±15 % vert) ; sans jours réels : —');
ok(ecartEstimation(l, 30, 1.2).ton === 'orange' && ecartEstimation(l, 40, 1.2).ton === 'rouge', 'B3 : ±30 % orange, au-delà rouge');
const photo = { 't:a': `termine||||`.replace('||||', `|||${S}|`), 't:b': `a_faire|||${S}|`, 't:x': `a_faire|||${S}|`, 't:y': `a_faire|||2026-T4-IT3|` };
const eng = engagesDePhoto(photo, S);
ok(eng.has('a') && eng.has('b') && eng.has('x') && !eng.has('y'), 'B4 : engagés = éléments du sprint sur la photo de la Planification');
const tous = [...sp, it('x', { type: 'story', points: '10', iteration: '' })];
const st = stabilite(eng, l, tous);
ok(st.pct === 67 && st.ton === 'rouge' && st.detail === '3 changements (+6 pts, −10 pts)', 'B4 : Stabilité = points engagés restés ÷ engagés ; « 3 changements (+6 pts, −10 pts) » ; vert ≥ 90 %, orange ≥ 75 %');
ok(stabilite(null, l, tous).pct === null, 'B4 : sans photo de la Planification : —');

console.log(erreurs ? `${erreurs} erreur(s)` : 'Qualité : OK');
process.exit(erreurs ? 1 : 0);
