/**
 * Vérification des liens entre niveaux (lots 2 à 5 du 16/10, docs/regles-reunions.html bloc 16 : R1-R3, Q1-Q5,
 * L1-L5, T1) sur l'organisation ACME de la démo. Un test par règle. Lancer : npm run verif:liens
 */
import { orgDemo } from '../src/demo';
import { makeOrgValue } from '../src/organisation';
import { enfantsDe, etatEnfant, ligneParent, lireDemandeParent, messagesCommunication, parentDe, propositionParent, titreDemandeParent, MARQUE_COMMUNICATION, LIBELLE_LIE } from '../src/parentEnfants';
import { planSuivi } from '../src/pointsSuivi';
import type { Echange, PointReunion } from '../src/types';
import { lienPrive, estResponsable, etatChezReceveur, niveauxDessous, peutCommuniquer, peutEscalader, personnesLiaison, premierDestinataire, responsablesNiveau, sujetDe } from '../src/liens';

let erreurs = 0;
const ok = (c: boolean, m: string) => {
  if (!c) erreurs++;
  console.log(`${c ? '✓' : '✗'} ${m}`);
};
const org = makeOrgValue(orgDemo('demo-entreprise'));
const mob = { kind: 'equipeagile' as const, id: 'acmeqmob' };
const train = { kind: 'train' as const, id: 'acmtr1' };
const pf = { kind: 'portfolio' as const, id: 'acmpf1' };
const jour = '2026-10-16';

// Responsables (règle générale)
ok(responsablesNiveau(mob, org).contenu === 'acmp6' && responsablesNiveau(mob, org).deroulement === 'acmp7', 'Responsables : équipe = PO (contenu) + Scrum Master (déroulement)');
ok(responsablesNiveau(train, org).tous.sort().join() === 'acmp4,acmp5', 'Responsables : train = PM + RTE');
ok(responsablesNiveau(pf, org).tous.join() === 'acmp3', 'Responsables : portfolio = Epic Owner');
ok(estResponsable('acmp11', mob, org, jour) && !estResponsable('acmp11', mob, org, '2026-11-30'), 'Q5 : le suppléant a les droits du responsable pendant la suppléance seulement');

// Q1 / Q2 · Escalader
ok(peutEscalader('acmp7', mob, org, jour) && peutEscalader('acmp6', mob, org, jour), 'Q1 : le Scrum Master et le PO escaladent');
ok(!peutEscalader('acmp8', mob, org, jour), 'Q1 : un membre de l’équipe n’escalade pas (il transmet ou passe par son SM)');
ok(peutEscalader('acmp4', train, org, jour) && !peutEscalader('acmp3', pf, org, jour), 'Q2 : le niveau le plus haut n’a pas « Escalader »');

// Q1 / Q2 · Communiquer
ok(niveauxDessous(train, org).some((n) => n.id === 'acmeqmob') && niveauxDessous(mob, org).length === 0, 'Q2 : le niveau le plus bas n’a pas de dessous (pas de « Communiquer » ni « Répartir »)');
ok(peutCommuniquer('acmp4', train, mob, org, jour), 'Q1 : le responsable du dessus communique');
const liaison = personnesLiaison(train, mob, org);
ok(liaison.length > 0 && liaison.every((p) => peutCommuniquer(p, train, mob, org, jour)), 'Q1 : la personne de liaison (de l’équipe et du train) communique');
ok(!peutCommuniquer('acmp4', mob, train, org, jour), 'Q1 : on ne communique que vers un niveau du dessous');

// Q3 · PO contenu, SM déroulement
ok(sujetDe('blocage') === 'deroulement' && sujetDe('decision') === 'contenu' && sujetDe('action', 'Revoir la priorité du parrainage') === 'contenu', 'Q3 : blocage = déroulement ; décision, priorité = contenu');
ok(premierDestinataire(train, org, 'deroulement') === 'acmp4' && premierDestinataire(train, org, 'contenu') === 'acmp5', 'Q3 : au train, déroulement → RTE en premier, contenu → PM en premier');

// R3 · Ce que voit l'envoyeur
ok(etatChezReceveur({ statut: 'envoye' }) === 'Reçu · pas encore traité', 'R3 : reçu, pas encore traité');
ok(etatChezReceveur({ statut: 'envoye', rappel_le: '2026-10-18' }) === 'Pris en compte · réponse prévue le 18/10', 'R3 / T1 : temporisé → « Pris en compte · réponse prévue le 18/10 »');
ok(etatChezReceveur({ statut: 'envoye', suivi_a: 'ART sync 🚆 Clients' }) === 'Suivi à ART sync 🚆 Clients', 'R3 : mis en réunion → « Suivi à … »');
ok(etatChezReceveur({ statut: 'repondu', suivi_a: 'x' }) === '', 'R3 : une fois répondu, plus d’état d’attente');

