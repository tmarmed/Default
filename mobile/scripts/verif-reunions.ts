/**
 * Vérification automatique des réunions calculées (src/reunions.ts, lot 6), sur l'exemple ACME de la démo
 * (portfolio Digital › train Clients › équipes Mobile et Web) : qui voit quelle réunion, quand, et qui l'anime.
 * Lancer : npm run verif:reunions
 */
import { donneesDemo, orgDemo, pointsDemo } from '../src/demo';
import { pointsFinis, backlogAPreparer, dateCourte, dateRelative, PARCOURS_DAILY, pastillePoint, pastilleSuivi, questionsEquipe, storiesAAccepter, storiesBloquees, suivis, suivisSynchro, texteCompteRendu, texteReponse, veilleOuvree } from '../src/daily';
import { toDateString } from '../src/dates';
import { ciblesEscalade, destinatairesTransfert, equipesDePersonne } from '../src/echange/hierarchieEchange';
import { makeOrgValue } from '../src/organisation';
import { aReprendre, chaineEscalade, parEspace, pointsEscalade, pointsReponse, reunionDeNiveau, titreEscalade } from '../src/suiviEscalade';
import { etapesParcours, ongletParcours, parcoursParDefaut, participantsReunion, reunionsAVenir } from '../src/reunions';
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
ok(pastillePoint('hier', '2026-10-01') === 'Hier' && pastillePoint('aujourdhui', '2026-10-01') === 'Aujourd’hui' && pastillePoint('blocage', '2026-10-01') === 'Blocage', 'daily : pastilles « Hier », « Aujourd’hui » sans date, type');
ok(dateCourte('2026-10-12') === '12/10', 'daily : date courte');
const dEnt = donneesDemo('demo-entreprise').items;
const pts = pointsDemo('demo-entreprise');
const nina = reunionsAVenir(o, mail('acmp7'), toDateString(new Date()), true, 14);
const prochain = nina.find((r) => r.type === 'daily' && r.niveau === 'equipeagile:acmeqmob')!;
ok(!!prochain && prochain.organisateur === mail('acmp7') && pts.filter((x) => x.reunion === prochain.id).length === 3, 'démo : Tom a préparé 3 points pour le prochain daily de Mobile (animé par Nina)');
const s1 = suivis(pts, dEnt);
ok(s1.length === 3 && s1.every((x) => x.tache.statut !== 'termine'), 'démo : 3 suivis (points concrétisés, tâche pas finie)');
ok(suivis(pts, dEnt.map((t) => (t.id === 'acm7' ? { ...t, statut: 'termine' as const } : t))).length === 2, 'suivi : une tâche terminée n’est plus suivie');
ok(suivis(pts.filter((x) => x.responsable === mail('acmp8')), dEnt).length === 1, 'démo : Tom a 1 suivi à son nom');
ok(storiesBloquees(pts, dEnt).has('acm4'), 'démo : « Écran de connexion » bloquée (blocage noté, pas levé)');
// Règles du 01/10 : « Type · date » des points suivis, parcours séparés selon les rôles (06/10), parcours du PO
ok(dateRelative('2026-10-02', '2026-10-02') === 'aujourd’hui' && dateRelative('2026-10-02', '2026-10-05') === 'hier' && dateRelative('2026-09-29', '2026-10-02') === '29/09', 'suivi : date « aujourd’hui », « hier » (veille ouvrée), sinon « 29/09 »');
{
  const a = pastilleSuivi({ type: 'action', reunion: 'daily-equipeagile:acmeqmob-2026-09-29' }, '2026-10-02');
  const b = pastilleSuivi({ type: 'blocage', reunion: 'daily-equipeagile:acmeqmob-2026-10-01' }, '2026-10-02');
  ok(a.texte === 'Action' && a.date === '29/09' && b.texte === 'Blocage' && b.date === 'Hier', 'suivi : type et date dans deux pastilles — [Action] [29/09], [Blocage] [Hier]');
}
/** « Mon point : Hier, … | PO : … | Suivre (lecture) : … » */
const onglets = (r: Parameters<typeof etapesParcours>[0]) =>
  etapesParcours(r, PARCOURS_DAILY)
    .map((o) => `${ongletParcours(o)}${o.lecture ? ' (lecture)' : ''} : ${o.etapes.map((x) => x.nom).join(', ')}`)
    .join(' | ');
