import AsyncStorage from '@react-native-async-storage/async-storage';
import { addDays, toDateString } from './dates';
import { iterationOf, piOf, shiftPi } from './pi';
import { creerMagasin, type Kind, type Persistance, type Table, TABLES, TABLES_ORG } from './magasin';
import { CLE_ORG, type KindOrg, type Org } from './organisation';
import { RECURRENCE_DEFAUTS, type Domaine, type Epic, type Feature, type Ignoree, type Item, type Objectif, type ObjectifPI } from './types';

/**
 * Mode démo (EXPO_PUBLIC_DEMO=1) : données d'exemple enregistrées sur l'appareil,
 * sans Google Sheet. Sert à essayer l'application en ligne.
 */
export const DEMO = process.env.EXPO_PUBLIC_DEMO === '1';

const KEY = 'mes-taches:demo';
/**
 * Version des données d'exemple : à augmenter quand leur forme change (nouveaux champs, nouveaux niveaux).
 * Des données enregistrées par une version plus ancienne de la démo sont remplacées par les nouvelles.
 */
const DEMO_DATA_VERSION = '21';
const VERSION_KEY = `${KEY}-version`;
let versionChecked: Promise<void> | null = null;

function checkVersion(): Promise<void> {
  versionChecked ??= (async () => {
    try {
      if ((await AsyncStorage.getItem(VERSION_KEY)) === DEMO_DATA_VERSION) return;
      // Données de tous les espaces de la démo (clés « mes-taches:demo… »)
      const cles = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(KEY) && k !== VERSION_KEY);
      await AsyncStorage.multiRemove(cles);
      await AsyncStorage.setItem(VERSION_KEY, DEMO_DATA_VERSION);
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
      ep('e1', 'Refonte du site web', m(-1), m(4, 0), '#1A73E8', { objectif: 'o1', etat: 'en_cours' }, 'Nouveau site vitrine et prise de rendez-vous en ligne'),
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
  };
}

type Seeds = { items: () => Item[]; entities: () => ReturnType<typeof sampleEntities>; org?: () => Org };

/**
 * Stockage d'un espace de la démo (« moi » : clés historiques ; autres : « mes-taches:demo@<espace> »), avec
 * les mêmes règles que les Google Sheets (magasin commun).
 */
function creerStore(espace: string, seeds: Seeds) {
  const key = espace === 'moi' ? KEY : `${KEY}@${espace}`;
  const memoire: Partial<Record<Table, unknown[]>> = {};
  const cle = (t: Table) => (t === 'items' ? key : `${key}-${t}`);
  const exemples = (t: Table): unknown[] =>
    t === 'items' ? seeds.items() : TABLES_ORG.includes(t as KindOrg) ? (seeds.org?.()[CLE_ORG[t as KindOrg]] ?? []) : seeds.entities()[t as Kind];

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
      for (const t of [...TABLES, ...TABLES_ORG]) await persistance.ecrire(t, exemples(t) as never);
      await persistance.ecrire('ignoree', []);
    },
  };
}

