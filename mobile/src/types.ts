/** Mêmes types en mode Simple et en mode SAFe (v7 : appel, démarche, story, exploration, bug). */
export type ItemType = 'tache' | 'rendez-vous' | 'appel' | 'demarche' | 'mission' | 'story' | 'exploration' | 'bug';
/** Types apparus avec la version 7 du script */
/** Types qui ont une heure de fin (créneau dans l'agenda) */
export const AVEC_FIN: ItemType[] = ['rendez-vous', 'mission'];
export const aHeureFin = (type: ItemType) => AVEC_FIN.includes(type);
/** Types sans « En cours » : un rendez-vous a lieu ou pas, un appel est passé ou pas */
export const sansEnCours = (type: ItemType) => type === 'rendez-vous' || type === 'appel';
/** Types qui ont une date de fin (date limite) */
export const aDateFin = (type: ItemType) => type === 'demarche';
/**
 * Date qui sert de repère (liste, calendrier, itération) : la date, sinon la date de fin d'une démarche
 * (une démarche sans date mais avec une échéance n'est pas « sans date »).
 */
export const dateRepere = (t: Pick<Item, 'date' | 'date_fin' | 'type' | 'periodicite'>) =>
  t.date || (aDateFin(t.type) && !t.periodicite ? (t.date_fin ?? '') : '');
/** Démarche dont la date de fin est passée sans être terminée */
export const finDepassee = (t: Pick<Item, 'date_fin' | 'type' | 'statut'>, today: string) =>
  aDateFin(t.type) && !!t.date_fin && t.date_fin < today && t.statut !== 'termine';

export const TYPES_V7: ItemType[] = ['appel', 'demarche', 'story', 'exploration', 'bug'];
export type Priorite = 'basse' | 'normale' | 'haute';
export type Statut = 'a_faire' | 'en_cours' | 'termine';
/** '' = pas de répétition */
export type Periodicite = '' | 'hebdomadaire' | 'mensuelle' | 'trimestrielle' | 'annuelle';

/** Une ligne de l'onglet « Taches » du Google Sheet. */
export interface Item {
  /** Espace (Google Sheet) d'où vient l'élément : posé par l'application au chargement, jamais enregistré */
  espace?: string;
  id: string;
  titre: string;
  type: ItemType;
  /** AAAA-MM-JJ ou vide */
  date: string;
  /** HH:MM ou vide */
  heure: string;
  /** Heure de fin (rendez-vous, mission), HH:MM ou vide */
  heure_fin: string;
  /** Date de fin (démarche) : date limite, AAAA-MM-JJ ou vide (v12) */
  date_fin: string;
  /** Jour où la tâche est passée à « Terminé » (calculé par le script, v13), vide sinon */
  termine_le: string;
  /** Statut d'avant « Terminé » ('en_cours' ou vide), calculé par le script (v14) : décocher le remet */
  statut_avant: string;
  lieu: string;
  description: string;
  priorite: Priorite;
  statut: Statut;
  cree_le: string;
  modifie_le: string;
  /** Répétition de l'élément */
  periodicite: Periodicite;
  /**
   * Moment dans la période, vide = « dans la période » :
   * semaine « 1 » (lundi) à « 7 » ; mois « 1 » à « 31 » ;
   * trimestre « m » ou « m-j » (m = 1er, 2e ou 3e mois) ; année « MM » ou « MM-JJ ».
   */
  echeance: string;
  /** Première période concernée (AAAA-MM-JJ), vide = date de création */
  debut: string;
  /** Fin de la répétition (AAAA-MM-JJ), vide = sans fin */
  fin: string;
  /** Périodes faites, séparées par « ; » (ex. « 2026-08;2026-09 ») */
  faits: string;
  /** Rattachement (le plus précis seulement) : epic, sinon objectif, sinon domaine (ids) */
  epic: string;
  objectif: string;
  domaine: string;
  /** SAFe : points (facultatif), itération choisie à la main (ex. 2026-T4-IT3), feature (id, le plus précis) */
  points: string;
  iteration: string;
  feature: string;
  /** Appel : numéro à composer */
  telephone: string;
  /** Sous-tâche : id de la tâche parente (un seul niveau) */
  parent: string;
  /** Entreprise (delivery SAFe) : équipe agile qui porte l'élément, et personne responsable (ids de l'Organisation) */
  equipe?: string;
  responsable?: string;
  /** Backlog (lot 4) : rang de priorité dans son backlog (plus petit = plus prioritaire), vide = non classé */
  rang?: string;

  // --- Champs calculés par l'application (non enregistrés) ---
  /** Occurrence affichée d'un élément répété : clé de sa période */
  occurrence?: string;
  /** Élément d'origine d'une occurrence */
  baseId?: string;
  /** Occurrence sans jour précis : étendue de la période */
  fenetre?: 'semaine' | 'mois' | 'trimestre' | 'annee';
  /** Libellé de la période (« sept. 2026 », « semaine du 21 sept. »…) */
  periodeLabel?: string;
  /** Périodes oubliées, regroupées sur une ligne « En retard » */
  retards?: string[];
  /** Calendrier : repère « ⏳ Fin » d'une démarche, affiché le jour de sa date de fin (en plus de sa date) */
  repereFin?: boolean;
  /** Sous-tâche affichée seule (calendrier) : titre du parent */
  parentTitre?: string;
  /** Parent affiché dans la liste : sous-tâches visibles, avancement, alerte de points */
  sousTaches?: Item[];
  sousTotal?: number;
  sousFaites?: number;
  alertePoints?: boolean;
}

