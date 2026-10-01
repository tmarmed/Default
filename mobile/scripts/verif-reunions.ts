/**
 * Vérification automatique des réunions calculées (src/reunions.ts, lot 6), sur l'exemple ACME de la démo
 * (portfolio Digital › train Clients › équipes Mobile et Web) : qui voit quelle réunion, quand, et qui l'anime.
 * Lancer : npm run verif:reunions
 */
import { donneesDemo, orgDemo, pointsDemo } from '../src/demo';
import { dateCourte, pastillePoint, storiesBloquees, suivis, texteCompteRendu, veilleOuvree } from '../src/daily';
import { toDateString } from '../src/dates';
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

// Équipe hors train (espace Équipe) : pas de PI Planning, la planification de l'IT1 a lieu ; vous dans deux espaces
const p = (id: string, email: string) => ({ id, nom: id, email, unite: '', manager: '', capacite: '', cree_le: '', modifie_le: '' });
const seule = makeOrgValue({
  ...orgDemo('demo-entreprise'),
  personnes: [...orgDemo('demo-entreprise').personnes, p('mobp1', 'po@mobile.example'), p('mobp3', mail('acmp8'))],
  equipes: [...orgDemo('demo-entreprise').equipes, { id: 'mobeq', nom: 'Mobile', train: '', po: 'mobp1', sm: '', membres: 'mobp1;mobp3', cree_le: '', modifie_le: '' }],
});
const tom2 = reunionsAVenir(seule, mail('acmp8'), '2026-10-01', true, 30);
ok(du(tom2, '2026-10-01').some((r) => r.type === 'planification' && r.niveau === 'equipeagile:mobeq'), 'équipe hors train : planification de l’IT1 le 1er oct.');
ok(du(tom2, '2026-10-01').some((r) => r.type === 'pi_planning') && du(tom2, '2026-10-02').filter((r) => r.type === 'daily').length === 2, 'même e-mail dans deux espaces : les réunions des deux équipes');
ok(du(tom2, '2026-10-02').find((r) => r.niveau === 'equipeagile:mobeq')?.organisateur === 'po@mobile.example', 'équipe sans Scrum Master : le daily est animé par le PO');

// Mode Simple : rituels personnels
const simple = reunionsAVenir(o, 'vous@demo', '2026-10-01', false, 31);
ok(du(simple, '2026-10-03').map((r) => r.type).join(',') === 'point_perso,bilan_soir', 'Simple : point perso et bilan du soir, chaque jour');
ok(du(simple, '2026-10-05').some((r) => r.type === 'revue_semaine'), 'Simple : revue de la semaine le lundi');
ok(du(simple, '2026-10-01').some((r) => r.type === 'revue_objectifs'), 'Simple : revue des objectifs le 1er du mois');
ok(simple.every((r) => !r.niveau && r.organisateur === 'vous@demo'), 'Simple : réunions personnelles, animées par vous');

// Daily (lot 6) : dates des points, suivi des points concrétisés, compte rendu
ok(veilleOuvree('2026-10-05') === '2026-10-02' && veilleOuvree('2026-10-01') === '2026-09-30', 'daily : « hier » = la veille ouvrée (lundi → vendredi)');
ok(pastillePoint('hier', '2026-10-01') === 'Hier · 30/09' && pastillePoint('aujourdhui', '2026-10-01') === 'Aujourd’hui · 1/10' && pastillePoint('blocage', '2026-10-01') === 'Blocage', 'daily : pastilles « Hier · 30/09 », « Aujourd’hui · 1/10 », type');
ok(dateCourte('2026-10-12') === '12/10', 'daily : date courte');
const dEnt = donneesDemo('demo-entreprise').items;
const pts = pointsDemo('demo-entreprise');
const nina = reunionsAVenir(o, mail('acmp7'), toDateString(new Date()), true, 14);
const prochain = nina.find((r) => r.type === 'daily' && r.niveau === 'equipeagile:acmeqmob')!;
ok(!!prochain && prochain.organisateur === mail('acmp7') && pts.filter((x) => x.reunion === prochain.id).length === 3, 'démo : Tom a préparé 3 points pour le prochain daily de Mobile (animé par Nina)');
const s1 = suivis(pts, dEnt);
ok(s1.length === 2 && s1.every((x) => x.tache.statut !== 'termine'), 'démo : 2 suivis (points concrétisés, tâche pas finie)');
ok(suivis(pts, dEnt.map((t) => (t.id === 'acm7' ? { ...t, statut: 'termine' as const } : t))).length === 1, 'suivi : une tâche terminée n’est plus suivie');
ok(suivis(pts.filter((x) => x.responsable === mail('acmp8')), dEnt).length === 1, 'démo : Tom a 1 suivi à son nom');
ok(storiesBloquees(pts, dEnt).has('acm4'), 'démo : « Écran de connexion » bloquée (blocage noté, pas levé)');
const cr = texteCompteRendu({ equipe: 'Mobile', jour: '2026-10-02', decisions: ['Livrer en deux fois'], creees: [{ titre: 'Accès API', sous: 'sous-tâche · Tom' }], escalades: [], notes: 1 });
ok(cr.includes('Décisions · 1') && cr.includes('Actions créées · 1') && !cr.includes('escaladés') && cr.includes('1 autre point noté seulement'), 'compte rendu : décisions, actions créées, blocages escaladés (s’il y en a)');

console.log(erreurs ? `${erreurs} erreur(s)` : 'Réunions : OK');
process.exit(erreurs ? 1 : 0);