const MEMBRE = 'Mon point : Hier, Aujourd’hui, Blocages, Prêt';
const PO = 'PO : Stories à accepter, Backlog à préparer, Questions de l’équipe, Prêt';
const SM = 'Situation, Tour de table, Concrétisation, Compte rendu';
ok(onglets({ membre: true }) === MEMBRE, 'parcours séparés : membre seul → un seul parcours (pas d’onglets) : Hier, Aujourd’hui, Blocages, Prêt');
ok(onglets({}) === onglets({ membre: true }), 'parcours séparés : sans rôle connu → celui du membre');
ok(onglets({ membre: true, po: true }) === `${MEMBRE} | ${PO} | Suivre (lecture) : ${SM}`, 'parcours séparés : PO membre → Mon point, PO, Suivre (parcours du SM en lecture seule)');
ok(onglets({ po: true }) === `PO : Hier, Aujourd’hui, Stories à accepter, Backlog à préparer, Questions de l’équipe, Prêt | Suivre (lecture) : ${SM}`, 'parcours séparés : PO hors équipe → PO (avec Hier et Aujourd’hui pour ses tâches), Suivre');
ok(onglets({ membre: true, sm: true }) === `${MEMBRE} | Animer : ${SM}`, 'parcours séparés : SM membre → Mon point (avec « Prêt »), Animer');
ok(onglets({ sm: true }) === `Animer : ${SM}`, 'parcours séparés : SM seul → Animer, sans onglets');
ok(onglets({ membre: true, po: true, sm: true }) === `${MEMBRE} | ${PO} | Animer : ${SM}`, 'parcours séparés : membre, PO et organisateur → Mon point, PO, Animer (Animer remplace Suivre)');
ok(
  !etapesParcours({ membre: true, po: true, sm: true }, PARCOURS_DAILY).some((o) => o.etapes.some((x) => x.nom.includes('('))),
  'parcours séparés : plus de rôle entre parenthèses dans les étapes',
);
ok(
  parcoursParDefaut(etapesParcours({ membre: true, sm: true }, PARCOURS_DAILY)) === 1 && parcoursParDefaut(etapesParcours({ membre: true, po: true }, PARCOURS_DAILY)) === 0,
  'parcours séparés : onglet ouvert par défaut « Animer » pour le SM, sinon le premier (Mon point)',
);
// Démo : un blocage de Tom passé en 🔄 Synchro vers Paul (PO de Mobile), en attente : 1 question de l'équipe pour Paul
const echDemo = donneesDemo('demo-entreprise').entities.echange;
const membresMobile = participantsReunion(prochain, o).map((id) => mail(id).toLowerCase());
const itMobile = new Set(dEnt.filter((t) => t.equipe === 'acmeqmob').map((t) => t.id));
const qs = questionsEquipe(echDemo, mail('acmp6'), membresMobile, itMobile);
ok(qs.length === 1 && qs[0].de === mail('acmp8') && qs[0].element === 'acm4', 'démo : 1 question de Tom pour le PO (échange 🔄 Synchro sur sa story)');
ok(questionsEquipe(echDemo, mail('acmp7'), membresMobile, itMobile).length === 0, 'questions de l’équipe : seulement celles adressées au PO');
ok(questionsEquipe(echDemo, mail('acmp6'), membresMobile, new Set()).length === 0, 'questions de l’équipe : seulement sur les stories de l’itération');
ok(questionsEquipe(echDemo.map((e) => ({ ...e, statut: 'pris_en_compte' as const })), mail('acmp6'), membresMobile, itMobile).length === 0, 'questions de l’équipe : une réponse prise en compte n’y est plus');
const sy = suivisSynchro(pts, echDemo);
ok(sy.length === 1 && sy[0].echange.a === mail('acmp6') && suivisSynchro(pts, []).length === 0, 'suivi : le blocage passé en Synchro est suivi tant que son échange existe');
ok(storiesBloquees(pts.filter((x) => x.concretisation === 'synchro'), dEnt, echDemo).has('acm4') && !storiesBloquees(pts.filter((x) => x.concretisation === 'synchro'), dEnt, echDemo.map((e) => ({ ...e, statut: 'repondu' as const }))).has('acm4'), 'story bloquée tant que l’échange Synchro attend sa réponse');
const decPaul = { ...sy[0].point, id: 'd1', type: 'decision' as const, personne: mail('acmp6'), auteur: mail('acmp6'), concretisation: 'rien' as const, tache: 'acmx3' };
ok(suivisSynchro([decPaul], echDemo).length === 1 && suivisSynchro([...pts, decPaul], echDemo).length === 1, 'suivi : réponse du PO notée « rien » suivie tant que l’échange existe, sans doublon avec le blocage');
ok(texteReponse({ titre: 'Blocage · Règles du mot de passe', reponse: 'Autre', note: 'Je vois avec la sécurité' }) === '« Règles du mot de passe » : Je vois avec la sécurité', 'réponse du PO notée comme décision (« Autre » : la remarque)');
const mobile = dEnt.filter((t) => t.equipe === 'acmeqmob');
ok(storiesAAccepter(mobile).map((t) => t.titre).join() === 'Inscription par e-mail', 'démo : 1 story à accepter');
ok(backlogAPreparer(mobile).map((x) => x.raison).sort().join() === 'sans_estimation,trop_grosse', 'démo : backlog à préparer (une story sans estimation, une de plus de 8 pts)');
ok(suivis(pts, dEnt).some((x) => x.tache.responsable === 'acmp6'), 'démo : une action d’un daily précédent à suivre pour Paul');
ok(texteCompteRendu({ equipe: 'Mobile', jour: '2026-10-02', decisions: [], creees: [], escalades: [], synchros: ['Mot de passe (Tom → Paul)'], notes: 0 }).includes('Blocages transmis · 1'), 'compte rendu : blocages transmis');
const cr = texteCompteRendu({ equipe: 'Mobile', jour: '2026-10-02', decisions: ['Livrer en deux fois'], creees: [{ titre: 'Accès API', sous: 'sous-tâche · Tom' }], escalades: [], notes: 1 });
ok(cr.includes('Décisions · 1') && cr.includes('Actions créées · 1') && !cr.includes('escaladés') && cr.includes('1 autre point noté seulement'), 'compte rendu : décisions, actions créées, blocages escaladés (s’il y en a)');

