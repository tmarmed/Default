/**
 * Vérification des règles des notes (lot 1 du 16/10, docs/regles-reunions.html bloc 16 : N1-N3, V1-V4, D1) :
 * src/notes.ts (pièce commune) et le nettoyage d'un point (src/magasin.ts). Un test par règle.
 * Lancer : npm run verif:notes
 */
import { nettoyerPoint } from '../src/magasin';
import {
  avecElements,
  deplacement,
  elementsDe,
  estPerso,
  impactConcretisation,
  impactNote,
  lignePartage,
  lignesHistorique,
  rappelPreparation,
  reunionsCibles,
  texteSuiviImpose,
  type CtxImpact,
} from '../src/notes';
import type { PointReunion, Reunion } from '../src/types';

let erreurs = 0;
const ok = (c: boolean, m: string) => {
  if (!c) erreurs++;
  console.log(`${c ? '✓' : '✗'} ${m}`);
};

const tom = 'tom.faure@acme.example';
const sara = 'sara.martin@acme.example';
const ctx: CtxImpact = {
  moi: tom,
  sprint: '2026-IT5',
  items: [
    { id: 's1', titre: 'Connexion', responsable: 'p-tom', iteration: '2026-IT5', type: 'story' },
    { id: 's2', titre: 'Paiement', responsable: 'p-sara', iteration: '2026-IT5', type: 'story' },
    { id: 's3', titre: 'Parrainage', responsable: 'p-tom', iteration: '', type: 'story' },
  ],
  emailDe: (id) => ({ 'p-tom': tom, 'p-sara': sara })[id] ?? '',
  nomDe: (e) => (e === sara ? 'Sara Martin' : 'Tom Faure'),
};

// N3 · plusieurs éléments
ok(elementsDe({ element: 's1', elements: 's2, s1,,s3' }).join() === 's1,s2,s3', 'N3 : éléments concernés = le premier puis les autres, sans doublon ni vide');
ok(JSON.stringify(avecElements(['s1', 's2', 's3'])) === JSON.stringify({ element: 's1', elements: 's2,s3' }) && avecElements([]).element === '', 'N3 : le premier reste « element » (lu partout), les autres dans « elements »');

// V1 / V2 · Perso ou à partager
ok(estPerso({ perso: '1' }) && !estPerso({ perso: '' }) && !estPerso({}), 'V1 : « 🔒 Perso » seulement quand la case est cochée (à partager par défaut)');
ok(impactNote({ type: 'information', element: 's1' }, ctx) === '', 'V2 : ma story, une information : rien ne touche l’équipe (perso possible)');
ok(impactNote({ type: 'information', element: 's2' }, ctx).includes('Sara Martin'), 'V2 : la story de Sara Martin : touche le travail d’un autre (perso retiré)');
ok(impactNote({ type: 'blocage', element: 's1' }, ctx).includes('planning') && impactNote({ type: 'blocage', element: 's3' }, ctx) === '', 'V2 : un blocage sur une story du sprint touche le planning ; hors sprint, non');
ok(impactNote({ type: 'information', element: 's1', elements: 's2' }, ctx).includes('Sara Martin'), 'V2 / N3 : un des éléments touche un autre : impact');

// N2 · Suivi obligatoire
const ch = (x: Partial<{ que: string; type: string; resp: string; qui: string; transmis: boolean; ratt: string }>) => ({ que: 'creer', type: 'tache', resp: tom, ratt: 's1', ...x });
const note = { type: 'action', element: 's1' };
ok(impactConcretisation(ch({}), note, ctx) === '', 'N2 : sous-tâche de ma story pour moi : organisation perso, suivi facultatif');
ok(impactConcretisation(ch({ resp: sara }), note, ctx).includes('Sara Martin'), 'N2 : affectée à une autre personne : suivi obligatoire');
ok(impactConcretisation(ch({ ratt: '' }), note, ctx).includes('périmètre'), 'N2 : tâche à part (nouvel élément du sprint) : suivi obligatoire');
ok(impactConcretisation(ch({ transmis: true }), note, ctx) !== '' && impactConcretisation(ch({ qui: 'dessus' }), note, ctx) !== '', 'N2 : transmis ou au niveau du dessus : suivi obligatoire');
ok(impactConcretisation(ch({ que: 'rien' }), note, ctx) === '' && impactConcretisation(ch({ que: 'budget' }), note, ctx) === '', 'N2 : Rien et demande de budget : pas de suivi imposé');
ok(impactConcretisation(ch({ que: 'suivre' }), { type: 'blocage', element: 's1' }, ctx).includes('planning'), 'N2 : action rapide sur un blocage du sprint : l’impact de la note compte');
ok(texteSuiviImpose('touche le travail de Sara Martin').endsWith('Confirmé par le Scrum Master.'), 'N2 : la feuille dit pourquoi le suivi est obligatoire et qui confirme');