// ---- Lot 3 · Parent et enfants ----
const ref = 'demo-entreprise|parent1';
const parentPt = { texte: 'Gel des mises en production du 20 au 24/10', element: '' };
const msgs = messagesCommunication({ pt: parentPt, ref, de: 'rte@acme.example', cibles: [{ niveau: 'equipeagile:acmeqmob', libelle: '👥 Mobile', a: 'nina@acme.example' }, { niveau: 'equipeagile:acmeqweb', libelle: '👥 Web', a: 'sm.web@acme.example' }], texte: '', espace: 'demo-entreprise', quoi: 'communiquer' });
ok(msgs.length === 2 && msgs.every((m) => m.point === ref && m.titre.startsWith(MARQUE_COMMUNICATION)) && msgs[0].a === 'nina@acme.example', 'L1 / Q1 : communiquer = un échange ⤵ par équipe (à son SM), lié au point parent dès la création');
const ech = (id: string, x: Partial<Echange>): Echange => ({ ...(msgs[0] as unknown as Echange), id, cree_le: '', modifie_le: '', ...x });
const enfants = [ech('c1', { niveau: 'equipeagile:acmeqmob', statut: 'repondu', reponse: 'Fait' }), ech('c2', { niveau: 'equipeagile:acmeqweb', suivi_a: 'Daily 👥 Web' }), ech('c3', { niveau: 'equipeagile:x' })];
const nom = (n: string) => ({ 'equipeagile:acmeqmob': 'Mobile', 'equipeagile:acmeqweb': 'Web', 'equipeagile:x': 'Studio' })[n] ?? '';
ok(ligneParent(enfantsDe(ref, enfants), nom) === '1 / 3 · Mobile ✓ · Web 🔵 · Studio ⏳', 'R3 : une seule ligne chez le parent « 1 / 3 · Mobile ✓ · Web 🔵 · Studio ⏳ »');
ok(etatEnfant({ statut: 'envoye', reponse: '' }) === 'attente' && etatEnfant({ statut: 'envoye', reponse: '', suivi_a: 'x' }) === 'suivi' && etatEnfant({ statut: 'repondu', reponse: 'Abandonné' }) === 'abandonne', 'États d’un enfant : en attente, suivi, fait, abandonné');
ok(propositionParent(enfants) === '' && propositionParent([enfants[0]]) === 'valider' && propositionParent([enfants[0], ech('c4', { statut: 'repondu', reponse: 'Plus suivi' })]) === 'plus_suivre', 'L4 : tous finis → « Valider » proposé au parent (« Ne plus suivre » si certains abandonnés)');
const enfantPt = { id: 'e1', reunion: 'daily-equipeagile:acmeqmob-2026-10-16', personne: 'nina@acme.example', auteur: 'nina@acme.example', type: 'action', texte: 'Gel des mises en production', element: '', concretisation: 'suivi', tache: 'c2', echange: 'c2', responsable: 'nina@acme.example', cree_le: '', statut: 'en_cours', validateur: 'nina@acme.example' } as PointReunion;
ok(parentDe(enfantPt, enfants)?.id === 'c2' && lienPrive(enfantPt, enfants, (m) => m) === LIBELLE_LIE, 'L2 : chez l’enfant, « 🔗 Lié au niveau du dessus » sans dire à quoi');
const base = { espace: 'demo-entreprise', note: '', moi: 'nina@acme.example', animateur: 'nina@acme.example', nomDe: (m: string) => m, echanges: enfants, niveau: 'equipeagile:acmeqweb' };
const dem = planSuivi({ ...base, pt: enfantPt, action: 'abandonner', note: 'Plus de mise en production cette semaine' });
ok(dem.points.length === 0 && dem.envoyer.length === 1 && lireDemandeParent(dem.envoyer[0].titre) === 'abandonner' && dem.envoyer[0].a === 'rte@acme.example', 'L4 : l’enfant qui abandonne envoie une demande au parent (OK · Refuser) ; son statut ne change pas');
const ok2 = planSuivi({ ...base, pt: enfantPt, action: 'abandonner', note: 'OK', depuisParent: true });
ok(ok2.points[0]?.patch.statut === 'abandonne' && ok2.echanges.some((x) => x.e.id === 'c2' && x.patch.statut === 'repondu'), 'L4 : après l’OK du parent, le statut change et le parent le voit (⊘)');
const fait = planSuivi({ ...base, pt: enfantPt, action: 'fait' });
ok(fait.echanges.some((x) => x.e.id === 'c2' && x.patch.reponse === 'Fait'), 'L4 : l’enfant « Fait » → le parent le voit (✓) et reçoit la réponse à accepter');
const parentPoint = { ...enfantPt, id: 'parent1', echange: '', tache: '', responsable: 'rte@acme.example', validateur: 'rte@acme.example' } as PointReunion;
const ab = planSuivi({ ...base, moi: 'rte@acme.example', animateur: 'rte@acme.example', pt: parentPoint, action: 'abandonner', note: 'Gel annulé' });
ok(ab.envoyer.filter((x) => x.titre.includes('Parent abandonné')).length === 3, 'L4 : parent abandonné → chaque enfant est prévenu');
ok(titreDemandeParent('detacher', 'x').includes('Détacher') && lireDemandeParent(titreDemandeParent('plus_suivre', 'x')) === 'plus_suivre', 'L5 : « Demander à détacher » passe par le même circuit (OK · Refuser)');

console.log(erreurs ? `${erreurs} erreur(s)` : 'Liens : OK');
process.exit(erreurs ? 1 : 0);
