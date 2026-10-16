import type { Conge, CoutPersonne, DemandeBudget, Depense, DossierInvestissement, Enveloppe } from './types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addDays, toDateString } from './dates';
import { jourMois } from './format';
import { iterationOf, piOf, piStart, shiftIteration, shiftPi } from './pi';
import { FILTRE_TOUT, photoDe, pointsPhoto } from './avancement';
import { estOuvre, occurrences } from './series';
import { clePlanPerso } from './daily';
import { serieParDefaut, serieVide } from './reunions';
import { PIECES_DEMO } from './demoPieces';
import { controleMorceau, creerMagasin, type Kind, type Persistance, type Table, TABLES, TABLES_ORG } from './magasin';
import { CLE_ORG, type KindOrg, type Org } from './organisation';
import { type TypeReunion, RECURRENCE_DEFAUTS, type Domaine, type Epic, type Feature, type Ignoree, type Item, type Objectif, type ObjectifPI, type PointReunion, type ResultatCle, type ValueStream, type Echange } from './types';

/**
 * Mode démo : données d'exemple enregistrées sur l'appareil, sans Google Sheet. Sert à essayer l'application.
 * - version démo compilée (EXPO_PUBLIC_DEMO=1) : toujours en démo ;
 * - version principale : bouton « 🧪 Mode démo » du menu du compte, désactivé par défaut (retenu sur l'appareil,
 *   l'application se recharge). Les données d'exemple seront retirées à la mise en production.
 * En démo, tout ce que l'application garde sur l'appareil est rangé à part (clés préfixées « demo~ ») : vos
 * vraies données et vos réglages ne sont jamais mélangés avec ceux de la démo.
 */
const DEMO_COMPILE = process.env.EXPO_PUBLIC_DEMO === '1';
const MODE_DEMO_KEY = 'president:mode-demo';
/**
 * Démo dans la version publiée (08/10) : lien « …/safe/?demo » ou bouton « 🧪 Essayer la démo » (écran de
 * connexion, menu du compte) ; « ?demo=0 » ou « Quitter la démo » revient à vos vraies données. Retenu sur l'appareil.
 */
function lireModeDemo(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const q = new URLSearchParams(window.location?.search ?? '');
    if (q.has('demo')) {
      if (q.get('demo') === '0') window.localStorage?.removeItem(MODE_DEMO_KEY);
      else window.localStorage?.setItem(MODE_DEMO_KEY, '1');
    }
    return window.localStorage?.getItem(MODE_DEMO_KEY) === '1';
  } catch {
    return false;
  }
}
/** Démo : version compilée pour les tests, ou demandée dans le navigateur (lien « ?demo », bouton) */
export const DEMO = DEMO_COMPILE || lireModeDemo();
/** Démo : votre adresse (auteur et destinataire des échanges) */
export const MOI_DEMO = 'vous@demo';
/** Démo · « Vous · tous les rôles » : votre fiche, dans chaque entreprise de la démo */
export const ID_VOUS_DEMO = 'vous-demo';
/**
 * Organisation vue par « Vous » dans la démo : SM et PO de chaque équipe, RTE et PM de chaque train, Epic Owner de
 * chaque portfolio, responsable de la direction (toutes les réunions en animateur). Les anciens SM et PO restent membres de leur équipe.
 */
export function orgTousLesRoles(o: Org): Org {
  const espaces = [...new Set([...o.equipes, ...o.trains, ...o.portfolios].map((x) => x.espace || 'moi'))];
  const idDe = (esp: string) => `${ID_VOUS_DEMO}-${esp}`;
  const vous = espaces
    .filter((esp) => !o.personnes.some((p) => p.id === idDe(esp)))
    .map((esp) => ({ espace: esp, id: idDe(esp), nom: 'Vous (tous les rôles)', email: MOI_DEMO, unite: '', manager: '', capacite: '', metier: 'SM', cree_le: '', modifie_le: '', nature: 'humain' }) as Org['personnes'][number]);
  return {
    ...o,
    personnes: [...o.personnes, ...vous],
    equipes: o.equipes.map((e) => {
      const id = idDe(e.espace || 'moi');
      const membres = [...new Set([id, e.sm, e.po, ...(e.membres ? e.membres.split(';') : [])].filter(Boolean))].join(';');
      return { ...e, sm: id, po: id, membres };
    }),
    trains: o.trains.map((t) => ({ ...t, rte: idDe(t.espace || 'moi'), pm: idDe(t.espace || 'moi') })),
    portfolios: o.portfolios.map((p) => ({ ...p, epic_owner: idDe(p.espace || 'moi') })),
    // Démo complète (15/10) : aussi responsable de la direction de premier niveau (anime le Comité budgétaire)
    unites: o.unites.map((u) => (u.parent ? u : { ...u, responsable: idDe(u.espace || 'moi') })),
  };
}
/** Boutons « 🧪 Essayer la démo » / « Quitter la démo » : dans le navigateur, hors version démo compilée */
export const DEMO_BASCULABLE = !DEMO_COMPILE && typeof window !== 'undefined' && !!window.localStorage;
export function changerModeDemo(actif: boolean) {
  try {
    if (actif) window.localStorage.setItem(MODE_DEMO_KEY, '1');
    else window.localStorage.removeItem(MODE_DEMO_KEY);
    // Recharge sans « ?demo » dans l'adresse (sinon il remettrait le mode)
    window.location.replace(window.location.pathname);
  } catch {
    /* navigateur sans stockage : on reste dans le mode actuel */
  }
}

/**
 * Hors démo, une seule fois : efface de l'appareil les restes des anciennes démos, qui partageaient les mêmes
 * emplacements que vos données (copies des tâches, epics, Organisation, espaces d'exemple). Vos vraies données
 * sont relues depuis vos Google Sheets : rien n'est perdu.
 */
export async function purgerRestesDemo(): Promise<boolean> {
  const FAIT = 'president:purge-demo-2';
  try {
    if (DEMO || (await AsyncStorage.getItem(FAIT))) return false;
    // Anciennes démos (clés partagées), démo rangée à part (« demo~… ») et interrupteur de démo retiré
    const cles = (await AsyncStorage.getAllKeys()).filter(
      (k) =>
        k.startsWith('mes-taches:demo') ||
        k.startsWith('demo~') ||
        ['mes-taches:cache', 'mes-taches:cache-epics', 'president:org-cache', 'president:messages-app', 'president:purge-demo-1'].includes(k),
    );
    await AsyncStorage.multiRemove(cles);
    await AsyncStorage.setItem(FAIT, '1');
    return true;
  } catch {
    return false;
  }
}

// Démo (15/10) : onglet resté ouvert, la date change (minuit passé, retour sur un onglet de la veille) → la page se
// recharge, et les données sont recréées pour le jour (règle de l'ouverture, checkVersion). Seulement en démo.
if (DEMO && typeof window !== 'undefined' && typeof document !== 'undefined' && typeof window.addEventListener === 'function') {
  const jourCharge = toDateString(new Date());
  const verifierJour = () => {
    if (toDateString(new Date()) !== jourCharge) window.location.reload();
  };
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && verifierJour());
  window.addEventListener('focus', verifierJour);
  setInterval(verifierJour, 60_000);
}

// Démo : clés de l'appareil rangées à part (sauf celles du fil d'échange, communes aux deux modes)
if (DEMO) {
  const P = 'demo~';
  const commune = (k: string) => k.startsWith('president:echange');
  const cle = (k: string) => (commune(k) ? k : P + k);
  const a = AsyncStorage as unknown as Record<string, (...x: never[]) => Promise<unknown>>;
  const o = Object.fromEntries(
    ['getItem', 'setItem', 'removeItem', 'mergeItem', 'multiGet', 'multiSet', 'multiRemove', 'getAllKeys'].map((m) => [m, a[m].bind(AsyncStorage)]),
  ) as Record<string, (...x: unknown[]) => Promise<unknown>>;
  a.getItem = ((k: string) => o.getItem(cle(k))) as never;
  a.setItem = ((k: string, v: string) => o.setItem(cle(k), v)) as never;
  a.removeItem = ((k: string) => o.removeItem(cle(k))) as never;
  a.mergeItem = ((k: string, v: string) => o.mergeItem(cle(k), v)) as never;
  // Opérations groupées (15/10) : une par clé, avec les fonctions d'origine — celles du navigateur rappellent
  // getItem / setItem / removeItem, déjà préfixés ici : le préfixe était ajouté deux fois (rien n'était effacé)
  a.multiGet = (async (ks: string[]) => Promise.all(ks.map(async (k) => [k, (await o.getItem(cle(k))) as string | null]))) as never;
  a.multiSet = (async (l: [string, string][]) => void (await Promise.all(l.map(([k, v]) => o.setItem(cle(k), v))))) as never;
  a.multiRemove = (async (ks: string[]) => void (await Promise.all(ks.map((k) => o.removeItem(cle(k)))))) as never;
  a.getAllKeys = (async () => ((await o.getAllKeys()) as string[]).flatMap((k) => (k.startsWith(P) ? [k.slice(P.length)] : commune(k) ? [k] : []))) as never;
}

const KEY = 'mes-taches:demo';
/**
 * Version des données d'exemple : à augmenter quand leur forme change (nouveaux champs, nouveaux niveaux).
 * Des données enregistrées par une version plus ancienne de la démo sont remplacées par les nouvelles.
 */
const DEMO_DATA_VERSION = '67';
const VERSION_KEY = `${KEY}-version`;
let versionChecked: Promise<void> | null = null;

function checkVersion(): Promise<void> {
  versionChecked ??= (async () => {
    try {
      // Règle (15/10) : les données de la démo sont celles du jour ; créées un autre jour (ou par une autre version),
      // elles sont recréées à l'ouverture (ce qui a été modifié la veille est effacé ; un onglet resté ouvert garde les
      // siennes jusqu'au rechargement automatique au changement de date, plus haut)
      const marque = `${DEMO_DATA_VERSION}|${toDateString(new Date())}`;
      if ((await AsyncStorage.getItem(VERSION_KEY)) === marque) return;
      // Données de tous les espaces de la démo (clés « mes-taches:demo… ») et copies d'affichage de la démo (rangées à
      // part, « demo~ ») : rien de la veille ne s'affiche
      const cles = (await AsyncStorage.getAllKeys()).filter((k) => (k.startsWith(KEY) || ['mes-taches:cache', 'mes-taches:cache-epics', 'president:org-cache'].includes(k)) && k !== VERSION_KEY);
      await AsyncStorage.multiRemove(cles);
      await AsyncStorage.setItem(VERSION_KEY, marque);
    } catch {
      // Stockage indisponible : la démo repart des exemples en mémoire.
    }
    // Démo complète (15/10) : plan du Point perso de ce matin (gardé sur l'appareil), s'il n'a pas encore été fait —
    // le Bilan du soir montre « Prévu ce matin »
    try {
      const cleP = clePlanPerso(toDateString(new Date()));
      if (!(await AsyncStorage.getItem(cleP))) await AsyncStorage.setItem(cleP, JSON.stringify(['d3', 'd18', 'd2']));
    } catch {
      // Stockage indisponible : la démo repart des exemples en mémoire.
    }
  })();
  return versionChecked;
}

function sample(): Item[] {
  const now = new Date();
  const d = (n: number) => toDateString(addDays(now, n));
  const stamp = now.toISOString();
  const pi2 = shiftPi(piOf(now), 1);
  const mk = (id: string, titre: string, type: Item['type'], date: string, heure: string, extra: Partial<Item> = {}): Item => ({
    id, titre, type, date, heure, heure_fin: '', date_fin: '', termine_le: '', statut_avant: '', lieu: '', description: '', priorite: 'normale', statut: 'a_faire',
    cree_le: stamp, modifie_le: stamp, periodicite: '', echeance: '', debut: '', fin: '', faits: '', epic: '', objectif: '', domaine: '',
    points: '', iteration: '', feature: '', telephone: '', parent: '', ...extra,
  });
  return [
    mk('d1', 'Rendez-vous client Dupont', 'rendez-vous', d(2), '10:30', {
      heure_fin: '11:30',
      epic: 'e2',
      lieu: '12 rue de Paris, Lyon', description: 'Présenter le devis et prendre les mesures', priorite: 'haute',
    }),
    mk('d2', 'Préparer le rapport de mission', 'mission', d(3), '', {
      epic: 'e2',
      description: 'Rassembler les photos et les heures du chantier', statut: 'en_cours',
    }),
    mk('d3', 'Appeler le fournisseur', 'tache', d(0), '09:00', { points: '1' }),
    // SAFe : tâches de la feature « Maquettes des pages », dans l'itération en cours
    mk('d18', 'Maquette de la page d\'accueil', 'tache', d(1), '', { feature: 'f1', points: '3', statut: 'en_cours' }),
    mk('d19', 'Maquette de la page contact', 'tache', '', '', { feature: 'f1', points: '2', iteration: iterationOf(now).key }),
    mk('d20', 'Choisir la palette de couleurs', 'tache', d(-1), '', { feature: 'f1', points: '1', statut: 'termine' }),
    // Nouveaux types (v7)
    mk('d21', 'Appeler le plombier', 'appel', d(0), '11:00', {
      telephone: '06 12 34 56 78', domaine: 'dperso', description: 'Fuite sous l’évier : demander un rendez-vous cette semaine',
    }),
    // Date de fin (v12) : la carte expire dans 40 jours
    mk('d22', 'Renouveler la carte d’identité', 'demarche', d(10), '', {
      date_fin: d(40),
      domaine: 'dperso', description: 'Prendre rendez-vous en mairie, photo d’identité, justificatif de domicile',
    }),
    mk('d23', 'En tant que client, je vois les tarifs en ligne', 'story', '', '', { feature: 'f3', points: '3' }),
    // Sous-tâches (v8) : la démarche « carte d'identité » et la story « tarifs » (5 j de sous-tâches pour 3 j → alerte)
    mk('d26', 'Faire les photos d’identité', 'tache', d(-3), '', { parent: 'd22', domaine: 'dperso', statut: 'termine' }),
    mk('d27', 'Appeler la mairie pour un rendez-vous', 'appel', d(0), '10:00', { parent: 'd22', domaine: 'dperso', telephone: '01 23 45 67 89' }),
    mk('d28', 'Déposer le dossier en mairie', 'tache', d(18), '', { parent: 'd22', domaine: 'dperso' }),
    mk('d29', 'Rédiger les textes des tarifs', 'tache', '', '', { parent: 'd23', feature: 'f3', points: '1', statut: 'termine', iteration: `${pi2}-IT4` }),
    mk('d30', 'Mettre en page la grille', 'tache', '', '', { parent: 'd23', feature: 'f3', points: '2', iteration: `${pi2}-IT4` }),
    mk('d31', 'Relire et publier', 'tache', '', '', { parent: 'd23', feature: 'f3', points: '2', iteration: `${pi2}-IT5` }),
    mk('d24', 'Comparer 3 outils de prise de rendez-vous', 'exploration', '', '', { feature: 'f3', points: '1' }),
    mk('d25', 'Le formulaire de contact n’envoie rien', 'bug', d(1), '', { epic: 'e1', priorite: 'haute', points: '1' }),
    // Alerte « rendez-vous qui se chevauchent » : même jour que le RDV Dupont (10:30)
    mk('d32', 'Rendez-vous banque', 'rendez-vous', d(2), '11:00', { heure_fin: '11:45', domaine: 'dperso', lieu: 'Agence du centre' }),
    mk('d4', 'Réunion équipe', 'rendez-vous', d(0), '14:00', { heure_fin: '15:30', lieu: 'Bureau' }),
    mk('d5', 'Chantier Martin', 'mission', d(-1), '08:00', { heure_fin: '12:00', lieu: 'Villeurbanne' }),
    mk('d6', 'Envoyer les factures', 'tache', d(-2), '', { statut: 'termine', epic: 'e1' }),
    mk('d7', 'Visite du dépôt', 'mission', d(8), '11:00', { heure_fin: '12:30', epic: 'e3' }),
    // Date de fin dans 2 jours → rappel « doit être finie dans 2 jours »
    mk('d34', 'Envoyer l’attestation d’assurance', 'demarche', '', '', { date_fin: d(2), domaine: 'dperso' }),
    // Epic « Salon professionnel » à l'état Prêt, mais une tâche est déjà faite → alerte du Portefeuille
    mk('d35', 'Réserver le stand', 'tache', d(-5), '', { epic: 'e2', statut: 'termine' }),
    // Chevauche la fin de la visite du dépôt (mission ↔ rendez-vous)
    mk('d33', 'Déjeuner fournisseur', 'rendez-vous', d(8), '12:00', { heure_fin: '13:30', domaine: 'dpro', lieu: 'Restaurant du port' }),
    mk('d8', 'Dentiste', 'rendez-vous', d(15), '17:30', { heure_fin: '18:00', domaine: 'dsante' }),
    mk('d40', 'Préparer l’anniversaire de Léa', 'tache', d(6), '', { domaine: 'dfamille' }),
    mk('d41', 'Cours de guitare', 'rendez-vous', d(4), '19:00', { heure_fin: '20:00', domaine: 'dloisirs' }),
    mk('d9', 'Commander le matériel', 'tache', d(1), '', { priorite: 'haute', epic: 'e3', points: '2' }),
    mk('d10', 'Relancer le devis Bernard', 'tache', '', '', { epic: 'e1' }),
    // Éléments répétés (débutent il y a deux mois pour montrer les retards à rattraper)
    mk('d11', 'Payer le loyer', 'tache', '', '', {
      domaine: 'dperso',
      periodicite: 'mensuelle', echeance: '5', priorite: 'haute', debut: toDateString(new Date(now.getFullYear(), now.getMonth() - 2, 1)),
      faits: toDateString(new Date(now.getFullYear(), now.getMonth() - 2, 1)).slice(0, 7),
    }),
    mk('d16', 'Mise en ligne du nouveau site', 'mission', d(110), '09:00', { epic: 'e1', priorite: 'haute' }),
    mk('d12', 'Faire les comptes du mois', 'tache', '', '', { periodicite: 'mensuelle', epic: 'e5' }),
    mk('d13', 'Point hebdo équipe', 'rendez-vous', '', '10:00', { heure_fin: '10:30', periodicite: 'hebdomadaire', echeance: '1', lieu: 'Visio', domaine: 'dpro' }),
    mk('d17', 'Appeler 10 prospects', 'tache', d(5), '', { objectif: 'o1' }),
    mk('d14', 'Déclaration de TVA', 'mission', '', '', { periodicite: 'trimestrielle' }),
    mk('d15', 'Renouveler l\'assurance', 'tache', '', '', {
      domaine: 'dperso',
      periodicite: 'annuelle', echeance: String(now.getMonth() + 1).padStart(2, '0'),
    }),
    ...historique(now, mk),
  ];
}