// Équipes, Transmettre à, Escalader (décidé 06/10) : SM → son équipe + SM du train ; PO → son équipe + PO du train
const qui = (nom: string) => o.personnes.find((x) => x.nom.startsWith(nom))!;
const [nNina, nPaul, nTom, nSara, nMarc] = ['Nina', 'Paul', 'Tom', 'Sara', 'Marc'].map(qui);
const titres = (id: string) => equipesDePersonne(id, o).map((g) => g.titre.split(' · ')[0]);
ok(titres(nTom.id).join() === 'Équipe', 'équipes : un membre n’a que son équipe');
ok(titres(nNina.id).includes('Équipe') && titres(nNina.id).includes('SM du train') && !titres(nNina.id).includes('PO du train'), 'équipes : le SM a son équipe et l’équipe des SM du train');
ok(titres(nPaul.id).includes('PO du train') && !titres(nPaul.id).includes('SM du train'), 'équipes : le PO a son équipe et l’équipe des PO du train');
ok(titres(nSara.id).includes('SM du train') && titres(nSara.id).includes('Portfolio'), 'équipes : le RTE a l’équipe des SM et le portfolio');
const versDe = (p: { email: string }) => destinatairesTransfert(p.email, null, o, [p.email]).flatMap((g) => g.emails);
ok(versDe(nNina).includes(nSara.email.toLowerCase()) && !versDe(nNina).includes(nMarc.email.toLowerCase()), 'transmettre : le SM peut transmettre au RTE, pas au PM');
ok(versDe(nPaul).includes(nMarc.email.toLowerCase()) && !versDe(nPaul).includes(nSara.email.toLowerCase()), 'transmettre : le PO peut transmettre au PM, pas au RTE');
ok(!versDe(nTom).includes(nSara.email.toLowerCase()) && !versDe(nTom).includes(nMarc.email.toLowerCase()), 'transmettre : un membre reste dans son équipe');
const eqMobile = o.equipes.find((e) => e.sm === nNina.id)!;
const esc = ciblesEscalade(nNina.id, { kind: 'equipeagile', id: eqMobile.id }, o);
ok(esc.length === 2 && esc.some((c) => c.pid === nSara.id) && esc.some((c) => c.pid === nMarc.id), 'escalader : le SM a deux voies, SM du train (RTE) et PO du train (PM)');