// ---------------------------------------------------------------------------
// Exemples des autres espaces de la démo : une équipe « Mobile », une entreprise « ACME »
// ---------------------------------------------------------------------------
const vide = () => ({ epic: [], objectif: [], domaine: [], feature: [], objectifpi: [], ignoree: [] }) as ReturnType<typeof sampleEntities>;
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
    return e;
  },
};
const SEEDS_ENTREPRISE: Seeds = {
  items: () =>
    exemple('acm', [
      ['Choisir le prestataire du nouveau CRM', 'tache', 5, { epic: 'acme1', points: '2' }],
      ['Migrer les contacts clients', 'story', SANS_DATE, { feature: 'acmf1', points: '8', equipe: 'acmeqmob', responsable: 'acmp7' }],
      ['Former les commerciaux', 'mission', 20, { epic: 'acme1' }],
      ['Écran de connexion', 'story', 3, { feature: 'acmf2', points: '3', equipe: 'acmeqmob', responsable: 'acmp8' }],
      ['Paiement en ligne', 'story', 8, { feature: 'acmf2', points: '5', equipe: 'acmeqmob' }],
      ['Page d’accueil du site', 'story', 6, { feature: 'acmf3', points: '3', equipe: 'acmeqweb', responsable: 'acmp10' }],
    ]),
  entities: () => {
    const e = vide();
    const stamp = new Date().toISOString();
    const base = { cree_le: stamp, modifie_le: stamp };
    const now = new Date();
    const m = (n: number) => toDateString(new Date(now.getFullYear(), now.getMonth() + n, 1));
    e.domaine = [{ id: 'acmdpro', nom: 'Pro', icone: '💼', couleur: '#1A73E8', parent: '', ...base }];
    e.objectif = [{ id: 'acmo1', titre: 'Fidéliser les clients', domaine: 'acmdpro', debut: m(-2), fin: m(10), couleur: '#1A73E8', description: '', cible: '90', actuel: '82', unite: '% de clients fidèles', ...base }];
    e.epic = [
      { id: 'acme1', titre: 'Nouveau CRM', description: '', debut: m(0), fin: m(6), couleur: '#00897B', objectif: 'acmo1', domaine: '', etat: 'pret', portfolio: 'acmpf1', ...base },
      { id: 'acme2', titre: 'Application client', description: '', debut: m(-1), fin: m(8), couleur: '#C2185B', objectif: 'acmo1', domaine: '', etat: 'en_cours', portfolio: 'acmpf1', ...base },
    ];
    e.feature = [
      { id: 'acmf1', titre: 'Reprise des données', description: '', epic: 'acme1', pi: piOf(now), iteration: '', points: '13', couleur: '', train: 'acmtr1', equipe: 'acmeqmob', ...base },
      { id: 'acmf2', titre: 'Compte client mobile', description: '', epic: 'acme2', pi: piOf(now), iteration: '', points: '8', couleur: '', train: 'acmtr1', equipe: 'acmeqmob', ...base },
      { id: 'acmf3', titre: 'Nouveau site vitrine', description: '', epic: 'acme2', pi: piOf(now), iteration: '', points: '5', couleur: '', train: 'acmtr1', equipe: 'acmeqweb', ...base },
    ];
    return e;
  },
  // Organisation d'ACME : hiérarchie (directions, services) et delivery SAFe (portfolio › train › équipes)
  org: () => {
    const stamp = new Date().toISOString();
    const base = { cree_le: stamp, modifie_le: stamp };
    const p = (id: string, nom: string, unite: string, manager: string, capacite = '') => ({
      id, nom, email: `${nom.split(' ')[0].toLowerCase()}.${nom.split(' ').slice(1).join('').toLowerCase()}@acme.example`.normalize('NFD').replace(/[̀-ͯ]/g, ''), unite, manager, capacite, ...base,
    });
    return {
      personnes: [
        p('acmp1', 'Claire Vidal', 'acmu1', ''),
        p('acmp2', 'Karim Haddad', 'acmu2', 'acmp1'),
        p('acmp3', 'Julie Morel', 'acmu4', 'acmp1'),
        p('acmp4', 'Sara Martin', 'acmu2', 'acmp2'),
        p('acmp5', 'Marc Petit', 'acmu4', 'acmp3'),
        p('acmp6', 'Paul Leroy', 'acmu3', 'acmp2', '8'),
        p('acmp7', 'Nina Dupont', 'acmu3', 'acmp2', '8'),
        p('acmp8', 'Tom Faure', 'acmu3', 'acmp2', '8'),
        p('acmp9', 'Emma Roy', 'acmu3', 'acmp2', '6'),
        p('acmp10', 'Léa Roux', 'acmu3', 'acmp2', '8'),
        p('acmp11', 'Hugo Blanc', 'acmu3', 'acmp2', '8'),
      ],
      unites: [
        { id: 'acmu1', nom: 'Direction générale', type: 'direction' as const, parent: '', responsable: 'acmp1', ...base },
        { id: 'acmu2', nom: 'Direction technique', type: 'direction' as const, parent: 'acmu1', responsable: 'acmp2', ...base },
        { id: 'acmu3', nom: 'Développement', type: 'service' as const, parent: 'acmu2', responsable: 'acmp2', ...base },
        { id: 'acmu4', nom: 'Direction commerciale', type: 'direction' as const, parent: 'acmu1', responsable: 'acmp3', ...base },
      ],
      portfolios: [{ id: 'acmpf1', nom: 'Digital', epic_owner: 'acmp3', ...base }],
      trains: [{ id: 'acmtr1', nom: 'Clients', portfolio: 'acmpf1', rte: 'acmp4', pm: 'acmp5', ...base }],
      equipes: [
        { id: 'acmeqmob', nom: 'Mobile', train: 'acmtr1', po: 'acmp6', sm: 'acmp7', membres: 'acmp6;acmp7;acmp8;acmp9', ...base },
        { id: 'acmeqweb', nom: 'Web', train: 'acmtr1', po: 'acmp10', sm: 'acmp11', membres: 'acmp10;acmp11', ...base },
      ],
    };
  },
};

/** Espaces proposés dans la démo, en plus de « Moi » */
export const ESPACES_DEMO = [
  { id: 'demo-equipe', type: 'equipe' as const, nom: 'Mobile' },
  { id: 'demo-entreprise', type: 'entreprise' as const, nom: 'ACME' },
];

const stores = new Map<string, ReturnType<typeof creerStore>>();
/** Données de démo d'un espace (un espace ajouté dans la démo démarre vide) */
export function demoApiFor(espace = 'moi') {
  let st = stores.get(espace);
  if (!st) {
    const seeds =
      espace === 'moi'
        ? { items: sample, entities: sampleEntities }
        : espace === 'demo-equipe'
          ? SEEDS_EQUIPE
          : espace === 'demo-entreprise'
            ? SEEDS_ENTREPRISE
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
/** Données d'exemple d'un espace de la démo (sans stockage) : pour les vérifications automatiques */
export function donneesDemo(espace = 'moi') {
  const seeds = espace === 'moi' ? { items: sample, entities: sampleEntities } : espace === 'demo-equipe' ? SEEDS_EQUIPE : SEEDS_ENTREPRISE;
  return { items: seeds.items(), entities: seeds.entities() };
}
/** Organisation d'exemple d'un espace de la démo (sans stockage) : pour les vérifications automatiques */
export function orgDemo(espace: string): Org {
  const seeds = espace === 'demo-entreprise' ? SEEDS_ENTREPRISE : undefined;
  return seeds?.org?.() ?? { personnes: [], unites: [], portfolios: [], trains: [], equipes: [] };
}
/** Espace « Moi » de la démo */
export const demoApi = demoApiFor('moi');