/**
 * Historique : tâches terminées il y a 4 à 18 mois (une ou deux par mois), pour essayer l'alerte de stockage
 * (« Supprimer les tâches terminées avant … »).
 */
function historique(now: Date, mk: (id: string, titre: string, type: Item['type'], date: string, heure: string, extra?: Partial<Item>) => Item): Item[] {
  const titres = ['Bilan du mois', 'Relancer les factures impayées', 'Classer les justificatifs', 'Mettre à jour le site'];
  const out: Item[] = [];
  for (let m = 18; m >= 4; m--) {
    for (let k = 0; k < (m % 3 === 0 ? 2 : 1); k++) {
      const jour = toDateString(new Date(now.getFullYear(), now.getMonth() - m, 8 + 10 * k));
      out.push(
        mk(`h${m}-${k}`, titres[(m + k) % titres.length], 'tache', jour, '', {
          statut: 'termine',
          termine_le: jour,
          domaine: k ? 'dperso' : 'dpro',
          description: 'Tâche terminée (historique de la démo) : compte rendu, pièces jointes et remarques de suivi.',
        }),
      );
    }
  }
  return out;
}

function sampleEntities(): {
  epic: Epic[];
  objectif: Objectif[];
  domaine: Domaine[];
  feature: Feature[];
  objectifpi: ObjectifPI[];
  ignoree: Ignoree[];
  valuestream: ValueStream[];
  resultat: ResultatCle[];
  echange: Echange[];
} {
  const now = new Date();
  const m = (months: number, day = 1) => toDateString(new Date(now.getFullYear(), now.getMonth() + months, day));
  const stamp = now.toISOString();
  const base = { cree_le: stamp, modifie_le: stamp };
  const dom = (id: string, nom: string, icone: string, couleur: string, parent = ''): Domaine => ({ id, nom, icone, couleur, parent, ...base });
  const obj = (id: string, titre: string, domaine: string, debut: string, fin: string, couleur: string, extra: Partial<Objectif> = {}): Objectif => ({
    id, titre, domaine, debut, fin, couleur, description: '', cible: '', actuel: '', unite: '', ...base, ...extra,
  });
  const ep = (id: string, titre: string, debut: string, fin: string, couleur: string, links: Partial<Epic>, description = ''): Epic => ({
    id, titre, description, debut, fin, couleur, objectif: '', domaine: '', etat: '', ...base, ...links,
  });
  // SAFe : PI en cours et suivant, itération en cours
  const pi = piOf(now);
  const pi2 = shiftPi(pi, 1);
  const it = iterationOf(now).key;
  const feat = (id: string, titre: string, epic: string, fpi: string, iteration: string, points: string): Feature => ({
    id, titre, description: '', epic, pi: fpi, iteration, points, couleur: '', ...base,
  });
  const opi = (id: string, titre: string, opiPi: string, type: ObjectifPI['type'], prevue: string, obtenue = '', domaine = 'dpro', epic = ''): ObjectifPI => ({
    id, titre, pi: opiPi, type, valeur_prevue: prevue, valeur_obtenue: obtenue, domaine, epic, ...base,
  });
  return {
    domaine: [
      dom('dpro', 'Pro', '💼', '#1A73E8'),
      dom('dperso', 'Perso', '🏠', '#188038'),
      dom('dsante', 'Santé', '🩺', '#D93025', 'dperso'),
      dom('dprojets', 'Projets', '📁', '#1967D2', 'dpro'),
      dom('dtravail', 'Travail', '🛠️', '#0B57D0', 'dpro'),
      dom('dfamille', 'Famille', '👪', '#E37400'),
      dom('dloisirs', 'Loisirs', '🎨', '#8E24AA'),
    ],
    objectif: [
      obj('o1', 'Doubler le nombre de clients', 'dpro', m(-2), m(3, 0), '#1A73E8', { cible: '20', actuel: '8', unite: 'clients' }),
      obj('o2', 'Certification ISO 9001', 'dpro', m(4), m(15, 0), '#5E35B1'),
      obj('o3', 'Tenir ses comptes à jour', 'dperso', m(-6), '', '#E37400', { description: 'Objectif permanent' }),
    ],
    epic: [
      ep('e1', 'Refonte du site web', m(-1), m(4, 0), '#1A73E8', { objectif: 'o1', okrs: 'o2', etat: 'en_cours' }, 'Nouveau site vitrine et prise de rendez-vous en ligne'),
      ep('e2', 'Salon professionnel', m(0, 15), m(2, 10), '#E37400', { objectif: 'o1', etat: 'pret' }, 'Stand, supports et rendez-vous clients'),
      ep('e3', "Déménagement de l'entrepôt", m(-3), m(1, 15), '#8E24AA', { domaine: 'dpro', etat: 'en_cours' }),
      ep('e6', 'Application mobile clients', m(6), m(12, 0), '#C2185B', { domaine: 'dpro', etat: 'idee' }),
      ep('e7', 'Nouveau fournisseur', m(2), m(5, 0), '#5E35B1', { domaine: 'dpro', etat: 'analyse' }),
      ep('e4', 'Audit et procédures qualité', m(5), m(14, 0), '#188038', { objectif: 'o2', etat: 'idee' }, 'Audit, procédures et formation'),
      ep('e5', 'Gestion courante', m(-2), '', '#00897B', { objectif: 'o3', etat: 'en_cours' }, 'Epic sans fin : tâches répétées du quotidien'),
    ],
    feature: [
      feat('f1', 'Maquettes des pages', 'e1', pi, it, '5'),
      feat('f2', 'Développement du site', 'e1', pi2, `${pi2}-IT2`, '13'),
      feat('f3', 'Prise de rendez-vous en ligne', 'e1', pi2, `${pi2}-IT4`, '8'),
      feat('f4', 'Stand et supports', 'e2', pi2, `${pi2}-IT1`, '5'),
    ],
    objectifpi: [
      opi('p1', 'Maquettes validées par 3 clients', pi, 'engage', '8', '6', 'dpro', 'e1'),
      opi('p2', 'Nouveau site en ligne', pi2, 'engage', '10'),
      opi('p3', 'Prise de rendez-vous en ligne', pi2, 'bonus', '6'),
      opi('p4', 'Stand prêt pour le salon', pi2, 'engage', '7', '', 'dpro', 'e2'),
      opi('p5', 'Comptes du trimestre clôturés', pi, 'engage', '5', '5', 'dperso'),
      opi('p6', 'Déclaration de TVA sans retard', pi2, 'engage', '6', '', 'dperso'),
    ],
    ignoree: [],
    valuestream: [],
    resultat: [],
    echange: [],
  };
}

type Seeds = { items: () => Item[]; entities: () => ReturnType<typeof sampleEntities>; org?: () => Org; points?: () => PointReunion[]; budget?: () => { depense: Depense[]; cout: CoutPersonne[]; demande: DemandeBudget[]; dossier?: DossierInvestissement[]; enveloppe?: Enveloppe[] }; conges?: () => Conge[] };

/**
 * Stockage d'un espace de la démo (« moi » : clés historiques ; autres : « mes-taches:demo@<espace> »), avec
 * les mêmes règles que les Google Sheets (magasin commun).
 */
function creerStore(espace: string, seeds: Seeds) {
  const key = espace === 'moi' ? KEY : `${KEY}@${espace}`;
  const memoire: Partial<Record<Table, unknown[]>> = {};
  const cle = (t: Table) => (t === 'items' ? key : `${key}-${t}`);
  // Démo dans le navigateur : une autre fenêtre (une autre personne, « Voir en tant que ») qui écrit dans le même
  // stockage fait relire l'onglet concerné à la prochaine lecture, comme un Google Sheet modifié par quelqu'un d'autre
  // (« ↻ Actualiser » d'une réunion le montre)
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function')
    window.addEventListener('storage', (ev) => {
      // Clés rangées à part en démo (« demo~… »)
      for (const t of Object.keys(memoire) as Table[]) if (ev.key === null || ev.key === cle(t) || ev.key.endsWith(`~${cle(t)}`)) delete memoire[t];
    });
  const exemples = (t: Table): unknown[] =>
    t === 'depense' || t === 'cout' || t === 'demande' || t === 'dossier' || t === 'enveloppe' ? (seeds.budget?.()[t] ?? []) : t === 'conge' ? (seeds.conges?.() ?? []) : t === 'joursreels' ? [] : t === 'items' ? seeds.items() : t === 'pointreunion' ? (seeds.points?.() ?? []) : TABLES_ORG.includes(t as KindOrg) ? (seeds.org?.()[CLE_ORG[t as KindOrg]] ?? []) : (seeds.entities()[t as Kind] ?? []);

  const persistance: Persistance = {
    async lire(t) {
      if (!memoire[t]) {
        await checkVersion();
        try {
          const raw = await AsyncStorage.getItem(cle(t));
          memoire[t] = raw ? JSON.parse(raw) : exemples(t);
        } catch {
          memoire[t] = exemples(t);
        }
      }
      return [...(memoire[t] as never[])];
    },
    async ecrire(t, rows) {
      memoire[t] = rows;
      try {
        await AsyncStorage.setItem(cle(t), JSON.stringify(rows));
      } catch {
        // Stockage indisponible (navigation privée) : la démo reste en mémoire.
      }
    },
  };

  return {
    ...creerMagasin(persistance),
    async reset(): Promise<void> {
      for (const t of [...TABLES, ...TABLES_ORG, 'pointreunion' as const]) await persistance.ecrire(t, exemples(t) as never);
      await persistance.ecrire('ignoree', []);
    },
  };
}

// ---------------------------------------------------------------------------
// Exemples des autres espaces de la démo : une équipe « Mobile », une entreprise « ACME »
// ---------------------------------------------------------------------------
const vide = () => ({ epic: [], objectif: [], domaine: [], feature: [], objectifpi: [], ignoree: [], valuestream: [], resultat: [], echange: [] }) as ReturnType<typeof sampleEntities>;
const exemple = (prefix: string, liste: [string, Item['type'], number, Partial<Item>][]): Item[] => {
  const now = new Date();
  const stamp = now.toISOString();
  return liste.map(([titre, type, jour, extra], k) => ({
    ...RECURRENCE_DEFAUTS,
    id: `${prefix}${k + 1}`, titre, type, date: jour === 999 ? '' : toDateString(addDays(now, jour)), heure: '', heure_fin: '', date_fin: '', termine_le: '', statut_avant: '',
    lieu: '', description: '', priorite: 'normale', statut: 'a_faire', cree_le: stamp, modifie_le: stamp, ...extra,
  }));
};
const SANS_DATE = 999;