export type ItemInput = Omit<
  Item,
  | 'id'
  | 'cree_le'
  | 'termine_le'
  | 'statut_avant'
  | 'modifie_le'
  | 'occurrence'
  | 'baseId'
  | 'fenetre'
  | 'periodeLabel'
  | 'retards'
  | 'parentTitre'
  | 'sousTaches'
  | 'sousTotal'
  | 'sousFaites'
  | 'alertePoints'
>;

/** Champs ajoutés avec la répétition : valeurs par défaut pour les anciennes données. */
export const RECURRENCE_DEFAUTS = {
  periodicite: '',
  echeance: '',
  debut: '',
  fin: '',
  faits: '',
  epic: '',
  objectif: '',
  domaine: '',
  points: '',
  iteration: '',
  feature: '',
  telephone: '',
  parent: '',
  heure_fin: '',
  date_fin: '',
  termine_le: '',
  statut_avant: '',
  equipe: '',
  responsable: '',
} as const;

/** Une ligne de l'onglet « Epics » : grand projet affiché dans la roadmap. */
export interface Epic {
  /** Espace (Google Sheet) d'où vient l'élément : posé par l'application au chargement, jamais enregistré */
  espace?: string;
  id: string;
  titre: string;
  description: string;
  /** AAAA-MM-JJ */
  debut: string;
  /** AAAA-MM-JJ, vide = epic sans fin (infinie) */
  fin: string;
  /** #RRGGBB */
  couleur: string;
  cree_le: string;
  modifie_le: string;
  /** Objectif (id), sinon domaine (id) */
  objectif: string;
  domaine: string;
  /** SAFe : état dans le Kanban du portefeuille ; vide = déduit des dates */
  etat: EtatEpic | '';
  /** Entreprise (delivery SAFe) : portfolio qui porte l'epic (id de l'Organisation) */
  portfolio?: string;
  /** SAFe (lot 4) : value streams de l'epic (ids séparés par « ; ») */
  value_streams?: string;
  /** SAFe (lot 4) : OKR liés directement (seulement pour une epic sans value stream ; ids séparés par « ; ») */
  okrs?: string;
  /** Backlog (lot 4) : rang de priorité dans le backlog du portfolio */
  rang?: string;
  /** Pilotage (09/10) : budget prévu en euros ; consommé saisi à la main (vide = calculé d'après les coûts annuels) */
  budget?: string;
  consomme?: string;
}

export type EtatEpic = 'idee' | 'analyse' | 'pret' | 'en_cours' | 'termine';

export const ETATS_EPIC: { value: EtatEpic; label: string; color: string }[] = [
  { value: 'idee', label: 'Idée', color: '#9AA3AF' },
  { value: 'analyse', label: 'Analyse', color: '#8E24AA' },
  { value: 'pret', label: 'Prêt', color: '#E37400' },
  { value: 'en_cours', label: 'En cours', color: '#1A73E8' },
  { value: 'termine', label: 'Terminé', color: '#188038' },
];

/** SAFe : sous-epic prévue dans un PI (trimestre), éventuellement dans une itération. */
export interface Feature {
  /** Espace (Google Sheet) d'où vient l'élément : posé par l'application au chargement, jamais enregistré */
  espace?: string;
  id: string;
  titre: string;
  description: string;
  epic: string;
  /** ex. 2026-T4 */
  pi: string;
  /** ex. 2026-T4-IT3 ou 2026-T4-IP */
  iteration: string;
  points: string;
  couleur: string;
  cree_le: string;
  modifie_le: string;
  /** Entreprise (delivery SAFe) : train qui porte la feature, et équipe qui la réalise (ids de l'Organisation) */
  train?: string;
  equipe?: string;
  /** Backlog (lot 4) : rang de priorité dans le backlog du train */
  rang?: string;
}

export type FeatureInput = Omit<Feature, 'id' | 'cree_le' | 'modifie_le'>;

/** SAFe : objectif du PI, engagement d'un trimestre. */
export interface ObjectifPI {
  /** Espace (Google Sheet) d'où vient l'élément : posé par l'application au chargement, jamais enregistré */
  espace?: string;
  id: string;
  titre: string;
  pi: string;
  type: 'engage' | 'bonus';
  /** 0 à 10, vide si non noté */
  valeur_prevue: string;
  valeur_obtenue: string;
  cree_le: string;
  modifie_le: string;
  /** Domaine (id), vide = tous domaines */
  domaine: string;
  /** Epic (id), vide = aucune en particulier (v11) */
  epic: string;
}

export type ObjectifPIInput = Omit<ObjectifPI, 'id' | 'cree_le' | 'modifie_le'>;