// N1 · En préparation : rappel 🟡
const serie = 'daily-equipeagile:acmeqmob-';
ok(rappelPreparation(`${serie}2026-10-15`, `${serie}2026-10-16`).startsWith('🟡') && rappelPreparation(`${serie}2026-10-15`, `${serie}2026-10-16`).includes('Daily du 15/10'), 'N1 : note écrite pour le Daily du 15/10, pas partagée : rappel 🟡 au Daily suivant');
ok(rappelPreparation(`${serie}2026-10-16`, `${serie}2026-10-16`) === '', 'N1 : note pour la réunion du jour : pas de rappel');
ok(rappelPreparation(`revue-equipeagile:acmeqmob-2026-10-14`, `${serie}2026-10-16`) === '', 'N1 : une autre série : pas de rappel ici');

// D1 · Déplacer
const r = (id: string, debut: string, x: Partial<Reunion> = {}): Reunion => ({ id, type: id.split('-')[0] as Reunion['type'], titre: '', niveau: '', organisateur: '', debut, duree_min: 15, repetition: '', cree_le: '', modifie_le: '', espace: 'demo-entreprise', ...x });
const ici = r(`revue-equipeagile:acmeqmob-2026-10-14`, '2026-10-14T14:00');
const mes = [
  r(`${serie}2026-10-17`, '2026-10-17T09:30'),
  r(`${serie}2026-10-16`, '2026-10-16T09:30'),
  r(`revue-equipeagile:acmeqmob-2026-10-28`, '2026-10-28T14:00'),
  r(`art_sync-train:acmtr1-2026-10-16`, '2026-10-16T11:00', { organisateur: 'rte@acme.example' }),
  r(`daily-equipeagile:acmeqweb-2026-10-16`, '2026-10-16T09:45', { espace: 'autre' }),
  r(`${serie}2026-10-13`, '2026-10-13T09:30'),
];
const cibles = reunionsCibles(mes, ici, '2026-10-16', (x) => x.organisateur !== 'rte@acme.example');
ok(cibles.length === 1 && cibles[0].value === `${serie}2026-10-16`, 'D1 : une réunion par série (la prochaine), pas celle d’ici, même espace, où le responsable participe');
const pt = { id: 'p1', reunion: ici.id, historique: '' } as PointReunion;
const d = deplacement(pt, cibles[0].reunion, 'Sara Martin');
ok(d.reunion === `${serie}2026-10-16` && Object.keys(d).sort().join() === 'historique,id,reunion', 'D1 : seuls la réunion et l’historique changent (responsable, validation, échéance, statut inchangés)');
ok(lignesHistorique(d.historique)[0] === 'Déplacé depuis « Revue de sprint du 14/10 » par Sara Martin', 'D1 : historique « Déplacé depuis « Revue de sprint du 14/10 » par Sara Martin »');
ok(lignesHistorique(deplacement({ ...pt, ...d }, r(`${serie}2026-10-17`, ''), 'Nina Dupont').historique).length === 2, 'D1 : l’historique garde chaque déplacement');

// V3 · Partager une note perso
ok(lignePartage('Tom Faure', '2026-10-16') === 'Note perso de Tom Faure, partagée le 16/10', 'V3 : une note perso partagée garde une ligne d’historique');

// Enregistrement d'un point : nouveaux champs vérifiés
const base = { reunion: `${serie}2026-10-16`, personne: tom, auteur: tom, type: 'information', texte: 'Note', element: 's1', concretisation: '', tache: '', responsable: '' } as Partial<PointReunion>;
const p = nettoyerPoint({ ...base, elements: 's2, s1 ,s3', perso: 'oui', historique: '  a ¶ b  ' });
ok(p.elements === 's2,s3' && p.perso === '' && p.historique === 'a ¶ b', 'Enregistrement : autres éléments nettoyés (sans le premier), « perso » = « 1 » ou rien, historique gardé');
let refus = false;
try {
  nettoyerPoint({ ...base, elements: 's2,<x>' });
} catch {
  refus = true;
}
ok(refus, 'Enregistrement : un élément concerné invalide est refusé');
ok(nettoyerPoint({ ...base, perso: '1' }).perso === '1', 'Enregistrement : « 🔒 Perso » gardé');

console.log(erreurs ? `${erreurs} erreur(s)` : 'Notes : OK');
process.exit(erreurs ? 1 : 0);