// Suivi des escalades (deux cas d'usage fixés le 06/10) : points de suivi dans la réunion de chacun, réponse recopiée
const eqM = o.equipes.find((e) => e.sm === nNina.id)!;
const trM = o.train.get(eqM.train)!;
const pfM = o.portfolio.get(trM.portfolio)!;
const nEq = { kind: 'equipeagile' as const, id: eqM.id };
const nTr = { kind: 'train' as const, id: trM.id };
const nPf = { kind: 'portfolio' as const, id: pfM.id };
ok(reunionDeNiveau(nEq, o)?.type === 'daily' && reunionDeNiveau(nTr, o)?.type === 'art_sync' && reunionDeNiveau(nPf, o)?.type === 'revue_portfolio', 'escalade : réunion correspondante (équipe → daily, train → ART sync, portfolio → revue du portfolio)');
const ech = { id: 'ech1', titre: titreEscalade('Blocage · API pas prête'), texte: 'API pas prête', element: 'st1' };
const esc1 = pointsEscalade({ echange: ech, par: nNina.email, vers: nSara.email, avant: nEq, apres: nTr, jour: '2026-10-06', org: o });
ok(esc1.length === 2 && esc1[0].reunion.startsWith('daily-') && esc1[0].concretisation === 'escalade' && esc1[1].reunion.startsWith('art_sync-') && !esc1[1].concretisation && esc1.every((x) => x.tache === 'ech1'), 'escalade du SM : « escaladé » au daily, « Escalade reçue » à l’ART sync, même échange');
ok(pointsEscalade({ echange: ech, par: nTom.email, vers: nNina.email, avant: nEq, apres: nEq, jour: '2026-10-06', org: o }).length === 1, 'escalade du membre au SM : un seul point, au daily de l’équipe');
ok(pointsEscalade({ echange: ech, par: nNina.email, vers: nSara.email, avant: nEq, apres: nTr, jour: '2026-10-06', org: o, dejaNote: true }).length === 1, 'escalade décidée en réunion : le point « escaladé » existe déjà, seul « Escalade reçue » est créé');
const monte = { ...ech, de: nTom.email, transmis_par: nSara.email, niveau: `portfolio:${pfM.id}` };
ok(chaineEscalade(monte, o).map((r) => r.type).join() === 'daily,art_sync,revue_portfolio', 'escalade sur trois niveaux : chaîne daily → ART sync → revue du portfolio');
const rep = pointsReponse(monte, mail('acmp1'), 'Budget accordé', '2026-10-08', o);
ok(rep.length === 3 && rep.every((x) => x.type === 'decision' && x.tache === 'ech1' && x.texte === 'Budget accordé'), 'réponse : recopiée en Décision dans les trois réunions de la chaîne');
ok(pointsReponse({ ...monte, titre: '↪ Blocage · API' }, mail('acmp1'), 'Oui', '2026-10-08', o).length > 0, 'réponse à un échange transmis depuis une réunion : recopiée aussi');
ok(pointsReponse({ ...monte, titre: 'Question simple' }, mail('acmp1'), 'Oui', '2026-10-08', o).length === 0, 'réponse à un échange non escaladé : rien dans les réunions');
ok([...parEspace(rep).keys()].length <= 3 && [...parEspace(rep).values()].flat().length === 3, 'points de suivi : regroupés par Sheet (une écriture par Sheet)');
const serie = esc1[1].reunion.slice(0, -10);
const pts2 = [{ ...esc1[1], id: 'p1', cree_le: '' }, { ...esc1[1], id: 'p2', cree_le: '', concretisation: 'rien' as const }];
ok(aReprendre(pts2, `${serie}2026-10-08`).map((x) => x.id).join() === 'p1' && aReprendre(pts2, esc1[1].reunion).length === 0, 'reprise : une escalade reçue non concrétisée revient à la réunion suivante');

// Fin de suivi (06/10) : supprimés au compte rendu suivant de la série (Rien, tâche terminée), pas les autres
const pf = (id: string, reunion: string, concretisation: string, tache = '') => ({ id, reunion, personne: '', auteur: '', type: 'blocage' as const, texte: '', element: '', concretisation: concretisation as never, tache, responsable: '', cree_le: '' });
const itemsPF = [{ id: 't1', statut: 'termine' }, { id: 't2', statut: 'en_cours' }] as never[];
const finis = pointsFinis([pf('a', 'daily-equipeagile:x-2026-10-01', 'rien'), pf('b', 'daily-equipeagile:x-2026-10-01', 'tache', 't1'), pf('c', 'daily-equipeagile:x-2026-10-01', 'tache', 't2'), pf('d', 'daily-equipeagile:x-2026-10-01', 'escalade', 'e1'), pf('e', 'daily-equipeagile:x-2026-10-06', 'rien'), pf('f', 'retro-equipeagile:x-2026-10-01', 'rien')], 'daily-equipeagile:x-2026-10-06', itemsPF);
const finis2 = pointsFinis([pf('d', 'daily-equipeagile:x-2026-10-01', 'escalade', 'e1'), { ...pf('g', 'daily-equipeagile:x-2026-10-03', 'rien', 'e1'), type: 'decision' as const }, pf('h', 'daily-equipeagile:x-2026-10-01', 'synchro', 'e2')], 'daily-equipeagile:x-2026-10-06', itemsPF, ['e2']);
ok(finis2.join() === 'd,g,h', 'fin de suivi : point transmis ou escaladé fini quand sa réponse est concrétisée (avant, ou dans cette réunion)');
ok(finis.join() === 'a,b', 'fin de suivi : « Rien » et tâche terminée supprimés au compte rendu suivant ; tâche en cours, escalade, réunion du jour et autre série gardés');

console.log(erreurs ? `${erreurs} erreur(s)` : 'Réunions : OK');
process.exit(erreurs ? 1 : 0);