export type EpicInput = Omit<Epic, 'id' | 'cree_le' | 'modifie_le'>;

/** Onglet « Objectifs » : résultat à atteindre, daté ou permanent. */
export interface Objectif {
  /** Espace (Google Sheet) d'où vient l'élément : posé par l'application au chargement, jamais enregistré */
  espace?: string;
  id: string;
  titre: string;
  description: string;
  domaine: string;
  debut: string;
  /** vide = objectif permanent */
  fin: string;
  couleur: string;
  /** Indicateur facultatif : valeur cible, valeur actuelle, unité */
  cible: string;
  actuel: string;
  unite: string;
  cree_le: string;
  modifie_le: string;
}

export type ObjectifInput = Omit<Objectif, 'id' | 'cree_le' | 'modifie_le'>;

/** Onglet « Domaines » : grande catégorie permanente (Pro, Perso…), ou sous-domaine d'un domaine (Santé sous Perso). */
export interface Domaine {
  /** Espace (Google Sheet) d'où vient l'élément : posé par l'application au chargement, jamais enregistré */
  espace?: string;
  id: string;
  nom: string;
  icone: string;
  couleur: string;
  /** Domaine au-dessus (sous-domaine, un seul niveau) ; vide = domaine principal */
  parent: string;
  cree_le: string;
  modifie_le: string;
}

/** Domaines de base de l'espace Moi : Santé sous Perso ; Projets et Travail sous Pro. */
export interface ModeleDomaine {
  nom: string;
  icone: string;
  couleur: string;
  /** Sous-domaines */
  sous?: ModeleDomaine[];
}
export const DOMAINES_DE_BASE: ModeleDomaine[] = [
  {
    nom: 'Pro',
    icone: '💼',
    couleur: '#1A73E8',
    sous: [
      { nom: 'Projets', icone: '📁', couleur: '#1967D2' },
      { nom: 'Travail', icone: '🛠️', couleur: '#0B57D0' },
    ],
  },
  { nom: 'Perso', icone: '🏠', couleur: '#188038', sous: [{ nom: 'Santé', icone: '🩺', couleur: '#D93025' }] },
  { nom: 'Famille', icone: '👪', couleur: '#E37400' },
  { nom: 'Loisirs', icone: '🎨', couleur: '#8E24AA' },
];

export type DomaineInput = Omit<Domaine, 'id' | 'cree_le' | 'modifie_le'>;

export type EntityKind = 'epic' | 'objectif' | 'domaine' | 'feature' | 'objectifpi' | 'ignoree' | 'valuestream' | 'resultat' | 'echange';

/**
 * Échange (onglet « Echanges » du Google Sheet de l'espace) : un message ou une question à choix, entre deux
 * interlocuteurs — vous (e-mail), une autre personne (e-mail), Claude (« claude », IA chat) ou l'application
 * (« president »). Pas d'historique : un message lu, ou une réponse prise en compte par celui qui a demandé,
 * est supprimé.
 */
export interface Echange {
  espace?: string;
  id: string;
  /** Qui écrit : e-mail, « claude » ou « president » */
  de: string;
  /** À qui : e-mail, « claude » ou « president » */
  a: string;
  type: 'message' | 'question';
  titre: string;
  texte: string;
  /** Question : choix proposés, séparés par « ; » */
  choix: string;
  /** Question : choix retenu par le destinataire */
  reponse: string;
  /** Remarque jointe à la réponse */
  note: string;
  /**
   * envoye : en attente du destinataire ; repondu : en attente de la prise en compte par l'auteur ;
   * pris_en_compte : marqué par une IA qui a lu l'échange dans le Sheet (Claude ne supprime jamais) — l'application
   * supprime alors la ligne à l'ouverture suivante.
   */
  statut: 'envoye' | 'repondu' | 'pris_en_compte' | 'transmis';
  /** Élément concerné (id d'une tâche, epic…), facultatif */
  element: string;
  /** Niveau de l'Organisation où vit l'échange (« equipeagile:id », « train:id », « portfolio:id », « unite:id ») */
  niveau: string;
  /** Qui l'a escaladé ou transmis en dernier (e-mail), vide sinon */
  transmis_par: string;
  /** « 1 » : privé à deux (seuls l'auteur et le destinataire le voient) */
  prive: string;
  /** Pièces jointes (images, fichiers) : ids séparés par « ; », rangées dans l'onglet PiecesJointes */
  pieces_jointes?: string;
  cree_le: string;
  modifie_le: string;
  /**
   * « Valider ? » d'un point de suivi (08/10) : « espace|id du point » ; pour une escalade, suivi de « |espace|id » du
   * point du niveau du dessus (« À reprendre » le rouvre). Sur l'échange ⤴ d'une escalade : le point du bas.
   */
  point?: string;
  /**
   * Transmettre (validation du 08/10) : l'échange dont celui-ci est le maillon suivant (« Je reste dans la boucle ») ;
   * la réponse revient à ce maillon, qui l'accepte et la fait redescendre (reformulée). Vide sinon.
   */
  parent?: string;
  /** Nature du message : information, question, blocage, décision à prendre ou prise, demande d'action (vide : d'après le type) */
  nature?: NatureEchange;
}
export type NatureEchange = '' | 'information' | 'question' | 'blocage' | 'decision_a_prendre' | 'decision_prise' | 'action';
export const NATURES_ECHANGE: NatureEchange[] = ['', 'information', 'question', 'blocage', 'decision_a_prendre', 'decision_prise', 'action'];
/** Libellés (un seul vocabulaire avec les notes de réunion) */
export const LIBELLE_NATURE: Record<Exclude<NatureEchange, ''>, string> = {
  information: 'Information',
  question: 'Question',
  blocage: 'Blocage',
  decision_a_prendre: 'Décision à prendre',
  decision_prise: 'Décision prise',
  action: 'Demande d’action',
};
/** Nature d'un échange : la sienne, sinon d'après le type (ancien échange) */
export const natureDe = (e: Pick<Echange, 'nature' | 'type'>): Exclude<NatureEchange, ''> => e.nature || (e.type === 'question' ? 'question' : 'information');
/** Ce qui se lit seulement (Lu ✓) : information, décision prise */
export const seLitSeulement = (n: NatureEchange) => n === 'information' || n === 'decision_prise';
/** Choix proposés selon la nature (question : ceux de l'auteur) */
export const CHOIX_NATURE: Partial<Record<NatureEchange, string>> = {
  blocage: 'Résolu;Pas résolu (motif)',
  action: 'Fait;Pas possible (motif)',
  decision_a_prendre: 'Décidé;Autre',
};
export type EchangeInput = Omit<Echange, 'id' | 'cree_le' | 'modifie_le'>;