const SEEDS_EQUIPE: Seeds = {
  items: () =>
    exemple('mob', [
      ['En tant qu’utilisateur, je me connecte avec Google', 'story', 2, { feature: 'mobf1', points: '3', statut: 'en_cours' }],
      ['En tant qu’utilisateur, je reçois une notification', 'story', SANS_DATE, { feature: 'mobf1', points: '5', iteration: iterationOf(new Date()).key }],
      ['L’écran de connexion plante sur Android 12', 'bug', 1, { epic: 'mobe1', points: '2', priorite: 'haute' }],
      ['Étudier les notifications push', 'exploration', 6, { epic: 'mobe1', points: '1' }],
    ]),
  entities: () => {
    const e = vide();
    const stamp = new Date().toISOString();
    const base = { cree_le: stamp, modifie_le: stamp };
    const now = new Date();
    const m = (n: number) => toDateString(new Date(now.getFullYear(), now.getMonth() + n, 1));
    // Domaine copié de Moi à la création de l'espace
    e.domaine = [{ id: 'mobdpro', nom: 'Pro', icone: '💼', couleur: '#1A73E8', parent: '', ...base }];
    e.epic = [{ id: 'mobe1', titre: 'Application mobile v2', description: '', debut: m(-1), fin: m(3), couleur: '#C2185B', objectif: '', domaine: 'mobdpro', etat: 'en_cours', ...base }];
    e.feature = [{ id: 'mobf1', titre: 'Connexion et notifications', description: '', epic: 'mobe1', pi: piOf(now), iteration: iterationOf(now).key, points: '8', couleur: '', ...base }];
    // Échanges en cours avec des collègues (onglet Echanges)
    const ech = (id: string, x: Partial<Echange>): Echange => ({ id, de: '', a: '', type: 'message', titre: '', texte: '', choix: '', reponse: '', note: '', statut: 'envoye', element: '', niveau: '', transmis_par: '', prive: '1', ...base, ...x });
    e.echange = [
      ech('mobx1', { de: 'lea.martin@mobile.example', a: MOI_DEMO, type: 'question', titre: 'Livrer la v2 en deux fois ?', texte: 'Connexion d’abord, notifications ensuite : on gagne trois semaines.', choix: 'Oui, deux livraisons;Non, une seule;Autre', element: 'mobe1' }),
      ech('mobx2', { de: 'hugo.petit@mobile.example', a: MOI_DEMO, titre: 'Maquette prête', texte: 'La maquette de l’écran de connexion est prête, je l’ai mise dans la feature.' }),
      ech('mobx3', { de: MOI_DEMO, a: 'lea.martin@mobile.example', type: 'question', titre: 'Revue de sprint jeudi ou vendredi ?', choix: 'Jeudi;Vendredi', statut: 'repondu', reponse: 'Jeudi', note: 'À 10 h, salle Atlas.' }),
      ech('mobx4', { de: MOI_DEMO, a: 'hugo.petit@mobile.example', titre: 'Bug Android 12', texte: 'Peux-tu regarder le plantage de l’écran de connexion ?' }),
    ];
    return e;
  },
  // Lot 5 de la démo complète (15/10) : Point d'équipe du mode Simple (le précédent : notes concrétisées et suivies ;
  // le prochain : une note préparée par Lea)
  points: () => {
    const avant = occurrenceDemo('point_equipe', 'equipeagile:mobeq', -1);
    const prochain = occurrenceDemo('point_equipe', 'equipeagile:mobeq');
    const jourAvant = avant.slice(-10);
    const lea = 'lea.martin@mobile.example';
    const hugo = 'hugo.petit@mobile.example';
    const pt = (id: string, x: Partial<PointReunion>): PointReunion => ({ id, reunion: avant, personne: lea, auteur: lea, type: 'information', texte: '', element: '', concretisation: '', tache: '', responsable: '', cree_le: `${jourAvant}T09:20:00.000Z`, ...x });
    return [
      pt('mobpt1', { personne: hugo, auteur: MOI_DEMO, type: 'action', texte: 'Corriger le plantage sur Android 12', element: 'mob3', concretisation: 'suivi', responsable: hugo, statut: 'en_cours', validateur: MOI_DEMO, echeance: toDateString(addDays(new Date(), 2)) }),
      pt('mobpt2', { type: 'decision', sous_type: 'prise', texte: 'Livrer la v2 en deux fois', element: 'mobe1', concretisation: 'rien' }),
      pt('mobpt3', { reunion: prochain, type: 'blocage', texte: 'Compte développeur Apple pas encore validé', element: 'mobe1', cree_le: new Date().toISOString() }),
    ];
  },
  // Membres de l'équipe Studio (espace Équipe, hors entreprise)
  org: () => {
    const stamp = new Date().toISOString();
    const base = { cree_le: stamp, modifie_le: stamp, unite: '', manager: '', capacite: '' };
    return {
      personnes: [
        { id: 'mobp1', nom: 'Lea Martin', email: 'lea.martin@mobile.example', nature: 'humain', ...base },
        { id: 'mobp2', nom: 'Hugo Petit', email: 'hugo.petit@mobile.example', nature: 'humain', ...base },
        { id: 'mobp3', nom: 'Vous', email: MOI_DEMO, nature: 'humain', ...base },
        { id: 'mobp4', nom: 'Claude', email: '', nature: 'ia_chat', ...base },
      ],
      unites: [],
      portfolios: [],
      trains: [],
      equipes: [{ id: 'mobeq', nom: 'Studio', train: '', po: 'mobp1', sm: 'mobp2', membres: 'mobp1;mobp2;mobp3;mobp4', cree_le: stamp, modifie_le: stamp }],
    };
  },
};
const SEEDS_ENTREPRISE: Seeds = {
  // 📅 Congés (lot 2) : Paul en congés le sprint suivant, Tom malade aujourd'hui, vous en formation, fermeture de fin d'année
  conges: () => {
    const stamp = new Date().toISOString();
    const it = iterationOf(new Date());
    const j = (base: string, n: number) => toDateString(addDays(new Date(`${base}T12:00`), n));
    const suivant = j(it.end, 1);
    const an = new Date().getFullYear();
    const c = (id: string, personne: string, du: string, au: string, nature: Conge['nature']): Conge => ({ id, personne, du, au, nature, cree_le: stamp, modifie_le: stamp });
    return [
      c('acmc1', 'paul.leroy@acme.example', j(suivant, 5), j(suivant, 9), 'conge'),
      c('acmc2', 'tom.faure@acme.example', toDateString(new Date()), toDateString(new Date()), 'maladie'),
      c('acmc3', MOI_DEMO, j(suivant, 6), j(suivant, 6), 'formation'),
      c('acmc4', '', `${an}-12-24`, `${an}-12-31`, 'fermeture'),
    ];
  },
  items: () =>
    exemple('acm', [
      ['Choisir le prestataire du nouveau CRM', 'tache', 5, { epic: 'acme1', points: '2' }],
      ['Migrer les contacts clients', 'story', SANS_DATE, { feature: 'acmf1', points: '8', equipe: 'acmeqmob', responsable: 'acmp7', iteration: iterationOf(new Date()).key }],
      ['Former les commerciaux', 'mission', 20, { epic: 'acme1' }],
      ['Écran de connexion', 'story', 3, { feature: 'acmf2', points: '3', equipe: 'acmeqmob', responsable: 'acmp8' }],
      ['Paiement en ligne', 'story', 8, { feature: 'acmf2', points: '5', equipe: 'acmeqmob', responsable: 'acmp9' }],
      ['Page d’accueil du site', 'story', 6, { feature: 'acmf3', points: '3', equipe: 'acmeqweb', responsable: 'acmp10' }],
      // Daily de Mobile : tâches nées des dailies précédents, pas encore finies (« suivis »)
      ['Obtenir les accès à l’API de test', 'tache', SANS_DATE, { parent: 'acm4', feature: 'acmf2', equipe: 'acmeqmob', responsable: 'acmp8', statut: 'en_cours', iteration: iterationOf(new Date()).key }],
      ['Commander les licences de test', 'tache', SANS_DATE, { equipe: 'acmeqmob', responsable: 'acmp9', iteration: iterationOf(new Date()).key }],
      // Daily, parcours du PO (Paul) : une story terminée à accepter, deux stories du PI à préparer (trop grosse,
      // sans estimation), une action notée à un daily précédent à son nom
      ['Inscription par e-mail', 'story', SANS_DATE, { feature: 'acmf2', points: '2', equipe: 'acmeqmob', responsable: 'acmp9', statut: 'termine', termine_le: toDateString(new Date()), iteration: iterationOf(new Date()).key }],
      ['Historique des commandes', 'story', SANS_DATE, { feature: 'acmf2', points: '13', equipe: 'acmeqmob' }],
      ['Notifications de livraison', 'story', SANS_DATE, { feature: 'acmf2', equipe: 'acmeqmob' }],
      ['Clarifier les règles de remboursement', 'tache', SANS_DATE, { equipe: 'acmeqmob', responsable: 'acmp6', statut: 'en_cours', iteration: iterationOf(new Date()).key }],
      // « Ma préparation » de Vous (validation du 08/10) : une story en cours à votre nom dans le sprint
      ['Préparer la démo du sprint', 'story', SANS_DATE, { feature: 'acmf2', points: '2', equipe: 'acmeqmob', responsable: `${ID_VOUS_DEMO}-demo-entreprise`, statut: 'en_cours', iteration: iterationOf(new Date()).key }],
      // Plan du jour (13/10, R5d) : tâche affectée à Vous après l'envoi de sa préparation → « Nouveau », à placer
      ['Relire le compte rendu du client', 'tache', SANS_DATE, { equipe: 'acmeqmob', responsable: `${ID_VOUS_DEMO}-demo-entreprise`, iteration: iterationOf(new Date()).key }],
      // Plan commun (R5b) : tâche de l'équipe Web cochée par Vous au Daily Web du jour
      ['Relire la page d’accueil', 'tache', SANS_DATE, { equipe: 'acmeqweb', responsable: `${ID_VOUS_DEMO}-demo-entreprise`, iteration: iterationOf(new Date()).key }],
      // Historique (13/10) : stories terminées aux trois sprints précédents (environ 18 points par sprint pour Mobile,
      // 10 pour Web), pour un coût d'un point réaliste (≈ 500 €) et des estimations à la fin crédibles
      ...[1, 2, 3].flatMap((n): [string, Item['type'], number, Partial<Item>][] => {
        const jour = addDays(new Date(), -14 * n);
        const fini = { statut: 'termine' as const, termine_le: toDateString(addDays(jour, -2)), iteration: iterationOf(jour).key };
        return [
          [`Parcours de commande · étape ${n}`, 'story', SANS_DATE, { feature: 'acmf2', points: '8', equipe: 'acmeqmob', responsable: 'acmp8', ...fini }],
          [`Profil client · partie ${n}`, 'story', SANS_DATE, { feature: 'acmf2', points: '5', equipe: 'acmeqmob', responsable: 'acmp9', ...fini }],
          [`Import des contacts · lot ${n}`, 'story', SANS_DATE, { feature: 'acmf1', points: '5', equipe: 'acmeqmob', responsable: 'acmp7', ...fini }],
          [`Pages du site · lot ${n}`, 'story', SANS_DATE, { feature: 'acmf3', points: '10', equipe: 'acmeqweb', responsable: 'acmp10', ...fini }],
        ];
      }),
      // Sprints plus anciens, depuis janvier : une story par équipe et par sprint, sur l'epic terminée « Site e-commerce
      // v1 » (le coût des personnes de chaque sprint va alors à une epic, et « Hors epics » reste faible)
      ...Array.from({ length: 30 }, (_, k) => k + 4)
        .filter((n) => toDateString(addDays(new Date(), -14 * n)) >= `${new Date().getFullYear()}-01-01`)
        .flatMap((n): [string, Item['type'], number, Partial<Item>][] => {
          const jour = addDays(new Date(), -14 * n);
          const fini = { statut: 'termine' as const, termine_le: toDateString(addDays(jour, -2)), iteration: iterationOf(jour).key };
          return [
            [`Site e-commerce v1 · mobile, incrément ${n}`, 'story', SANS_DATE, { epic: 'acme4', points: '13', equipe: 'acmeqmob', responsable: 'acmp8', ...fini }],
            [`Site e-commerce v1 · web, incrément ${n}`, 'story', SANS_DATE, { epic: 'acme4', points: '8', equipe: 'acmeqweb', responsable: 'acmp10', ...fini }],
          ];
        }),
    ]),
  // Daily de Mobile (onglet PointsReunion) : le point préparé par Tom pour le prochain daily, trois points concrétisés
  // aux dailies précédents dont la tâche n'est pas finie, et un blocage de Tom passé en échange 🔄 Synchro vers Paul
  // (le PO), qui le retrouve dans « Questions de l'équipe »
  points: () => {
    const jour = prochainDaily(new Date());
    const veille = joursOuvresAvant(jour, 1);
    const avant = joursOuvresAvant(jour, 2);
    const reunion = (j: string) => `daily-equipeagile:acmeqmob-${j}`;
    const tom = 'tom.faure@acme.example';
    const nina = 'nina.dupont@acme.example';
    const emma = 'emma.roy@acme.example';
    const paul = 'paul.leroy@acme.example';
    const sara = 'sara.martin@acme.example';
    const pt = (id: string, x: Partial<PointReunion>): PointReunion => ({
      id, reunion: reunion(jour), personne: tom, auteur: tom, type: 'hier', texte: '', element: '', concretisation: '', tache: '', responsable: '', cree_le: new Date(Date.now() - 3600_000).toISOString(), ...x,
    });
    // Avancement (13/10, bloc 13) : photo du Daily d'hier (envoyé), d'où « Avancement depuis le Daily du … » :
    // l'accès à l'API passé En cours, l'inscription Terminée, le paiement repris par Emma, la migration déplacée
    // de sprint, et la relecture du compte rendu ajoutée en cours de route
    const items = SEEDS_ENTREPRISE.items();
    const ent = SEEDS_ENTREPRISE.entities();
    const mobile = items.filter((t) => t.equipe === 'acmeqmob');
    const fIds = new Set(mobile.map((t) => t.feature).filter(Boolean));
    const features = (ent.feature as Feature[]).filter((f) => fIds.has(f.id));
    const eIds = new Set([...mobile.map((t) => t.epic), ...features.map((f) => f.epic)].filter(Boolean));
    const hier = (id: string, o: Partial<Item>) => mobile.map((t) => (t.id === id ? { ...t, ...o } : t));
    const etatHier = hier('acm7', { statut: 'a_faire' }).map((t) => (t.id === 'acm9' ? { ...t, statut: 'en_cours' as const } : t.id === 'acm5' ? { ...t, responsable: 'acmp8' } : t.id === 'acm2' ? { ...t, iteration: iterationOf(addDays(new Date(), -14)).key } : t)).filter((t) => t.id !== 'acm14');
    const liste: PointReunion[] = [
      pt('acmpt1', { reunion: reunion(veille), type: 'blocage', texte: 'Pas d’accès à l’API de test', element: 'acm4', concretisation: 'sous_tache', tache: 'acm7', responsable: tom, cree_le: `${veille}T09:40:00.000Z` }),
      pt('acmpt2', { reunion: reunion(avant), personne: emma, auteur: nina, type: 'action', texte: 'Commander les licences de test', concretisation: 'tache', tache: 'acm8', responsable: emma, cree_le: `${avant}T09:42:00.000Z` }),
      pt('acmpt3', { type: 'hier', texte: 'Formulaire de connexion terminé', element: 'acm4' }),
      // Note préparée par Vous pour le prochain daily ; note d'hier pas encore concrétisée (« Notes à concrétiser »)
      pt('acmpt11', { personne: MOI_DEMO, auteur: MOI_DEMO, type: 'blocage', texte: 'Salle de démo pas encore réservée', element: 'acm13' }),
      pt('acmpt19', { personne: MOI_DEMO, auteur: MOI_DEMO, type: 'aujourdhui', texte: 'Préparer la démo du sprint', element: 'acm13' }),
      pt('acmpt21', { reunion: `daily-equipeagile:acmeqweb-${veille}`, personne: MOI_DEMO, auteur: MOI_DEMO, type: 'aujourdhui', texte: 'Relire la page d’accueil', element: 'acm15', cree_le: `${veille}T09:30:00.000Z` }),
      pt('acmpt20', { reunion: `daily-equipeagile:acmeqweb-${jour}`, personne: MOI_DEMO, auteur: MOI_DEMO, type: 'aujourdhui', texte: 'Relire la page d’accueil', element: 'acm15' }),
      pt('acmpt12', { reunion: reunion(veille), personne: nina, auteur: nina, type: 'decision', sous_type: 'a_prendre', texte: 'Choisir la bibliothèque de graphiques', cree_le: `${veille}T09:44:00.000Z` }),
      pt('acmpt4', { type: 'aujourdhui', texte: 'Brancher la connexion Google', element: 'acm4' }),
      // Plan du jour (13/10) : le plan de Tom à la daily d'hier, revu par le statut de ses éléments
      pt('acmpt16', { reunion: reunion(veille), type: 'aujourdhui', texte: 'Écran de connexion', element: 'acm4', cree_le: `${veille}T09:30:00.000Z` }),
      pt('acmpt17', { reunion: reunion(veille), type: 'aujourdhui', texte: 'Obtenir les accès à l’API de test', element: 'acm7', cree_le: `${veille}T09:30:00.000Z` }),
      pt('acmpt5', { type: 'blocage', texte: 'Le serveur de test refuse les connexions', element: 'acm4' }),
      pt('acmpt6', { reunion: reunion(veille), type: 'blocage', texte: 'Règles du mot de passe à confirmer', element: 'acm4', concretisation: 'synchro', tache: 'acmx3', responsable: paul, auteur: nina, cree_le: `${veille}T09:41:00.000Z` }),
      pt('acmpt7', { reunion: reunion(avant), personne: paul, auteur: nina, type: 'action', texte: 'Clarifier les règles de remboursement', concretisation: 'tache', tache: 'acm12', responsable: paul, cree_le: `${avant}T09:44:00.000Z` }),
      // Points de suivi (08/10) à valider par vous : fait par Emma ; en retard ; escalade revenue avec la réponse du RTE
      pt('acmpt8', { reunion: reunion(avant), personne: emma, auteur: MOI_DEMO, type: 'action', texte: 'Revoir les maquettes du panier', element: 'acm4', concretisation: 'suivi', responsable: emma, statut: 'fait', validateur: MOI_DEMO, echeance: veille, note: 'Maquettes revues avec le PO', cree_le: `${avant}T09:45:00.000Z` }),
      pt('acmpt9', { reunion: reunion(avant), personne: paul, auteur: MOI_DEMO, type: 'blocage', texte: 'Relancer le service juridique', concretisation: 'suivi', responsable: paul, statut: 'en_cours', validateur: MOI_DEMO, echeance: avant, cree_le: `${avant}T09:46:00.000Z` }),
      pt('acmpt10', { reunion: reunion(avant), type: 'blocage', texte: 'API de paiement bloquée', element: 'acm4', concretisation: 'escalade', tache: 'acmx4', echange: 'acmx4', responsable: sara, statut: 'fait', validateur: MOI_DEMO, note: 'Réponse de Sara Martin : accès donné par le prestataire (clé dans le coffre)', cree_le: `${avant}T09:47:00.000Z` }),
      // 📌 Mes suivis (lot 5) : fermés, gardés jusqu'à leur suppression (validé ; abandonné avec son motif)
      pt('acmpt13', { reunion: reunion(avant), personne: nina, auteur: MOI_DEMO, type: 'action', texte: 'Mettre à jour la liste des testeurs', concretisation: 'suivi', responsable: nina, statut: 'valide', validateur: MOI_DEMO, note: 'Liste à jour', cree_le: `${avant}T09:48:00.000Z` }),
      // Validé depuis le Chat : « Décidé hors réunion », mis en avant au daily suivant jusqu'à « Confirmer »
      pt('acmpt15', { reunion: reunion(avant), personne: paul, auteur: MOI_DEMO, type: 'action', texte: 'Mettre à jour le guide d’installation', concretisation: 'suivi', responsable: paul, statut: 'valide', validateur: MOI_DEMO, note: 'Guide relu', hors_reunion: '1', cree_le: `${avant}T09:50:00.000Z` }),
      pt('acmpt14', { reunion: reunion(avant), personne: MOI_DEMO, auteur: MOI_DEMO, type: 'action', texte: 'Réserver la salle de démo du vendredi', concretisation: 'suivi', responsable: MOI_DEMO, statut: 'abandonne', validateur: nina, note: 'Démo faite à distance', cree_le: `${avant}T09:49:00.000Z` }),
    ];
    // Lot 2 de la démo complète (15/10) : contenu préparé des réunions SAFe, aux prochaines réunions des séries
    {
      const eqM = 'equipeagile:acmeqmob';
      const trC = 'train:acmtr1';
      const pfD = 'portfolio:acmpf1';
      const marc = 'marc.petit@acme.example';
      const julieM = 'julie.morel@acme.example';
      let n = 0;
      const don = (reunionId: string, par: string, d: Record<string, unknown>) => pt(`acmd2-${++n}`, { reunion: reunionId, personne: par, auteur: par, type: 'donnee', texte: JSON.stringify({ o: 'membre', ...d }) });
      const vote = (reunionId: string, par: string, el: string, val: string) => pt(`acmv2-${++n}`, { reunion: reunionId, personne: par, auteur: par, type: 'vote', texte: JSON.stringify({ el, val, tour: 1 }) });
      const note = (reunionId: string, par: string, type: PointReunion['type'], texte: string, x: Partial<PointReunion> = {}) => pt(`acmn2-${++n}`, { reunion: reunionId, personne: par, auteur: par, type, texte, ...x });
      // Rétrospective Mobile : idées des deux colonnes (une anonyme), étoiles déjà données, et une proposition
      // reportée de la rétro précédente
      const retro = occurrenceDemo('retro', eqM);
      liste.push(
        don(retro, nina, { k: 'idee', c: 'ri1', col: 'va', texte: 'Le daily tient en 15 minutes' }),
        don(retro, tom, { k: 'idee', c: 'ri2', col: 'va', texte: 'Bonne entraide sur l’API de paiement' }),
        don(retro, emma, { k: 'idee', c: 'ri3', col: 'va', texte: 'Démo appréciée par les clients' }),
        don(retro, tom, { k: 'idee', c: 'ri4', col: 'ameliorer', texte: 'Trop de réunions le lundi' }),
        don(retro, emma, { k: 'idee', c: 'ri5', col: 'ameliorer', texte: 'Stories pas assez découpées à l’affinage', anonyme: true }),
        don(retro, paul, { k: 'idee', c: 'ri6', col: 'ameliorer', texte: 'Environnement de test instable' }),
        vote(retro, nina, 'ri5', '1'), vote(retro, tom, 'ri5', '1'), vote(retro, paul, 'ri5', '1'), vote(retro, tom, 'ri4', '1'), vote(retro, emma, 'ri6', '1'),
        note(occurrenceDemo('retro', eqM, -1), nina, 'proposition', 'Faire relire le code à deux avant la démo', { sous_type: 'reportee' }),
      );
      // Inspect & Adapt Clients : problèmes proposés par le train et premières étoiles
      const ia = occurrenceDemo('inspect_adapt', trC);
      liste.push(
        don(ia, sara, { k: 'probleme', c: 'ip1', texte: 'Les features arrivent non estimées au PI Planning' }),
        don(ia, paul, { k: 'probleme', c: 'ip2', texte: 'Dépendances avec le train Paiements découvertes trop tard' }),
        don(ia, nina, { k: 'probleme', c: 'ip3', texte: 'Environnement de test partagé saturé' }),
        vote(ia, sara, 'ip2', '1'), vote(ia, nina, 'ip2', '1'), vote(ia, paul, 'ip1', '1'),
      );
      // Affinage Mobile : votes de poker préparés (désaccord sur une story, accord sur l'autre)
      const aff = occurrenceDemo('affinage', eqM);
      liste.push(vote(aff, tom, 'acm10', '5'), vote(aff, emma, 'acm10', '8'), vote(aff, nina, 'acm10', '13'), vote(aff, tom, 'acm11', '3'), vote(aff, emma, 'acm11', '3'), vote(aff, nina, 'acm11', '3'));
      // PI Planning Clients : votes de confiance préparés (un « 2 » à expliquer) et deux risques notés
      const pip = occurrenceDemo('pi_planning', trC);
      liste.push(
        vote(pip, tom, 'confiance', '4'), vote(pip, emma, 'confiance', '3'), vote(pip, nina, 'confiance', '4'), vote(pip, paul, 'confiance', '2'), vote(pip, sara, 'confiance', '4'),
        note(pip, sara, 'risque', 'Le prestataire de paiement change d’API en février'),
        note(pip, nina, 'risque', 'Équipe Web à mi-temps en janvier (formation)'),
      );
      // System demo Clients : retours des parties prenantes
      const sd = occurrenceDemo('system_demo', trC);
      liste.push(note(sd, marc, 'information', 'Le parcours d’inscription est clair pour les clients testeurs'), note(sd, julieM, 'action', 'Ajouter le paiement par carte enregistrée', { element: 'acmf2' }));
      // Semaine IP Clients : idées de hackathon et inscriptions à la formation
      const ip = occurrenceDemo('iteration_ip', trC);
      liste.push(
        don(ip, tom, { k: 'idee_ip', c: 'ii1', texte: 'Connexion par empreinte digitale' }),
        don(ip, emma, { k: 'idee_ip', c: 'ii2', texte: 'Tableau de bord des erreurs en temps réel' }),
        don(ip, nina, { k: 'formation', c: 'if1', texte: 'Formation accessibilité (2 jours)' }),
        don(ip, paul, { k: 'formation', c: 'if2', texte: 'Dette : migrer les tests vers la nouvelle API' }),
      );
      // Lot 5 : Point d'équipe Mobile du mode Simple (le précédent : suivi et décision ; le prochain : une note d'Emma)
      const peAvant = occurrenceDemo('point_equipe', eqM, -1);
      const peProchain = occurrenceDemo('point_equipe', eqM);
      liste.push(
        note(peAvant, tom, 'action', 'Corriger le plantage de l’écran de connexion', { auteur: MOI_DEMO, element: 'acm4', concretisation: 'suivi', responsable: tom, statut: 'en_cours', validateur: MOI_DEMO, echeance: toDateString(addDays(new Date(), 2)), cree_le: `${peAvant.slice(-10)}T09:20:00.000Z` }),
        note(peAvant, nina, 'decision', 'Livrer l’application en deux fois', { sous_type: 'prise', element: 'acme2', concretisation: 'rien', cree_le: `${peAvant.slice(-10)}T09:22:00.000Z` }),
        note(peProchain, emma, 'blocage', 'Compte développeur Apple pas encore validé', { element: 'acm4' }),
      );
      // Revue des OKR Digital : une décision à prendre sur l'OKR des coûts
      liste.push(note(occurrenceDemo('revue_okr', pfD), marc, 'decision', 'Le coût par commande ne baisse pas : revoir la cible de 8 €', { sous_type: 'a_prendre', element: 'acmo2' }));
    }
    // Live (15/10) : l'Atelier des maquettes du jour lancé par Nina (réunion libre r-demo2), à l'étape « Notes »
    {
      const auj = toDateString(new Date());
      const e = { v: 3, lance: new Date(Date.now() - 10 * 60_000).toISOString(), anim: nina, etape: 'notes', libelle: 'Notes', detail: 'Écran de connexion' };
      liste.push(pt('acmlive1', { reunion: `reunion-r-demo2-${auj}`, personne: nina, auteur: nina, type: 'etat', texte: JSON.stringify(e), cree_le: new Date().toISOString() }));
      liste.push(pt('acmlive2', { reunion: `reunion-r-demo2-${auj}`, personne: nina, auteur: nina, type: 'information', texte: 'Les maquettes du panier sont validées par le PO', element: 'acm4', cree_le: new Date().toISOString() }));
    }
    // Suivis tels qu'hier : les maquettes du panier étaient encore « en cours » (passées à « fait » depuis)
    const suivisHier = liste.filter((x) => !!x.statut).map((x) => (x.id === 'acmpt8' ? { ...x, statut: 'en_cours' as const } : x));
    const photo = photoDe({ items: etatHier, features, epics: (ent.epic as Epic[]).filter((x) => eIds.has(x.id)), suivis: suivisHier, tousItems: items.map((t) => etatHier.find((a) => a.id === t.id) ?? t) }, 0);
    // L'epic de l'application mobile était « Analyse » hier
    for (const k of Object.keys(photo).filter((x) => x.startsWith('e:')).slice(0, 1)) photo[k] = ['analyse', ...photo[k].split('|').slice(1)].join('|');
    const photoHier = pointsPhoto(reunion(veille), nina, photo, FILTRE_TOUT).map((x, k) => ({ ...x, id: `acmav${k + 1}`, cree_le: `${veille}T09:55:00.000Z` }));
    // Avancement au niveau du train et du portfolio : photos d'hier de l'ART sync et de la Revue du portfolio, avec
    // tout le delivery tel qu'hier (seuls les éléments de la réunion comptent) ; une feature avancée d'un PI, une epic
    // dont le budget a grandi, une demande accordée en partie, une demande nouvelle ; au portfolio, une epic passée
    // de Analyse à Prêt, l'enveloppe relevée, un résultat clé en progrès
    const bud = budgetDemoEntreprise();
    const pi = piOf(toDateString(new Date()));
    const tout = photoDe({ items, features: ent.feature as Feature[], epics: ent.epic as Epic[], objectifs: ent.objectif, resultats: ent.resultat, objectifsPI: ent.objectifpi, enveloppes: bud.enveloppe, demandes: bud.demande, tousItems: items.map((t) => etatHier.find((a) => a.id === t.id) ?? t) }, 0);
    const changer = (photoX: Record<string, string>, cle: string, i: number, v: string) => {
      if (photoX[cle] === undefined) return;
      const c = photoX[cle].split('|');
      c[i] = v;
      photoX[cle] = c.join('|');
    };
    // Risque noté à une ART sync, suivi (ROAM : Owned par Paul) : « En cours » hier, « Fait » depuis
    const risque = pt('acmpt30', { reunion: `art_sync-train:acmtr1-${avant}`, personne: paul, auteur: paul, type: 'risque', texte: 'Retard du fournisseur de paiement', concretisation: 'suivi', responsable: paul, statut: 'fait', validateur: MOI_DEMO, echeance: jour, note: 'Contrat signé avec un second fournisseur', cree_le: `${avant}T11:20:00.000Z` });
    liste.push(risque);
    // Lot 1 de la démo complète (15/10) : notes et suivis manquants
    const julieEO = 'julie.morel@acme.example';
    liste.push(
      // Information fermée d'office (case « À concrétiser » décochée) et Information à concrétiser (cochée)
      pt('acmpt22', { reunion: reunion(veille), personne: emma, auteur: emma, type: 'information', texte: 'Nouvelle version de l’outil de test disponible', concretisation: 'rien', cree_le: `${veille}T09:43:00.000Z` }),
      // Lot 1 des notes (16/10, N3) : une note qui concerne deux éléments de l'équipe
      pt('acmpt23', { personne: emma, auteur: emma, type: 'information', texte: 'Le prestataire change de contact au 1er novembre', element: 'acm4', elements: 'acm7' }),
      // D1 : suivi déplacé de la Revue de sprint vers le Daily par Nina Dupont (historique gardé)
      pt('acmpt40', { reunion: reunion(avant), personne: emma, auteur: nina, type: 'action', texte: 'Montrer le parcours de paiement au client', element: 'acm4', concretisation: 'suivi', responsable: emma, statut: 'en_cours', validateur: nina, echeance: jour, historique: `Déplacé depuis « Revue de sprint du ${jourMois(joursOuvresAvant(jour, 3))} » par Nina Dupont`, cree_le: `${avant}T09:53:00.000Z` }),
      // Décision prise en séance : rien à concrétiser, partagée au compte rendu (Clos)
      pt('acmpt24', { reunion: reunion(veille), personne: nina, auteur: nina, type: 'decision', sous_type: 'prise', texte: 'Garder la connexion Google pour la v1', element: 'acm4', concretisation: 'rien', cree_le: `${veille}T09:45:00.000Z` }),
      // Suivi « À reprendre » : fait par Tom, refusé par Vous avec le motif
      pt('acmpt25', { reunion: reunion(avant), personne: tom, auteur: MOI_DEMO, type: 'action', texte: 'Refaire le test de charge de la connexion', element: 'acm4', concretisation: 'suivi', responsable: tom, statut: 'a_reprendre', validateur: MOI_DEMO, echeance: veille, note: 'À reprendre : le test a été fait sur 10 utilisateurs, il en faut 500', cree_le: `${avant}T09:51:00.000Z` }),
      // « Plus suivi » : plus suivi en réunion, la story liée continue sa vie au backlog
      pt('acmpt26', { reunion: reunion(avant), personne: paul, auteur: MOI_DEMO, type: 'action', texte: 'Préparer la story du parrainage', concretisation: 'suivi', tache: 'acm11', responsable: paul, statut: 'plus_suivi', validateur: MOI_DEMO, note: 'Suivie au backlog (story)', cree_le: `${avant}T09:52:00.000Z` }),
      // Escalade sur trois niveaux : le blocage du Daily (acmpt10) transmis à Sara Martin (RTE) ; suivi à l'ART sync et
      // transmis au portfolio (Julie Morel, Epic Owner) ; suivi à la Synchronisation du portfolio, fait
      pt('acmpt31', { reunion: `art_sync-train:acmtr1-${avant}`, personne: sara, auteur: sara, type: 'blocage', texte: 'API de paiement bloquée (équipe Mobile)', element: 'acm4', concretisation: 'escalade', tache: 'acmx10', echange: 'acmx4', responsable: julieEO, statut: 'fait', validateur: sara, note: 'Réponse de Julie Morel : contrat du prestataire prolongé, accès rétabli', cree_le: `${avant}T11:25:00.000Z` }),
      pt('acmpt32', { reunion: `sync_portfolio-portfolio:acmpf1-${avant}`, personne: julieEO, auteur: julieEO, type: 'blocage', texte: 'Accès du prestataire de paiement à prolonger', element: 'acm4', concretisation: 'suivi', tache: 'acmx10', echange: 'acmx10', responsable: julieEO, statut: 'fait', validateur: julieEO, echeance: veille, note: 'Contrat prolongé d’un an', cree_le: `${avant}T14:10:00.000Z` }),
      // Demande de budget née d'une note (lot 4) : concrétisée en 💶 à la rétro du 9/10 (demande acmdb1)
      pt('acmpt28', { reunion: occurrenceDemo('retro', 'equipeagile:acmeqmob', -1), personne: nina, auteur: nina, type: 'action', texte: 'Licence de l’outil de test', concretisation: 'budget', tache: 'acmdb1', responsable: nina, cree_le: `${avant}T15:00:00.000Z` }),
      // Note liée à un message du Chat déjà clos (lot 3) : « 🔒 Échange privé terminé »
      pt('acmpt27', { reunion: reunion(avant), personne: tom, auteur: MOI_DEMO, type: 'blocage', texte: 'Droits d’accès au dépôt de code', concretisation: 'suivi', tache: 'acmx-clos', echange: 'acmx-clos', responsable: paul, statut: 'fait', validateur: MOI_DEMO, echeance: veille, note: 'Accès donné', cree_le: `${avant}T09:53:00.000Z` }),
      // Dépendance notée à l'ART sync, à concrétiser : l'équipe Web attend une feature du train Paiements
      // (lot 2 plus bas : contenu préparé des réunions SAFe)
      pt('acmpt33', { reunion: `art_sync-train:acmtr1-${avant}`, personne: nina, auteur: nina, type: 'dependance', texte: 'L’équipe Web attend le « Paiement sécurisé » du train Paiements', element: 'acmf4', cree_le: `${avant}T11:30:00.000Z` }),
    );
    const train = { ...tout, ...photoDe({ suivis: [{ ...risque, statut: 'en_cours' }] }, 0) };
    changer(train, 'f:acmf1', 3, shiftPi(pi, 1));
    changer(train, 'q:acmopi1', 1, '4');
    changer(train, 'e:acme2', 1, '90000');
    changer(train, 'd:acmdb3', 0, 'soumise');
    changer(train, 'd:acmdb3', 1, '2400');
    delete train['d:acmdb1'];
    const portfolio = { ...tout };
    changer(portfolio, 'e:acme1', 0, 'analyse');
    changer(portfolio, `v:portfolio:acmpf1|${new Date().getFullYear()}`, 1, '230000');
    changer(portfolio, 'r:acmr1', 1, '78');
    const sans = FILTRE_TOUT;
    const photosNiveaux = [
      ...pointsPhoto(`art_sync-train:acmtr1-${veille}`, 'paul.leroy@acme.example', train, sans).map((x, k) => ({ ...x, id: `acmavt${k + 1}`, cree_le: `${veille}T11:30:00.000Z` })),
      ...pointsPhoto(`revue_portfolio-portfolio:acmpf1-${veille}`, 'marc.petit@acme.example', portfolio, sans).map((x, k) => ({ ...x, id: `acmavp${k + 1}`, cree_le: `${veille}T11:30:00.000Z` })),
    ];
    // 💶 Budget participatif (13/10, session 3) : prochaine séance (début d'un PI sur deux, T1 et T3), demandes du
    // train Clients avec leur montant (RTE Sara Martin, PM Marc Petit), une demande sans train (l'Epic Owner), et deux votes
    let piB = piOf(toDateString(new Date()));
    for (let k = 0; k < 4 && !(/-T[13]$/.test(piB) && toDateString(piStart(piB)) >= toDateString(new Date())); k++) piB = shiftPi(piB, 1);
    let jourB = toDateString(piStart(piB));
    while (!estOuvre(jourB)) jourB = toDateString(addDays(new Date(`${jourB}T12:00`), 1));
    const reunionBudget = `budget-portfolio:acmpf1-${jourB}`;
    const donnee = (id: string, par: string, d: Record<string, unknown>) => pt(id, { reunion: reunionBudget, personne: par, auteur: par, type: 'donnee', texte: JSON.stringify(d), cree_le: `${toDateString(new Date())}T08:00:00.000Z` });
    const marc = 'marc.petit@acme.example';
    const julie = 'julie.morel@acme.example';
    const budgetParticipatif = [
      donnee('acmbp1', sara, { k: 'demande', c: 'dm1', o: 'membre', texte: 'Plateforme de tests automatisés · 60 k€' }),
      donnee('acmbp2', marc, { k: 'demande', c: 'dm2', o: 'membre', texte: 'Programme fidélité dans l’application · 150 k€' }),
      donnee('acmbp3', julie, { k: 'demande', c: 'dm3', o: 'membre', texte: 'Étude de marché Benelux · 30 k€' }),
      donnee('acmbp6', 'leo.bernard@acme.example', { k: 'demande', c: 'dm4', o: 'membre', texte: 'Certification de sécurité des paiements · 80 k€' }),
      donnee('acmbp4', sara, { k: 'budget', c: 'budget', o: 'membre', l: { dm1: 40, dm2: 30, dm3: 10, dm4: 20 } }),
      donnee('acmbp5', marc, { k: 'budget', c: 'budget', o: 'membre', l: { dm1: 20, dm2: 50, dm3: 10, dm4: 20 } }),
      donnee('acmbp7', 'leo.bernard@acme.example', { k: 'budget', c: 'budget', o: 'membre', l: { dm1: 10, dm2: 20, dm4: 70 } }),
    ];
    // Avancement dans toutes les autres réunions (14/10) : la photo de la réunion précédente de chaque série
    const actuel = photoDe({ items, features: ent.feature as Feature[], epics: ent.epic as Epic[], objectifs: ent.objectif, resultats: ent.resultat, objectifsPI: ent.objectifpi, enveloppes: bud.enveloppe, demandes: bud.demande, tousItems: items }, 0);
    const equipeDe = (t: Item) => t.equipe || (ent.feature as Feature[]).find((f) => f.id === t.feature)?.equipe || '';
    const trainDe = (eq: string) => ({ acmeqmob: 'acmtr1', acmeqweb: 'acmtr1' })[eq] ?? '';
    const epicsDe = (fs: Feature[], its: Item[]) => new Set([...fs.map((f) => f.epic), ...its.map((t) => t.epic)].filter(Boolean));
    const seriesAv: SerieAv[] = [];
    const deja = new Set(['daily-equipeagile:acmeqmob-', 'art_sync-train:acmtr1-', 'revue_portfolio-portfolio:acmpf1-']);
    const ajouterSerie = (prefixe: string, focus: number, recul: number, cles: string[], qui: string) => {
      if (!deja.has(prefixe)) seriesAv.push({ prefixe, focus, jour: joursOuvresAvant(jour, recul), cles, qui });
    };
    for (const eq of ['acmeqmob', 'acmeqweb']) {
      const its = items.filter((t) => equipeDe(t) === eq);
      const fs = (ent.feature as Feature[]).filter((f) => its.some((t) => t.feature === f.id));
      const es = epicsDe(fs, its);
      const cles = [...its.map((t) => `t:${t.id}`), ...fs.map((f) => `f:${f.id}`), ...[...es].map((x) => `e:${x}`)];
      const sm = eq === 'acmeqmob' ? nina : 'hugo.blanc@acme.example';
      for (const [t, recul] of [['daily', 1], ['planification', 10], ['affinage', 10], ['revue', 10], ['retro', 10]] as const) ajouterSerie(`${t}-equipeagile:${eq}-`, 0, recul, cles, sm);
    }
    for (const tr of ['acmtr1', 'acmtr2']) {
      const fs = (ent.feature as Feature[]).filter((f) => f.train === tr || items.some((t) => t.feature === f.id && trainDe(equipeDe(t)) === tr));
      const its = items.filter((t) => trainDe(equipeDe(t)) === tr);
      const es = epicsDe(fs, its);
      const cles = [...fs.map((f) => `f:${f.id}`), ...(ent.objectifpi as ObjectifPI[]).map((o) => `q:${o.id}`), ...[...es].map((x) => `e:${x}`), ...bud.enveloppe.filter((v) => v.niveau === `train:${tr}`).map((v) => `v:${v.id}`), ...bud.demande.filter((d) => d.demandeur === `train:${tr}` || d.destination === `train:${tr}`).map((d) => `d:${d.id}`)];
      const rte = tr === 'acmtr1' ? sara : 'leo.bernard@acme.example';
      for (const [t, recul] of [['art_sync', 5], ['pi_planning', 60], ['system_demo', 10], ['inspect_adapt', 60], ['iteration_ip', 60], ['affinage_train', 10], ['prepa_pi', 60]] as const) ajouterSerie(`${t}-train:${tr}-`, 1, recul, cles, rte);
    }
    {
      const es = (ent.epic as Epic[]).filter((x) => x.portfolio === 'acmpf1');
      const cles = [...es.map((x) => `e:${x.id}`), ...bud.enveloppe.filter((v) => v.niveau === 'portfolio:acmpf1').map((v) => `v:${v.id}`), ...bud.demande.filter((d) => d.destination === 'portfolio:acmpf1').map((d) => `d:${d.id}`), ...(ent.objectif as Objectif[]).map((o) => `o:${o.id}`), ...(ent.resultat as ResultatCle[]).map((r) => `r:${r.id}`)];
      for (const [t, recul, focus] of [['sync_portfolio', 10, 2], ['budget', 120, 2], ['revue_okr', 60, 3]] as const) ajouterSerie(`${t}-portfolio:acmpf1-`, focus, recul, cles, marc);
      ajouterSerie('comite_budget-unite:acmu1-', 2, 120, cles, 'claire.vidal@acme.example');
    }
    const avancementsSeries = photosSeries(seriesAv, actuel, ['acmp6', 'acmp7', 'acmp8', 'acmp9', 'acmp10', 'acmp11'], 'acm');
    return [...photoHier, ...photosNiveaux, ...liste, ...budgetParticipatif, ...avancementsSeries];
  },
  entities: () => {
    const e = vide();
    const stamp = new Date().toISOString();
    const base = { cree_le: stamp, modifie_le: stamp };
    const now = new Date();
    const m = (n: number) => toDateString(new Date(now.getFullYear(), now.getMonth() + n, 1));
    e.domaine = [{ id: 'acmdpro', nom: 'Pro', icone: '💼', couleur: '#1A73E8', parent: '', ...base }];
    e.objectif = [{ id: 'acmo1', titre: 'Fidéliser les clients', domaine: 'acmdpro', debut: m(-2), fin: m(10), couleur: '#1A73E8', description: '', cible: '90', actuel: '82', unite: '% de clients fidèles', ...base }];
    e.epic = [
      { id: 'acme1', titre: 'Nouveau CRM', description: '', debut: m(0), fin: m(6), couleur: '#00897B', objectif: 'acmo1', domaine: '', etat: 'pret', portfolio: 'acmpf1', budget: '80000', ...base },
      { id: 'acme2', titre: 'Application client', description: '', debut: m(-1), fin: m(8), couleur: '#C2185B', objectif: 'acmo1', domaine: '', etat: 'en_cours', portfolio: 'acmpf1', budget: '100000', ...base },
      // Lot 5 : idée en analyse, dossier d'investissement à compléter puis à décider à la Revue du portfolio
      { id: 'acme3', titre: 'Paiement en un clic', description: '', debut: m(2), fin: m(9), couleur: '#5E35B1', objectif: 'acmo1', domaine: '', etat: 'analyse', portfolio: 'acmpf1', ...base },
      // Lot 4 de la démo complète (15/10) : une idée remise à plus tard et une abandonnée (Revue du portfolio)
      { id: 'acme5', titre: 'Borne de commande en magasin', description: '', debut: m(6), fin: m(14), couleur: '#00897B', objectif: '', domaine: '', etat: 'idee', portfolio: 'acmpf1', ...base },
      { id: 'acme6', titre: 'Programme de parrainage', description: '', debut: m(3), fin: m(8), couleur: '#8E24AA', objectif: '', domaine: '', etat: 'idee', portfolio: 'acmpf1', ...base },
      // Epic terminée (13/10) : le travail des équipes de janvier à l'été, avant l'Application client
      { id: 'acme4', titre: 'Site e-commerce v1', description: '', debut: `${new Date().getFullYear()}-01-01`, fin: toDateString(addDays(new Date(), -14 * 4)), couleur: '#6D4C41', objectif: 'acmo1', domaine: '', etat: 'termine', portfolio: 'acmpf1', budget: '230000', ...base },
    ];
    e.feature = [
      { id: 'acmf1', titre: 'Reprise des données', description: '', epic: 'acme1', pi: piOf(now), iteration: '', points: '13', couleur: '', train: 'acmtr1', equipe: 'acmeqmob', ...base },
      { id: 'acmf2', titre: 'Compte client mobile', description: '', epic: 'acme2', pi: piOf(now), iteration: '', points: '8', couleur: '', train: 'acmtr1', equipe: 'acmeqmob', ...base },
      { id: 'acmf3', titre: 'Nouveau site vitrine', description: '', epic: 'acme2', pi: piOf(now), iteration: '', points: '5', couleur: '', train: 'acmtr1', equipe: 'acmeqweb', ...base },
      // Train Paiements (13/10) : l'Application client est payée à 13/26 par Clients et 13/26 par Paiements
      { id: 'acmf4', titre: 'Paiement sécurisé', description: '', epic: 'acme2', pi: piOf(now), iteration: '', points: '13', couleur: '', train: 'acmtr2', equipe: '', ...base },
      // PI suivant (15/10) : features du train Clients pour la Préparation du PI Planning et le PI Planning (plans
      // d'équipe par sprint) ; une candidate pas encore estimée ni placée
      ...(() => {
        const piS = shiftPi(piOf(now), 1);
        const sprint = (k: number) => shiftIteration(iterationOf(toDateString(piStart(piS))).key, k);
        return [
          { id: 'acmf5', titre: 'Paiement en un clic dans l’application', epic: 'acme3', iteration: sprint(0), points: '13', equipe: 'acmeqmob' },
          { id: 'acmf6', titre: 'Notifications de livraison', epic: 'acme2', iteration: sprint(1), points: '8', equipe: 'acmeqmob' },
          { id: 'acmf7', titre: 'Fiches produits enrichies', epic: 'acme2', iteration: sprint(0), points: '5', equipe: 'acmeqweb' },
          { id: 'acmf8', titre: 'Avis clients sur le site', epic: 'acme2', iteration: '', points: '', equipe: '' },
        ].map((f) => ({ ...f, description: '', pi: piS, couleur: '', train: 'acmtr1', ...base }));
      })(),
    ];
    // Lot 4 : OKR, résultats clés et value streams d'ACME
    e.objectif.push({ id: 'acmo2', titre: 'Réduire les coûts d’exploitation', domaine: 'acmdpro', debut: m(-1), fin: m(11), couleur: '#E37400', description: '', cible: '', actuel: '', unite: '', ...base });
    e.resultat = [
      { id: 'acmr1', objectif: 'acmo1', titre: 'Clients fidèles', actuel: '82', cible: '90', unite: '%', ...base },
      { id: 'acmr2', objectif: 'acmo1', titre: 'Note de l’application', actuel: '4.1', cible: '4.5', unite: '/ 5', ...base },
      { id: 'acmr3', objectif: 'acmo2', titre: 'Coût par commande', actuel: '12', cible: '8', unite: '€', ...base },
    ];
    // Objectif du PI du train Clients (avancement à l'ART sync : valeur obtenue 4 → 6 sur 10)
    e.objectifpi = [{ id: 'acmopi1', titre: 'Paiement en ligne disponible pour tous les clients', pi: piOf(toDateString(new Date())), type: 'engage', valeur_prevue: '8', valeur_obtenue: '6', domaine: '', epic: 'acme2', ...base }];
    e.valuestream = [
      { id: 'acmvs1', nom: 'Parcours client en ligne', type: 'operationnel', description: '', portfolio: 'acmpf1', trains: 'acmtr1', okrs: 'acmo1', ...base },
      { id: 'acmvs2', nom: 'Plateforme de paiement', type: 'developpement', description: '', portfolio: 'acmpf1', trains: '', okrs: 'acmo1;acmo2', ...base },
    ];
    e.epic = e.epic.map((x) => (x.id === 'acme2' ? { ...x, value_streams: 'acmvs1', objectif: '' } : x.id === 'acme1' ? { ...x, okrs: 'acmo1', value_streams: '', objectif: '' } : x));
    // Échanges privés à deux dans l'équipe Mobile (« Voir en tant que » Nina Dupont pour les voir)
    const ech = (id: string, x: Partial<Echange>): Echange => ({ id, de: '', a: '', type: 'message', titre: '', texte: '', choix: '', reponse: '', note: '', statut: 'envoye', element: '', niveau: 'equipeagile:acmeqmob', transmis_par: '', prive: '1', cree_le: new Date().toISOString(), modifie_le: new Date().toISOString(), ...x });
    // Lot 5 de la démo complète (15/10) : séries enregistrées (onglet Reunions) — une réunion libre chaque jeudi, le
    // Daily Mobile d'après-demain déplacé à 10:30, la prochaine Revue de sprint Web annulée
    {
      const auj = toDateString(new Date());
      const loin = toDateString(addDays(new Date(), 60));
      const daily = serieParDefaut('daily', 'equipeagile:acmeqmob');
      const dOcc = occurrences(daily, auj, loin)[2];
      const revueW = serieParDefaut('revue', 'equipeagile:acmeqweb');
      const rOcc = occurrences(revueW, auj, loin)[0];
      (e as unknown as Record<string, unknown>).serie = [
        // Live (15/10) : atelier animé par Nina chaque jour ouvré, Vous y participe ; celui d'aujourd'hui est lancé
        // (ligne d'état) : bandeau « En direct » et écran de l'animatrice en lecture seule
        serieVide({ id: 'r-demo2', titre: 'Atelier des maquettes', unite: 'jour', jours: 'ouvres', heure: '08:30', duree: '30', animateur: 'nina.dupont@acme.example', participants: `${MOI_DEMO};tom.faure@acme.example;emma.roy@acme.example`, debut: auj, cree_le: stamp, modifie_le: stamp }),
        serieVide({ id: 'r-demo1', titre: 'Point avec le prestataire de paiement', unite: 'semaine', jours: '4', heure: '14:00', duree: '45', animateur: MOI_DEMO, participants: 'nina.dupont@acme.example;sara.martin@acme.example', debut: auj, cree_le: stamp, modifie_le: stamp }),
        ...(dOcc ? [{ ...daily, exceptions: JSON.stringify([{ d: dOcc.origine, a: `${dOcc.origine}T10:30` }]), cree_le: stamp, modifie_le: stamp }] : []),
        ...(rOcc ? [{ ...revueW, exceptions: JSON.stringify([{ d: rOcc.origine, annulee: true }]), cree_le: stamp, modifie_le: stamp }] : []),
      ];
    }
    (e as unknown as Record<string, unknown>).piecejointe = PIECES_DEMO.map((x) => ({ id: `${x.piece}-0`, piece: x.piece, nom: x.nom, type: x.type, taille: String(Math.floor((x.donnees.length * 3) / 4)), partie: '0', total: '1', donnees: x.donnees, cree_le: new Date().toISOString(), controle: controleMorceau(x.donnees) }));
    e.echange = [
      ech('acmx1', { de: 'paul.leroy@acme.example', a: 'nina.dupont@acme.example', type: 'question', titre: 'Découper la story de connexion ?', texte: 'Elle fait 8 points : on la coupe en deux pour ce sprint ?', choix: 'Oui, en deux;Non, on la garde' }),
      ech('acmx2', { de: 'tom.faure@acme.example', a: 'nina.dupont@acme.example', titre: 'Budget des licences', texte: 'Il faut valider l’achat des licences de test : ça dépasse l’équipe.' }),
      // Blocage de Tom passé en 🔄 Synchro vers Paul (PO) au daily d'hier (voir les points du daily)
      ech('acmx3', {
        de: 'tom.faure@acme.example',
        a: 'paul.leroy@acme.example',
        type: 'question',
        titre: 'Blocage · Règles du mot de passe à confirmer',
        texte: 'Blocage noté au daily Mobile pour Tom Faure (story « Écran de connexion ») : peux-tu le lever ?',
        choix: 'Je m’en occupe;On en parle après le daily;Autre',
        element: 'acm4',
        transmis_par: 'nina.dupont@acme.example',
        cree_le: `${joursOuvresAvant(prochainDaily(new Date()), 1)}T09:45:00.000Z`,
      }),
      // Escalade sur trois niveaux (lot 1 de la démo complète, 15/10) : Vous → Sara Martin (train), puis Sara → Julie
      // Morel (portfolio) ; les réponses sont redescendues
      ech('acmx4', {
        de: MOI_DEMO,
        a: 'sara.martin@acme.example',
        type: 'question',
        nature: 'blocage',
        titre: '⤴ Blocage · API de paiement bloquée',
        texte: 'Blocage noté au daily Mobile pour Tom Faure (story « Écran de connexion ») : l’équipe ne peut pas le lever seule.',
        choix: 'Résolu;Pas résolu (motif)',
        statut: 'repondu',
        reponse: 'Résolu',
        note: 'Accès donné par le prestataire (clé dans le coffre)',
        niveau: 'train:acmtr1',
        element: 'acm4',
        cree_le: `${joursOuvresAvant(prochainDaily(new Date()), 2)}T09:55:00.000Z`,
      }),
      ech('acmx10', {
        de: 'sara.martin@acme.example',
        a: 'julie.morel@acme.example',
        type: 'question',
        nature: 'blocage',
        titre: '⤴ Blocage · Accès du prestataire de paiement à prolonger',
        texte: 'Noté à l’ART sync Clients : le contrat du prestataire bloque l’équipe Mobile.',
        choix: 'Résolu;Pas résolu (motif)',
        statut: 'repondu',
        reponse: 'Résolu',
        note: 'Contrat prolongé d’un an',
        parent: 'acmx4',
        transmis_par: 'sara.martin@acme.example',
        niveau: 'portfolio:acmpf1',
        element: 'acm4',
        cree_le: `${joursOuvresAvant(prochainDaily(new Date()), 2)}T11:40:00.000Z`,
      }),
      // Question de l'équipe au PO (Vous dans la démo) : dans « Questions de l'équipe » du parcours PO du Daily
      ech('acmx11', {
        de: 'emma.roy@acme.example',
        a: MOI_DEMO,
        type: 'question',
        titre: 'Connexion Google : obligatoire ou facultative ?',
        texte: 'Pour l’écran de connexion, on propose aussi l’e-mail ou seulement Google ?',
        choix: 'Les deux;Google seulement;Autre',
        element: 'acm4',
        cree_le: `${joursOuvresAvant(prochainDaily(new Date()), 1)}T16:00:00.000Z`,
      }),
      // Rappel d'un suivi à valider (08/10) : la réponse de la transmission est redescendue ; « Valider » se fait en
      // réunion (Situation, « À valider »), le Chat ne reçoit qu'un rappel
      ech('acmx5', {
        de: 'sara.martin@acme.example',
        a: MOI_DEMO,
        titre: '📌 À valider · API de paiement bloquée',
        texte: 'Réponse de Sara Martin : accès donné par le prestataire (clé dans le coffre). Validez-le ici (✅ Valider) ou dans la Situation du daily Mobile (« À valider »).',
        element: 'acm4',
        point: 'demo-entreprise|acmpt10',
      }),
      // Transmettre (08/10) : Tom vous signale un blocage ; vous l'avez transmis à Sara Martin en restant dans la boucle ;
      // elle a répondu : à vous de l'accepter et de faire redescendre la réponse à Tom (reformulée)
      ech('acmx6', {
        de: 'tom.faure@acme.example',
        a: MOI_DEMO,
        type: 'question',
        nature: 'blocage',
        titre: 'Serveur de test hors service',
        texte: 'Il ne répond plus depuis lundi, je ne peux plus tester la connexion.',
        choix: 'Résolu;Pas résolu (motif)',
        statut: 'transmis',
        element: 'acm4',
        // Lot 3 : capture et journal joints ; seule la capture a été cochée en transmettant à Sara
        pieces_jointes: 'acmpj1;acmpj2',
      }),
      ech('acmx7', {
        de: MOI_DEMO,
        a: 'sara.martin@acme.example',
        type: 'question',
        nature: 'blocage',
        titre: 'Serveur de test de l’équipe Mobile indisponible',
        texte: '↪ Transmis par Vous (tous les rôles) · pas mon périmètre',
        choix: 'Résolu;Pas résolu (motif)',
        statut: 'repondu',
        reponse: 'Résolu',
        note: 'Redémarré ce matin, la supervision est en place.',
        transmis_par: MOI_DEMO,
        parent: 'acmx6',
        niveau: 'train:acmtr1',
        element: 'acm4',
        pieces_jointes: 'acmpj1',
      }),
      // Lot 3 de la démo complète (15/10) : transmis à trois personnes en parallèle (un maillon chacun, une réponse sur
      // trois : « 🔔 Relancer », « ⊘ Clôturer chez tous ») ; « Je me retire » (Paul → Sara au nom de Paul, transmis par
      // Vous : « Voir en tant que » Paul ou Sara)
      ech('acmx12', { de: 'marc.petit@acme.example', a: MOI_DEMO, type: 'question', nature: 'question', titre: 'Qui présente le paiement à la System demo ?', texte: 'Il faut une personne de l’équipe Mobile pour la démo de vendredi.', choix: 'Moi;Pas disponible', statut: 'transmis', niveau: 'train:acmtr1', element: 'acmf2' }),
      ech('acmx13', { de: MOI_DEMO, a: 'tom.faure@acme.example', type: 'question', nature: 'question', titre: 'Qui présente le paiement à la System demo ?', texte: 'Marc cherche quelqu’un pour la démo de vendredi : tu peux ?', choix: 'Moi;Pas disponible', parent: 'acmx12', transmis_par: MOI_DEMO, element: 'acmf2' }),
      ech('acmx14', { de: MOI_DEMO, a: 'emma.roy@acme.example', type: 'question', nature: 'question', titre: 'Qui présente le paiement à la System demo ?', texte: 'Marc cherche quelqu’un pour la démo de vendredi : tu peux ?', choix: 'Moi;Pas disponible', statut: 'repondu', reponse: 'Moi', note: 'Je montre le paiement en un clic', parent: 'acmx12', transmis_par: MOI_DEMO, element: 'acmf2' }),
      ech('acmx15', { de: MOI_DEMO, a: 'nina.dupont@acme.example', type: 'question', nature: 'question', titre: 'Qui présente le paiement à la System demo ?', texte: 'Marc cherche quelqu’un pour la démo de vendredi : tu peux ?', choix: 'Moi;Pas disponible', parent: 'acmx12', transmis_par: MOI_DEMO, element: 'acmf2' }),
      ech('acmx16', { de: 'paul.leroy@acme.example', a: 'sara.martin@acme.example', type: 'question', nature: 'action', titre: 'Accès au tableau de bord du train', texte: 'Paul a besoin d’un accès en lecture au tableau de bord du train.', choix: 'Fait;Pas possible (motif)', transmis_par: MOI_DEMO, niveau: 'train:acmtr1' }),
      // 💶 Lot 4 : une demande de budget à décider (Chat) et une information reçue (disparaît à la lecture)
      ech('acmx8', {
        de: 'nina.dupont@acme.example',
        a: MOI_DEMO,
        type: 'question',
        nature: 'decision_a_prendre',
        titre: '💶 Demande de budget · Licence de l’outil de test',
        texte: '1 200 € · par an · demandée à Rétrospective du 9/10\nÀ traiter à : ART sync',
        choix: '💶 Accorder;↩ À reprendre (motif);✖ Refuser (motif)',
        point: 'acmdb1',
        niveau: 'train:acmtr1',
      }),
      ech('acmx9', {
        de: 'sara.martin@acme.example',
        a: MOI_DEMO,
        nature: 'information',
        titre: 'ℹ️ Pour information · 💶 Budget',
        texte: 'Votre demande « Écrans de test » : accordée 900 €.\nDécidée à : ART sync du 2/10.',
        niveau: 'equipeagile:acmeqweb',
      }),
    ];
    return e;
  },
  // Organisation d'ACME : hiérarchie (directions, services) et delivery SAFe (portfolio › train › équipes)
  org: () => {
    const stamp = new Date().toISOString();
    const base = { cree_le: stamp, modifie_le: stamp };
    const p = (id: string, nom: string, unite: string, manager: string, capacite = '', metier = '') => ({
      id, nom, metier, email: `${nom.split(' ')[0].toLowerCase()}.${nom.split(' ').slice(1).join('').toLowerCase()}@acme.example`.normalize('NFD').replace(/[̀-ͯ]/g, ''), unite, manager, capacite, ...base,
    });
    return {
      personnes: [
        p('acmp1', 'Claire Vidal', 'acmu1', ''),
        p('acmp2', 'Karim Haddad', 'acmu2', 'acmp1'),
        p('acmp3', 'Julie Morel', 'acmu4', 'acmp1'),
        p('acmp4', 'Sara Martin', 'acmu2', 'acmp2'),
        p('acmp5', 'Marc Petit', 'acmu4', 'acmp3'),
        p('acmp6', 'Paul Leroy', 'acmu3', 'acmp2', '8', 'dev'),
        p('acmp7', 'Nina Dupont', 'acmu3', 'acmp2', '8', 'dev'),
        p('acmp8', 'Tom Faure', 'acmu3', 'acmp2', '8', 'dev'),
        p('acmp9', 'Emma Roy', 'acmu3', 'acmp2', '6', 'testeur'),
        p('acmp10', 'Léa Roux', 'acmu3', 'acmp2', '8', 'designer'),
        p('acmp11', 'Hugo Blanc', 'acmu3', 'acmp2', '8', 'dev'),
        // Deuxième train du portfolio Digital (13/10) : son RTE
        p('acmp12', 'Léo Bernard', 'acmu2', 'acmp2'),
        // Lot 4 de la démo complète (15/10) : Contrôleur de gestion (portfolio) et Partie prenante (équipe Mobile)
        p('acmp13', 'Inès Garnier', 'acmu1', 'acmp1'),
        p('acmp14', 'Antoine Lefèvre', 'acmu4', 'acmp3'),
      ],
      unites: [
        { id: 'acmu1', nom: 'Direction générale', type: 'direction' as const, parent: '', responsable: 'acmp1', ...base },
        { id: 'acmu2', nom: 'Direction technique', type: 'direction' as const, parent: 'acmu1', responsable: 'acmp2', ...base },
        { id: 'acmu3', nom: 'Développement', type: 'service' as const, parent: 'acmu2', responsable: 'acmp2', ...base },
        { id: 'acmu4', nom: 'Direction commerciale', type: 'direction' as const, parent: 'acmu1', responsable: 'acmp3', ...base },
      ],
      // Rôles transverses (13/10) : Claire Vidal (direction générale) voit tout le portfolio
      portfolios: [{ id: 'acmpf1', nom: 'Digital', epic_owner: 'acmp3', transverses: 'acmp1|direction;acmp13|controleur', ...base }],
      trains: [
        // Rôles transverses (13/10) : Karim Haddad (direction technique) coach agile du train et de ses équipes
        { id: 'acmtr1', nom: 'Clients', portfolio: 'acmpf1', rte: 'acmp4', pm: 'acmp5', transverses: 'acmp2|coach', ...base },
        // Deuxième train (13/10) : réalise une partie de l'Application client (paiement sécurisé)
        { id: 'acmtr2', nom: 'Paiements', portfolio: 'acmpf1', rte: 'acmp12', pm: '', ...base },
      ],
      equipes: [
        // Lot 4 : Partie prenante (invitée aux revues) ; Hugo Blanc suppléant de Nina Dupont cette semaine
        { id: 'acmeqmob', nom: 'Mobile', train: 'acmtr1', po: 'acmp6', sm: 'acmp7', membres: 'acmp6;acmp7;acmp8;acmp9', transverses: `acmp14|partie_prenante;acmp11|suppleant|${toDateString(new Date())}|${toDateString(addDays(new Date(), 5))}|acmp7`, ...base },
        { id: 'acmeqweb', nom: 'Web', train: 'acmtr1', po: 'acmp10', sm: 'acmp11', membres: 'acmp10;acmp11', ...base },
      ],
    };
  },
};

