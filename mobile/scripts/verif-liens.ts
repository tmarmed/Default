/**
 * Vérification des liens entre niveaux (lots 2 à 5 du 16/10, docs/regles-reunions.html bloc 16 : R1-R3, Q1-Q5,
 * L1-L5, T1) sur l'organisation ACME de la démo. Un test par règle. Lancer : npm run verif:liens
 */
import { orgDemo } from '../src/demo';
import { makeOrgValue } from '../src/organisation';
import { estResponsable, etatChezReceveur, niveauxDessous, peutCommuniquer, peutEscalader, personnesLiaison, premierDestinataire, responsablesNiveau, sujetDe } from '../src/liens';

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

console.log(erreurs ? `${erreurs} erreur(s)` : 'Liens : OK');
process.exit(erreurs ? 1 : 0);