/** SAFe (lot 4) : flux de valeur d'un portfolio (opérationnel : comment la valeur arrive au client ; développement : les systèmes qui le soutiennent). */
export type TypeValueStream = 'operationnel' | 'developpement';
export interface ValueStream {
  /** Espace (Google Sheet) d'où vient l'élément : posé par l'application au chargement, jamais enregistré */
  espace?: string;
  id: string;
  nom: string;
  type: TypeValueStream;
  description: string;
  /** Portfolio (id de l'Organisation) */
  portfolio: string;
  /** Trains qui servent ce value stream (ids séparés par « ; ») ; ses features en découlent (pas de lien direct) */
  trains: string;
  /** OKR liés (ids d'objectifs séparés par « ; ») */
  okrs: string;
  cree_le: string;
  modifie_le: string;
}
export type ValueStreamInput = Omit<ValueStream, 'id' | 'cree_le' | 'modifie_le'>;

/** SAFe (lot 4) : résultat clé mesurable d'un OKR (l'objectif), « actuel → cible ». */
export interface ResultatCle {
  /** Espace (Google Sheet) d'où vient l'élément : posé par l'application au chargement, jamais enregistré */
  espace?: string;
  id: string;
  /** OKR (id de l'objectif) */
  objectif: string;
  titre: string;
  actuel: string;
  cible: string;
  unite: string;
  cree_le: string;
  modifie_le: string;
}
export type ResultatCleInput = Omit<ResultatCle, 'id' | 'cree_le' | 'modifie_le'>;

/** Liste d'ids « a;b;c » ↔ tableau */
export const idsDe = (v: string | undefined) => (v ? v.split(';').filter(Boolean) : []);
export const joindreIds = (l: string[]) => [...new Set(l)].join(';');

/** Alerte ignorée : sa clé, et la situation (son message) au moment où on l'a ignorée. */
export interface Ignoree {
  /** Espace (Google Sheet) d'où vient l'élément : posé par l'application au chargement, jamais enregistré */
  espace?: string;
  id: string;
  cle: string;
  signature: string;
  cree_le: string;
  modifie_le: string;
}
export type IgnoreeInput = Omit<Ignoree, 'id' | 'cree_le' | 'modifie_le'>;

/** Icônes proposées pour les domaines. */
export const DOMAINE_ICONES = ['💼', '📁', '🏠', '🩺', '💶', '❤️', '🎓', '🛠️', '🌱', '✈️', '👪', '📦', '⚽', '🎨'];

/** Couleurs proposées pour les epics. */
export const EPIC_COULEURS = ['#1A73E8', '#8E24AA', '#E37400', '#188038', '#D93025', '#00897B', '#5E35B1', '#C2185B'];

export interface Settings {
  /** URL de l'application Web Apps Script (…/exec) */
  url: string;
  /** Clé d'accès (connexion sans compte Google) */
  key?: string;
  /** Connexion par compte Google : e-mail du compte */
  googleEmail?: string;
}

/** Libellés, dans l'ordre d'affichage : les mêmes noms courts partout (fiche, filtre, liste, menu ＋) */
export const TYPE_LABELS: Record<ItemType, string> = {
  tache: 'Tâche',
  'rendez-vous': 'Rendez-vous',
  appel: 'Appel',
  demarche: 'Démarche',
  mission: 'Mission',
  story: 'Story',
  exploration: 'Exploration',
  bug: 'Bug',
};

