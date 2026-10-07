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
import { couperSerie, datesRegle, exceptionsOrphelines, libelleRegle, lireExceptions, modifierOccurrence, modifierSerie, occurrences } from '../src/series';
import { seriesACreer, serieParDefaut, serieVide, etapesParcours, ongletParcours, parcoursParDefaut, participantsReunion, reunionsAVenir } from '../src/reunions';
import { type Reunion, TYPES_REUNION } from '../src/types';
import { iterationOf, iterationsOf, lireCalendrier, piOf } from '../src/pi';
import { avecCriteres, capacite, criteresDe, etatPrete, feriesFrance, joursOuvres, lireNombre, nombreFr } from '../src/reunionsEquipe';

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
// Organisateur : SM de Mobile (Nina) pour le daily et la revue (07/10 : le SM anime, le PO prépare)
ok(du(paul, '2026-10-13').find((r) => r.type === 'daily')?.organisateur === mail('acmp7'), 'daily animé par le Scrum Master');
ok(du(paul, '2026-10-14').find((r) => r.type === 'revue')?.organisateur === mail('acmp7'), 'revue animée par le Scrum Master (le PO prépare et accepte)');
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
const simple = reunionsAVenir(o, 'vous@demo', '2026-10-01', false, 40);
ok(du(simple, '2026-10-02').map((r) => r.type).join(',') === 'point_perso,bilan_soir' && !du(simple, '2026-10-03').length, 'Simple : point perso et bilan du soir, chaque jour ouvré (pas le samedi)');
ok(du(simple, '2026-10-05').some((r) => r.type === 'revue_semaine'), 'Simple : revue de la semaine le lundi');
ok(du(simple, '2026-11-02').some((r) => r.type === 'revue_objectifs'), 'Simple : revue des objectifs le 1er jour ouvré du mois (1er novembre : dimanche et férié → lundi 2)');
ok(du(simple, '2026-10-01').some((r) => r.type === 'revue_trimestre') && !du(simple, '2026-10-01').some((r) => r.type === 'revue_objectifs'), 'Simple : revue du trimestre le 1er octobre (à la place de la revue des objectifs)');
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
  ok(a.texte === 'Action' && a.age === 'depuis 3 j' && b.texte === 'Blocage' && b.age === '', 'suivi : âge seulement à partir de 2 jours — [Action] [depuis 3 j], [Blocage] (noté hier : rien)');
}
/** « Mon point : Hier, … | PO : … | Suivre (lecture) : … » */
const onglets = (r: Parameters<typeof etapesParcours>[0]) =>
  etapesParcours(r, PARCOURS_DAILY)
    .map((o) => `${ongletParcours(o)}${o.lecture ? ' (lecture)' : ''} : ${o.etapes.map((x) => x.nom).join(', ')}`)
    .join(' | ');
const MEMBRE = 'Mon point : Hier, Aujourd’hui, Blocages';
const PO = 'PO : Stories à accepter, Backlog à préparer, Questions de l’équipe';
const SM = 'Situation, Tour de table, Concrétisation, Compte rendu';
ok(onglets({ membre: true }) === MEMBRE, 'parcours séparés : membre seul → un seul parcours (pas d’onglets) : Hier, Aujourd’hui, Blocages (plus d’étape « Prêt »)');
ok(onglets({}) === onglets({ membre: true }), 'parcours séparés : sans rôle connu → celui du membre');
ok(onglets({ membre: true, po: true }) === `${MEMBRE} | ${PO}`, 'parcours séparés : PO membre → Mon point, PO (plus d’onglet « Suivre » : bandeau En direct)');
ok(onglets({ po: true }) === `PO : Hier, Aujourd’hui, Stories à accepter, Backlog à préparer, Questions de l’équipe`, 'parcours séparés : PO hors équipe → PO (avec Hier et Aujourd’hui pour ses tâches)');
ok(onglets({ membre: true, sm: true }) === `${MEMBRE} | Animer : ${SM}`, 'parcours séparés : SM membre → Mon point, Animer');
ok(onglets({ sm: true }) === `Animer : ${SM}`, 'parcours séparés : SM seul → Animer, sans onglets');
ok(onglets({ membre: true, po: true, sm: true }) === `${MEMBRE} | ${PO} | Animer : ${SM}`, 'parcours séparés : membre, PO et organisateur → Mon point, PO, Animer');
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