/** Jour du prochain daily d'une équipe d'un train : premier jour ouvré, sauf le 1er jour du PI (PI Planning) */
function prochainDaily(now: Date): string {
  for (let d = now; ; d = addDays(d, 1)) {
    const j = toDateString(d);
    const debutPI = toDateString(joursOuvresApres(piStart(piOf(j)))) === j;
    if (d.getDay() >= 1 && d.getDay() <= 5 && !debutPI) return j;
  }
}
const joursOuvresApres = (debut: Date) => {
  let d = debut;
  while (d.getDay() === 0 || d.getDay() === 6) d = addDays(d, 1);
  return d;
};
/** `n` jours ouvrés avant `jour` */
function joursOuvresAvant(jour: string, n: number): string {
  let d = new Date(`${jour}T12:00`);
  for (let k = 0; k < n; ) {
    d = addDays(d, -1);
    if (d.getDay() >= 1 && d.getDay() <= 5) k++;
  }
  return toDateString(d);
}

/** Espaces proposés dans la démo, en plus de « Moi » */
/**
 * 💶 Google Sheet « Budget » d'ACME (démo, 09/10) : coûts annuels des membres des équipes, et des dépenses de
 * chaque sorte (loyer de l'entreprise réparti par effectif, licence d'une epic, prestataire par jour, audit d'une feature)
 */
