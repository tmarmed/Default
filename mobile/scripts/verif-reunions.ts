/**
 * Vérification automatique des réunions calculées (src/reunions.ts, lot 6), sur l'exemple ACME de la démo
 * (portfolio Digital › train Clients › équipes Mobile et Web) : qui voit quelle réunion, quand, et qui l'anime.
 * Lancer : npm run verif:reunions
 */
import { orgDemo } from '../src/demo';
import { makeOrgValue } from '../src/organisation';
import { participantsReunion, reunionsAVenir } from '../src/reunions';
import { type Reunion, TYPES_REUNION } from '../src/types';

let erreurs = 0;
const ok = (cond: boolean, msg: string) => {
  if (!cond) {
    erreurs++;
    console.error(`✗ ${msg}`);
  } else console.log(`✓ ${msg}`);
};

const o = makeOrgValue(orgDemo('demo-entreprise'));
const mail = (id: string) => o.personne.get(id)!.email;
const types = (l: Reunion[]) => new Set(l.map((r) => r.type));
const du = (l: Reunion[], jour: string) => l.filter((r) => r.debut.startsWith(jour));

// Catalogue : chaque type a ses étapes ; les réunions SAFe d'équipe, de train et de portfolio finissent par le compte rendu
ok(Object.values(TYPES_REUNION).every((t) => t.etapes.length >= 3), 'catalogue : au moins 3 étapes par réunion');
ok(
  Object.entries(TYPES_REUNION)
    .filter(([, t]) => t.mode === 'safe')
    .every(([k, t]) => t.etapes[t.etapes.length - 1] === (k === 'planification' ? 'Engagement' : 'Compte rendu')),
  'catalogue : les réunions SAFe finissent par le compte rendu (planification : l’engagement)',
);
ok(Object.values(TYPES_REUNION).filter((t) => t.mode === 'simple').every((t) => !t.etapes.includes('Compte rendu')), 'catalogue : pas de compte rendu en mode Simple');

// Mardi 13 oct. 2026 : IT1 du T4 (1er oct. → 14 oct.), jour ouvré ordinaire
const paul = reunionsAVenir(o, mail('acmp6'), '2026-10-01', true, 92); // PO de Mobile
ok(du(paul, '2026-10-13').some((r) => r.type === 'daily' && r.niveau === 'equipeagile:acmeqmob' && r.debut.endsWith('09:30')), 'PO de Mobile : daily à 9:30 un jour ouvré');
ok(du(paul, '2026-10-10').length === 0, 'pas de réunion le samedi');
// 1er oct. 2026 (jeudi) : début du PI T4 → PI Planning, sans daily ni planification d'équipe
ok(du(paul, '2026-10-01').some((r) => r.type === 'pi_planning' && r.niveau === 'train:acmtr1'), '1er jour du PI : PI Planning du train');
ok(!du(paul, '2026-10-01').some((r) => r.type === 'daily' || r.type === 'planification'), 'jour du PI Planning : ni daily ni planification d’équipe');
// IT1 : 1er → 14 oct. (mercredi) ; revue, rétro et System demo le 14
ok(['revue', 'retro', 'system_demo'].every((t) => du(paul, '2026-10-14').some((r) => r.type === t)), 'fin de l’IT1 (14 oct.) : revue, rétro et System demo');
// Milieu de l'IT1 : 8 oct. (jeudi)
ok(du(paul, '2026-10-08').some((r) => r.type === 'affinage'), 'milieu de l’IT1 (8 oct.) : affinage');
// IT2 : 15 oct. → planification
ok(du(paul, '2026-10-15').some((r) => r.type === 'planification'), 'début de l’IT2 (15 oct.) : planification');
// ART sync : mercredi, pour le PO
ok(du(paul, '2026-10-07').some((r) => r.type === 'art_sync'), 'PO : ART sync le mercredi');
// Organisateur : SM de Mobile (Nina) pour le daily, PO (Paul) pour la revue
ok(du(paul, '2026-10-13').find((r) => r.type === 'daily')?.organisateur === mail('acmp7'), 'daily animé par le Scrum Master');
ok(du(paul, '2026-10-14').find((r) => r.type === 'revue')?.organisateur === mail('acmp6'), 'revue animée par le Product Owner');
ok(!types(paul).has('revue_portfolio') && !types(paul).has('revue_okr'), 'PO : pas de revue du portfolio');

// Membre simple (Tom) : pas d'ART sync, mais System demo et PI Planning
const tom = reunionsAVenir(o, mail('acmp8'), '2026-10-01', true, 92);
ok(!types(tom).has('art_sync') && types(tom).has('system_demo') && types(tom).has('pi_planning'), 'membre : pas d’ART sync ; System demo et PI Planning');
ok(!tom.some((r) => r.niveau === 'equipeagile:acmeqweb'), 'membre de Mobile : rien de l’équipe Web');

// RTE (Sara) : réunions du train et du portfolio, aucune réunion d'équipe
const sara = reunionsAVenir(o, mail('acmp4'), '2026-10-01', true, 92);
ok(!sara.some((r) => r.niveau.startsWith('equipeagile:')), 'RTE : pas de réunion d’équipe');
ok(['art_sync', 'pi_planning', 'inspect_adapt', 'revue_portfolio', 'revue_okr'].every((t) => types(sara).has(t as Reunion['type'])), 'RTE : ART sync, PI Planning, I&A, revue du portfolio, revue des OKR');
ok(du(sara, '2026-12-31').some((r) => r.type === 'inspect_adapt') && du(sara, '2026-12-31').some((r) => r.type === 'revue_okr'), 'fin du PI (31 déc.) : Inspect & Adapt et revue des OKR');
ok(du(sara, '2026-10-06').some((r) => r.type === 'revue_portfolio'), 'revue du portfolio : 1er mardi du mois (6 oct.)');

// Epic Owner (Julie) : seulement le portfolio (et le train qu'elle ne pilote pas : rien)
const julie = reunionsAVenir(o, mail('acmp3'), '2026-10-01', true, 92);
ok(julie.length > 0 && julie.every((r) => r.niveau === 'portfolio:acmpf1'), 'Epic Owner : seulement les revues du portfolio et des OKR');

// Hors delivery (Claire) : rien en SAFe
ok(reunionsAVenir(o, mail('acmp1'), '2026-10-01', true, 92).length === 0, 'personne hors delivery : aucune réunion SAFe');

// Participants
const daily = du(paul, '2026-10-13').find((r) => r.type === 'daily')!;
ok(participantsReunion(daily, o).length === 4, 'daily de Mobile : 4 participants');
const sync = du(paul, '2026-10-07').find((r) => r.type === 'art_sync')!;
ok(participantsReunion(sync, o).length === 6, 'ART sync : RTE, PM, SM et PO des 2 équipes (6)');

// Mode Simple : rituels personnels
const simple = reunionsAVenir(o, 'vous@demo', '2026-10-01', false, 31);
ok(du(simple, '2026-10-03').map((r) => r.type).join(',') === 'point_perso,bilan_soir', 'Simple : point perso et bilan du soir, chaque jour');
ok(du(simple, '2026-10-05').some((r) => r.type === 'revue_semaine'), 'Simple : revue de la semaine le lundi');
ok(du(simple, '2026-10-01').some((r) => r.type === 'revue_objectifs'), 'Simple : revue des objectifs le 1er du mois');
ok(simple.every((r) => !r.niveau && r.organisateur === 'vous@demo'), 'Simple : réunions personnelles, animées par vous');

console.log(erreurs ? `${erreurs} erreur(s)` : 'Réunions : OK');
process.exit(erreurs ? 1 : 0);
