import { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import type { VoteEtat } from '../../etatReunion';
import { fmtPoints, piOf, shiftPi } from '../../pi';
import type { CatalogueParcours, EtapeCatalogue, ParcoursRole } from '../../reunions';
import { lireNombre } from '../../reunionsEquipe';
import { useSafe } from '../../safe';
import { colors } from '../../theme';
import { type Epic, ETATS_EPIC, type Feature, type TypeReunion, TYPES_REUNION } from '../../types';
import { SectionFiche } from '../Choix';
import { TitreFiche } from '../FormSheet';
import { ListeEditable, MesTaches, Navigation } from './Affinage';
import { BlocPoints, BlocSuivi, Compteurs, type Equipe, EtapeCompteRendu, EtapeConcretisation, FenetreEquipe, type PropsReunion, prenom, type R, useReunion } from './base';
import { Ligne, Pastilles, st, Vide } from './ui';
import { CARTES_CONFIANCE, type DecisionVote, VoteAnimateur, VoteEtoiles, VoteParticipant, votesDe } from './Vote';

/**
 * Réunions du train et du portfolio (07/10), sur le même socle que celles de l'équipe : mêmes onglets (Mon point,
 * PO pour le PM, Animer), mêmes points notés, même vote, même concrétisation, même compte rendu (au niveau du dessus :
 * train → Epic Owner) et même live. Chaque réunion est une liste d'étapes (`CONFIGS`), d'après sa maquette :
 * PI Planning, ART sync, System demo, Inspect & Adapt, Revue du portfolio, Revue des OKR, Affinage du backlog du
 * train, Préparation du PI Planning, Synchronisation du portfolio, Budget participatif, Itération IP.
 */
interface Elem {
  id: string;
  titre: string;
  sous?: string;
  pastille?: string;
}
interface Ctx {
  r: R;
  e: Equipe;
  /** PI de la réunion (« 2026-T4 ») et le suivant */
  pi: string;
  piSuivant: string;
  /** Features du train pour le PI (ou du portfolio) */
  features: Feature[];
  epics: Epic[];
  fmt: (n: number) => string;
}
type Etape =
  | { k: 'situation'; compteurs: (c: Ctx) => { valeur: string; libelle: string; ton?: 'rouge' | 'orange' | 'vert' }[]; objectif: string; sousObjectif: string }
  | { k: 'liste'; icone: string; titre: string; sous: string; lignes: (c: Ctx) => Elem[]; points?: boolean }
  | { k: 'elements'; icone: string; mot: string; liste: (c: Ctx) => Elem[]; choix?: string[] }
  | { k: 'points'; icone: string; titre: string; sous: string; placeholder: string }
  | { k: 'saisies'; icone: string; titre: string; sous: string; cle: string; vote?: 'etoiles' }
  | { k: 'confiance' }
  | { k: 'budget'; cle: string }
  | { k: 'concretisation' }
  | { k: 'compte_rendu' }
  // Participants
  | { k: 'taches' }
  | { k: 'notes'; titre?: string }
  | { k: 'saisie'; icone: string; titre: string; sous: string; cle: string; placeholder: string }
  | { k: 'mes_elements'; icone: string; titre: string; sous: string; liste: (c: Ctx) => Elem[] }
  | { k: 'voter_confiance' }
  | { k: 'voter_etoiles'; cle: string }
  | { k: 'voter_budget'; cle: string };
interface Config {
  nomCourt: string;
  /** Étapes par rôle : animateur, participant (Mon point), PM ou PO (onglet PO) */
  sm: [string, string, Etape][];
  membre: [string, string, Etape][];
  po?: [string, string, Etape][];
}

// ---- Listes de données ----
const avancementFeature = (c: Ctx, f: Feature) => {
  const st_ = c.e.h.items.filter((t) => t.feature === f.id && t.type === 'story');
  const faits = st_.filter((t) => t.statut === 'termine').length;
  return st_.length ? Math.round((100 * faits) / st_.length) : 0;
};
const featuresPI = (c: Ctx): Elem[] =>
  c.features.map((f) => ({ id: f.id, titre: f.titre, sous: [f.equipe ? `👥 ${c.r.org.equipe.get(f.equipe)?.nom ?? ''}` : '', f.iteration ? f.iteration.split('-').pop() : '', f.points ? c.fmt(Number(f.points) || 0) : ''].filter(Boolean).join(' · '), pastille: `${avancementFeature(c, f)} %` }));
const featuresPrep = (c: Ctx): Elem[] =>
  c.e.h.featureList
    .filter((f) => (f.train ?? '') === (c.e.train?.id ?? '') && (!f.pi || f.pi >= c.piSuivant))
    .map((f) => ({ id: f.id, titre: f.titre, sous: [f.pi ? `PI ${f.pi}` : 'sans PI', f.points ? c.fmt(Number(f.points) || 0) : 'sans estimation'].join(' · '), pastille: f.points ? 'estimée' : 'à préparer' }));
const epicsPortfolio = (c: Ctx): Elem[] => c.epics.map((x) => ({ id: x.id, titre: x.titre, sous: x.description.slice(0, 80), pastille: ETATS_EPIC.find((s) => s.value === x.etat)?.label ?? 'Idée' }));
const objectifsPI = (c: Ctx): Elem[] =>
  c.e.h.objectifsPI.filter((o) => o.pi === c.pi).map((o) => ({ id: o.id, titre: o.titre, sous: `${o.type === 'engage' ? 'engagé' : 'non engagé'} · valeur prévue ${o.valeur_prevue || '—'}${o.valeur_obtenue ? ` · obtenue ${o.valeur_obtenue}` : ''}`, pastille: o.type === 'engage' ? 'engagé' : 'bonus' }));
const okrs = (c: Ctx): Elem[] =>
  c.e.h.objectifList
    .filter((o) => c.e.h.resultats.some((k) => k.objectif === o.id))
    .map((o) => {
      const krs = c.e.h.resultats.filter((k) => k.objectif === o.id);
      return { id: o.id, titre: `🎯 ${o.titre}`, sous: krs.map((k) => `${k.titre} : ${k.actuel || 0}/${k.cible || '?'} ${k.unite}`).join(' · '), pastille: `${krs.length} RC` };
    });
const previsibilite = (c: Ctx) => {
  const l = c.e.h.objectifsPI.filter((o) => o.pi === c.pi && o.type === 'engage');
  const prevu = l.reduce((s, o) => s + (Number(o.valeur_prevue) || 0), 0);
  const obtenu = l.reduce((s, o) => s + (Number(o.valeur_obtenue) || 0), 0);
  return prevu ? Math.round((100 * obtenu) / prevu) : 0;
};

// ---- Les réunions ----
const SIT = (objectif: string, sousObjectif: string, compteurs: (c: Ctx) => { valeur: string; libelle: string; ton?: 'rouge' | 'orange' | 'vert' }[]): Etape => ({ k: 'situation', objectif, sousObjectif, compteurs });
const CONC: Etape = { k: 'concretisation' };
const CR: Etape = { k: 'compte_rendu' };
const TACHES: Etape = { k: 'taches' };
export const CONFIGS: Partial<Record<TypeReunion, Config>> = {
  pi_planning: {
    nomCourt: 'au PI Planning',
    sm: [
      ['situation', 'Situation', SIT('Un plan par équipe, des objectifs du PI, les risques traités', 'Plans d’équipe, objectifs du PI avec leur valeur, risques (ROAM), un vote de confiance d’au moins 3.', (c) => [{ valeur: String(c.features.length), libelle: 'features du PI' }, { valeur: String(objectifsPI(c).length), libelle: 'objectifs du PI' }, { valeur: String(c.r.donneesDe('risque').length), libelle: 'risques', ton: 'orange' }])],
      ['contexte', 'Contexte', { k: 'saisies', icone: '🧭', titre: 'Contexte', sous: 'Vision du PM, features priorisées', cle: 'vision' }],
      ['capacite', 'Capacité', { k: 'saisies', icone: '👥', titre: 'Capacité par équipe', sous: 'Déclarée par les SM', cle: 'capacite' }],
      ['plans', 'Plans d’équipe', { k: 'liste', icone: '🗓️', titre: 'Plans d’équipe', sous: 'Features du PI par équipe et itération', lignes: featuresPI, points: true }],
      ['objectifs', 'Objectifs du PI', { k: 'liste', icone: '🏁', titre: 'Objectifs du PI', sous: 'Préparés par les PO · valeur par les Business Owners', lignes: objectifsPI, points: true }],
      ['risques', 'Risques', { k: 'points', icone: '⚠', titre: 'Risques · ROAM', sous: 'Résolu, Owned, Accepté, Mitigé : à la concrétisation', placeholder: '＋ Risque' }],
      ['vote', 'Vote', { k: 'confiance' }],
      ['concretisation', 'Concrétisation', CONC],
      ['compte_rendu', 'Compte rendu', CR],
    ],
    membre: [
      ['taches', 'Mes tâches', TACHES],
      ['capacite_m', 'Capacité', { k: 'saisie', icone: '👥', titre: 'Capacité de mon équipe', sous: 'SM : jours et points par itération, absences connues', cle: 'capacite', placeholder: 'IT1 : 30 pts (Nina absente 2 j)' }],
      ['risques_m', 'Risques', { k: 'notes', titre: 'Nos risques et points' }],
      ['vote_m', 'Vote', { k: 'voter_confiance' }],
    ],
    po: [
      ['vision', 'Vision', { k: 'saisie', icone: '🧭', titre: 'Vision', sous: 'Affichée au « Contexte »', cle: 'vision', placeholder: 'Message de vision' }],
      ['features_po', 'Features', { k: 'mes_elements', icone: '🧩', titre: 'Features du PI', sous: 'Priorisées (WSJF)', liste: featuresPI }],
      ['vote_po', 'Vote', { k: 'voter_confiance' }],
    ],
  },
  art_sync: {
    nomCourt: 'à l’ART sync',
    sm: [
      ['situation', 'Situation', SIT('Voir l’avancement du train, lever les obstacles', 'Partie SM (obstacles, organisation), puis partie PO (contenu, priorités).', (c) => [{ valeur: String(c.features.length), libelle: 'features' }, { valeur: `${c.features.length ? Math.round(c.features.reduce((s, f) => s + avancementFeature(c, f), 0) / c.features.length) : 0} %`, libelle: 'avancement' }, { valeur: String(c.r.reportes.length), libelle: 'escalades reçues', ton: 'orange' }])],
      ['vue', 'Vue du train', { k: 'liste', icone: '🚆', titre: 'Vue du train', sous: 'Features du PI', lignes: featuresPI }],
      ['partie_sm', 'Partie SM', { k: 'points', icone: '🧑‍🔧', titre: 'Partie SM', sous: 'Obstacles et organisation, avec le RTE', placeholder: '＋ Obstacle, décision ou action' }],
      ['partie_po', 'Partie PO', { k: 'points', icone: '📦', titre: 'Partie PO', sous: 'Contenu, priorités, périmètre, avec le PM', placeholder: '＋ Décision, action ou blocage' }],
      ['risques', 'Risques', { k: 'points', icone: '⚠', titre: 'Risques', sous: 'Nouveaux risques du train', placeholder: '＋ Risque' }],
      ['concretisation', 'Concrétisation', CONC],
      ['compte_rendu', 'Compte rendu', CR],
    ],
    membre: [
      ['taches', 'Mes tâches', TACHES],
      ['avancement', 'Avancement', { k: 'mes_elements', icone: '📈', titre: 'Avancement', sous: 'Features du PI', liste: featuresPI }],
      ['notes', 'Nos points', { k: 'notes', titre: 'Nos points' }],
    ],
    po: [
      ['features_po', 'Mes features', { k: 'mes_elements', icone: '🧩', titre: 'Features du PI', sous: 'Contenu et priorités', liste: featuresPI }],
      ['notes_po', 'Mes points', { k: 'notes', titre: 'Mes points' }],
    ],
  },
  system_demo: {
    nomCourt: 'à la System demo',
    sm: [
      ['situation', 'Situation', SIT('Montrer le système intégré', 'Ce que le train a fini pendant l’itération, et recueillir les retours.', (c) => [{ valeur: String(c.features.filter((f) => avancementFeature(c, f) === 100).length), libelle: 'features finies', ton: 'vert' }, { valeur: String(c.features.length), libelle: 'features du PI' }, { valeur: String(c.r.tous.filter((x) => c.r.ici(x)).length), libelle: 'retours' }])],
      ['a_montrer', 'À montrer', { k: 'liste', icone: '🖥️', titre: 'À montrer', sous: 'Features du PI, avancement', lignes: featuresPI }],
      ['features', 'Features', { k: 'elements', icone: '🧩', mot: 'Feature', liste: featuresPI }],
      ['retours', 'Retours', { k: 'points', icone: '💬', titre: 'Retours', sous: 'Des Business Owners et parties prenantes', placeholder: '＋ Retour' }],
      ['concretisation', 'Concrétisation', CONC],
      ['compte_rendu', 'Compte rendu', CR],
    ],
    membre: [
      ['taches', 'Mes tâches', TACHES],
      ['nos_features', 'Nos features', { k: 'mes_elements', icone: '🧩', titre: 'Nos features', sous: 'Ce que nous montrons', liste: featuresPI }],
      ['retours_m', 'Mes retours', { k: 'notes', titre: 'Mes retours' }],
    ],
  },
  inspect_adapt: {
    nomCourt: 'à l’Inspect & Adapt',
    sm: [
      ['situation', 'Situation', SIT('Mesurer, puis améliorer', 'Voir ce que le train a livré, mesurer la prévisibilité, traiter le problème le plus voté.', (c) => [{ valeur: `${previsibilite(c)} %`, libelle: 'prévisibilité', ton: previsibilite(c) < 80 ? 'orange' : 'vert' }, { valeur: String(c.features.filter((f) => avancementFeature(c, f) === 100).length), libelle: 'features livrées' }, { valeur: String(c.r.donneesDe('probleme').length), libelle: 'problèmes proposés' }])],
      ['demo', 'Démo du PI', { k: 'liste', icone: '🖥️', titre: 'Démo du PI', sous: 'Ce que le train a livré', lignes: featuresPI, points: true }],
      ['previsibilite', 'Prévisibilité', { k: 'liste', icone: '📏', titre: 'Prévisibilité', sous: 'Valeur obtenue sur valeur prévue (objectifs engagés)', lignes: objectifsPI }],
      ['problemes', 'Problèmes', { k: 'saisies', icone: '🧩', titre: 'Problèmes', sous: 'Proposés par le train · vote : 1 étoile par problème, 3 au total', cle: 'probleme', vote: 'etoiles' }],
      ['atelier', 'Atelier', { k: 'points', icone: '🔬', titre: 'Atelier', sous: 'Causes (5 pourquoi), puis actions', placeholder: '＋ Action, décision ou blocage' }],
      ['concretisation', 'Concrétisation', CONC],
      ['compte_rendu', 'Compte rendu', CR],
    ],
    membre: [
      ['taches', 'Mes tâches', TACHES],
      ['problemes_m', 'Problèmes', { k: 'saisie', icone: '🧩', titre: 'Problèmes à proposer', sous: 'Pour tout le train', cle: 'probleme', placeholder: 'Problème' }],
      ['voter', 'Voter', { k: 'voter_etoiles', cle: 'probleme' }],
    ],
  },
  revue_portfolio: {
    nomCourt: 'à la revue du portfolio',
    sm: [
      ['situation', 'Situation', SIT('Décider de l’état de chaque epic', 'Avancer, garder ou arrêter les epics ; trier les nouvelles idées.', (c) => [{ valeur: String(c.epics.length), libelle: 'epics' }, { valeur: String(c.epics.filter((x) => x.etat === 'idee' || !x.etat).length), libelle: 'idées' }, { valeur: String(c.epics.filter((x) => x.etat === 'en_cours').length), libelle: 'en cours' }])],
      ['kanban', 'Kanban', { k: 'liste', icone: '🗂️', titre: 'Kanban des epics', sous: 'Idée → Analyse → Prêt → En cours → Terminé', lignes: epicsPortfolio }],
      ['epics', 'Epics', { k: 'elements', icone: '🗂️', mot: 'Epic', liste: epicsPortfolio, choix: ETATS_EPIC.map((s) => s.label) }],
      ['idees', 'Idées', { k: 'saisies', icone: '💡', titre: 'Nouvelles idées', sous: 'Proposées par les trains', cle: 'idee_pf' }],
      ['concretisation', 'Concrétisation', CONC],
      ['compte_rendu', 'Compte rendu', CR],
    ],
    membre: [
      ['taches', 'Mes tâches', TACHES],
      ['mes_epics', 'Mes epics', { k: 'mes_elements', icone: '🗂️', titre: 'Epics du portfolio', sous: 'Leur état', liste: epicsPortfolio }],
      ['idees_m', 'Idées', { k: 'saisie', icone: '💡', titre: 'Mes idées', sous: 'Nouvelles idées d’epic', cle: 'idee_pf', placeholder: 'Idée' }],
    ],
  },
  revue_okr: {
    nomCourt: 'à la revue des OKR',
    sm: [
      ['situation', 'Situation', SIT('Revoir les OKR du trimestre', 'Où en sont les résultats clés, que viser au trimestre suivant.', (c) => [{ valeur: String(okrs(c).length), libelle: 'OKR' }, { valeur: String(c.e.h.resultats.length), libelle: 'résultats clés' }, { valeur: String(c.epics.length), libelle: 'epics' }])],
      ['okr', 'OKR', { k: 'elements', icone: '🎯', mot: 'OKR', liste: okrs, choix: ['Garder', 'Ajuster', 'Arrêter'] }],
      ['suivant', 'Trimestre suivant', { k: 'points', icone: '📅', titre: 'Trimestre suivant', sous: 'Décisions et actions', placeholder: '＋ Décision ou action' }],
      ['concretisation', 'Concrétisation', CONC],
      ['compte_rendu', 'Compte rendu', CR],
    ],
    membre: [
      ['taches', 'Mes tâches', TACHES],
      ['valeurs', 'Valeurs', { k: 'mes_elements', icone: '🎯', titre: 'OKR', sous: 'Résultats clés actuels', liste: okrs }],
      ['notes', 'Mes points', { k: 'notes' }],
    ],
  },
  affinage_train: {
    nomCourt: 'à l’affinage du train',
    sm: [
      ['situation', 'Situation', SIT('Préparer les features du prochain PI', 'Features estimées, critères écrits, prêtes pour le PI Planning.', (c) => [{ valeur: String(featuresPrep(c).length), libelle: 'features à préparer', ton: 'orange' }, { valeur: String(featuresPrep(c).filter((f) => f.pastille === 'estimée').length), libelle: 'estimées' }, { valeur: String(c.features.length), libelle: 'features du PI' }])],
      ['a_preparer', 'Features à préparer', { k: 'liste', icone: '🪄', titre: 'Features à préparer', sous: 'Ordre du PM', lignes: featuresPrep }],
      ['feature', 'Feature', { k: 'elements', icone: '🧩', mot: 'Feature', liste: featuresPrep, choix: ['Prête', 'À reprendre', 'À découper'] }],
      ['concretisation', 'Concrétisation', CONC],
      ['compte_rendu', 'Compte rendu', CR],
    ],
    membre: [
      ['nos_features', 'Nos features', { k: 'mes_elements', icone: '🧩', titre: 'Features à préparer', sous: 'Questions de l’équipe', liste: featuresPrep }],
      ['notes', 'Mes points', { k: 'notes' }],
    ],
  },
  prepa_pi: {
    nomCourt: 'à la préparation du PI Planning',
    sm: [
      ['situation', 'Situation', SIT('Préparer le PI Planning', 'Vision, features, capacité, dépendances et organisation des deux jours.', (c) => [{ valeur: String(featuresPrep(c).length), libelle: 'features candidates' }, { valeur: String(c.r.donneesDe('capacite').length), libelle: 'capacités reçues' }, { valeur: String(c.r.tous.filter((x) => c.r.ici(x)).length), libelle: 'points' }])],
      ['vision', 'Vision', { k: 'saisies', icone: '🧭', titre: 'Vision', sous: 'Du PM', cle: 'vision' }],
      ['features', 'Features du PI', { k: 'liste', icone: '🧩', titre: 'Features du PI', sous: 'Candidates, ordre du PM', lignes: featuresPrep }],
      ['capacite', 'Capacité', { k: 'saisies', icone: '👥', titre: 'Capacité des équipes', sous: 'Déclarée par les SM', cle: 'capacite' }],
      ['dependances', 'Dépendances', { k: 'points', icone: '🔗', titre: 'Dépendances', sous: 'Entre équipes et avec l’extérieur', placeholder: '＋ Dépendance (blocage) ou action' }],
      ['organisation', 'Organisation', { k: 'points', icone: '🗓️', titre: 'Organisation', sous: 'Salles, horaires, invités', placeholder: '＋ Action ou décision' }],
      ['concretisation', 'Concrétisation', CONC],
      ['compte_rendu', 'Compte rendu', CR],
    ],
    membre: [
      ['capacite_m', 'Capacité', { k: 'saisie', icone: '👥', titre: 'Capacité de mon équipe', sous: 'Par itération, absences connues', cle: 'capacite', placeholder: 'IT1 : 30 pts' }],
      ['notes', 'Mes points', { k: 'notes' }],
    ],
    po: [['vision_po', 'Vision', { k: 'saisie', icone: '🧭', titre: 'Vision du PI', sous: 'Message de vision', cle: 'vision', placeholder: 'Message de vision' }]],
  },
  sync_portfolio: {
    nomCourt: 'à la synchronisation du portfolio',
    sm: [
      ['situation', 'Situation', SIT('Synchroniser les trains du portfolio', 'Avancement des epics, escalades des trains.', (c) => [{ valeur: String(c.epics.filter((x) => x.etat === 'en_cours').length), libelle: 'epics en cours' }, { valeur: String(c.r.reportes.length), libelle: 'escalades', ton: 'orange' }, { valeur: String(c.epics.length), libelle: 'epics' }])],
      ['epics', 'Epics en cours', { k: 'liste', icone: '🗂️', titre: 'Epics en cours', sous: 'Avancement', lignes: (c) => epicsPortfolio(c).filter((x) => x.pastille === 'En cours'), points: true }],
      ['escalades', 'Escalades des trains', { k: 'points', icone: '⤴', titre: 'Escalades des trains', sous: 'Reçues des ART sync (à concrétiser) et nouvelles', placeholder: '＋ Blocage, décision ou action' }],
      ['concretisation', 'Concrétisation', CONC],
      ['compte_rendu', 'Compte rendu', CR],
    ],
    membre: [
      ['avancement', 'Avancement', { k: 'mes_elements', icone: '🗂️', titre: 'Epics', sous: 'Avancement', liste: epicsPortfolio }],
      ['escalades_m', 'Nos escalades', { k: 'notes', titre: 'Nos escalades' }],
    ],
  },
  budget: {
    nomCourt: 'au budget participatif',
    sm: [
      ['situation', 'Situation', SIT('Répartir le budget du semestre', 'Entre les demandes des trains, par un vote des participants (100 points chacun).', (c) => [{ valeur: String(c.r.donneesDe('demande').length), libelle: 'demandes' }, { valeur: String(new Set(c.r.donneesDe('budget').map((x) => x.p.personne)).size), libelle: 'votants' }, { valeur: String(c.e.personnes.length), libelle: 'participants' }])],
      ['demandes', 'Demandes', { k: 'saisies', icone: '🙋', titre: 'Demandes', sous: 'Préparées par les PM et RTE', cle: 'demande' }],
      ['vote', 'Vote', { k: 'budget', cle: 'demande' }],
      ['repartition', 'Répartition', { k: 'points', icone: '💶', titre: 'Répartition', sous: 'Décidée d’après le vote', placeholder: '＋ Décision (montant) ou action' }],
      ['concretisation', 'Concrétisation', CONC],
      ['compte_rendu', 'Compte rendu', CR],
    ],
    membre: [
      ['demandes_m', 'Mes demandes', { k: 'saisie', icone: '🙋', titre: 'Mes demandes', sous: 'Ce que je demande (et pourquoi)', cle: 'demande', placeholder: 'Programme fidélité · 400 k€' }],
      ['vote_m', 'Mon vote', { k: 'voter_budget', cle: 'demande' }],
    ],
  },
  iteration_ip: {
    nomCourt: 'au lancement de l’itération IP',
    sm: [
      ['situation', 'Situation', SIT('Lancer l’itération d’innovation et de planification', 'Programme, hackathon, formation, dette technique.', (c) => [{ valeur: String(c.r.donneesDe('idee_ip').length), libelle: 'idées' }, { valeur: String(c.r.donneesDe('formation').length), libelle: 'inscriptions' }, { valeur: String(c.e.personnes.length), libelle: 'participants' }])],
      ['programme', 'Programme', { k: 'points', icone: '🗓️', titre: 'Programme', sous: 'Hackathon, Inspect & Adapt, formation, PI Planning', placeholder: '＋ Décision ou action' }],
      ['hackathon', 'Hackathon', { k: 'saisies', icone: '💡', titre: 'Hackathon', sous: 'Idées du train · vote : 1 étoile par idée, 3 au total', cle: 'idee_ip', vote: 'etoiles' }],
      ['formation', 'Formation', { k: 'saisies', icone: '🎓', titre: 'Formation et dette', sous: 'Inscriptions et sujets', cle: 'formation' }],
      ['concretisation', 'Concrétisation', CONC],
      ['compte_rendu', 'Compte rendu', CR],
    ],
    membre: [
      ['idee', 'Mon idée', { k: 'saisie', icone: '💡', titre: 'Mon idée', sous: 'Pour le hackathon', cle: 'idee_ip', placeholder: 'Idée' }],
      ['formation_m', 'Formation', { k: 'saisie', icone: '🎓', titre: 'Formation', sous: 'Je m’inscris (sujet, dette technique)', cle: 'formation', placeholder: 'Sécurité des applications' }],
      ['votes', 'Mes votes', { k: 'voter_etoiles', cle: 'idee_ip' }],
    ],
  },
};
export const estReunionNiveau = (t: TypeReunion) => !!CONFIGS[t];

export function FenetreNiveau(p: PropsReunion) {
  const config = CONFIGS[p.reunion.type]!;
  const catalogue: CatalogueParcours = {
    sm: config.sm.map(([cle, nom]) => ({ cle, nom })),
    membre: config.membre.map(([cle, nom]) => ({ cle, nom })),
    po: (config.po ?? []).map(([cle, nom]) => ({ cle, nom })),
  };
  const etapes = new Map([...config.sm, ...config.membre, ...(config.po ?? [])].map(([cle, nom, et]) => [cle, { nom, et }]));
  const libelleEtape = (cle: string) => etapes.get(cle)?.nom ?? '';
  return <Fenetre p={p} config={config} catalogue={catalogue} etapes={etapes} libelleEtape={libelleEtape} />;
}

function Fenetre({ p, config, catalogue, etapes, libelleEtape }: { p: PropsReunion; config: Config; catalogue: CatalogueParcours; etapes: Map<string, { nom: string; et: Etape }>; libelleEtape: (c: string) => string }) {
  const safe = useSafe();
  const r = useReunion(p, catalogue, { nomCourt: config.nomCourt, libelleEtape });
  const { e } = r;
  const fmt = (n: number) => fmtPoints(n, safe.pointsJours);
  const pi = piOf(e.jour);
  const n = e.niveauIci;
  const features = e.h.featureList.filter((f) => (n?.kind === 'train' ? (f.train ?? '') === n.id : true) && f.pi === pi);
  const epics = e.h.epicList.filter((x) => (n?.kind === 'portfolio' ? x.portfolio === n.id : e.portfolio ? x.portfolio === e.portfolio.id : true));
  const c: Ctx = { r, e, pi, piSuivant: shiftPi(pi, 1), features, epics, fmt };
  const animateur = prenom(e.nomDe(p.reunion.organisateur));
  const [cleAnim, setCleAnim] = useState('');
  const [idx, setIdx] = useState<Record<string, number>>({});
  const [choix, setChoix] = useState<Record<string, string>>({});
  const [vote, setVote] = useState<VoteEtat | undefined>(undefined);
  const [decision, setDecision] = useState<DecisionVote | undefined>(undefined);
  useEffect(() => {
    if (r.anime && r.live.etat?.vote && !vote) setVote(r.live.etat.vote);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.live.etat?.v]);
  const poserVote = (v: VoteEtat | undefined) => {
    setVote(v);
    r.live.publier({ vote: v });
  };
  const listeDe = (cle: string) => {
    const et = etapes.get(cle)?.et;
    return et && et.k === 'elements' ? et.liste(c) : [];
  };
  const elemCourant = (cle: string) => {
    const l = listeDe(cle);
    return l[Math.min(idx[cle] ?? 0, Math.max(0, l.length - 1))];
  };
  const saisiesDe = (cle: string) => r.donneesDe<{ texte: string }>(cle).map((x) => ({ id: x.d.c ?? x.p.id, texte: x.d.texte, par: x.p.personne }));
  const total = (cle: string) => {
    const m = new Map<string, number>();
    for (const x of r.donneesDe<{ l: Record<string, number> }>('budget')) for (const [id, v] of Object.entries(x.d.l ?? {})) m.set(id, (m.get(id) ?? 0) + (Number(v) || 0));
    return saisiesDe(cle).map((d) => ({ ...d, pts: m.get(d.id) ?? 0 })).sort((a, b) => b.pts - a.pts);
  };

  const rendu = (x: EtapeCatalogue, _o: ParcoursRole, lecture: boolean) => {
    const et = etapes.get(x.cle)?.et;
    if (!et) return null;
    const voteVu = lecture || !r.anime ? r.live.etat?.vote : vote;
    switch (et.k) {
      case 'situation':
        return (
          <>
            <TitreFiche icone="📊" titre="Situation" vide="" sous={`${TYPES_REUNION[p.reunion.type].libelle} · ${e.nomNiveau} · PI ${pi}`} />
            <Compteurs l={et.compteurs(c)} />
            <BlocSuivi r={r} lecture={lecture} onAjouter />
            <SectionFiche titre="Objectifs de la réunion">
              <Ligne premiere texte={`🎯 ${et.objectif}`} sous={et.sousObjectif} />
            </SectionFiche>
          </>
        );
      case 'liste':
      case 'mes_elements': {
        const l = et.k === 'liste' ? et.lignes(c) : et.liste(c);
        return (
          <>
            <TitreFiche icone={et.icone} titre={`${et.titre} · ${l.length}`} vide="" sous={et.sous} />
            <SectionFiche titre={et.titre}>{l.length ? l.map((y, i) => <Ligne key={y.id} premiere={i === 0} texte={y.titre} sous={y.sous} pastille={y.pastille ? { texte: y.pastille, ton: 'bleu' } : undefined} />) : <Vide texte="Rien pour l’instant." />}</SectionFiche>
            {et.k === 'liste' && et.points && <BlocPoints r={r} points={r.tous.filter((y) => r.ici(y))} lecture={lecture} stories={[]} />}
            {et.k === 'mes_elements' && <BlocPoints r={r} titre="Mes points" points={r.prep.filter((y) => y.type !== 'donnee')} pourPrep stories={[]} />}
          </>
        );
      }
      case 'elements': {
        const l = et.liste(c);
        if (!l.length) return <Vide texte="Rien à revoir." />;
        const k = lecture ? Math.max(0, l.findIndex((y) => y.id === r.live.etat?.element)) : Math.min(idx[x.cle] ?? 0, l.length - 1);
        const y = l[k];
        return (
          <>
            <Navigation n={l.length} cur={k} onChoisir={lecture ? undefined : (i) => setIdx((m) => ({ ...m, [x.cle]: i }))} aReprendre={new Set(l.map((z, i) => (et.choix && !choix[z.id] && i < k ? i : -1)).filter((i) => i >= 0))} />
            <TitreFiche icone={et.icone} titre={y.titre} vide="" sous={`${et.mot} ${k + 1} sur ${l.length}${y.pastille ? ` · ${y.pastille}` : ''}`} />
            {!!y.sous && (
              <SectionFiche titre="Où en est-on">
                <Ligne premiere texte={y.sous} />
              </SectionFiche>
            )}
            {et.choix && (
              <SectionFiche titre="Décision">
                <View style={{ padding: 12 }}>{lecture ? <Text style={st.texte}>{choix[y.id] || 'À décider'}</Text> : <Pastilles petit options={et.choix.map((z) => ({ value: z, label: z }))} value={choix[y.id] ?? ''} onChange={(z) => setChoix((m) => ({ ...m, [y.id]: z }))} />}</View>
              </SectionFiche>
            )}
            <BlocPoints r={r} points={r.tous.filter((z) => r.ici(z) && z.element === y.id)} lecture={lecture} stories={[]} />
          </>
        );
      }
      case 'points':
        return (
          <>
            <TitreFiche icone={et.icone} titre={et.titre} vide="" sous={et.sous} />
            <BlocPoints r={r} points={r.tous.filter((y) => r.ici(y))} lecture={lecture} stories={[]} placeholder={et.placeholder} />
          </>
        );
      case 'saisies': {
        const l = saisiesDe(et.cle);
        const tour = voteVu?.tour ?? 1;
        const nbv = (id: string) => [...votesDe(r, id, tour).values()].filter(Boolean).length;
        const ouvert = !!voteVu?.ouvert;
        const revele = !!voteVu?.revele;
        const tri = revele ? [...l].sort((a, b) => nbv(b.id) - nbv(a.id)) : l;
        return (
          <>
            <TitreFiche icone={et.icone} titre={`${et.titre} · ${l.length}`} vide="" sous={et.sous} />
            <SectionFiche titre={et.vote ? (revele ? 'Votes révélés' : ouvert ? '🗳️ Vote ouvert · votes cachés' : 'Reçues') : 'Reçues'}>
              {tri.length ? tri.map((y, i) => <Ligne key={y.id} premiere={i === 0} texte={y.texte} sous={`par ${prenom(e.nomDe(y.par))}`} pastille={revele ? { texte: `★ ${nbv(y.id)}`, ton: 'orange' } : undefined} />) : <Vide texte="Rien reçu pour l’instant." />}
              {et.vote && !lecture && r.anime && !!l.length && (
                <View style={{ padding: 12 }}>
                  <Pastilles
                    options={ouvert ? [{ value: 'r', label: '🗳️ Révéler les votes' }, { value: 't', label: '🔁 Relancer le vote' }] : [{ value: 'o', label: revele ? '🔁 Nouveau tour' : '🗳️ Ouvrir le vote' }]}
                    value=""
                    onChange={(v) => poserVote(v === 'r' ? { ...vote!, ouvert: false, revele: true } : v === 't' ? { ...vote!, tour: vote!.tour + 1 } : { ouvert: true, revele: false, tour: revele ? tour + 1 : tour, elements: l.map((y) => y.id) })}
                  />
                </View>
              )}
            </SectionFiche>
            <BlocPoints r={r} points={r.tous.filter((y) => r.ici(y))} lecture={lecture} stories={[]} />
          </>
        );
      }
      case 'confiance':
        return (
          <>
            <TitreFiche icone="🗳️" titre="Vote de confiance" vide="" sous="Le plan du train · cartes 1 à 5 · sous 3, on reprend le plan" />
            <VoteAnimateur r={r} el="confiance" titre="🗳️ Confiance dans le plan du train" valeurs={CARTES_CONFIANCE} vote={voteVu} decision={decision} lecture={lecture} onVote={poserVote} onDecision={setDecision} />
            <BlocPoints r={r} points={r.tous.filter((y) => r.ici(y))} lecture={lecture} stories={[]} placeholder="＋ Pourquoi (vote ≤ 2) : blocage ou action" />
          </>
        );
      case 'budget': {
        const l = total(et.cle);
        const votants = new Set(r.donneesDe('budget').map((y) => y.p.personne)).size;
        return (
          <>
            <TitreFiche icone="🗳️" titre="Vote" vide="" sous={`100 points par participant · ${votants} sur ${e.personnes.length} ont voté`} />
            <SectionFiche titre="Total des points">{l.length ? l.map((y, i) => <Ligne key={y.id} premiere={i === 0} texte={y.texte} sous={`par ${prenom(e.nomDe(y.par))}`} pastille={{ texte: `${y.pts} pts`, ton: i === 0 ? 'vert' : 'bleu' }} />) : <Vide texte="Aucune demande." />}</SectionFiche>
          </>
        );
      }
      case 'concretisation':
        return <EtapeConcretisation r={r} lecture={lecture} iterationCode={`PI ${pi}`} />;
      case 'compte_rendu': {
        const dec = Object.entries(choix);
        return (
          <EtapeCompteRendu
            r={r}
            lecture={lecture}
            iterationCode={`PI ${pi}`}
            entete={
              dec.length || decision ? (
                <SectionFiche titre={`Décisions · ${dec.length + (decision ? 1 : 0)}`}>
                  {decision && <Ligne premiere texte={`Vote de confiance : ${decision.choix === 'retenir' ? decision.val || '—' : 'reporté'}`} />}
                  {dec.map(([id, v], i) => (
                    <Ligne key={id} premiere={!decision && i === 0} texte={[...etapes.values()].map((z) => (z.et.k === 'elements' ? z.et.liste(c).find((q) => q.id === id)?.titre : undefined)).find(Boolean) ?? id} pastille={{ texte: v, ton: 'bleu' }} />
                  ))}
                </SectionFiche>
              ) : undefined
            }
          />
        );
      }
      // ---- Participants ----
      case 'taches':
        return <MesTaches r={r} />;
      case 'notes':
        return (
          <>
            <TitreFiche icone="📝" titre={et.titre ?? 'Mes points'} vide="" sous="Blocages, décisions, actions : ils arrivent chez l’animateur" />
            <BlocPoints r={r} titre={et.titre ?? 'Mes points'} points={r.prep.filter((y) => y.type !== 'donnee')} pourPrep stories={[]} />
          </>
        );
      case 'saisie': {
        const miennes = saisiesDe(et.cle).filter((y) => y.par === r.mail);
        return (
          <>
            <TitreFiche icone={et.icone} titre={et.titre} vide="" sous={et.sous} />
            <ListeEditable
              titre={et.titre}
              l={miennes.map((y) => y.texte)}
              onChange={(l) => {
                for (const y of miennes) if (!l.includes(y.texte)) r.poserDonnee(et.cle, y.id, null);
                const nouvelle = l.find((t) => !miennes.some((y) => y.texte === t));
                if (nouvelle) r.poserDonnee(et.cle, `${Date.now()}`, { texte: nouvelle });
              }}
              placeholder={et.placeholder}
            />
          </>
        );
      }
      case 'voter_confiance':
        return (
          <>
            <TitreFiche icone="🗳️" titre="Vote de confiance" vide="" sous={`Quand ${animateur} ouvre le vote`} />
            <VoteParticipant r={r} el="confiance" valeurs={CARTES_CONFIANCE} vote={r.live.etat?.vote} animateur={animateur} titre="🗳️ Votre confiance dans le plan du train" />
          </>
        );
      case 'voter_etoiles': {
        const l = saisiesDe(et.cle);
        return (
          <>
            <TitreFiche icone="🗳️" titre="Voter" vide="" sous={r.live.etat?.vote?.ouvert ? `Vote ouvert par ${animateur}` : 'En attente de l’ouverture du vote'} />
            <VoteEtoiles r={r} elements={l.map((y) => ({ id: y.id, texte: y.texte, sous: `par ${prenom(e.nomDe(y.par))}` }))} vote={r.live.etat?.vote} animateur={animateur} />
          </>
        );
      }
      case 'voter_budget':
        return <VoteBudget r={r} demandes={saisiesDe(et.cle)} />;
      default:
        return null;
    }
  };

  const envoyerCR = async () => {
    const dec = Object.entries(choix);
    // Revue du portfolio : l'état décidé de chaque epic (une écriture groupée)
    await r.envoyerCompteRendu({
      iteration: '',
      lignes: [
        ...(decision ? [`Vote de confiance : ${decision.choix === 'retenir' ? decision.val : 'reporté'}`] : []),
        ...dec.map(([id, v]) => `${[...etapes.values()].map((z) => (z.et.k === 'elements' ? z.et.liste(c).find((q) => q.id === id)?.titre : undefined)).find(Boolean) ?? id} : ${v}`),
      ],
    });
  };
  const cleEl = [...etapes.entries()].find(([k, v]) => k === cleAnim && v.et.k === 'elements')?.[0];
  const el = cleEl ? elemCourant(cleEl) : undefined;
  const nEl = cleEl ? listeDe(cleEl).length : 0;
  const motEl = cleEl ? (etapes.get(cleEl)!.et as { mot: string }).mot : '';
  return (
    <FenetreEquipe
      p={p}
      r={r}
      catalogue={catalogue}
      rendu={rendu}
      libelleFin={(o) => (o.role === 'po' ? `Envoyer à ${animateur}` : `Envoyer à ${animateur}`)}
      etapeAnim={{ cle: cleAnim, setCle: setCleAnim, element: el?.id ?? '', detail: el ? `${motEl} ${(idx[cleAnim] ?? 0) + 1} sur ${nEl} · ${el.titre}` : '' }}
      onSuivant={(role, cle) => {
        if (role !== 'sm' || etapes.get(cle)?.et.k !== 'elements') return false;
        const i = idx[cle] ?? 0;
        if (i < listeDe(cle).length - 1) return (setIdx((m) => ({ ...m, [cle]: i + 1 })), true);
        return false;
      }}
      libelleSuivant={(role, cle) => {
        const et = etapes.get(cle)?.et;
        if (role !== 'sm' || et?.k !== 'elements') return undefined;
        const i = idx[cle] ?? 0;
        return i < listeDe(cle).length - 1 ? `${et.mot} suivant${et.mot === 'Feature' ? 'e' : ''} ›` : undefined;
      }}
      envoyerCR={envoyerCR}
      renduCR={(rid) => <EtapeCompteRendu r={r} lecture reunionId={rid} iterationCode={`PI ${pi}`} />}
    />
  );
}

/** Budget participatif : 100 points à répartir entre les demandes ; envoyé avec « Envoyer » */
function VoteBudget({ r, demandes }: { r: R; demandes: { id: string; texte: string; par: string }[] }) {
  const mien = r.donneesDe<{ l: Record<string, number> }>('budget').find((x) => x.p.personne === r.mail)?.d.l ?? {};
  const [saisie, setSaisie] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(mien).map(([k, v]) => [k, String(v)])));
  const somme = Object.values(saisie).reduce((s, v) => s + (lireNombre(v) || 0), 0);
  const poser = (id: string, v: string) => {
    const n = { ...saisie, [id]: v };
    setSaisie(n);
    r.poserDonnee('budget', 'budget', { l: Object.fromEntries(Object.entries(n).map(([k, x]) => [k, lireNombre(x) || 0])) });
  };
  return (
    <>
      <TitreFiche icone="🗳️" titre="Mon vote" vide="" sous="100 points à répartir · envoyé avec « Envoyer »" />
      <SectionFiche titre={`Reste : ${100 - somme} point${Math.abs(100 - somme) > 1 ? 's' : ''}`}>
        {demandes.map((d, i) => (
          <View key={d.id} style={[st.ligne, i > 0 && st.bord]}>
            <View style={st.corps}>
              <Text style={st.texte}>{d.texte}</Text>
            </View>
            <TextInput value={saisie[d.id] ?? ''} onChangeText={(v) => poser(d.id, v)} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.muted} style={[st.note, { width: 60, textAlign: 'center' }]} accessibilityLabel={`Points pour ${d.texte}`} />
          </View>
        ))}
        {!demandes.length && <Vide texte="Aucune demande pour l’instant." />}
      </SectionFiche>
      {somme > 100 && <Text style={[st.sous, { color: colors.danger, marginHorizontal: 16 }]}>Plus de 100 points : retirez-en {somme - 100}.</Text>}
    </>
  );
}