export function budgetDemoEntreprise(): { depense: Depense[]; cout: CoutPersonne[]; demande: DemandeBudget[]; dossier: DossierInvestissement[]; enveloppe: Enveloppe[] } {
  const stamp = new Date().toISOString();
  const debutAnnee = `${new Date().getFullYear()}-01-01`;
  const dans = (j: number) => toDateString(addDays(new Date(), j));
  const dep = (id: string, x: Partial<Depense>): Depense => ({ id, motif: '', categorie: 'autre', montant: '0', periode: 'ponctuel', du: debutAnnee, au: '', porteur: '', cle: '', parts: '', cree_le: stamp, modifie_le: stamp, ...x });
  const dem = (id: string, x: Partial<DemandeBudget>): DemandeBudget => ({ id, motif: '', montant: '0', periode: 'ponctuel', du: debutAnnee, au: '', pour: '', demandeur: '', destination: 'train:acmtr1', soumis_par: '', origine: '', statut: 'soumise', montant_accorde: '', motif_decision: '', decide_par: '', decide_le: '', hors_reunion: '', cree_le: stamp, modifie_le: stamp, ...x });
  const couts: [string, string][] = [['acmp6', '58000'], ['acmp7', '61000'], ['acmp8', '54000'], ['acmp9', '50000'], ['acmp10', '52000'], ['acmp11', '56000']];
  const dos = (id: string, x: Partial<DossierInvestissement>): DossierInvestissement => ({ id, hypothese: '', estimation: '', budget_prevu: '', budget_mvp: '', decision: '', decide_le: '', decide_par: '', decide_a: '', modifie_le: stamp, ...x });
  const an = String(new Date().getFullYear());
  return {
    // 💶 Enveloppes de l'année (Comité budgétaire) : entreprise et portfolio Digital
    enveloppe: [
      { id: `entreprise:demo-entreprise|${an}`, niveau: 'entreprise:demo-entreprise', annee: an, montant: '400000', modifie_le: stamp },
      { id: `portfolio:acmpf1|${an}`, niveau: 'portfolio:acmpf1', annee: an, montant: '250000', modifie_le: stamp },
      // Enveloppe du train Clients (Budget participatif, 13/10) : il paie les epics qu'il réalise
      { id: `train:acmtr1|${an}`, niveau: 'train:acmtr1', annee: an, montant: '150000', modifie_le: stamp },
      { id: `train:acmtr2|${an}`, niveau: 'train:acmtr2', annee: an, montant: '80000', modifie_le: stamp },
      // Année suivante : enveloppe du portfolio déjà fixée (Comité budgétaire de janvier), à répartir entre les trains
      { id: `portfolio:acmpf1|${Number(an) + 1}`, niveau: 'portfolio:acmpf1', annee: String(Number(an) + 1), montant: '280000', modifie_le: stamp },
    ],
    // 💼 Lot 5 : dossiers d'investissement (deux epics lancées, une idée à décider, MVP du CRM presque atteint)
    dossier: [
      dos('acme1', { hypothese: 'Un seul CRM fait gagner une demi-journée par semaine aux commerciaux', estimation: '60', budget_prevu: '80000', budget_mvp: '12000', decision: 'lancer', decide_le: dans(-30), decide_par: 'marc.petit@acme.example', decide_a: 'Revue du portfolio' }),
      dos('acme2', { hypothese: 'Les clients commandent plus depuis l’application', estimation: '90', budget_prevu: '100000', budget_mvp: '15000', decision: 'lancer', decide_le: dans(-40), decide_par: 'marc.petit@acme.example', decide_a: 'Revue du portfolio' }),
      dos('acme3', { hypothese: 'Payer en un clic double les achats répétés', estimation: '40', budget_prevu: '60000' }),
      // Lot 4 : remise à plus tard (revient à décider) et abandonnée
      dos('acme5', { hypothese: 'Une borne réduit l’attente en magasin', estimation: '30', budget_prevu: '120000', decision: 'pas_maintenant', decide_le: dans(-12), decide_par: 'julie.morel@acme.example', decide_a: 'Revue du portfolio' }),
      dos('acme6', { hypothese: 'Le parrainage apporte 10 % de nouveaux clients', estimation: '15', budget_prevu: '40000', decision: 'abandonner', decide_le: dans(-12), decide_par: 'julie.morel@acme.example', decide_a: 'Revue du portfolio' }),
    ],
    cout: couts.map(([id, cout_annuel]) => ({ id, cout_annuel, cree_le: stamp, modifie_le: stamp })),
    // 💶 Lot 4 : demandes de budget (une à décider à l'ART sync, une accordée, une décidée hors réunion à revoir)
    demande: [
      dem('acmdb1', { motif: 'Licence de l’outil de test', montant: '1200', periode: 'an', du: dans(20), pour: 'epic:acme2', demandeur: 'equipeagile:acmeqmob', soumis_par: 'nina.dupont@acme.example', origine: 'Rétrospective du 9/10' }),
      dem('acmdb2', { motif: 'Écrans de test', montant: '900', periode: 'ponctuel', du: dans(-7), pour: 'epic:acme2', demandeur: 'equipeagile:acmeqweb', soumis_par: MOI_DEMO, origine: 'Planification de sprint du 1/10', statut: 'accordee', montant_accorde: '900', decide_par: 'sara.martin@acme.example', decide_le: stamp }),
      // Lot 4 : refusée (motif), à reprendre (motif), soumise plus haut (du train au portfolio)
      dem('acmdb4', { motif: 'Salon professionnel à Lyon', montant: '6000', periode: 'ponctuel', du: dans(40), pour: 'equipeagile:acmeqweb', demandeur: 'equipeagile:acmeqweb', soumis_par: 'lea.roux@acme.example', origine: 'Revue de sprint du 1/10', statut: 'refusee', motif_decision: 'Hors des priorités du PI', decide_par: 'sara.martin@acme.example', decide_le: stamp }),
      dem('acmdb5', { motif: 'Deuxième serveur de test', montant: '3500', periode: 'an', du: dans(15), pour: 'epic:acme2', demandeur: 'equipeagile:acmeqmob', soumis_par: 'nina.dupont@acme.example', origine: 'Rétrospective du 9/10', statut: 'a_reprendre', motif_decision: 'Comparer avec une offre en ligne', decide_par: 'sara.martin@acme.example', decide_le: stamp }),
      dem('acmdb6', { motif: 'Audit d’accessibilité du site', montant: '18000', periode: 'ponctuel', du: dans(45), pour: 'epic:acme2', demandeur: 'train:acmtr1', destination: 'portfolio:acmpf1', soumis_par: 'sara.martin@acme.example', origine: 'ART sync du 8/10', en_reunion: '1' }),
      // Lot 2 (16/10, R1) : acmdb1 attend au Chat de Vous (« 📌 Mettre en réunion ») ; celle-ci est déjà mise en réunion
      dem('acmdb7', { motif: 'Casques pour les tests d’accessibilité', montant: '450', periode: 'ponctuel', du: dans(10), pour: 'equipeagile:acmeqweb', demandeur: 'equipeagile:acmeqweb', soumis_par: 'lea.roux@acme.example', origine: 'Rétrospective du 9/10', en_reunion: '1' }),
      dem('acmdb3', { motif: 'Formation à l’accessibilité', montant: '2400', periode: 'ponctuel', du: dans(30), pour: 'equipeagile:acmeqmob', demandeur: 'equipeagile:acmeqmob', soumis_par: 'nina.dupont@acme.example', origine: 'Rétrospective du 25/09', statut: 'accordee', montant_accorde: '2000', decide_par: 'marc.petit@acme.example', decide_le: stamp, hors_reunion: '1' }),
    ],
    depense: [
      dep('acmd1', { motif: 'Loyer du bâtiment', categorie: 'frais_generaux', montant: '8000', periode: 'mois', porteur: 'entreprise:demo-entreprise', cle: 'effectif' }),
      dep('acmd2', { motif: 'Licence de cartographie', categorie: 'licence', montant: '300', periode: 'mois', du: dans(-40), au: dans(260), porteur: 'epic:acme2' }),
      dep('acmd3', { motif: 'Prestataire Alex Moreau', categorie: 'prestataire', montant: '550', periode: 'jour', du: dans(-20), au: dans(70), porteur: 'epic:acme2' }),
      dep('acmd4', { motif: 'Audit de sécurité des données', categorie: 'autre', montant: '4000', periode: 'ponctuel', du: dans(35), porteur: 'feature:acmf1' }),
    ],
  };
}