/** Libellés courts (puces, filtres) : les mêmes que TYPE_LABELS */
export const TYPE_SHORT = TYPE_LABELS;

export const TYPE_ICONS: Record<ItemType, string> = {
  tache: '✓',
  'rendez-vous': '📅',
  appel: '📞',
  demarche: '🗂️',
  mission: '🚩',
  story: '📖',
  exploration: '🔍',
  bug: '🐞',
};

export const PRIORITE_LABELS: Record<Priorite, string> = {
  basse: 'Basse',
  normale: 'Normale',
  haute: 'Haute',
};

export const PERIODICITE_LABELS: Record<Exclude<Periodicite, ''>, string> = {
  hebdomadaire: 'Chaque semaine',
  mensuelle: 'Chaque mois',
  trimestrielle: 'Chaque trimestre',
  annuelle: 'Chaque année',
};

export const STATUT_LABELS: Record<Statut, string> = {
  a_faire: 'À faire',
  en_cours: 'En cours',
  termine: 'Terminé',
};

// ---------------------------------------------------------------------------
// Réunions SAFe et agiles (lot 6)
// ---------------------------------------------------------------------------
/** Types de réunion : équipe, train, portfolio (mode SAFe) ; rituels personnels (mode Simple) */
export type TypeReunion =
  | 'daily'
  | 'planification'
  | 'revue'
  | 'retro'
  | 'affinage'
  | 'pi_planning'
  | 'art_sync'
  | 'system_demo'
  | 'inspect_adapt'
  | 'revue_portfolio'
  | 'revue_okr'
  | 'affinage_train'
  | 'prepa_pi'
  | 'sync_portfolio'
  | 'budget'
  | 'iteration_ip'
  | 'point_perso'
  | 'bilan_soir'
  | 'revue_semaine'
  | 'revue_objectifs'
  | 'revue_trimestre'
  | 'point_annuel'
  | 'reunion';

/** Répétition d'une réunion, vide = une seule fois */
export type RepetitionReunion = '' | 'quotidienne' | 'hebdomadaire' | 'iteration' | 'mensuelle' | 'trimestrielle' | 'annuelle' | 'pi';

/**
 * Réunion : un rendez-vous planifié (répété), animé dans la fenêtre de traitement, une étape à la fois.
 * Pour l'instant calculée d'après la cadence SAFe et les rôles de l'Organisation (src/reunions.ts), pas enregistrée.
 */
export interface Reunion {
  /** Espace (Google Sheet) d'où vient l'élément : posé par l'application au chargement, jamais enregistré */
  espace?: string;
  id: string;
  type: TypeReunion;
  titre: string;
  /** Niveau de l'Organisation (même format que les échanges : « equipeagile:id », « train:id », « portfolio:id »), vide = personnel */
  niveau: string;
  /** Qui anime (e-mail) */
  organisateur: string;
  /** Début : AAAA-MM-JJTHH:MM */
  debut: string;
  /** Durée en minutes */
  duree_min: number;
  repetition: RepetitionReunion;
  cree_le: string;
  modifie_le: string;
  /** Série d'où vient la réunion (onglet Reunions) et sa date d'origine (celle de la règle, gardée dans l'id) */
  serie?: string;
  origine?: string;
  /** Déplacée par une exception */
  deplacee?: boolean;
  /** 📅 Réunion libre : participants (e-mails) */
  participants?: string[];
}

/** Rôle qui anime : Scrum Master, Product Owner, RTE, Product Manager, Epic Owner, ou vous (mode Simple) */
export type RoleOrganisateur = 'sm' | 'po' | 'rte' | 'pm' | 'epic_owner' | 'moi';
export const LIBELLE_ROLE: Record<RoleOrganisateur, string> = {
  sm: 'Scrum Master',
  po: 'Product Owner',
  rte: 'RTE',
  pm: 'Product Manager',
  epic_owner: 'Epic Owner',
  moi: 'Vous',
};

export interface TypeReunionInfo {
  icone: string;
  libelle: string;
  /** Mode où la réunion existe */
  mode: 'safe' | 'simple';
  niveau: 'equipe' | 'train' | 'portfolio' | 'perso';
  /** Rôle qui l'anime */
  role: RoleOrganisateur;
  /** Durée par défaut, en minutes */
  duree: number;
  /** Étapes de l'animation (libellés courts), affichées en haut de la fenêtre */
  etapes: string[];
}

