/**
 * Vérification du calcul automatique (lot 6 du 16/10, docs/regles-reunions.html bloc 17 : K1-K4) : src/calcul.ts
 * et l'alerte des sous-tâches (src/subtasks.ts). Lancer : npm run verif:calcul
 */
import { dateHeritee, datesDesEnfants, depassementSousTaches, joursReelsSaisissables, libelleDateHeritee, pointsEpic, pointsFeature, sortDuParent } from '../src/calcul';
import { pointsCheck } from '../src/subtasks';
import type { Item } from '../src/types';

let erreurs = 0;
const ok = (c: boolean, m: string) => {
  if (!c) erreurs++;
  console.log(`${c ? '✓' : '✗'} ${m}`);
};
const it = (id: string, x: Partial<Item>) => ({ id, titre: id, points: '', date: '', date_fin: '', iteration: '', parent: '', feature: '', ...x }) as Item;

// K1 · vers le bas, seulement les dates
const parent = it('Écran de connexion', { date: '2026-10-18' });
ok(dateHeritee(it('s', { parent: parent.id }), [parent]).date === '2026-10-18' && libelleDateHeritee(dateHeritee(it('s', { parent: parent.id }), [parent])) === 'Comme « Écran de connexion » : 18/10', 'K1 : enfant vide → la date du parent, en gris, qu’il suit');
ok(dateHeritee(it('s', { parent: parent.id, date: '2026-10-17' }), [parent]).source === 'propre', 'K1 : enfant rempli → garde la sienne');
ok(dateHeritee(it('s', { parent: parent.id, iteration: '2026-T4-IT2' }), [parent]).source === 'sprint', 'K1 : priorité : sa date > son sprint > son parent');
ok(sortDuParent(it('s', { date: '2026-10-20' }), parent).includes('sort de') && sortDuParent(it('s', { date: '2026-10-17' }), parent) === '', 'K1 : enfant rempli qui sort du parent → alerte');

// K2 · vers le haut, points (arrêt à l'epic) et dates
const taches = [it('a', { points: '3', feature: 'f1' }), it('b', { points: '5', feature: 'f1' }), it('a1', { points: '2', parent: 'a', feature: 'f1' })];
ok(pointsFeature({ points: '' }, taches.filter((t) => t.feature === 'f1')).valeur === 8 && pointsFeature({ points: '' }, taches).calcule, 'K2 : feature vide → somme de ses tâches, calculée sans rien dire (sous-tâches non comptées deux fois)');
ok(pointsFeature({ points: '10' }, taches).valeur === 10 && !pointsFeature({ points: '10' }, taches).calcule, 'K2 : feature remplie → garde sa valeur (alerte « Passer à n · Garder » s’il y a un écart)');
ok(pointsEpic([{ id: 'f1', points: '' }, { id: 'f2', points: '13' }], taches) === 21, 'K2 : epic = somme de ses features (valeur ou valeur calculée) ; arrêt à l’epic');
const d = datesDesEnfants([it('x', { date: '2026-10-20' }), it('y', { date: '2026-10-12', date_fin: '2026-11-02' })]);
ok(d.debut === '2026-10-12' && d.fin === '2026-11-02', 'K2 : parent sans date → du plus tôt au plus tard de ses enfants');

// K3 · jours réels
ok(!joursReelsSaisissables('story') && !joursReelsSaisissables('feature') && !joursReelsSaisissables('epic') && joursReelsSaisissables('tache'), 'K3 : jours réels jamais saisis sur story, feature, epic ; corrigés sur la tâche');

// K4 · sous-tâches
const story = it('st', { points: '5' });
ok(!depassementSousTaches(story, [it('1', { points: '2' }), it('2', { points: '3' })]).alerte, 'K4 : somme des sous-tâches ≤ estimation → rien');
ok(depassementSousTaches(story, [it('1', { points: '4' }), it('2', { points: '3' })]).alerte, 'K4 : au-delà → alerte « Passer à n · Garder »');
ok(!depassementSousTaches(it('st', { points: '' }), [it('1', { points: '4' })]).alerte, 'K4 : story sans estimation → calculée sans rien dire');
ok(!pointsCheck(story, [it('1', { points: '1' })]).alerte && pointsCheck(story, [it('1', { points: '8' })]).alerte, 'K4 : la même règle dans l’alerte existante (fiche, Itération, PI)');

console.log(erreurs ? `${erreurs} erreur(s)` : 'Calcul : OK');
process.exit(erreurs ? 1 : 0);