// ---------------------------------------------------------------------------
// Réunions d'équipe (07/10) : critères, Prête, jours ouvrés, capacité
// ---------------------------------------------------------------------------
{
  const desc = 'Le client choisit.\n\nCritères d’acceptation :\n- Envoi en moins de 1 min\n- Désinscription en un clic';
  ok(criteresDe(desc).join('|') === 'Envoi en moins de 1 min|Désinscription en un clic', 'critères : lus sous « Critères d’acceptation : »');
  const d2 = avecCriteres(desc, ['Envoi en moins de 1 min', 'Choix des notifications']);
  ok(criteresDe(d2).length === 2 && d2.startsWith('Le client choisit.'), 'critères : remplacés, le reste de la description gardé');
  ok(criteresDe(avecCriteres('', ['A'])).join() === 'A', 'critères : section ajoutée si absente');
  const p1 = etatPrete({ points: 13, criteres: ['a'], feature: 'f' });
  const p2 = etatPrete({ points: 5, criteres: ['a'], feature: 'f' });
  ok(!p1.ok && p1.manque.some((x) => x.startsWith('découpage')) && p2.ok, 'Prête : 8 pts au plus, critères, estimation, feature');
  ok(feriesFrance(2026).includes('2026-04-06') && feriesFrance(2026).includes('2026-05-14') && feriesFrance(2026).includes('2026-11-11'), 'fériés : lundi de Pâques, Ascension, 11 novembre (2026)');
  const o = joursOuvres('2026-11-09', '2026-11-13');
  ok(o.jours === 4 && o.feries.join() === '2026-11-11', 'jours ouvrés : une semaine avec le 11 novembre → 4 jours');
  ok(capacite(9.5, 0.8) === 8 && lireNombre('1,1') === 1.1 && nombreFr(0.8) === '0,8', 'capacité : 9,5 j × 0,8 = 8 pts ; saisie « 1,1 »');
}
// ---------------------------------------------------------------------------
// Calendrier agile par équipe (07/10)
// ---------------------------------------------------------------------------
{
  const d = lireCalendrier('');
  const l = iterationsOf('2026-T4', d);
  ok(l.length === 7 && l[0].start === '2026-10-01' && l[0].end === '2026-10-14' && l[6].code === 'IP' && l[6].end === '2026-12-31', 'calendrier par défaut : 6 sprints de 2 semaines + IP, comme avant');
  const c3 = lireCalendrier({ semaines: 3, sprints: 4, ip: false });
  const l3 = iterationsOf('2026-T4', c3);
  ok(l3.length === 4 && l3[1].start === '2026-10-22' && l3[3].end === '2026-12-31', 'sprints de 3 semaines, 4 sprints, sans IP : le dernier va jusqu’à la fin du PI');
  const cd = lireCalendrier({ decalage: 4 });
  ok(piOf('2026-10-02', cd) === '2026-T3' && iterationOf('2026-10-05', cd).key === '2026-T4-IT1' && iterationsOf('2026-T3', cd).at(-1)!.end === '2026-10-04', 'PI décalé de 4 jours : le 2/10 est encore dans le PI d’avant');
  const ce = lireCalendrier({ exceptions: [{ pi: '2027-T1', debut: '2027-01-11' }] });
  ok(iterationOf('2027-01-05', ce).key === '2026-T4-IP' && iterationOf('2027-01-11', ce).key === '2027-T1-IT1', 'exception : le PI de janvier commence le 11');
  ok(lireCalendrier('{"semaines":9,"sprints":0}').semaines === 4 && lireCalendrier('pas du json').sprints === 6, 'calendrier : valeurs bornées, JSON invalide → par défaut');
  const od = orgDemo('demo-entreprise');
  const org = makeOrgValue({ ...od, equipes: od.equipes.map((e, i) => (i === 0 ? { ...e, calendrier: JSON.stringify({ semaines: 1, sprints: 6, ip: true, decalage: 0 }) } : e)) });
  const e0 = od.equipes[0];
  const sm = org.personne.get(e0.sm)?.email ?? '';
  const plan = reunionsAVenir(org, sm, '2026-10-01', true, 14).filter((r) => r.type === 'planification' && r.niveau === `equipeagile:${e0.id}`);
  ok(plan.length >= 1 && plan.some((r) => r.debut.startsWith('2026-10-08')), 'équipe en sprints d’une semaine : planification chaque semaine');
}
// ---------------------------------------------------------------------------
// Séries de réunions (07/10) : règle + exceptions
// ---------------------------------------------------------------------------
{
  const cal = lireCalendrier('');
  const fin1 = serieVide({ id: 's1', unite: 'sprint', ancre: 'fin', ecart: '-1', heure: '14:00', duree: '60' });
  ok(datesRegle(fin1, '2026-10-01', '2026-10-31', cal).join() === '2026-10-13,2026-10-27', 'sprint · fin − 1 jour ouvré');
  const deb2 = serieVide({ id: 's2', unite: 'sprint', ancre: 'debut', ecart: '2' });
  ok(datesRegle(deb2, '2026-10-01', '2026-10-20', cal).join() === '2026-10-05,2026-10-19', 'sprint · début + 2 jours ouvrés (week-end sauté)');
  const ip = serieVide({ id: 's3', unite: 'pi', ancre: 'ip' });
  ok(datesRegle(ip, '2026-10-01', '2026-12-31', cal).join() === '2026-12-24', 'PI · semaine IP (24 décembre)');
  const noel = serieVide({ id: 's4', unite: 'semaine', jours: '5' });
  ok(datesRegle(noel, '2026-12-21', '2026-12-27', cal).join() === '2026-12-24', 'férié (vendredi 25 décembre) : la réunion passe au jour ouvré le plus proche de la semaine');
  ok(datesRegle(serieVide({ id: 's5', unite: 'jour', jours: 'ouvres' }), '2026-11-09', '2026-11-13', cal).length === 4, 'chaque jour ouvré : le 11 novembre sauté');
  ok(datesRegle(serieVide({ id: 's6', unite: 'mois', ancre: 'debut', jours: '2' }), '2026-10-01', '2026-12-31', cal).join() === '2026-10-06,2026-11-03,2026-12-01', 'mois · 1er mardi');
  ok(datesRegle(serieVide({ id: 's7', unite: 'semaine', jours: '1', tous: '2', debut: '2026-10-05' }), '2026-10-01', '2026-10-31', cal).join() === '2026-10-05,2026-10-19', 'toutes les 2 semaines, depuis le début de la série');
  ok(libelleRegle(fin1) === 'Chaque sprint · fin − 1 j' && libelleRegle(ip) === 'Chaque PI · semaine IP', 'libellé de la règle');
  // Une réunion déplacée, une annulée ; identique à la série → l'exception est retirée
  let s = modifierOccurrence(fin1, '2026-10-13', { a: '2026-10-14T10:00' });
  s = modifierOccurrence(s, '2026-10-27', { annulee: true });
  const occ = occurrences(s, '2026-10-01', '2026-10-31', cal);
  ok(occ.length === 2 && occ[0].debut === '2026-10-14T10:00' && occ[0].origine === '2026-10-13' && occ[1].annulee, 'exceptions : déplacée (date d’origine gardée) et annulée');
  ok(lireExceptions(modifierOccurrence(s, '2026-10-13', { a: '2026-10-13T14:00' })).length === 1, 'exception identique à la série : retirée');
  // Celle-ci et les suivantes
  const [av, ap] = couperSerie(s, '2026-10-27', { heure: '16:00' }, 'x');
  ok(av.fin === '2026-10-26' && ap.id === 's1~2026-10-27' && ap.debut === '2026-10-27' && ap.heure === '16:00' && lireExceptions(av).length === 1 && lireExceptions(ap).length === 1, 'celle-ci et les suivantes : la série est coupée, les exceptions suivent');
  // Toute la série : l'exception devenue identique disparaît
  const t = modifierSerie(modifierOccurrence(fin1, '2026-10-13', { a: '2026-10-13T16:00' }), { heure: '16:00' }, 'x');
  ok(!lireExceptions(t).length, 'toute la série : une exception devenue identique est retirée');
  // Calendrier changé : exception orpheline
  const c3 = lireCalendrier({ semaines: 3 });
  ok(exceptionsOrphelines(s, c3).some((e) => e.d === '2026-10-13'), 'calendrier changé : exception « à revoir »');
  // Séries d'après l'Organisation : créées une fois, par espace
  const sm = mail(o.equipes[0].sm);
  const od = orgDemo('demo-entreprise');
  const oe = makeOrgValue({ ...od, equipes: od.equipes.map((e) => ({ ...e, espace: 'ent' })), trains: od.trains.map((t) => ({ ...t, espace: 'ent' })), portfolios: od.portfolios.map((p) => ({ ...p, espace: 'ent' })) });
  const aCreer = seriesACreer(oe, sm, []);
  const toutes = [...aCreer.values()].flat();
  ok(aCreer.size >= 1 && toutes.some((x) => x.id === `daily-equipeagile:${o.equipes[0].id}`), 'séries à créer au démarrage (mode SAFe)');
  ok(seriesACreer(oe, sm, toutes).size === 0, 'séries déjà enregistrées : rien à créer');
  // Série enregistrée modifiée : le daily à 10:00
  const daily = toutes.find((x) => x.type_reunion === 'daily')!;
  const l = reunionsAVenir(oe, sm, '2026-10-02', true, 1, toutes.map((x) => (x.id === daily.id ? { ...x, heure: '10:00' } : x)));
  ok(l.find((r) => r.type === 'daily' && r.niveau === daily.niveau)?.debut === '2026-10-02T10:00', 'série enregistrée : son heure est suivie');
  ok(serieParDefaut('daily', 'equipeagile:x').id === 'daily-equipeagile:x', 'id de série stable : type-niveau');
}
console.log(erreurs ? `${erreurs} erreur(s)` : 'Réunions : OK');
process.exit(erreurs ? 1 : 0);