/** Catalogue des réunions (contenu des étapes : daily validé, src/components/Daily.tsx ; les autres en cours de validation) */
export const TYPES_REUNION: Record<TypeReunion, TypeReunionInfo> = {
  daily: { icone: '☀️', libelle: 'Daily', mode: 'safe', niveau: 'equipe', role: 'sm', duree: 15, etapes: ['Situation', 'Tour de table', 'Concrétisation', 'Compte rendu'] },
  planification: { icone: '🧮', libelle: "Planification de sprint", mode: 'safe', niveau: 'equipe', role: 'sm', duree: 120, etapes: ['Capacité', 'Objectifs', 'Stories', 'Engagement'] },
  revue: { icone: '🎬', libelle: "Revue de sprint", mode: 'safe', niveau: 'equipe', role: 'po', duree: 60, etapes: ['Bilan', 'Terminées', 'Non terminées', 'Compte rendu'] },
  retro: { icone: '🔁', libelle: 'Rétrospective', mode: 'safe', niveau: 'equipe', role: 'sm', duree: 60, etapes: ['Indicateurs', 'Ce qui va', 'Ce qui ne va pas', 'Actions', 'Compte rendu'] },
  affinage: { icone: '🪄', libelle: 'Affinage du backlog', mode: 'safe', niveau: 'equipe', role: 'po', duree: 60, etapes: ['À préparer', 'Story par story', 'Compte rendu'] },
  pi_planning: { icone: '🗓️', libelle: 'PI Planning', mode: 'safe', niveau: 'train', role: 'rte', duree: 480, etapes: ['Contexte', 'Capacité', 'Plan', 'Objectifs', 'Risques', 'Vote', 'Compte rendu'] },
  art_sync: { icone: '🚆', libelle: 'ART sync', mode: 'safe', niveau: 'train', role: 'rte', duree: 60, etapes: ['Vue du train', 'Équipes', 'Risques', 'Compte rendu'] },
  system_demo: { icone: '🖥️', libelle: 'System demo', mode: 'safe', niveau: 'train', role: 'pm', duree: 60, etapes: ['À montrer', 'Feature par feature', 'Retours', 'Compte rendu'] },
  inspect_adapt: { icone: '🔍', libelle: 'Inspect & Adapt', mode: 'safe', niveau: 'train', role: 'rte', duree: 240, etapes: ['Démo du PI', 'Mesures', 'Problèmes', 'Actions', 'Compte rendu'] },
  revue_portfolio: { icone: '💼', libelle: 'Revue du portfolio', mode: 'safe', niveau: 'portfolio', role: 'epic_owner', duree: 90, etapes: ['Vue', 'Epic par epic', 'Nouvelles idées', 'Compte rendu'] },
  revue_okr: { icone: '🎯', libelle: 'Revue des OKR', mode: 'safe', niveau: 'portfolio', role: 'epic_owner', duree: 60, etapes: ['OKR par OKR', 'Statut', 'Compte rendu'] },
  affinage_train: { icone: '🪄', libelle: 'Affinage du backlog du train', mode: 'safe', niveau: 'train', role: 'pm', duree: 60, etapes: ['Situation', 'Features à préparer', 'Feature', 'Concrétisation', 'Compte rendu'] },
  prepa_pi: { icone: '🧭', libelle: 'Préparation du PI Planning', mode: 'safe', niveau: 'train', role: 'rte', duree: 90, etapes: ['Situation', 'Vision', 'Features du PI', 'Capacité', 'Dépendances', 'Organisation', 'Concrétisation', 'Compte rendu'] },
  sync_portfolio: { icone: '🔄', libelle: 'Synchronisation du portfolio', mode: 'safe', niveau: 'portfolio', role: 'epic_owner', duree: 45, etapes: ['Situation', 'Epics en cours', 'Escalades des trains', 'Concrétisation', 'Compte rendu'] },
  budget: { icone: '💶', libelle: 'Budget participatif', mode: 'safe', niveau: 'portfolio', role: 'epic_owner', duree: 120, etapes: ['Situation', 'Demandes', 'Vote', 'Répartition', 'Concrétisation', 'Compte rendu'] },
  iteration_ip: { icone: '💡', libelle: 'Semaine IP', mode: 'safe', niveau: 'train', role: 'rte', duree: 60, etapes: ['Situation', 'Programme', 'Hackathon', 'Formation', 'Concrétisation', 'Compte rendu'] },
  point_perso: { icone: '🌅', libelle: 'Point perso', mode: 'simple', niveau: 'perso', role: 'moi', duree: 10, etapes: ['Hier', "Aujourd'hui", 'Plan figé'] },
  bilan_soir: { icone: '🌙', libelle: 'Bilan du soir', mode: 'simple', niveau: 'perso', role: 'moi', duree: 10, etapes: ['Prévu / fait', 'Pas fini'] },
  revue_semaine: { icone: '📆', libelle: 'Revue de la semaine', mode: 'simple', niveau: 'perso', role: 'moi', duree: 30, etapes: ['Semaine écoulée', 'En retard', 'Priorités'] },
  revue_objectifs: { icone: '🧭', libelle: 'Revue des objectifs', mode: 'simple', niveau: 'perso', role: 'moi', duree: 30, etapes: ['Objectifs', 'Domaines délaissés', 'Fin'] },
  revue_trimestre: { icone: '🗂️', libelle: 'Revue du trimestre', mode: 'simple', niveau: 'perso', role: 'moi', duree: 45, etapes: ['Trimestre écoulé', 'Objectifs du trimestre', 'Domaines', 'Fin'] },
  point_annuel: { icone: '🎆', libelle: 'Point annuel', mode: 'simple', niveau: 'perso', role: 'moi', duree: 60, etapes: ["Bilan de l'année", 'Garder · arrêter · commencer', "Objectifs de l'année", 'Domaines', 'Fin'] },
  reunion: { icone: '📅', libelle: 'Réunion', mode: 'safe', niveau: 'perso', role: 'moi', duree: 30, etapes: ['Points', 'Décisions', 'Compte rendu'] },
};