export const ESPACES_DEMO = [
  // Espace Équipe « Studio » (15/10 : renommé, il se confondait avec l'équipe Mobile d'ACME)
  { id: 'demo-equipe', type: 'equipe' as const, nom: 'Studio' },
  { id: 'demo-entreprise', type: 'entreprise' as const, nom: 'ACME' },
];

const stores = new Map<string, ReturnType<typeof creerStore>>();
/** Données de démo d'un espace (un espace ajouté dans la démo démarre vide) */
export function demoApiFor(espace = 'moi') {
  let st = stores.get(espace);
  if (!st) {
    const seeds =
      espace === 'moi'
        ? { items: sample, entities: sampleEntities, points: pointsMoi }
        : espace === 'demo-equipe'
          ? SEEDS_EQUIPE
          : espace === 'demo-entreprise'
            ? SEEDS_ENTREPRISE
            : espace.startsWith('budget@')
              ? { items: () => [], entities: vide, budget: espace === 'budget@demo-entreprise' ? budgetDemoEntreprise : espace === 'budget@demo-equipe' ? budgetDemoEquipe : undefined }
              : { items: () => [], entities: vide };
    st = creerStore(espace, seeds);
    stores.set(espace, st);
  }
  return st;
}
/** Démo : efface pour de bon les données d'un espace (vider la corbeille de President) */
export async function effacerDemo(espace: string): Promise<void> {
  if (espace === 'moi') return;
  const key = espace === 'moi' ? KEY : `${KEY}@${espace}`;
  stores.delete(espace);
  try {
    const cles = (await AsyncStorage.getAllKeys()).filter((k) => k === key || k.startsWith(`${key}-`));
    await AsyncStorage.multiRemove(cles);
  } catch {
    // Stockage indisponible : rien à effacer
  }
}
/** Série de réunions dont la démo a une réunion précédente (photo) : `cles`, ce que la réunion montre */
interface SerieAv {
  prefixe: string;
  focus: number;
  /** Jour de la réunion précédente */
  jour: string;
  cles: string[];
  /** Animateur (auteur de la photo et du suivi) */
  qui: string;
}
/** Statut d'avant (le chemin parcouru depuis) */
const STATUT_EPIC_AVANT: Record<string, string> = { termine: 'en_cours', en_cours: 'pret', pret: 'analyse', analyse: 'idee' };
const STATUT_AVANT: Record<string, string> = { termine: 'en_cours', en_cours: 'a_faire', bloque: 'en_cours', pret: 'analyse', analyse: 'idee', accordee: 'soumise', a_reprendre: 'soumise', refusee: 'soumise' };
/** Sortes changées par niveau (clé) : au niveau de la réunion, toutes ; au-dessus, la première seulement */
const SORTES_DEMO: Record<string, (keyof typeof CHAMP_DEMO | 'ajoute')[]> = {
  t: ['statut', 'responsable', 'echeance', 'planning', 'ajoute'],
  f: ['statut', 'planning', 'ajoute'],
  q: ['valeur'],
  e: ['statut', 'valeur', 'echeance', 'ajoute'],
  v: ['valeur'],
  d: ['statut', 'valeur'],
  o: ['valeur', 'echeance'],
  r: ['valeur'],
};
const CHAMP_DEMO = { statut: 0, valeur: 1, echeance: 2, planning: 3, responsable: 4 } as const;
const RANG_DEMO: Record<string, number> = { t: 0, f: 1, q: 1, e: 2, v: 2, d: 2, o: 3, r: 3 };
/** Valeur d'avant d'un champ, ou '' si on ne peut pas la changer */
function avantDe(sorte: keyof typeof CHAMP_DEMO, v: string, k: number, personnes: string[], epic = false): string {
  if (sorte === 'statut') return (epic ? STATUT_EPIC_AVANT : STATUT_AVANT)[v] ?? '';
  if (sorte === 'valeur') {
    const n = Number(v);
    if (v === '' || !Number.isFinite(n) || n <= 0) return '';
    return String(n <= 10 ? Math.max(0, Math.round((n - 2) * 10) / 10) : n < 5000 ? Math.round(n * 0.8) : Math.round((n * 0.8) / 1000) * 1000);
  }
  if (sorte === 'echeance') return /^\d{4}-\d{2}-\d{2}$/.test(v) ? toDateString(addDays(new Date(`${v}T12:00`), -7 - (k % 3) * 7)) : '';
  if (sorte === 'planning') return /-IT\d+$/.test(v) ? shiftIteration(v, -1) : /^\d{4}-T\d$/.test(v) ? shiftPi(v, -1) : '';
  return personnes.filter((x) => x && x !== v)[k % Math.max(1, personnes.length - 1)] ?? '';
}
/**
 * Avancement dans toutes les réunions de la démo (14/10) : pour chaque série, la photo de sa réunion précédente diffère
 * de la situation actuelle d'un changement de chaque sorte au niveau de la réunion (statut, valeur, échéance, sprint ou
 * PI, responsable, ajouté en cours de route), d'un changement par niveau au-dessus, et d'un suivi passé à « Fait »
 */
