/**
 * Vérification du changement de périmètre (lot 7 du 16/10, docs/regles-reunions.html bloc 17 : P0, P1) :
 * src/perimetre.ts. Lancer : npm run verif:perimetre
 */
import { changementPerimetre, conseilBaisse, demandePerimetre, encoderPatch, etapesPerimetre, libelleImpact, lirePatch, texteLisible } from '../src/perimetre';
import type { Item } from '../src/types';

let erreurs = 0;
const ok = (c: boolean, m: string) => {
  if (!c) erreurs++;
  console.log(`${c ? '✓' : '✗'} ${m}`);
};
const S = '2026-T4-IT2';
const t = (x: Partial<Item>) => ({ iteration: '', points: '', parent: '', equipe: 'acmeqmob', ...x }) as Item;

ok(changementPerimetre(t({}), t({ iteration: S, points: '5' }), S).delta === 5 && changementPerimetre(t({}), t({ iteration: S, points: '5' }), S).quoi === 'entre dans le sprint', 'P0 : ajouter une story estimée au sprint → +5');
ok(changementPerimetre(t({ iteration: S, points: '5' }), t({ iteration: '' , points: '5' }), S).delta === -5, 'P0 : retirer ou déplacer un élément du sprint → −5');
ok(changementPerimetre(t({ iteration: S, points: '5' }), t({ iteration: S, points: '8' }), S).quoi === 'réestimée', 'P0 : réestimer une story du sprint (hausse ou baisse)');
ok(!changementPerimetre(t({}), t({ iteration: S, points: '' }), S).oui, 'P0 : élément sans estimation (retouche à 0) → pas de changement');
ok(!changementPerimetre(t({ parent: 'st', iteration: S }), t({ parent: 'st', iteration: S, points: '3' }), S).oui, 'P0 : sous-tâche (dans la limite de la story) → non');
ok(!changementPerimetre(t({ iteration: '2026-T4-IT3', points: '5' }), t({ iteration: '2026-T4-IT3', points: '8' }), S).oui, 'P0 : hors du sprint en cours → non');
ok(etapesPerimetre('tom@x', 'paul@x', 'nina@x').join() === 'po,sm' && etapesPerimetre('paul@x', 'paul@x', 'nina@x').join() === 'sm' && etapesPerimetre('nina@x', 'paul@x', 'nina@x').join() === 'po', 'P1 : n’importe qui propose, le PO valide, le SM confirme (on ne se répond pas à soi-même)');
const p = { id: 'acm5', iteration: S };
ok(JSON.stringify(lirePatch(`Texte\n${encoderPatch(p)}`)) === JSON.stringify(p) && texteLisible(`Texte\n${encoderPatch(p)}`) === 'Texte', 'P1 : le changement voyage avec la demande et ne s’affiche pas');
const d = demandePerimetre({ de: 'tom@x', a: 'paul@x', etape: 'po', item: { id: 'acm5', titre: 'Paiement' }, impact: libelleImpact({ delta: 5, quoi: 'entre dans le sprint' }), raison: 'Client prioritaire', patch: p, niveau: 'equipeagile:acmeqmob', espace: 'e' });
ok(d.type === 'question' && d.choix === 'Valider;Refuser (motif)' && d.a === 'paul@x' && !d.point, 'P1 : la demande arrive au Chat du PO (Valider · Refuser), sans point de suivi d’office');
ok(libelleImpact({ delta: -3, quoi: 'sort du sprint' }) === '−3 pts · sort du sprint' && conseilBaisse(-3).includes('backlog') && conseilBaisse(2) === '', 'P1 : à la baisse, proposer de compléter avec le backlog');

console.log(erreurs ? `${erreurs} erreur(s)` : 'Périmètre : OK');
process.exit(erreurs ? 1 : 0);