/**
 * Point noté pendant une réunion (onglet PointsReunion) : préparé par le participant ou noté par l'organisateur.
 * Lignes techniques de la même table (07/10), jamais montrées comme des points : `etat` (ligne d'état de la réunion,
 * écrite par l'animateur : texte JSON, voir src/etatReunion.ts), `vote` (le vote d'une personne : texte JSON) et
 * `donnee` (une préparation propre à une réunion : absences, stories choisies, idées… : texte JSON).
 */
export type TypePoint = 'hier' | 'aujourdhui' | 'blocage' | 'decision' | 'action' | 'information' | 'risque' | 'dependance' | 'etat' | 'vote' | 'donnee';
/**
 * Concrétisation d'un blocage, d'une décision ou d'une action : sous-tâche de l'élément, tâche à part dans
 * l'itération, rien, escalade au RTE, ou (blocage) échange 🔄 Synchro adressé au PO, au SM ou à un membre de
 * l'équipe ; vide = pas encore décidé
 */
export type Concretisation = '' | 'sous_tache' | 'tache' | 'rien' | 'escalade' | 'synchro' | 'suivi';
/** Statut d'un point de suivi (08/10) ; vide = pas encore concrétisé (ou ancien point) */
export type StatutSuivi = '' | 'en_cours' | 'fait' | 'valide' | 'a_reprendre' | 'abandonne';
export interface PointReunion {
  /** Espace (Google Sheet) d'où vient l'élément : posé par l'application au chargement, jamais enregistré */
  espace?: string;
  id: string;
  /** Réunion (son id calculé : type, niveau et date, ex. « daily-equipeagile:acmeqmob-2026-10-02 ») */
  reunion: string;
  /** Personne dont c'est le point (e-mail) */
  personne: string;
  /** Qui l'a noté (e-mail) : la personne elle-même ou l'organisateur */
  auteur: string;
  type: TypePoint;
  texte: string;
  /** Élément concerné (id d'une story), facultatif */
  element: string;
  concretisation: Concretisation;
  /**
   * Tâche créée (sous-tâche ou tâche à part), échange d'escalade ou échange 🔄 Synchro : son id, pour le suivi ;
   * pour une réponse du PO (décision), l'id de l'échange auquel elle répond
   */
  tache: string;
  /** Responsable de la suite (e-mail) */
  responsable: string;
  cree_le: string;
  /** Point de suivi (08/10) : statut, validateur (e-mail), échéance (AAAA-MM-JJ), mot du responsable ou motif */
  statut?: StatutSuivi;
  validateur?: string;
  echeance?: string;
  note?: string;
  /** Concrétisation « Créer » : type de l'élément créé et son rattachement (élément du dessus) */
  type_cree?: string;
  rattache?: string;
  /**
   * Escalade (08/10) : l'échange ⤴ qui relie ce point à celui de l'autre niveau (le point du bas l'a envoyé, celui du
   * haut le reçoit) ; la validation du haut redescend par lui
   */
  echange?: string;
  /** Décision (validation du 08/10) : « a_prendre » (se concrétise comme un blocage) ou « prise » (trace) */
  sous_type?: SousType;
}
export type SousType = '' | 'a_prendre' | 'prise';
export const TYPES_POINT: TypePoint[] = ['hier', 'aujourdhui', 'blocage', 'decision', 'action', 'information', 'risque', 'dependance', 'etat', 'vote', 'donnee'];
/** Lignes techniques de PointsReunion (état, votes, préparations) : jamais affichées comme des points */
export const estTechnique = (p: Pick<PointReunion, 'type'>) => p.type === 'etat' || p.type === 'vote' || p.type === 'donnee';