/**
 * Démo complète (15/10) : identifiant de la prochaine réunion d'une série par défaut (`sens` -1 : la précédente),
 * pour y préparer des données (idées, votes, problèmes…) visibles à l'ouverture
 */
function occurrenceDemo(type: TypeReunion, niveau: string, sens: 1 | -1 = 1): string {
  const auj = toDateString(new Date());
  const s = serieParDefaut(type, niveau);
  const l = sens > 0 ? occurrences(s, auj, toDateString(addDays(new Date(), 200))) : occurrences(s, toDateString(addDays(new Date(), -150)), toDateString(addDays(new Date(), -1)));
  const o = (sens > 0 ? l : [...l].reverse()).find((x) => !x.annulee);
  return `${type}-${niveau}-${o?.origine ?? auj}`;
}
function photosSeries(series: SerieAv[], actuel: Record<string, string>, personnes: string[], prefixeId: string): PointReunion[] {
  const out: PointReunion[] = [];
  series.forEach((s, n) => {
    const photo = { ...actuel };
    const prises = new Set<string>();
    for (const [g, sortes] of Object.entries(SORTES_DEMO)) {
      if (RANG_DEMO[g] < s.focus) continue;
      const cles = s.cles.filter((c) => c.startsWith(`${g}:`) && photo[c] !== undefined);
      if (!cles.length) continue;
      const aFaire = RANG_DEMO[g] === s.focus || (s.focus === 0 && g === 'f') ? sortes : sortes.slice(0, 1);
      aFaire.forEach((sorte, i) => {
        // Une clé différente par sorte, décalée d'une série à l'autre
        for (let j = 0; j < cles.length; j++) {
          const cle = cles[(n + i + j) % cles.length];
          if (prises.has(cle)) continue;
          if (sorte === 'ajoute') {
            delete photo[cle];
            prises.add(cle);
            return;
          }
          const c = photo[cle].split('|');
          const avant = avantDe(sorte, c[CHAMP_DEMO[sorte]] ?? '', n + i, personnes, g === 'e');
          if (!avant || avant === c[CHAMP_DEMO[sorte]]) continue;
          c[CHAMP_DEMO[sorte]] = avant;
          photo[cle] = c.join('|');
          prises.add(cle);
          return;
        }
      });
    }
    const reunion = `${s.prefixe}${s.jour}`;
    // Suivi noté à la réunion précédente : « En cours » à la photo, « Fait » depuis
    const suivi: PointReunion = {
      id: `${prefixeId}sav${n + 1}`, reunion, personne: s.qui, auteur: s.qui, type: n % 2 ? 'risque' : 'action', texte: n % 2 ? 'Risque de retard sur les tests de charge' : 'Partager le plan de la prochaine période',
      element: '', concretisation: 'suivi', tache: '', responsable: s.qui, statut: 'fait', validateur: s.qui, echeance: s.jour, note: 'Fait', cree_le: `${s.jour}T10:00:00.000Z`,
    };
    photo[`s:${suivi.id}`] = ['en_cours', '', s.jour, '', s.qui].join('|');
    out.push(suivi, ...pointsPhoto(reunion, s.qui, photo, FILTRE_TOUT).map((x, k) => ({ ...x, id: `${prefixeId}sav${n + 1}p${k + 1}`, cree_le: `${s.jour}T10:30:00.000Z` })));
  });
  return out;
}
/**
 * 🔒 Moi (13/10) : photo de la Revue des objectifs du mois dernier, d'où « Avancement depuis la Revue des objectifs du … » :
 * « Doubler le nombre de clients » est passé de 5 à 8 clients
 */