// ---------------------------------------------------------------------------
// 💶 Budget (lot 1, conception validée le 09/10, docs/maquette-budget.html) : tables du Google Sheet « Budget » de
// l'entreprise, séparé et partagé seulement avec le droit « Gérer le budget » (voir src/budget.ts)
// ---------------------------------------------------------------------------
/** Période d'une dépense : ponctuelle (à la date « du »), par jour, par mois, par an, ou en % (frais généraux) */
export type PeriodeDepense = 'ponctuel' | 'jour' | 'mois' | 'an' | 'pct';
/** Répartition d'une dépense portée par un niveau sur ses enfants : par effectif, à parts égales, ou en % à la main */
export type CleRepartition = 'effectif' | 'egal' | 'pct';
export type CategorieDepense = 'frais_generaux' | 'licence' | 'prestataire' | 'materiel' | 'hebergement' | 'formation' | 'deplacement' | 'autre';
export const CATEGORIES_DEPENSE: { value: CategorieDepense; label: string; icone: string }[] = [
  { value: 'frais_generaux', label: 'Frais généraux', icone: '🏢' },
  { value: 'licence', label: 'Licence', icone: '🔑' },
  { value: 'prestataire', label: 'Prestataire', icone: '🧑‍💻' },
  { value: 'materiel', label: 'Matériel', icone: '🖥️' },
  { value: 'hebergement', label: 'Hébergement', icone: '☁️' },
  { value: 'formation', label: 'Formation', icone: '🎓' },
  { value: 'deplacement', label: 'Déplacement', icone: '🚆' },
  { value: 'autre', label: 'Autre', icone: '📦' },
];
export const PERIODES_DEPENSE: { value: PeriodeDepense; label: string }[] = [
  { value: 'ponctuel', label: 'Ponctuel' },
  { value: 'jour', label: 'Par jour' },
  { value: 'mois', label: 'Par mois' },
  { value: 'an', label: 'Par an' },
  { value: 'pct', label: 'En %' },
];
/** Une dépense : un seul modèle pour tout (loyer, licence, prestataire…) */
export interface Depense {
  espace?: string;
  id: string;
  motif: string;
  categorie: CategorieDepense;
  /** Euros (ou % si période « pct ») */
  montant: string;
  periode: PeriodeDepense;
  /** AAAA-MM-JJ ; « au » vide = sans fin */
  du: string;
  au: string;
  /** Porteur : « entreprise:<espace> », « portfolio:<id> », « train:<id> », « equipeagile:<id> », « epic:<id> », « feature:<id> », « item:<id> » */
  porteur: string;
  /** Répartition sur les enfants du porteur (vide = clé par défaut : effectif pour les frais généraux, sinon parts égales) */
  cle: CleRepartition | '';
  /** Parts à la main (JSON { « portfolio:<id> »: 85, … }), pour la clé « pct » */
  parts: string;
  cree_le: string;
  modifie_le: string;
}
/** Coût annuel d'une personne (sorti de l'Organisation : il vit dans le Sheet Budget) */
export interface CoutPersonne {
  espace?: string;
  /** Identifiant de la personne (Organisation) */
  id: string;
  cout_annuel: string;
  cree_le: string;
  modifie_le: string;
}

// ---------------------------------------------------------------------------
// 📅 Congés et jours réels (lot 2 du budget, 09/10) : dans le Google Sheet de l'espace (pas sensible)
// ---------------------------------------------------------------------------
/** Congé, maladie, formation (une personne) ou fermeture de l'entreprise (personne vide) */
export type NatureConge = 'conge' | 'maladie' | 'formation' | 'fermeture';
export const NATURES_CONGE: { value: NatureConge; label: string; icone: string }[] = [
  { value: 'conge', label: 'Congés', icone: '🏖️' },
  { value: 'maladie', label: 'Maladie', icone: '🤒' },
  { value: 'formation', label: 'Formation', icone: '🎓' },
  { value: 'fermeture', label: 'Fermeture de l’entreprise', icone: '🏢' },
];
export interface Conge {
  espace?: string;
  id: string;
  /** E-mail de la personne ; vide = fermeture de toute l'entreprise */
  personne: string;
  /** AAAA-MM-JJ, inclus */
  du: string;
  au: string;
  nature: NatureConge;
  cree_le: string;
  modifie_le: string;
}
/** Jours réels d'une personne sur un sprint, validés par le Scrum Master en Rétrospective (une ligne par personne) */
export interface JoursReels {
  espace?: string;
  /** « <équipe>|<sprint>|<e-mail> » */
  id: string;
  equipe: string;
  sprint: string;
  personne: string;
  jours: string;
  valide_par: string;
  valide_le: string;
}

/**
 * 💶 Demande de budget (lot 4, 09/10) : née seulement en réunion, soumise par l'animateur qui a le droit « Gérer le
 * budget », reçue par la réunion de suivi du niveau du dessus (ART sync, Synchronisation du portfolio, Comité
 * budgétaire) ; décidée en séance ou depuis le Chat (« décidé hors réunion », mis en avant à la réunion suivante).
 * Dans le Sheet « Budget » de l'entreprise.
 */
export type StatutDemande = 'soumise' | 'accordee' | 'a_reprendre' | 'refusee';
export interface DemandeBudget {
  espace?: string;
  id: string;
  motif: string;
  montant: string;
  periode: PeriodeDepense;
  du: string;
  au: string;
  /** Élément concerné (« epic:<id> », « equipeagile:<id> »…) : porteur de la dépense si elle est accordée */
  pour: string;
  /** Niveau qui demande (« equipeagile:<id> », « train:<id> », « portfolio:<id> ») et niveau qui décide */
  demandeur: string;
  destination: string;
  soumis_par: string;
  /** Réunion où la demande est née (titre et date) */
  origine: string;
  statut: StatutDemande;
  montant_accorde: string;
  motif_decision: string;
  decide_par: string;
  decide_le: string;
  /** Décidée depuis le Chat (« 1 ») : mise en avant à la réunion suivante, jusqu'à « Confirmé » (« 2 ») */
  hors_reunion: string;
  cree_le: string;
  modifie_le: string;
}