function pointsMoi(): PointReunion[] {
  const avant = toDateString(addDays(new Date(), -30));
  const photo = photoDe({ objectifs: sampleEntities().objectif }, 3);
  photo['o:o1'] = ['', '5', ...photo['o:o1'].split('|').slice(2)].join('|');
  const revue = pointsPhoto(`revue_objectifs-perso-${avant}`, MOI_DEMO, photo, FILTRE_TOUT).map((x, k) => ({ ...x, id: `moiav${k + 1}`, cree_le: `${avant}T18:00:00.000Z` }));
  // Avancement des autres réunions perso (14/10) : Bilan du soir d'hier (d'où le Point perso et le Bilan du soir
  // d'aujourd'hui), Revue de la semaine, Revue du trimestre, Point annuel
  const items = sample();
  const ent = sampleEntities();
  const actuel = photoDe({ items, objectifs: ent.objectif }, 0);
  const jour = toDateString(new Date());
  const cles = [...items.filter((t) => !t.parent).map((t) => `t:${t.id}`), ...ent.objectif.map((o) => `o:${o.id}`)];
  const serie = (type: string, recul: number, focus: number): SerieAv => ({ prefixe: `${type}-perso-`, focus, jour: joursOuvresAvant(jour, recul), cles, qui: MOI_DEMO });
  // Lot 5 de la démo complète (15/10) : plan du jour (créneaux des éléments cochés à mes Dailies d'aujourd'hui : la
  // démo du sprint de 14:00 à 16:00, la page d'accueil le matin ; un événement perso), un suivi perso et une note à
  // concrétiser du Point perso d'hier
  const pt = (id: string, x: Partial<PointReunion>): PointReunion => ({ id, reunion: '', personne: MOI_DEMO, auteur: MOI_DEMO, type: 'donnee', texte: '', element: '', concretisation: '', tache: '', responsable: '', cree_le: `${jour}T07:30:00.000Z`, ...x });
  const plan = `plan_jour-moi-${jour}`;
  const hier = joursOuvresAvant(jour, 1);
  const perso = [
    pt('moipl1', { reunion: plan, element: 'acm13', texte: JSON.stringify({ k: 'place', h: '14:00', f: '16:00' }) }),
    pt('moipl2', { reunion: plan, element: 'acm15', texte: JSON.stringify({ k: 'place', d: 'Matin' }) }),
    pt('moipl3', { reunion: plan, texte: JSON.stringify({ k: 'evt', h: '17:00', f: '17:45', t: 'Rendez-vous chez le dentiste' }) }),
    pt('moisp1', { reunion: `point_perso-perso-${hier}`, type: 'action', texte: 'Relancer l’assurance pour le devis', concretisation: 'suivi', responsable: MOI_DEMO, statut: 'en_cours', validateur: MOI_DEMO, echeance: jour, cree_le: `${hier}T07:40:00.000Z` }),
    pt('moisp2', { reunion: `point_perso-perso-${hier}`, type: 'blocage', texte: 'Devis du plombier toujours pas reçu', cree_le: `${hier}T07:42:00.000Z` }),
    // Lot 1 des notes (16/10) : au Daily Mobile, une note « En préparation » écrite pour le Daily précédent et pas
    // partagée (rappel 🟡, N1), et une note « 🔒 Perso » (V1), gardées dans 🔒 Moi
    pt('moinp1', { reunion: `daily-equipeagile:acmeqmob-${joursOuvresAvant(prochainDaily(new Date()), 1)}`, type: 'information', texte: 'Présenter la nouvelle maquette du profil', element: 'acm13', cree_le: `${hier}T09:10:00.000Z` }),
    pt('moinp2', { reunion: `daily-equipeagile:acmeqmob-${prochainDaily(new Date())}`, type: 'action', texte: 'Relire mes notes sur l’API avant la démo', element: 'acm13', perso: '1', cree_le: `${jour}T07:35:00.000Z` }),
  ];
  return [...revue, ...photosSeries([serie('bilan_soir', 1, 0), serie('revue_semaine', 5, 0), serie('revue_trimestre', 63, 3), serie('point_annuel', 250, 3)], actuel, [], 'moi'), ...perso];
}
/** Budget de l'équipe Mobile en mode Simple (lot 5, 15/10) : budget prévu du projet, dépenses */
function budgetDemoEquipe() {
  const stamp = new Date().toISOString();
  const dans = (j: number) => toDateString(addDays(new Date(), j));
  return {
    dossier: [{ id: 'mobe1', hypothese: '', estimation: '', budget_prevu: '30000', budget_mvp: '', decision: '', decide_le: '', decide_par: '', decide_a: '', estimation_fin: '', modifie_le: stamp } as DossierInvestissement],
    depense: [
      { id: 'mobd1', motif: 'Comptes développeur des magasins d’applications', categorie: 'licence', montant: '120', periode: 'an', du: dans(-60), au: '', porteur: 'epic:mobe1', cle: '', parts: '', cree_le: stamp, modifie_le: stamp } as Depense,
      { id: 'mobd2', motif: 'Graphiste (icônes)', categorie: 'prestataire', montant: '450', periode: 'jour', du: dans(-20), au: dans(-14), porteur: 'epic:mobe1', cle: '', parts: '', cree_le: stamp, modifie_le: stamp } as Depense,
    ],
    cout: [],
    demande: [],
  };
}
/** Données d'exemple d'un espace de la démo (sans stockage) : pour les vérifications automatiques */
export function donneesDemo(espace = 'moi') {
  const seeds = espace === 'moi' ? { items: sample, entities: sampleEntities } : espace === 'demo-equipe' ? SEEDS_EQUIPE : SEEDS_ENTREPRISE;
  return { items: seeds.items(), entities: seeds.entities() };
}
/** Points de réunion d'exemple d'un espace de la démo (sans stockage) : pour les vérifications automatiques */
export function pointsDemo(espace: string): PointReunion[] {
  return (espace === 'demo-entreprise' ? SEEDS_ENTREPRISE.points?.() : undefined) ?? [];
}
/** Organisation d'exemple d'un espace de la démo (sans stockage) : pour les vérifications automatiques */
export function orgDemo(espace: string): Org {
  const seeds = espace === 'demo-entreprise' ? SEEDS_ENTREPRISE : undefined;
  return seeds?.org?.() ?? { personnes: [], unites: [], portfolios: [], trains: [], equipes: [] };
}
/** Espace « Moi » de la démo */
export const demoApi = demoApiFor('moi');
