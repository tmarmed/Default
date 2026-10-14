import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  aConcretiser,
  attendConcretisation,
  backlogAPreparer,
  concretisationParDefaut,
  dateCourte,
  ageAffiche,
  enRetard,
  jourReunion,
  LIBELLE_CONCRETISATION,
  TYPES_NOTE,
  sousLigneSuivi,
  LIBELLE_TYPE_POINT, libelleNote,
  PARCOURS_DAILY,
  pastilleSuivi,
  prefixeReunion,
  questionsEquipe,
  situationIteration,
  storiesAAccepter,
  storiesBloquees,
  suivis as calculerSuivis,
  suivisSynchro,
  texteCompteRendu,
  texteReponse,
  veilleOuvree,
} from '../daily';
import { destinatairesTransfert, lireNiveau, personneParEmail } from '../echange/hierarchieEchange';
import { aReprendre, parEspace, pointsEscalade, titreEscalade, titreTransmis } from '../suiviEscalade';
import { useHierarchy } from '../hierarchyContext';
import { autresEquipesDuTrain, membresDe, nomPersonne, optionsPersonnes, type OrgValue, porteurs } from '../organisation';
import { fmtPoints, iterationOf, piOf, pointsOf } from '../pi';
import { type EtapeCatalogue, etapesParcours, ongletParcours, type ParcoursRole, parcoursParDefaut, participantsReunion } from '../reunions';
import { PARCOURS_DAILY as CATALOGUE, elementsDuPlan, type EvenementJour, planDe, reunionPrecedenteAvecPlan } from '../daily';
import { PlanDuJour } from './reunion/PlanDuJour';
import { usePlanJour } from './reunion/usePlanJour';
import { useSafe } from '../safe';
import { subtaskMap } from '../subtasks';
import { colors } from '../theme';
import { enfantsRepartition, gerantsBudget, niveauDessus, reunionDuNiveau, useBudget } from '../budget';
import { useAvancement } from './reunion/Avancement';
import { BlocArbre, changementsSuivi, ModeAffichage, nbSuivisChanges } from './reunion/Arbre';
import { BlocBrique, TitreGroupe } from './reunion/Brique';
import { type Concretisation, type Echange, type EchangeInput, estTechnique, type Item, type ItemInput, type PeriodeDepense, type PointReunion, RECURRENCE_DEFAUTS, type Reunion, type SousType, type Statut, type TypePoint } from '../types';
import { etatDe, texteDirect } from '../etatReunion';
import { useLive } from './useLive';
import { FeuilleChoix, SectionFiche } from './Choix';
import { type ChoixConcret, choixParDefaut, concretisationDe, elementACreer, estSuivi, LIBELLE_TYPE_CREE, patchConcretise, resumeChoix as resumeConcret, resumePoint } from '../concretisation';
import { libelleElement } from '../elementConcerne';
import { echeanceParDefaut, estFini, jourCourt, LIBELLE_STATUT, relierEscalades, validateurDe } from '../pointsSuivi';
import { absentsLe, useConges } from '../conges';
import { BlocHorsReunion, cheminElement, type CtxSuivi, lienPrive, LignesSuivi, pointsDeSuivi, repartirSuivis, statutAffiche } from './reunion/Suivi';
import { FeuilleConcretiser } from './reunion/Concretiser';
import { estAutre, placeholderNote, reponsePrete } from './EchangesView';
import { FenetreReunion, type ModeReunion, type OngletReunion } from './FenetreReunion';
import { TitreFiche } from './FormSheet';
import { Compteur, pluriel, Entonnoir, FiltresType, FiltresVue, Ligne, LigneCase, LigneStory, Pastille, PastilleFiltres, Pastilles, pastilleStatut, SaisiePoint, st, TITRE_TYPE, titreAjout, type Ton, TONS, tonType, Vide, type VueSuivi } from './reunion/ui';

/**
 * Daily (lot 6, validé le 01/10 ; parcours séparés le 06/10) : contenu de la fenêtre de réunion. Chaque rôle de la
 * personne a son propre parcours dans un onglet en haut de la fenêtre (`etapesParcours`), qu'elle fait quand elle
 * veut, dans l'ordre qu'elle veut, chacun avec sa barre d'étapes et sa dernière étape :
 * - « Mon point » (membre) : Hier (ses stories et tâches de l'itération, y compris celles nées des réunions, avec à
 *   droite « Action · 29/09 »), Aujourd'hui, Blocages, Prêt (récapitulatif, « Envoyer au SM ») ; s'il anime, son
 *   point n'est pas envoyé : « Enregistrer mon point », il rejoint directement ses points notés ;
 * - « PO » : Stories à accepter (terminées dans l'itération), Backlog à préparer (stories des features du PI sans
 *   estimation ou trop grosses), Questions de l'équipe (échanges 🔄 Synchro que les membres lui adressent sur les
 *   stories de l'itération ; il y répond avec les choix de l'échange : à l'envoi, la réponse part dans l'échange et
 *   est dupliquée en point « décision » de la réunion, que le SM concrétise ; une réponse déjà donnée dans la Synchro
 *   est dupliquée de même), Prêt ; s'il n'est pas membre, il fait d'abord Hier et Aujourd'hui pour ses tâches ;
 * - « Animer » (Scrum Master, organisateur) : Situation (compteurs de l'itération, « Suivi · n », objectifs) · Tour
 *   de table (un membre à la fois : ses stories, un seul bloc « Points notés » pour ce qu'il a préparé et ce que note
 *   le SM) · Concrétisation (sous-tâche de la story, tâche à part, rien, escalade au RTE, ou pour un blocage échange
 *   « Transmettre à » le PO, le SM ou un membre, via un bouton « Concrétiser » qui ouvre toutes les possibilités ;
 *   avec un responsable) · Compte rendu (tâches créées en un lot ; échanges Synchro, escalades et compte rendu au RTE
 *   envoyés en un lot) ;
 * - « Suivre » (le PO qui n'anime pas) : le parcours du SM en lecture seule, avec les données du Sheet (points
 *   préparés par chacun, décisions déjà concrétisées) relues à l'ouverture de l'onglet ; rien n'y est modifiable.
 * L'état de chaque onglet (étape, saisies) est gardé quand on change d'onglet.
 * Une story ou une tâche qui a des sous-tâches affiche « n sous-tâches » et un › : la toucher ouvre sa fiche.
 * Points rangés dans l'onglet PointsReunion du Sheet de l'espace de l'équipe : une lecture à l'ouverture, une
 * relecture en arrivant sur chaque membre au tour de table (au plus une par membre), une écriture groupée à l'envoi ;
 * « ↻ Actualiser » relit les points, les tâches et les échanges de l'espace en une lecture groupée.
 */

/** Opérations du daily (fournies par l'application : Sheets, état des tâches et des échanges) */
/** Éléments qu'une réunion peut ajouter (en plus des tâches) */
export type KindAjout = 'epic' | 'objectif' | 'domaine' | 'feature' | 'objectifpi' | 'resultat';
export interface ActionsDaily {
  lirePoints: (espace: string, prefixe: string) => Promise<PointReunion[]>;
  /** Points créés, modifiés et retirés en un seul passage ; renvoie les points créés dans l'ordre */
  ecrirePoints: (
    espace: string,
    creer: Omit<PointReunion, 'id' | 'cree_le'>[],
    modifier: (Partial<PointReunion> & { id: string })[],
    retirer: string[],
  ) => Promise<{ crees: PointReunion[]; modifies: PointReunion[] }>;
  /**
   * « ↻ Actualiser » : relit en une lecture groupée les points (id commençant par `prefixe`), les tâches et les
   * échanges de l'espace (l'application met à jour ses tâches et ses échanges) ; renvoie les points
   */
  actualiser?: (espace: string, prefixe: string) => Promise<PointReunion[]>;
  /** Modifie des tâches en un seul passage (stories engagées, acceptées, estimées…) ; renvoie les tâches modifiées */
  modifierItems?: (espace: string, patches: (Partial<Item> & { id: string })[]) => Promise<Item[]>;
  /** Modifie des epics, objectifs, features… en un seul passage (revue du portfolio, revue des objectifs, ＋ Choisir) */
  modifierEntites?: (espace: string, kind: KindAjout, patches: { id: string; [k: string]: string }[]) => Promise<void>;
  /** ＋ Nouveau dans une réunion (08/10) : crée des objectifs, domaines, features, objectifs du PI, epics, résultats clés */
  creerEntites?: (espace: string, kind: KindAjout, inputs: Record<string, string>[]) => Promise<{ id: string }[]>;
  /** Concrétisation en 🗓️ réunion ponctuelle (08/10) : séries d'un jour, créées en une écriture ; renvoie leurs ids */
  creerReunions?: (espace: string, l: { titre: string; jour: string; animateur: string; participants: string[]; niveau: string }[]) => Promise<string[]>;
  /** ✕ sur un ajout de la séance : supprime l'élément créé (tâche ou autre) */
  supprimer?: (kind: KindAjout | 'item', id: string) => Promise<void>;
  /** Crée des tâches en un seul passage ; renvoie les tâches créées dans l'ordre */
  creerTaches: (espace: string, inputs: ItemInput[]) => Promise<Item[]>;
  /** Envoie des échanges (Synchro, escalades, compte rendu) en un seul passage ; renvoie les échanges créés dans l'ordre */
  envoyerEchanges: (espace: string, inputs: EchangeInput[]) => Promise<Echange[]>;
  /** Réponses du PO aux échanges de l'équipe (réponse normale à l'échange), en un seul passage */
  repondreEchanges: (reponses: { e: Echange; reponse: string; note: string }[]) => Promise<void>;
  /** Modifie des échanges en un seul passage (« Valider ? » réglés, échange ⤴ relié au point du bas) */
  modifierEchanges?: (l: { e: Echange; patch: Partial<Echange> }[]) => Promise<void>;
}

interface Props {
  visible: boolean;
  reunion: Reunion | null;
  /** Organisateur : vous animez (étapes du Scrum Master, après celles de vos autres rôles) */
  mode: ModeReunion;
  org: OrgValue;
  /** Vous (e-mail) */
  moi: string;
  /** AAAA-MM-JJ */
  aujourdhui: string;
  fil?: string;
  actions: ActionsDaily;
  onFermer: () => void;
  onInfo?: (texte: string) => void;
  /** Ouvre la fiche d'une tâche (le même ouvreur que le reste de l'application) */
  onOpenTask?: (t: Item) => void;
  /** Fiche d'une feature, d'une epic ou d'un objectif (depuis l'avancement, 13/10) */
  onOpenEntite?: (kind: 'feature' | 'epic' | 'objectif', id: string) => void;
  /** Échanges chargés (🔄 Synchro) : questions de l'équipe au PO, suivi des blocages passés en Synchro */
  echanges?: Echange[];
}

/** Parcours d'où vient un point de votre préparation : « Mon point » (membre) ou « PO » (envoyés séparément) */
type Prep = 'membre' | 'po';
type Local = Omit<PointReunion, 'id' | 'cree_le'> & { id: string; cree_le: string; onglet?: Prep };
/** Point à écrire dans le Sheet (sans id, date ni onglet d'origine) */
const aEcrire = ({ id: _i, cree_le: _c, onglet: _o, ...x }: Local | (PointReunion & { onglet?: Prep })) => x;
const prenom = (nom: string) => nom.split(' ')[0] || nom;
const arrondi = (n: number) => String(Math.round(n * 10) / 10);
let compteurLocal = 0;
const idLocal = () => `local-${Date.now()}-${++compteurLocal}`;
/** Points affichables (sans les lignes techniques : état, votes, préparations) */
const sansTech = (l: PointReunion[]) => l.filter((x) => !estTechnique(x));

export function FenetreDaily(p: Props) {
  const { reunion } = p;
  if (!reunion) return null;
  return <Daily {...p} reunion={reunion} />;
}

/** Équipe du daily, ses personnes, sa situation d'itération */
function useEquipeDaily(reunion: Reunion, org: OrgValue, aujourdhui: string, points: PointReunion[], echanges: Echange[]) {
  const h = useHierarchy();
  const n = lireNiveau(reunion.niveau);
  const equipe = n?.kind === 'equipeagile' ? org.equipe.get(n.id) : undefined;
  const jour = jourReunion(reunion);
  const it = iterationOf(jour);
  const seuleEquipe = org.equipes.filter((e) => (e.espace || 'moi') === (reunion.espace || 'moi')).length === 1;
  const dansEquipe = (t: Item) => {
    const e = porteurs(t, h, org).equipe;
    return e ? e === equipe?.id : seuleEquipe && (t.espace || 'moi') === (reunion.espace || 'moi');
  };
  const bloquees = useMemo(() => storiesBloquees(points, h.items, echanges), [points, h.items, echanges]);
  const situation = useMemo(
    () => situationIteration(h.items, dansEquipe, jour, bloquees, aujourdhui),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [h.items, jour, bloquees, aujourdhui, equipe?.id, org],
  );
  const personnes = participantsReunion(reunion, org)
    .map((id) => org.personne.get(id))
    .filter((x): x is NonNullable<typeof x> => !!x && !!x.email);
  const role = (id: string) => (id === equipe?.sm ? 'Scrum Master' : id === equipe?.po ? 'Product Owner' : 'Membre');
  const nomDe = (email: string) => nomPersonne(org, email);
  const train = equipe?.train ? org.train.get(equipe.train) : undefined;
  const rte = train?.rte ? org.personne.get(train.rte) : undefined;
  const pm = train?.pm ? org.personne.get(train.pm) : undefined;
  const parId = new Map(h.items.map((t) => [t.id, t]));
  const subs = useMemo(() => subtaskMap(h.items), [h.items]);
  return { h, equipe, jour, it, situation, bloquees, personnes, role, nomDe, train, rte, pm, parId, subs, dansEquipe };
}

function Daily({ visible, reunion, mode, org, moi, aujourdhui, fil, actions, onFermer, onInfo, onOpenTask, onOpenEntite, echanges = [] }: Props & { reunion: Reunion }) {
  const safe = useSafe();
  const mail = moi.toLowerCase();
  const espace = reunion.espace || 'moi';
  const prefixe = prefixeReunion(reunion);
  const [serveur, setServeur] = useState<PointReunion[]>([]);
  const [charge, setCharge] = useState(false);
  /** Votre préparation (partie participant) ; ce que vous aviez déjà envoyé est repris, puis remplacé à l'envoi */
  const [prep, setPrep] = useState<Local[]>([]);
  /** Points déjà envoyés que la préparation reprend (id → parcours d'origine), retirés à l'envoi de leur parcours */
  const [anciens, setAnciens] = useState<Record<string, Prep>>({});
  /** Notés par l'organisateur pendant la réunion */
  const [locaux, setLocaux] = useState<Local[]>([]);
  const [choix, setChoix] = useState<Record<string, Partial<ChoixConcret>>>({});
  /** Feuille « Concrétiser » ouverte sur un point : choix de la concrétisation, puis du responsable */
  /** Tour de table : filtre des points notés par type (pastille « Filtres » à côté du titre, fermé et « Tous » par défaut) */
  const [filtreType, setFiltreType] = useState<TypePoint | ''>('');
  const [filtresOuverts, setFiltresOuverts] = useState(false);
  /** Situation : même filtre sur le suivi (fermé, « Tous » par défaut) */
  const [filtreSuivi, setFiltreSuivi] = useState<TypePoint | ''>('');
  const [filtresSuiviOuverts, setFiltresSuiviOuverts] = useState(false);
  const [vueSuivi, setVueSuivi] = useState<VueSuivi>('tout');
  const [feuille, setFeuille] = useState<{ id: string } | null>(null);
  /** PO : ses réponses aux questions de l'équipe (par échange), envoyées avec son point */
  const [reponses, setReponses] = useState<Record<string, { c: string; note: string }>>({});
  const [membre, setMembre] = useState(0);
  /** Suivis (14/10) : case « Arborescence » décochée par défaut */
  const [arboSuivis, setArboSuivis] = useState(false);
  /** Étape affichée (clé), dans l'onglet ouvert */
  const [cle, setCle] = useState('');
  const relus = useRef(new Set<string>());
  /** Tout ce qui a été lu (lignes techniques comprises : ligne d'état de chaque daily de la série) */
  const [lus, setLus] = useState<PointReunion[]>([]);

  const tous = useMemo(() => [...serveur.filter((x) => !(x.id in anciens)), ...prep, ...locaux] as PointReunion[], [serveur, anciens, prep, locaux]);
  const e = useEquipeDaily(reunion, org, aujourdhui, tous, echanges);
  const { h, equipe, jour, it, situation, personnes, nomDe, rte, pm, parId, subs } = e;
  // 💶 Demande de budget comme concrétisation d'une note (13/10) : pour qui a le droit « Gérer le budget » de l'équipe
  const budgetCtx = useBudget();
  const eqB = lireNiveau(reunion.niveau)?.kind === 'equipeagile' ? org.equipe.get(lireNiveau(reunion.niveau)!.id) : undefined;
  const niveauBudget = eqB ? `equipeagile:${eqB.id}` : '';
  const dessusBudget = niveauBudget ? niveauDessus(niveauBudget, org) : null;
  const budgetConcret =
    niveauBudget && dessusBudget && gerantsBudget(niveauBudget, org).includes(mail)
      ? { decideur: reunionDuNiveau(dessusBudget) || 'niveau du dessus', pour: [...enfantsRepartition(niveauBudget, org, h).filter((x) => x.cle.startsWith('epic:')).map((x) => ({ value: x.cle, label: x.nom })), { value: niveauBudget, label: `${eqB!.nom} (sans epic)` }] }
      : undefined;
  const congesCtx = useConges();
  const veille = veilleOuvree(jour);
  const dela = (pt: PointReunion) => pt.reunion === reunion.id;
  const moiP = personneParEmail(mail, org);
  const sm = equipe?.sm ? org.personne.get(equipe.sm) : undefined;
  const po = equipe?.po ? org.personne.get(equipe.po) : undefined;

  // Rôles de la personne dans ce daily, et ses parcours séparés (un onglet par rôle : membre, PO, SM)
  const anime = mode === 'organisateur';
  const estMembre = !!moiP && !!equipe && membresDe(equipe).includes(moiP.id);
  const estPO = !!moiP && equipe?.po === moiP.id;
  const parcours = useMemo(() => etapesParcours({ membre: estMembre, po: estPO, sm: anime }, PARCOURS_DAILY), [estMembre, estPO, anime]);
  // Live (07/10) : l'animateur publie la ligne d'état, les participants la relisent (seulement à plusieurs)
  const live = useLive({
    visible,
    reunion,
    espace,
    anime,
    nbParticipants: personnes.length,
    moi: mail,
    actions,
    charge,
    pointsInitiaux: lus,
    onPoints: (l) => {
      const ici = (x: PointReunion) => x.reunion === reunion.id;
      setLus((avant) => [...avant.filter((x) => !ici(x)), ...l.filter(ici)]);
      setServeur((avant) => [...avant.filter((x) => !ici(x)), ...sansTech(l).filter(ici)]);
    },
  });
  /** Étape de l'onglet Animer (publiée dans la ligne d'état) */
  const [etapeSm, setEtapeSm] = useState('');
  /**
   * Onglet « Compte rendu · date » (07/10) : le dernier compte rendu envoyé de la série (aujourd'hui, ou le daily
   * d'avant), visible jusqu'à la fin du daily suivant ; en lecture seule
   */
  const dernierCR = useMemo(() => {
    const ids = lus
      .filter((x) => x.reunion.startsWith(prefixe) && x.reunion.slice(-10) <= jour && (x.type === 'etat' ? !!etatDe([x], x.reunion)?.fin : aConcretiser(x) && !!x.concretisation))
      .map((x) => x.reunion);
    return ids.sort().pop() ?? '';
  }, [lus, prefixe, jour]);
  /**
   * Avancement depuis le Daily précédent (13/10, bloc 13) : stories et tâches de l'équipe, plus les features et epics
   * rattachées ; une photo est écrite avec le compte rendu
   */
  const itemsAv = h.items.filter((t) => e.dansEquipe(t));
  const fIdsAv = new Set(itemsAv.map((t) => t.feature).filter(Boolean));
  const featuresAv = h.featureList.filter((f) => fIdsAv.has(f.id));
  const eIdsAv = new Set([...itemsAv.map((t) => t.epic), ...featuresAv.map((f) => f.epic)].filter(Boolean));
  const perimetreAv = { items: itemsAv, features: featuresAv, epics: h.epicList.filter((x) => eIdsAv.has(x.id)), suivis: serveur.filter((x) => !!x.statut), tousItems: h.items };
  const sourcesAv = { items: h.items, featureList: h.featureList, epicList: h.epicList, points: serveur };
  const avancement = useAvancement({ type: reunion.type, reunion: reunion.id, prefixes: [prefixe], points: lus, perimetre: perimetreAv, sources: sourcesAv });
  const avancementCR = useAvancement({ type: reunion.type, reunion: dernierCR || reunion.id, prefixes: [prefixe], points: lus, perimetre: perimetreAv, sources: sourcesAv, lecture: true });
  /**
   * Parcours d'origine d'un point déjà envoyé : « PO » pour une réponse à un échange ou une story à accepter ou à
   * préparer (ou tout, s'il n'est pas membre), sinon « Mon point »
   */
  const ongletDe = (x: Pick<PointReunion, 'type' | 'tache' | 'texte'>): Prep =>
    !estPO ? 'membre' : !estMembre ? 'po' : (x.type === 'decision' && !!x.tache) || /^(Accepter|Préparer) « /.test(x.texte) ? 'po' : 'membre';
  /** Déjà envoyé : la préparation de ces parcours reprend ce qui a été envoyé (pas encore concrétisé) */
  const reprendre = (l: PointReunion[], quels: Prep[]) => {
    const miens = l.filter((x) => x.reunion === reunion.id && x.personne === mail && x.auteur === mail && !x.concretisation && quels.includes(ongletDe(x)));
    setAnciens((a) => ({ ...Object.fromEntries(Object.entries(a).filter(([, o]) => !quels.includes(o))), ...Object.fromEntries(miens.map((x) => [x.id, ongletDe(x)])) }));
    setPrep((p) => [...p.filter((x) => !quels.includes(x.onglet ?? 'membre')), ...miens.map((x) => ({ ...x, id: idLocal(), onglet: ongletDe(x) }))]);
  };

  // Ouverture : une lecture (points de ce daily et des dailies précédents de l'équipe, pour le suivi)
  useEffect(() => {
    if (!visible) return;
    setServeur([]);
    setLus([]);
    setPrep([]);
    setAnciens({});
    setLocaux([]);
    setChoix({});
    setReponses({});
    setMembre(0);
    setCharge(false);
    // Votre propre point est déjà là (votre préparation) : pas de relecture à votre tour
    relus.current = new Set([mail]);
    let actif = true;
    actions
      .lirePoints(espace, prefixe)
      .then((l) => {
        if (!actif) return;
        setLus(l);
        setServeur(sansTech(l));
        reprendre(sansTech(l), ['membre', 'po']);
        setCharge(true);
      })
      .catch((err) => actif && (setCharge(true), onInfo?.(`Points du daily non lus : ${(err as Error).message}`)));
    return () => {
      actif = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, reunion.id]);

  // Plan du jour (13/10, R5) : places, événements perso et journée, dans 🔒 Moi (vus par moi seul) ; écrits avec « Mon point »
  const { dailiesDuJour, relirePlans, planAilleurs, hierAilleurs, places, setPlaces, evtsPerso, setEvtsPerso, journee, changerJournee, ecrire: ecrireCreneaux, reunionsDuJour } = usePlanJour({ visible, actions, mail, jour, org, safeActif: safe.actif, onInfo });

  // Animateur : chaque étape et chaque membre du tour de table sont publiés dans la ligne d'état
  useEffect(() => {
    if (!visible || !anime || !charge || !etapeSm) return;
    const nom = CATALOGUE.sm.find((x) => x.cle === etapeSm)?.nom ?? '';
    const c = personnes[Math.min(membre, Math.max(0, personnes.length - 1))];
    live.publier({ etape: etapeSm, libelle: nom, element: etapeSm === 'tour' ? (c?.email.toLowerCase() ?? '') : '', detail: etapeSm === 'tour' && c ? prenom(c.nom) : '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, anime, charge, etapeSm, membre]);
  // Participant : l'écran de l'animateur (bandeau « En direct ») suit son membre du tour de table
  useEffect(() => {
    if (anime || live.etat?.etape !== 'tour' || !live.etat.element) return;
    const i = personnes.findIndex((x) => x.email.toLowerCase() === live.etat?.element);
    if (i >= 0) setMembre(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anime, live.etat?.v]);

  // Tour de table : en arrivant sur un membre, on relit ses points (préparés depuis l'ouverture) — une fois par membre
  const courant = personnes[Math.min(membre, Math.max(0, personnes.length - 1))];
  useEffect(() => {
    if (!visible || cle !== 'tour' || !courant || relus.current.has(courant.email.toLowerCase())) return;
    const m = courant.email.toLowerCase();
    relus.current.add(m);
    actions
      .lirePoints(espace, reunion.id)
      .then((l) => setServeur((avant) => [...avant.filter((x) => !(dela(x) && x.personne === m)), ...sansTech(l).filter((x) => x.personne === m)]))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, cle, courant?.email]);

  /** Nouveau point de votre préparation (`onglet` : le parcours qui l'envoie) */
  const nouveau = (type: TypePoint, texte: string, element: string, tache = '', onglet: Prep = 'membre'): Local => ({
    onglet,
    id: idLocal(),
    reunion: reunion.id,
    personne: mail,
    auteur: mail,
    type,
    texte,
    element,
    concretisation: '',
    tache,
    responsable: '',
    cree_le: new Date().toISOString(),
  });
  const retirerPrep = (id: string) => setPrep((l) => l.filter((y) => y.id !== id));
  const fmt = (n: number) => fmtPoints(n, safe.pointsJours);
  /** Échange 🔄 Synchro auquel répond une décision du PO */
  const echangeDe = (x: Pick<PointReunion, 'type' | 'tache'>) => (x.type === 'decision' && x.tache ? echanges.find((y) => y.id === x.tache) : undefined);
  const surStory = (x: { texte: string; element: string }) => {
    const titre = x.element ? (parId.get(x.element)?.titre ?? 'story') : '';
    return titre && titre !== x.texte ? `sur 📖 ${titre}` : '';
  };
  /** Concrétisation déjà décidée d'un point (réponse du PO) : « → tâche à part · 👤 Tom » */
  const concretise = (x: Pick<PointReunion, 'type' | 'concretisation' | 'responsable'>) =>
    x.type === 'decision' && (x.concretisation === 'sous_tache' || x.concretisation === 'tache') ? `→ ${LIBELLE_CONCRETISATION[x.concretisation]} · 👤 ${nomDe(x.responsable)}` : '';
  /** Ouvrir la fiche d'un élément qui a des sous-tâches (›) */
  const ouvrir = (t: Item) => (onOpenTask && (subs.get(t.id)?.length ?? 0) > 0 ? () => onOpenTask(t) : undefined);

  // ---------------------------------------------------------------------------
  // Partie participant : vos tâches (Hier, Aujourd'hui), blocages, parcours du PO
  // ---------------------------------------------------------------------------
  /** Tâches nées d'une réunion (point concrétisé en sous-tâche ou tâche à part) : le point d'origine */
  const pointDeTache = useMemo(
    () => new Map(serveur.filter((x) => (x.concretisation === 'sous_tache' || x.concretisation === 'tache') && x.tache).map((x) => [x.tache, x])),
    [serveur],
  );
  const idsIteration = new Set(situation.elements.map((t) => t.id));
  // Vos éléments : stories, tâches et sous-tâches de l'itération à votre nom, et les tâches nées des réunions
  const idsCartes = new Set(situation.cartes.map((t) => t.id));
  const miens = moiP ? h.items.filter((t) => t.responsable === moiP.id && (idsIteration.has(t.id) || idsCartes.has(t.id) || pointDeTache.has(t.id))) : [];
  const hierListe = miens.filter(
    (t) => t.statut === 'en_cours' || (t.statut === 'termine' && (!t.termine_le || t.termine_le >= veille)) || (pointDeTache.has(t.id) && t.statut !== 'termine'),
  );
  // Aujourd'hui (13/10) : d'abord les tâches en cours (reprises d'office), puis le reste
  const aujListe = miens.filter((t) => t.statut !== 'termine').sort((a, b) => Number(b.statut === 'en_cours') - Number(a.statut === 'en_cours'));
  // 13/10 : les tâches en cours sont reprises d'office dans Aujourd'hui (cochées), sauf si on les décoche
  const [decochesAuj, setDecochesAuj] = useState<Set<string>>(new Set());
  // Tâche nouvelle (R5d, 13/10) : créée ou changée pour moi après l'envoi de ma préparation, pas dans mon plan
  // envoyé → cochée d'office (elle arrive « À placer » dans le Plan du jour)
  const mesEnvois = serveur.filter((x) => x.reunion === reunion.id && x.personne === mail && x.auteur === mail);
  const dernierEnvoi = mesEnvois.reduce((m, x) => (x.cree_le > m ? x.cree_le : m), '');
  const nouvelles = new Set(
    dernierEnvoi ? aujListe.filter((t) => !mesEnvois.some((x) => x.type === 'aujourdhui' && x.element === t.id) && (t.modifie_le || t.cree_le || '') > dernierEnvoi).map((t) => t.id) : [],
  );
  const parDefautAuj = (t: Item) => (t.statut === 'en_cours' || nouvelles.has(t.id)) && !prep.some((x) => x.type === 'aujourdhui' && x.element === t.id);
  const coche = (type: TypePoint, t: Item, texte: string) =>
    prep.some((x) => x.type === type && x.element === t.id && x.texte === texte) || (type === 'aujourdhui' && parDefautAuj(t) && !decochesAuj.has(t.id));
  const basculer = (type: TypePoint, t: Item, texte: string, onglet: Prep) => {
    const parDefaut = type === 'aujourdhui' && parDefautAuj(t);
    if (parDefaut) return setDecochesAuj((s) => (s.has(t.id) ? new Set([...s].filter((x) => x !== t.id)) : new Set([...s, t.id])));
    setPrep((l) => (coche(type, t, texte) ? l.filter((x) => !(x.type === type && x.element === t.id && x.texte === texte)) : [...l, nouveau(type, texte, t.id, '', onglet)]));
  };
  /** Blocages encore ouverts des dailies précédents (notés par vous) : rappelés dans Aujourd'hui, sans les renoter */
  const blocagesOuverts = serveur.filter((x) => x.type === 'blocage' && x.personne === mail && x.reunion < reunion.id && x.reunion.startsWith(reunion.id.slice(0, -10)) && !estFini(x.statut) && x.concretisation !== 'rien');

  // Une préparation pour plusieurs Dailies (R5b, 13/10) : dans « Aujourd'hui », mes éléments des autres équipes qui
  // ont un Daily aujourd'hui ; à l'envoi de mon point, chaque Daily reçoit sa part (un lot par Daily changé)
  const autresDailies = dailiesDuJour
    .filter((r) => r.id !== reunion.id && lireNiveau(r.niveau)?.kind === 'equipeagile')
    .map((r) => {
      const eq = lireNiveau(r.niveau)!.id;
      const elements = moiP ? elementsDuPlan(h.items.filter((t) => t.responsable === moiP.id && t.statut !== 'termine' && porteurs(t, h, org).equipe === eq)) : [];
      const hierA = hierAilleurs.find((x) => x.reunion === r.id);
      const planHier = (hierA?.elements ?? []).map((id) => parId.get(id)).filter((t): t is Item => !!t);
      return { r, eq, nom: org.equipe.get(eq)?.nom ?? '', elements, planHier, hierDu: hierA?.du ?? '' };
    })
    .filter((x) => x.elements.length > 0 || x.planHier.length > 0);
  // Espaces de la préparation (R5b) : on ajoute ou enlève un autre Daily à n'importe quelle étape ; enlevé, il est
  // caché, hors du Plan du jour, et rien ne lui est envoyé
  const [sansDailies, setSansDailies] = useState<Set<string>>(new Set());
  const montres = autresDailies.filter((a) => !sansDailies.has(a.r.id));
  const choixEspaces = autresDailies.length > 0 && (
    <View style={[st.choix, { marginHorizontal: 16, marginBottom: 6 }]}>
      <Text style={st.sous}>Espaces :</Text>
      <View style={[st.choixPastille, st.choixPetit, st.choixOn]}>
        <Text style={[st.choixTexte, st.choixTextePetit, st.choixTexteOn]}>👥 {equipe?.nom ?? 'Ce Daily'}</Text>
      </View>
      {autresDailies.map((a) => {
        const on = !sansDailies.has(a.r.id);
        return (
          <Pressable
            key={a.r.id}
            onPress={() => setSansDailies((x) => (on ? new Set([...x, a.r.id]) : new Set([...x].filter((y) => y !== a.r.id))))}
            style={[st.choixPastille, st.choixPetit, on && st.choixOn]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
          >
            <Text style={[st.choixTexte, st.choixTextePetit, on && st.choixTexteOn]}>{on ? '✓ ' : '＋ '}👥 {a.nom}</Text>
          </Pressable>
        );
      })}
    </View>
  );
  const [choixAutres, setChoixAutres] = useState<Record<string, Record<string, boolean>>>({});
  const cocheAutre = (rid: string, id: string) => choixAutres[rid]?.[id] ?? planAilleurs.some((x) => x.reunion === rid && x.element === id);
  const basculerAutre = (rid: string, id: string) => setChoixAutres((m) => ({ ...m, [rid]: { ...(m[rid] ?? {}), [id]: !cocheAutre(rid, id) } }));
  const envoyerAutres = async () => {
    for (const a of montres) {
      const ch = choixAutres[a.r.id] ?? {};
      if (!Object.keys(ch).length) continue;
      const deja = planAilleurs.filter((x) => x.reunion === a.r.id);
      const creer = [
        ...a.elements.filter((t) => cocheAutre(a.r.id, t.id) && !deja.some((x) => x.element === t.id)).map((t) => aEcrire({ ...nouveau('aujourdhui', t.titre, t.id), reunion: a.r.id })),
      ];
      const retirer = deja.filter((x) => !cocheAutre(a.r.id, x.element)).map((x) => x.id);
      if (creer.length || retirer.length) await actions.ecrirePoints(a.r.espace || 'moi', creer, [], retirer);
    }
    setChoixAutres({});
    relirePlans();
  };

  // Plan du jour (13/10) : « Hier » = le plan de la daily précédente, chaque élément « fait » / « pas fait » (sans
  // toucher au statut) ; noté en point « hier » lié à l'élément (sous_type), envoyé avec le reste de la préparation
  const planHierDe = (m: string) => {
    const r = reunionPrecedenteAvecPlan(tous, reunion.id, m);
    return { reunion: r, elements: [...planDe(tous, r, m)].map((id) => parId.get(id)).filter((t): t is Item => !!t) };
  };
  const monPlanHier = planHierDe(mail);
  /** Ligne d'une de vos tâches : case à cocher, sous-tâches (›), à droite son état ou « Action · 29/09 » */
  const ligneTache = (type: TypePoint, t: Item, i: number, onglet: Prep) => {
    const pt = pointDeTache.get(t.id);
    const n = subs.get(t.id)?.length ?? 0;
    const sous = [nouvelles.has(t.id) ? '🆕 Nouveau' : '', n ? pluriel(n, 'sous-tâche') : t.parent ? `Sous-tâche de ${parId.get(t.parent)?.titre ?? 'la story'}` : ''].filter(Boolean).join(' · ');
    return (
      <LigneCase
        key={t.id}
        premiere={i === 0}
        texte={`${t.type === 'story' ? '📖 ' : ''}${t.titre}`}
        sous={sous}
        coche={coche(type, t, t.titre)}
        onBasculer={() => basculer(type, t, t.titre, onglet)}
        onOuvrir={ouvrir(t)}
        pastille={pt ? { ...pastilleSuivi(pt, jour), ton: tonType(pt.type) } : pastilleStatut(t.statut)}
        tache={pt ? undefined : t}
      />
    );
  };
  const listeTaches = (type: TypePoint, liste: Item[], vide: string, onglet: Prep) => (liste.length ? liste.map((t, i) => ligneTache(type, t, i, onglet)) : <Vide texte={vide} />);
  /** Points ajoutés à la main (pas une tâche de la liste) */
  const listeLibres = (type: TypePoint, liste: Item[]) =>
    prep
      .filter((x) => x.type === type && !x.sous_type && !liste.some((t) => x.element === t.id && x.texte === t.titre) && !(type === 'hier' && monPlanHier.elements.some((t) => t.id === x.element)))
      .map((x) => <Ligne key={x.id} texte={x.texte} sous={surStory(x) || 'ajouté par vous'} onRetirer={() => retirerPrep(x.id)} />);

  /** Bloc « Mes notes » (13/10) sous Hier et Aujourd'hui : tous les types, Information par défaut (fermée d'office) */
  const blocMesNotes = (stories: Item[], onglet: Prep = 'membre') => {
    const notes = prep.filter((y) => (TYPES_NOTE as string[]).includes(y.type));
    return (
      <BlocBrique titre={`Mes notes · ${notes.length}`}>
        {notes.map((y, i) => (
          <Ligne key={y.id} premiere={i === 0} texte={y.texte} sous={surStory(y) || 'sans story'} pastille={{ texte: libelleNote(y), ton: tonType(y.type) }} onRetirer={() => retirerPrep(y.id)} />
        ))}
        <SaisiePoint premiere={!notes.length} types={TYPES_NOTE} typeDefaut="information" jour={jour} placeholder="＋ Note (information, blocage, décision, action)" stories={stories} onAjouter={(type, texte, element, c, sous_type) => setPrep((l) => [...l, { ...nouveau(type, texte, element, '', onglet), sous_type, ...(c?.c === 'rien' ? { concretisation: 'rien' as const } : {}) }])} />
      </BlocBrique>
    );
  };
  // PO : stories à accepter, backlog à préparer, questions de l'équipe
  const aAccepter = storiesAAccepter(situation.elements);
  const pi = piOf(jour);
  const aPreparer = backlogAPreparer(h.items.filter((t) => t.type === 'story' && !!t.feature && h.features.get(t.feature)?.pi === pi && e.dansEquipe(t)));
  const questions = estPO ? questionsEquipe(echanges, mail, personnes.map((x) => x.email), idsIteration) : [];
  /** Réponse déjà notée en point de la réunion (décision du PO liée à l'échange) */
  const reponseNotee = (q: Echange) => tous.some((x) => x.type === 'decision' && x.personne === mail && (x.tache === q.id || x.texte === texteReponse(q)));
  /**
   * Vos réponses : celles données ici (envoyées à l'échange avec votre point) et celles déjà données dans la Synchro.
   * Chacune est dupliquée en point « décision » de la réunion (rattaché à la story, avec la référence de l'échange) :
   * l'échange disparaît quand il est pris en compte, le SM la voit et la concrétise quand même.
   */
  const reponsesPO = questions.flatMap((q) => {
    const r = reponses[q.id];
    const ici = q.statut === 'envoye' && !!r && reponsePrete(r.c, r.note);
    if (!ici && (q.statut !== 'repondu' || reponseNotee(q))) return [];
    const e = ici ? { ...q, reponse: r.c, note: r.note.trim() } : q;
    return [{ q: e, ici, pt: { ...nouveau('decision', texteReponse(e), q.element, q.id, 'po'), id: `local-rep-${q.id}` } }];
  });
  const preparation = [...prep, ...reponsesPO.map((r) => r.pt)];
  /** Préparation d'un parcours (« Mon point » ou « PO ») */
  const preparationDe = (o: Prep) => preparation.filter((x) => (x.onglet ?? 'membre') === o);

  // ---- Envoi d'un parcours au SM : réponses aux échanges (un lot), puis points (un lot) ----
  // S'il anime, le point est seulement enregistré : il rejoint ses points notés. Chaque parcours remplace ce qu'il
  // avait envoyé ; ce qui vient d'être écrit est repris (sans relecture), pour un nouvel envoi ou le compte rendu.
  const envoyerPreparation = async (o: Prep) => {
    // Tâches en cours reprises d'office dans Aujourd'hui (pas décochées) : ajoutées au point envoyé
    const reprises = o === 'membre' ? aujListe.filter((t) => parDefautAuj(t) && !decochesAuj.has(t.id)).map((t) => nouveau('aujourdhui', t.titre, t.id, '', o)) : [];
    const pts = [...preparationDe(o), ...reprises];
    const ici = o === 'po' ? reponsesPO.filter((r) => r.ici) : [];
    if (ici.length) await actions.repondreEchanges(ici.map((r) => ({ e: r.q, reponse: r.q.reponse, note: r.q.note })));
    const retires = Object.keys(anciens).filter((id) => anciens[id] === o);
    const { crees } = await actions.ecrirePoints(espace, pts.map(aEcrire), [], retires);
    // Plan commun : on ne retire que les places des éléments de ce Daily décochés ; les autres (autres Dailies, Point perso) restent
    if (o === 'membre') {
      await envoyerAutres();
      const coches = new Set(pts.filter((x) => x.type === 'aujourdhui').map((x) => x.element));
      await ecrireCreneaux(new Set(Object.keys(places).filter((id) => coches.has(id) || !aujListe.some((t) => t.id === id))));
    }
    setServeur((l) => [...l.filter((x) => !retires.includes(x.id)), ...crees]);
    setAnciens((a) => ({ ...Object.fromEntries(Object.entries(a).filter(([id]) => !retires.includes(id))), ...Object.fromEntries(crees.map((x) => [x.id, o])) }));
    setPrep((l) => [...l.filter((x) => (x.onglet ?? 'membre') !== o), ...crees.map((x) => ({ ...x, id: idLocal(), onglet: o }))]);
    if (o === 'po') setReponses({});
    const quoi = o === 'po' ? 'Point PO' : 'Point';
    onInfo?.(
      (anime
        ? `${quoi} enregistré : ${pluriel(pts.length, 'élément')}, il rejoint vos notes`
        : pts.length
          ? `${quoi} envoyé${sm ? ` à ${sm.nom} (SM)` : ''} : ${pluriel(pts.length, 'élément')}`
          : 'Préparation vide envoyée : rien de noté') + (ici.length ? `, ${pluriel(ici.length, 'réponse')} envoyée${ici.length > 1 ? 's' : ''} dans le chat.` : '.'),
    );
  };

  // ---------------------------------------------------------------------------
  // Animation (Scrum Master)
  // ---------------------------------------------------------------------------
  // Suivi : points concrétisés (dailies précédents, ou celui-ci déjà envoyé) dont la tâche n'est pas finie
  // Points de suivi (08/10, avec un statut) à part ; les anciens points (sans statut) gardent leur suivi d'avant
  const suivisEquipe = useMemo(() => calculerSuivis(serveur.filter((x) => !x.statut), h.items), [serveur, h.items]);
  const suivisEchanges = useMemo(() => suivisSynchro(serveur.filter((x) => !x.statut), echanges), [serveur, echanges]);
  const [aValider, setAValider] = useState(false);
  const ctxSuivi: CtxSuivi = {
    espace,
    jour,
    moi: mail,
    animateur: (reunion.organisateur || mail).toLowerCase(),
    nomDe,
    h,
    items: h.items,
    echanges,
    niveau: equipe ? `equipeagile:${equipe.id}` : '',
    lecture: false,
    actions,
    onPoints: (l) => {
      const maj = <T extends PointReunion>(ll: T[]) => ll.map((x) => ({ ...x, ...(l.find((y) => y.id === x.id) ?? {}) }));
      setLus(maj);
      setServeur(maj);
    },
    concret: {
      moi: { email: mail, nom: nomDe(mail), meta: 'vous' },
      equipe: personnes.map((y) => ({ email: y.email.toLowerCase(), nom: y.nom })),
      validateurs: [...new Map([...personnes.map((y) => ({ email: y.email.toLowerCase(), nom: y.nom })), { email: mail, nom: nomDe(mail), meta: 'vous' }].map((y) => [y.email, y])).values()],
      contexte: situation.cartes.map((t) => t.id),
    },
    echeance: echeanceParDefaut(reunion),
    ctxCreer: (pt) => ({
      espace,
      iteration: it.key,
      equipe: equipe?.id ?? '',
      train: e.train?.id,
      idDe: (m: string) => personneParEmail(m, org)?.id ?? '',
      description: `${libelleNote(pt)} noté au daily ${equipe?.nom ?? ''} (${nomDe(pt.personne)}), re-concrétisé le ${dateCourte(jour)}.`,
      h,
      moi: mail,
    }),
    onInfo,
    changements: (p) => changementsSuivi(avancement, p.id, nomDe),
  };
  // Ouverts, fermés (filtre « Fermées ») et décidés hors réunion (en tête, « Confirmer ») — validé le 09/10
  const { horsReunion: horsReunionD, fermees: fermeesD, ouverts: ouvertsD } = repartirSuivis(pointsDeSuivi(serveur, reunion.id));
  const nouveauxSuivis = vueSuivi === 'fermees' ? fermeesD : ouvertsD;
  const nValider = nouveauxSuivis.filter((x) => statutAffiche(x, h.items, jour).s === 'fait' && validateurDe(x, ctxSuivi.animateur) === mail).length;
  // À concrétiser : ce qui ne l'a pas encore été (un compte rendu déjà envoyé ne recrée rien)
  // Points de suivi reportés des réunions précédentes (escalades reçues, réponses recopiées) : à concrétiser aussi
  const reportes = useMemo(() => aReprendre(serveur, reunion.id).filter(attendConcretisation), [serveur, reunion.id]);
  const aDecider = [...[...tous, ...(anime ? reponsesPO.map((r) => r.pt) : [])].filter((x) => dela(x) && aConcretiser(x) && !x.concretisation), ...(anime ? reportes : [])];
  // Concrétisation (08/10, feuille « Concrétiser ») : les choix du SM sur ceux proposés ; forme d'avant (c, resp, a) en plus
  const escaladesDaily = [
    ...(rte?.email ? [{ email: rte.email.toLowerCase(), nom: rte.nom, meta: `RTE du train ${e.train?.nom ?? ''} · obstacle, organisation` }] : []),
    ...(pm?.email ? [{ email: pm.email.toLowerCase(), nom: pm.nom, meta: `PM du train ${e.train?.nom ?? ''} · contenu, priorité` }] : []),
  ];
  const choixDe = (pt: PointReunion) => {
    const base = choixParDefaut(pt, { animateur: reunion.organisateur || mail, echeance: echeanceParDefaut(reunion), h, moi: mail });
    const x = { ...base, ...choix[pt.id] };
    const dansEq = personnes.some((y) => y.email.toLowerCase() === x.resp);
    if (choix[pt.id]?.resp === undefined && x.qui !== 'dessus' && !dansEq) x.resp = po?.email.toLowerCase() ?? mail;
    if (x.qui === 'dessus' && !escaladesDaily.some((y) => y.email === x.resp)) x.resp = escaladesDaily[0]?.email ?? x.resp;
    return { ...x, c: concretisationDe(x), a: x.resp };
  };
  /** Tâche née d'un point : sous-tâche de sa story ou tâche à part dans l'itération, avec son responsable */
  function entreeTache(pt: Pick<PointReunion, 'texte' | 'type' | 'personne' | 'element'>, c: 'sous_tache' | 'tache', resp: string): ItemInput {
    return {
      ...RECURRENCE_DEFAUTS,
      espace,
      titre: pt.texte,
      type: 'tache',
      date: '',
      heure: '',
      heure_fin: '',
      date_fin: '',
      lieu: '',
      description: `${libelleNote(pt)} noté au daily ${equipe?.nom ?? ''} du ${dateCourte(jour)} (${nomDe(pt.personne)}).`,
      priorite: pt.type === 'blocage' ? 'haute' : 'normale',
      statut: 'a_faire',
      parent: c === 'sous_tache' ? pt.element : '',
      feature: '',
      epic: '',
      objectif: '',
      domaine: '',
      points: '',
      iteration: it.key,
      telephone: '',
      equipe: equipe?.id ?? '',
      responsable: personneParEmail(resp, org)?.id ?? '',
    };
  }
  const ajouter = (x: { personne: string; type: TypePoint; texte: string; element: string; sous_type?: SousType }) =>
    setLocaux((l) => [...l, { ...nouveau(x.type, x.texte, x.element), personne: x.personne.toLowerCase(), sous_type: x.sous_type ?? '' }]);

  // ---- Envoi du compte rendu : tâches (un lot), échanges (un lot), points (un lot, votre préparation comprise) ----
  const envoyerCompteRendu = async () => {
    const decides = aDecider.map((pt) => ({ pt, ...choixDe(pt) }));
    // Demandes de budget nées des notes (13/10) : une par note, soumises au niveau du dessus ; la note est close
    for (const d of decides.filter((x) => x.que === 'budget' && !!budgetConcret))
      await budgetCtx.soumettreDemande(espace, { motif: d.pt.texte, montant: String(d.montant ?? '').replace(',', '.'), periode: (d.periode || 'ponctuel') as PeriodeDepense, du: jour, au: '', pour: d.pour || budgetConcret!.pour[0].value, demandeur: niveauBudget, soumis_par: mail, origine: `Daily du ${dateCourte(jour)}` });
    // « Créer » (08/10) : tâches de tout type, features, réunions ponctuelles, rattachées à l'élément du dessus
    const idDe = (m: string) => personneParEmail(m, org)?.id ?? '';
    const ctxCreer = (pt: PointReunion) => ({ espace, iteration: it.key, equipe: equipe?.id ?? '', train: e.train?.id, idDe, description: `${libelleNote(pt)} noté au daily ${equipe?.nom ?? ''} du ${dateCourte(jour)} (${nomDe(pt.personne)}).`, h, moi: mail });
    const aCreerTout = decides.filter((d) => d.que === 'creer' && d.qui !== 'dessus').map((d) => ({ d, x: elementACreer(d, d.pt, ctxCreer(d.pt)) }));
    const aCreer = aCreerTout.map((a) => a.d);
    const lotItems = aCreerTout.filter((a) => a.x.kind === 'item');
    const creees = await actions.creerTaches(espace, lotItems.map((a) => (a.x as { input: ItemInput }).input));
    const tacheDe = new Map(lotItems.map((a, i) => [a.d.pt.id, creees[i]?.id ?? '']));
    const lotFeatures = aCreerTout.filter((a) => a.x.kind === 'feature');
    if (lotFeatures.length && actions.creerEntites) {
      const fs = await actions.creerEntites(espace, 'feature', lotFeatures.map((a) => (a.x as { input: Record<string, string> }).input));
      lotFeatures.forEach((a, i) => tacheDe.set(a.d.pt.id, fs[i]?.id ?? ''));
    }
    const lotReunions = aCreerTout.filter((a) => a.x.kind === 'reunion');
    if (lotReunions.length && actions.creerReunions) {
      const ids = await actions.creerReunions(espace, lotReunions.map((a) => ({ ...(a.x as Extract<typeof a.x, { kind: 'reunion' }>), niveau: reunion.niveau })));
      lotReunions.forEach((a, i) => tacheDe.set(a.d.pt.id, ids[i] ?? ''));
    }
    // Vous êtes aussi le PO : vos réponses données ici partent dans leurs échanges (un lot)
    const ici = reponsesPO.filter((r) => r.ici);
    if (ici.length) await actions.repondreEchanges(ici.map((r) => ({ e: r.q, reponse: r.q.reponse, note: r.q.note })));

    const escalades = decides.filter((d) => d.c === 'escalade');
    // Point de suivi confié à quelqu'un qui n'est pas du daily : prévenu dans le Chat (08/10)
    const synchros = decides.filter((d) => d.que !== 'rien' && d.qui !== 'dessus' && !!d.resp && d.resp !== mail && !personnes.some((y) => y.email.toLowerCase() === d.resp));
    const decisions = decides.filter((d) => d.pt.type === 'decision');
    const story = (id: string) => (id ? parId.get(id)?.titre : undefined);
    // Échanges en un seul lot : blocages passés en 🔄 Synchro (de la personne qui a le blocage, transmis par vous),
    // puis, s'il y a un RTE, escalades et compte rendu
    const lot: EchangeInput[] = synchros.map((d) => ({
      de: mail,
      a: d.resp,
      type: 'message' as const,
      titre: `${estSuivi(d) ? '📌 Nouveau suivi' : `✓ ${LIBELLE_TYPE_CREE(d.type)} pour vous`} · ${d.pt.texte}`.slice(0, 200),
      texte: `${libelleNote(d.pt)} noté au daily ${equipe?.nom ?? ''} du ${dateCourte(jour)} par ${nomDe(d.pt.personne)}${libelleElement(d.element, h) ? ` (${libelleElement(d.element, h)})` : ''}. Responsable : ${nomDe(d.resp)}${estSuivi(d) ? ` · Validation : ${nomDe(d.valid)}${d.ech ? ` · Échéance : ${dateCourte(d.ech)}` : ''}` : ' · sans suivi'}.`,
      choix: '',
      reponse: '',
      note: '',
      statut: 'envoye' as const,
      element: d.element,
      niveau: equipe ? `equipeagile:${equipe.id}` : '',
      transmis_par: '',
      prive: '1',
      pieces_jointes: '',
      espace,
    }));
    // Escalades : chacune à l'équipe choisie (SM du train → RTE ; PO du train → PM) ; compte rendu au RTE
    const escaladesEnvoyees = e.train ? escalades.filter((d) => !!d.a) : [];
    if (e.train) {
      const base = { de: mail, a: (rte?.email ?? '').toLowerCase(), type: 'message' as const, choix: '', reponse: '', note: '', statut: 'envoye' as const, niveau: `train:${e.train.id}`, transmis_par: '', prive: '1', pieces_jointes: '', espace };
      const texte = texteCompteRendu({
        equipe: equipe?.nom ?? '',
        jour,
        decisions: decisions.map((d) => d.pt.texte),
        creees: aCreer.map((d) => ({ titre: d.titre, sous: resumeConcret(d, nomDe, h) })),
        escalades: escalades.map((d) => `${d.pt.texte} (${nomDe(d.pt.personne)}${story(d.pt.element) ? `, « ${story(d.pt.element)} »` : ''})`),
        synchros: decides.filter((d) => d.c === 'suivi').map((d) => `${d.pt.texte} (${resumeConcret(d, nomDe, h)})`),
        notes: decides.filter((d) => d.c === 'rien' && d.pt.type !== 'decision').length,
      });
      lot.push(
        ...escaladesEnvoyees.map((d) => ({
          ...base,
          a: d.a,
          titre: titreEscalade(`Blocage · ${d.pt.texte}`),
          texte: `Blocage noté au daily ${equipe?.nom ?? ''} du ${dateCourte(jour)} pour ${nomDe(d.pt.personne)}${story(d.pt.element) ? ` (story « ${story(d.pt.element)} »)` : ''} : l'équipe ne peut pas le lever seule.`,
          element: d.pt.element,
        })),
        ...(rte?.email ? [{ ...base, titre: `Compte rendu · Daily ${equipe?.nom ?? ''} du ${dateCourte(jour)}`, texte, element: '' }] : []),
      );
    }
    const envoyes = lot.length ? await actions.envoyerEchanges(espace, lot) : [];
    // Le point garde l'échange créé (Synchro, escalade) pour le suivi
    const echangeDuPoint = new Map(escaladesEnvoyees.map((d, i) => [d.pt.id, envoyes[synchros.length + i]?.id ?? '']));

    // Une réponse du PO (décision) garde le lien vers sa question, sauf si elle devient une tâche
    const patch = (d: (typeof decides)[number]) => ({
      ...patchConcretise(d, tacheDe.get(d.pt.id) || echangeDuPoint.get(d.pt.id) || (d.pt.type === 'decision' && d.c === 'rien' ? d.pt.tache : '') || (d.c === 'escalade' || d.c === 'suivi' ? d.pt.tache : '')),
      ...(echangeDuPoint.get(d.pt.id) ? { echange: echangeDuPoint.get(d.pt.id) } : {}),
    });
    const parPoint = new Map(decides.map((d) => [d.pt.id, d]));
    const creer = [...preparation, ...locaux].map((y) => {
      const d = parPoint.get(y.id);
      return d ? { ...aEcrire(y), ...patch(d) } : aEcrire(y);
    });
    const modifier = decides.filter((d) => !d.pt.id.startsWith('local-')).map((d) => ({ id: d.pt.id, ...patch(d) }));
    // Cas d'usage 1 : chaque escalade crée un point de suivi « Escalade reçue » dans la réunion correspondante de
    // celui qui reçoit (ART sync du train) ; même Sheet que ce daily : dans la même écriture, sinon une par Sheet
    const recus = parEspace(
      escaladesEnvoyees.flatMap((d) => {
        const id = echangeDuPoint.get(d.pt.id);
        if (!id) return [];
        const ech = { id, titre: titreEscalade(`Blocage · ${d.pt.texte}`), texte: d.pt.texte, element: d.pt.element };
        return pointsEscalade({ echange: ech, par: mail, vers: d.a, avant: equipe ? { kind: 'equipeagile', id: equipe.id } : null, apres: e.train ? { kind: 'train', id: e.train.id } : null, jour, org, dejaNote: true });
      }),
    );
    // Points au suivi fini : gardés jusqu'à la rétro (ou la démo) du niveau, qui les supprime (voir NETTOYAGE)
    // Lignes d'état des dailies précédents : retirées (celle d'aujourd'hui reste jusqu'au compte rendu suivant)
    const etatsAnciens = lus.filter((x) => x.type === 'etat' && x.reunion !== reunion.id).map((x) => x.id);
    // Avancement (13/10) : photo de la situation, comparée au Daily suivant ; dans la même écriture
    const photo = avancement.envoi(mail);
    const ecrits = await actions.ecrirePoints(espace, [...creer, ...photo.creer, ...(recus.get(espace) ?? [])], modifier, [...Object.keys(anciens), ...etatsAnciens, ...photo.retirer]);
    for (const [esp, l] of recus) if (esp !== espace) await actions.ecrirePoints(esp, l, [], []);
    await relierEscalades(actions, espace, envoyes, escaladesEnvoyees.map((d) => d.pt.id), [...preparation, ...locaux].map((y) => y.id), ecrits.crees, echangeDuPoint);
    live.terminer();
    onInfo?.(
      `Compte rendu du daily : ${pluriel(creees.length, 'tâche')} créée${creees.length > 1 ? 's' : ''}` +
        (escalades.length ? `, ${pluriel(escalades.length, 'note')} transmise${escalades.length > 1 ? 's' : ''}` : '') +
        (synchros.length ? `, ${pluriel(synchros.length, 'suivi')} transmis` : '') +
        (rte?.email ? `, envoyé à ${nomDe(rte.email)} (RTE).` : ' ; pas de RTE : compte rendu non envoyé.'),
    );
  };

  // ---------------------------------------------------------------------------
  // Écrans
  // ---------------------------------------------------------------------------
  /** Rôle affiché sous un nom dans « Transmettre à » : PO, SM, RTE, PM */
  const libelleRole = (email: string) => {
    const id = personneParEmail(email, org)?.id ?? '';
    if (!id) return '';
    if (id === rte?.id) return 'RTE';
    if (id === pm?.id) return 'PM';
    const eq = org.equipes.find((x) => x.sm === id || x.po === id);
    return eq ? `${eq.sm === id ? 'SM' : 'PO'} · ${eq.nom}` : '';
  };
  /** Résumé d'une concrétisation : « Sous-tâche · 👤 Tom », « Transmettre à Paul », « ⤴ Escalader au RTE », « Rien » */
  const resumeChoix = (c: Concretisation | '', resp: string, a: string) =>
    c === 'sous_tache' || c === 'tache'
      ? `${c === 'sous_tache' ? 'Sous-tâche' : `Tâche à part (${it.nom})`} · 👤 ${nomDe(resp)}`
      : c === 'synchro'
        ? `Transmettre à ${a ? nomDe(a) : '…'}`
        : c === 'escalade'
          ? `↪ Transmettre aux ${a && a === pm?.email?.toLowerCase() ? 'PO' : 'SM'} du train`
          : 'Rien';
  /** « Suivre » (lecture seule) : les points de ce daily tels qu'ils sont dans le Sheet, à concrétiser ou concrétisés */
  const duSheetDe = (rid: string) => serveur.filter((y) => y.reunion === rid && aConcretiser(y));
  const duSheet = duSheetDe(reunion.id);

  const rendu = (x: EtapeCatalogue, o: ParcoursRole) => {
    if (!charge) return <Vide texte="Lecture des points du daily…" />;
    const sous = (s: string) => s;
    /** Parcours qui envoie ce qui est coché ou ajouté ici */
    const pr: Prep = o.role === 'po' ? 'po' : 'membre';
    // Stories de la personne : proposées dans la fenêtre « Nouveau point »
    const mesStories = situation.cartes.filter((t) => !!moiP && t.responsable === moiP.id);
    const lecture = o.lecture;
    switch (x.cle) {
      case 'hier':
      case 'aujourdhui': {
        const hier = x.cle === 'hier';
        return (
          <>
            <TitreFiche icone={hier ? '⏪' : '▶️'} titre={hier ? 'Hier' : 'Aujourd’hui'} vide="" sous={sous(hier ? 'Le plan d’hier et son statut (modifiable), ce dont vous parlerez' : 'Cochez ce que vous ferez aujourd’hui : le statut ne change pas')} />
            {pr === 'membre' && choixEspaces}
            {hier && monPlanHier.elements.length > 0 && (
              <BlocBrique titre={`Plan du ${dateCourte(monPlanHier.reunion.slice(-10))} · ${monPlanHier.elements.length}`}>
                {monPlanHier.elements.map((t, i) => (
                  <Ligne key={t.id} premiere={i === 0} texte={`${t.type === 'story' ? '📖 ' : ''}${t.titre}`} pastille={pastilleStatut(t.statut)} tache={t} />
                ))}
              </BlocBrique>
            )}
            {(() => {
              // Hier : ce qui n'était pas au plan ; Aujourd'hui : cocher = plan du jour, le statut ne change pas (13/10)
              const liste = hier ? hierListe.filter((t) => !monPlanHier.elements.some((y) => y.id === t.id)) : aujListe;
              return (
                <BlocBrique titre={hier ? `${monPlanHier.elements.length ? 'Hors plan' : 'Mes stories et tâches'} · ${liste.length}` : `Mon plan du jour · ${aujListe.filter((t) => coche('aujourdhui', t, t.titre)).length} sur ${aujListe.length}`}>
                  {hier ? listeTaches('hier', liste, 'Rien en cours ni terminé hier.', pr) : listeTaches('aujourdhui', liste, 'Rien à votre nom dans le sprint.', pr)}
                  {listeLibres(hier ? 'hier' : 'aujourdhui', liste)}
                </BlocBrique>
              );
            })()}
            {hier &&
              pr === 'membre' &&
              montres.filter((a) => a.planHier.length > 0).map((a) => (
                <BlocBrique key={`h-${a.r.id}`} titre={`👥 ${a.nom} · plan du ${dateCourte(a.hierDu.slice(-10))}`}>
                  {a.planHier.map((t, i) => (
                    <Ligne key={t.id} premiere={i === 0} texte={`${t.type === 'story' ? '📖 ' : ''}${t.titre}`} pastille={pastilleStatut(t.statut)} tache={t} />
                  ))}
                </BlocBrique>
              ))}
            {!hier &&
              pr === 'membre' &&
              montres.filter((a) => a.elements.length > 0).map((a) => (
                <BlocBrique key={a.r.id} titre={`👥 ${a.nom} · Daily ${a.r.debut.slice(11, 16).replace(/^0/, '')} · ${a.elements.filter((t) => cocheAutre(a.r.id, t.id)).length} sur ${a.elements.length}`}>
                  {a.elements.map((t, i) => (
                    <LigneCase key={t.id} premiere={i === 0} texte={`${t.type === 'story' ? '📖 ' : ''}${t.titre}`} sous={`envoyé au Daily ${a.nom}`} coche={cocheAutre(a.r.id, t.id)} onBasculer={() => basculerAutre(a.r.id, t.id)} pastille={pastilleStatut(t.statut)} tache={t} />
                  ))}
                </BlocBrique>
              ))}
            {!hier && blocagesOuverts.length > 0 && (
              <BlocBrique titre={`Blocages toujours ouverts · ${blocagesOuverts.length}`}>
                {blocagesOuverts.map((y, i) => (
                  <Ligne key={y.id} premiere={i === 0} texte={y.texte} sous={`noté le ${dateCourte(y.reunion.slice(-10))}${y.statut ? ` · ${LIBELLE_STATUT[y.statut]}` : y.concretisation ? '' : ' · pas encore concrétisé'}`} pastille={{ texte: 'Blocage', ton: 'rouge' }} />
                ))}
              </BlocBrique>
            )}
            {blocMesNotes(mesStories, pr)}
          </>
        );
      }
      // Plan du jour (13/10, R5) : l'emploi du temps, vu par moi seul ; les éléments cochés dans Aujourd'hui sans
      // heure propre ce jour-là sont « À placer » ; réunions et éléments déjà à l'heure occupent le temps
      case 'plan': {
        const aMoi = moiP ? h.items.filter((t) => t.responsable === moiP.id && t.date === jour && !!t.heure && t.statut !== 'termine') : [];
        const fixes: EvenementJour[] = [...reunionsDuJour, ...aMoi.map((t) => ({ heure: t.heure.replace(/^0/, ''), fin: t.heure_fin ? t.heure_fin.replace(/^0/, '') : undefined, titre: t.titre }))];
        return (
          <>
            <TitreFiche icone="🗓️" titre="Plan du jour" vide="" sous={sous('Placez vos éléments dans la journée : vu par vous seul')} />
            {choixEspaces}
            <PlanDuJour
              elements={[
                ...aujListe.filter((t) => coche('aujourdhui', t, t.titre)),
                // Plan commun (R5b) : ce que j'ai coché à mes autres Dailies du jour (autres équipes, autres espaces)
                ...[...new Set([...planAilleurs.filter((x) => x.reunion !== reunion.id && !sansDailies.has(x.reunion)).map((x) => x.element), ...montres.flatMap((a) => a.elements.filter((t) => cocheAutre(a.r.id, t.id)).map((t) => t.id))])]
                  .filter((id) => !autresDailies.some((a) => a.elements.some((t) => t.id === id) && !cocheAutre(a.r.id, id)))
                  .map((id) => parId.get(id))
                  .filter((t): t is Item => !!t && t.statut !== 'termine' && !aujListe.some((y) => y.id === t.id)),
              ].filter((t) => !aMoi.some((y) => y.id === t.id))}
              places={places}
              fixes={fixes}
              perso={evtsPerso}
              journee={journee}
              onPlacer={(id, p) => setPlaces((x) => {
                const y = { ...x };
                if (p) y[id] = p;
                else delete y[id];
                return y;
              })}
              onAjouterEvt={(ev) => setEvtsPerso((l) => [...l, ev])}
              onRetirerEvt={(ev) => setEvtsPerso((l) => l.filter((y) => y !== ev))}
              onJournee={changerJournee}
            />
          </>
        );
      }
      // Résumé (13/10) : ce dont vous parlerez et vos notes, avant « Envoyer au Scrum Master » ; « blocages » :
      // ancien nom de l'étape (parcours enregistrés avant le 13/10)
      case 'resume':
      case 'blocages': {
        const nHier = prep.filter((y) => y.type === 'hier').length;
        const nAuj = aujListe.filter((t) => coche('aujourdhui', t, t.titre)).length + prep.filter((y) => y.type === 'aujourdhui' && !aujListe.some((t) => t.id === y.element)).length;
        const notes = prep.filter((y) => (TYPES_NOTE as string[]).includes(y.type));
        return (
          <>
            <TitreFiche icone="📋" titre="Résumé" vide="" sous={sous('Ce que vous direz au tour de table')} />
            <BlocBrique titre="Tâches">
              <Ligne premiere texte={`⏪ Hier · ${nHier} élément${nHier > 1 ? 's' : ''}`} />
              <Ligne texte={`▶️ Aujourd’hui · ${nAuj} élément${nAuj > 1 ? 's' : ''}`} />
            </BlocBrique>
            <BlocBrique titre={`Mes notes · ${notes.length}`}>
              {TYPES_NOTE.flatMap((ty) => notes.filter((y) => y.type === ty)).map((y, i) => (
                <Ligne key={y.id} premiere={i === 0} texte={y.texte} sous={surStory(y) || 'sans story'} pastille={{ texte: libelleNote(y), ton: tonType(y.type) }} onRetirer={() => retirerPrep(y.id)} />
              ))}
              {!notes.length && <Vide texte="Aucune note." />}
            </BlocBrique>
          </>
        );
      }
      case 'accepter':
        return (
          <>
            <TitreFiche icone="🏁" titre="Stories à accepter" vide="" sous={sous(`${it.nom} · terminées, cochez celles que vous accepterez aujourd’hui`)} />
            {/* Arbre des éléments (14/10) : la case « accepter aujourd'hui » sur chaque story */}
            {aAccepter.length ? (
              <BlocArbre
                key="arbre-accepter"
                av={avancement}
                titre="Terminées"
                cles={aAccepter.map((t) => `t:${t.id}`)}
                strict
                nom={nomDe}
                montrerResponsable
                sousEnPlus={(t) => { const n = subs.get(t.id)?.length ?? 0; return n ? pluriel(n, 'sous-tâche') : ''; }}
                cases={{ coche: (t) => coche('aujourdhui', t, `Accepter « ${t.titre} »`), basculer: (t) => basculer('aujourdhui', t, `Accepter « ${t.titre} »`, 'po'), fige: lecture }}
                lecture={lecture}
                onOuvrir={lecture ? undefined : onOpenTask}
                onOuvrirEntite={lecture ? undefined : onOpenEntite}
              />
            ) : (
              <Vide texte="Aucune story terminée dans le sprint." />
            )}
          </>
        );
      case 'backlog':
        return (
          <>
            <TitreFiche icone="🪄" titre="Backlog à préparer" vide="" sous={sous(`Stories des features du PI sans estimation ou trop grosses (plus de ${fmt(8)})`)} />
            {aPreparer.length ? (
              <BlocArbre
                key="arbre-backlog"
                av={avancement}
                titre="À préparer"
                cles={aPreparer.map(({ story }) => `t:${story.id}`)}
                strict
                nom={nomDe}
                sousEnPlus={(t) => { const x = aPreparer.find((y) => y.story.id === t.id); const n = subs.get(t.id)?.length ?? 0; return [x?.raison === 'trop_grosse' ? `${fmt(pointsOf(t))}, à découper` : '', n ? pluriel(n, 'sous-tâche') : ''].filter(Boolean).join(' · '); }}
                pastilleDe={(t) => { const x = aPreparer.find((y) => y.story.id === t.id); return x ? { texte: x.raison === 'trop_grosse' ? 'trop grosse' : 'sans estimation', ton: 'orange' } : undefined; }}
                cases={{ coche: (t) => coche('aujourdhui', t, `Préparer « ${t.titre} »`), basculer: (t) => basculer('aujourdhui', t, `Préparer « ${t.titre} »`, 'po'), fige: lecture }}
                lecture={lecture}
                onOuvrir={lecture ? undefined : onOpenTask}
                onOuvrirEntite={lecture ? undefined : onOpenEntite}
              />
            ) : (
              <Vide texte="✓ Backlog du PI prêt : toutes les stories sont estimées." />
            )}
          </>
        );
      case 'questions': {
        const notees = new Set(reponsesPO.map((r) => r.q.id));
        return (
          <>
            <TitreFiche icone="❓" titre="Questions de l’équipe" vide="" sous={sous('Questions des membres (💬 Chat) sur les stories du sprint ; votre réponse part dans leur message et rejoint votre point')} />
            {!questions.length && (
              <BlocBrique titre="Questions · 0">
                <Vide texte="✓ Aucune question de l’équipe en attente." />
              </BlocBrique>
            )}
            {questions.map((q) => {
              const repondu = q.statut === 'repondu';
              const r = reponses[q.id] ?? { c: '', note: '' };
              const poser = (y: Partial<typeof r>) => setReponses((mm) => ({ ...mm, [q.id]: { ...r, ...y } }));
              const choixQ = q.choix.split(';').map((c) => c.trim()).filter(Boolean);
              return (
                <View key={q.id} style={st.carteConcret}>
                  <View style={st.ligneHaut}>
                    <View style={st.corps}>
                      <Text style={st.texte}>{q.titre.replace(/^Blocage · /, '')}</Text>
                      <Text style={st.sous}>
                        {[`De ${nomDe(q.de)}`, q.transmis_par ? `transmis par ${nomDe(q.transmis_par)}` : '', surStory({ texte: '', element: q.element })].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <Pastille {...(repondu ? { texte: 'Répondu', ton: 'vert' as const } : { texte: 'Blocage', age: ageAffiche(q.cree_le.slice(0, 10), jour), ton: 'rouge' as const })} />
                  </View>
                  {repondu ? (
                    <Text style={st.sous}>
                      ↳ {estAutre(q.reponse) ? q.note : [q.reponse, q.note].filter(Boolean).join(' — ')}
                      {notees.has(q.id) ? ' · sera noté comme décision' : ' · noté'}
                    </Text>
                  ) : (
                    <>
                      <Pastilles options={choixQ.map((c) => ({ value: c, label: c }))} value={r.c} onChange={(v) => poser({ c: v })} />
                      {!!r.c && (
                        <TextInput
                          value={r.note}
                          onChangeText={(v) => poser({ note: v })}
                          placeholder={placeholderNote(r.c)}
                          placeholderTextColor={colors.muted}
                          style={st.note}
                          accessibilityLabel={placeholderNote(r.c)}
                        />
                      )}
                      {notees.has(q.id) && <Text style={st.sous}>✓ Partira dans le message avec votre point, notée comme décision</Text>}
                    </>
                  )}
                </View>
              );
            })}
          </>
        );
      }
      case 'situation': {
        const s = situation;
        const nSuivisVus = [...suivisEquipe, ...suivisEchanges].filter((x) => !filtreSuivi || x.point.type === filtreSuivi).length + nouveauxSuivis.filter((x) => !filtreSuivi || x.type === filtreSuivi).length;
        return (
          <>
            <TitreFiche icone="☀️" titre="Situation" vide="" sous={sous(`${it.nom} · du ${dateCourte(it.start)} au ${dateCourte(it.end)} · ${equipe?.nom ?? ''}`)} />
            <View style={st.compteurs}>
              <Compteur valeur={`${arrondi(s.faits)} / ${arrondi(s.prevus)}`} libelle={`${safe.pointsJours ? 'jours' : 'pts'} faits / prévus`} />
              <Compteur valeur={String(s.bloquees)} libelle={s.bloquees > 1 ? 'stories bloquées' : 'story bloquée'} ton={s.bloquees ? 'rouge' : undefined} />
              <Compteur valeur={String(s.retard)} libelle="en retard" ton={s.retard ? 'orange' : undefined} />
            </View>
            {(() => {
              // 📅 Absents aujourd'hui (congés déclarés, lot 2) : le Daily n'attend pas une personne absente
              const ab = absentsLe(congesCtx.conges, jour);
              const noms = personnes.filter((y) => ab.fermeture || ab.personnes.includes(y.email.toLowerCase())).map((y) => y.nom);
              return noms.length ? <Text style={[st.sous, { marginHorizontal: 16, marginTop: 6 }]}>📅 Absents aujourd’hui : {noms.join(', ')}</Text> : null;
            })()}
            {/* Arbre des éléments (14/10) : réunion avec tour de table, les blocs arrivent fermés (le détail au tour de table) */}
            <BlocArbre key="arbre-situation" av={avancement} titre="Éléments du sprint" cles={situation.elements.map((t) => `t:${t.id}`)} nom={nomDe} montrerResponsable fermeAuDepart lecture={lecture} onOuvrir={lecture ? undefined : onOpenTask} onOuvrirEntite={lecture ? undefined : onOpenEntite} />
            {/* Suivis (14/10) : coque commune des briques, fermée au départ (réunion avec tour de table) */}
            <BlocBrique
              key="suivis-situation"
              titre="📌 Suivis"
              n={nSuivisVus}
              nChanges={nbSuivisChanges(avancement, nouveauxSuivis)}
              fermeAuDepart
              arborescence={nouveauxSuivis.some((x) => !!cheminElement(x.element, h)) ? { valeur: arboSuivis, changer: setArboSuivis } : undefined}
              aValider={{ n: nValider, actif: aValider, onPress: () => setAValider((v) => !v) }}
              filtres={{
                nb: [!!filtreSuivi, vueSuivi !== 'tout', avancement.filtre.mode !== 'elements'].filter(Boolean).length,
                contenu: (
                  <>
                    <ModeAffichage av={avancement} lecture={lecture} />
                    <FiltresVue value={vueSuivi} onChange={setVueSuivi} nSuivis={suivisEquipe.length + suivisEchanges.length + nouveauxSuivis.length} nFermees={fermeesD.length} />
                    <FiltresType types={TYPES_NOTE} value={filtreSuivi} onChange={setFiltreSuivi} />
                  </>
                ),
              }}
            >
              <>
              {vueSuivi !== 'fermees' && !aValider && <BlocHorsReunion points={horsReunionD} ctx={ctxSuivi} peutConfirmer={anime && !lecture} />}
              <LignesSuivi parElement={arboSuivis} points={nouveauxSuivis.filter((x) => !filtreSuivi || x.type === filtreSuivi)} premiere={!horsReunionD.length || vueSuivi === 'fermees'} ctx={{ ...ctxSuivi, lecture: lecture || vueSuivi === 'fermees' }} aValider={aValider && nValider > 0} />
              {!aValider && vueSuivi !== 'fermees' && suivisEquipe.filter((x) => !filtreSuivi || x.point.type === filtreSuivi).map(({ point, tache }, i) => (
                <Ligne
                  key={point.id}
                  premiere={!nouveauxSuivis.length && i === 0}
                  texte={tache.titre}
                  sous={sousLigneSuivi(LIBELLE_CONCRETISATION[point.concretisation], nomDe(point.responsable || point.personne), tache.statut === 'en_cours' ? 'en cours' : 'à faire')}
                  pastille={{ ...pastilleSuivi(point, jour), ton: tonType(point.type) }}
                />
              ))}
              {/* Blocages passés en 🔄 Synchro : suivis tant que l'échange existe (sans historique) */}
              {!aValider && vueSuivi !== 'fermees' && suivisEchanges.filter((x) => !filtreSuivi || x.point.type === filtreSuivi).map(({ point, echange }, i) => (
                <Ligne
                  key={point.id}
                  premiere={!nouveauxSuivis.length && !suivisEquipe.filter((x) => !filtreSuivi || x.point.type === filtreSuivi).length && i === 0}
                  texte={point.texte}
                  sous={
                    point.type === 'decision'
                      ? sousLigneSuivi('réponse reçue', nomDe(echange.de), 'à accepter', 'De')
                      : sousLigneSuivi(LIBELLE_CONCRETISATION[point.concretisation], nomDe(echange.a), echange.statut === 'repondu' ? 'répondu' : 'en attente')
                  }
                  pastille={{ ...pastilleSuivi(point, jour), ton: tonType(point.type) }}
                />
              ))}
              {/* Points de suivi reportés : escalades reçues et réponses recopiées, à concrétiser (cas d'usage 1 et 2) */}
              {/* Notes à concrétiser (14/10) : plus dans la Situation, elles sont à l'étape Concrétisation */}
              {!suivisEquipe.length && !suivisEchanges.length && !nouveauxSuivis.length && <Vide texte="✓ Rien en attente des dailies précédents." />}
              {/* Un point à suivre oublié : ajouté ici, concrétisé dans la même fenêtre (07/10) */}
              {anime && !lecture && (
                <SaisiePoint
                  types={TYPES_NOTE}
                  typeDefaut="action"
                  titre="Nouveau suivi"
                  jour={jour}
                  placeholder="＋ Suivi oublié"
                  stories={situation.cartes}
                  concretiser={{ personnes: optionsPersonnes(personnes, 'email'), respDefaut: mail }}
                  onAjouter={(type, texte, element, conc, sousType) => {
                    const pt = { ...nouveau(type, texte, element), personne: mail, sous_type: sousType ?? '' };
                    setLocaux((l) => [...l, pt]);
                    if (conc) setChoix((m) => ({ ...m, [pt.id]: { que: conc.c === 'rien' ? 'rien' : 'creer', resp: conc.resp } }));
                  }}
                />
              )}
              </>
            </BlocBrique>
            <BlocBrique titre="Objectifs de la réunion">
              <Ligne premiere texte="🎯 Se synchroniser sur l’objectif de sprint" sous="Chacun dit ce qu’il a fait hier et ce qu’il fera aujourd’hui (15 min)" />
              <Ligne texte="🧱 Lever les blocages" sous="Les noter pendant le tour de table, les concrétiser ensuite" />
            </BlocBrique>
          </>
        );
      }
      case 'tour': {
        if (!courant) return <Vide texte="Aucun participant dans l’équipe." />;
        const m = courant.email.toLowerCase();
        // Plan du jour (13/10) : ses éléments pas terminés, cochés selon son plan ; le statut ne change pas ici
        const estMoi = m === mail;
        const sonPlan = planDe(lecture ? serveur : tous, reunion.id, m);
        // Stories du sprint (cartes), tâches de l'itération, et ce qui est déjà à son plan
        const sesElements = elementsDuPlan(h.items.filter((t) => (t.responsable === courant.id && (idsIteration.has(t.id) || idsCartes.has(t.id))) || sonPlan.has(t.id)));
        const dansPlan = (t: Item) => (estMoi && !lecture ? coche('aujourdhui', t, t.titre) : sonPlan.has(t.id));
        const sonHier = planHierDe(m);
        // Lecture seule : les points du Sheet (ce que chacun a envoyé, ce que le SM a noté et concrétisé) ; Hier et
        // Aujourd'hui sont affichés à part (plan du jour)
        // Suivis du membre (14/10) : ceux dont il est responsable, avec leurs changements
        const sesSuivis = nouveauxSuivis.filter((x) => (x.responsable || x.personne).toLowerCase() === m);
        const notes = (lecture ? serveur : tous).filter((y) => dela(y) && y.personne === m && y.type !== 'hier' && y.type !== 'aujourdhui').sort((a, b) => a.cree_le.localeCompare(b.cree_le));
        return (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.membres}>
              {personnes.map((y, i) => (
                <Pressable key={y.id} disabled={lecture} onPress={() => setMembre(i)} style={[st.membre, i === membre && st.membreOn]} accessibilityRole="button" accessibilityState={{ selected: i === membre }}>
                  <Text style={[st.membreTexte, i === membre && st.membreTexteOn]}>{prenom(y.nom)}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <TitreFiche icone="👤" titre={courant.nom} vide="" sous={sous(`${membre + 1} sur ${personnes.length} · ${e.role(courant.id)}`)} />
            {sonHier.elements.length > 0 && (
              <BlocBrique titre={`⏪ Hier · plan du ${dateCourte(sonHier.reunion.slice(-10))}`}>
                {sonHier.elements.map((t, i) => (
                  <Ligne key={t.id} premiere={i === 0} texte={`${t.type === 'story' ? '📖 ' : ''}${t.titre}`} pastille={pastilleStatut(t.statut)} tache={t} />
                ))}
              </BlocBrique>
            )}
            {/* Arbre des éléments du membre (14/10) : ses stories et tâches, leur feature et leur epic en contexte ; la case =
                « je travaille dessus aujourd'hui » (plan du jour, jamais le statut) */}
            {/* Clé propre : ne reprend pas l'état (fermé) du bloc de la Situation */}
            <BlocArbre
              key={`arbre-tour-${m}`}
              av={avancement}
              titre={`Éléments de ${courant.nom}`}
              cles={sesElements.map((t) => `t:${t.id}`)}
              strict
              nom={nomDe}
              cases={{ coche: dansPlan, basculer: (t) => basculer('aujourdhui', t, t.titre, 'membre'), fige: !estMoi || lecture }}
              lecture={lecture}
              onOuvrir={lecture ? undefined : onOpenTask}
              onOuvrirEntite={lecture ? undefined : onOpenEntite}
            />
            {sesSuivis.length > 0 && (
              <BlocBrique titre={`📌 Suivis de ${courant.nom}`} n={sesSuivis.length} nChanges={nbSuivisChanges(avancement, sesSuivis)} arborescence={sesSuivis.some((x) => !!cheminElement(x.element, h)) ? { valeur: arboSuivis, changer: setArboSuivis } : undefined}>
                <LignesSuivi parElement={arboSuivis} points={sesSuivis} ctx={{ ...ctxSuivi, lecture }} />
              </BlocBrique>
            )}
            <>
            {/* Brique Notes (14/10) : coque commune, 🌳 décochée par défaut (rangées sous leur élément si cochée) */}
            <BlocBrique
              titre="Notes"
              n={notes.filter((y) => !filtreType || y.type === filtreType).length}
              suffixe={filtreType ? ` sur ${notes.length}` : ''}
              arborescence={notes.some((x) => !!cheminElement(x.element, h)) ? { valeur: arboSuivis, changer: setArboSuivis } : undefined}
              filtres={{ nb: filtreType ? 1 : 0, contenu: <FiltresType types={['information', 'blocage', 'decision', 'action']} value={filtreType} onChange={setFiltreType} /> }}
            >
              {(arboSuivis ? [...notes].sort((x, y) => cheminElement(x.element, h).localeCompare(cheminElement(y.element, h))) : notes).filter((y) => !filtreType || y.type === filtreType).map((y, i, l) => {
                const q = echangeDe(y);
                const par =
                  y.auteur === y.personne ? `par ${courant.nom}` : y.auteur === sm?.email.toLowerCase() || (anime && y.auteur === mail) ? 'par le SM' : `par ${nomDe(y.auteur)}`;
                const story = surStory(y);
                return (
                  <View key={y.id}>
                    {arboSuivis && (i === 0 || cheminElement(l[i - 1].element, h) !== cheminElement(y.element, h)) && <TitreGroupe texte={cheminElement(y.element, h)} />}
                    <Ligne
                      premiere={i === 0 && !arboSuivis}
                      texte={y.texte}
                      sous={[par, q ? `réponse à ${nomDe(q.de)}` : '', concretise(y), arboSuivis ? '' : story].filter(Boolean).join(' · ')}
                      pastille={{ texte: libelleNote(y), ton: tonType(y.type) }}
                      onRetirer={!lecture && y.id.startsWith('local-') ? () => (setLocaux((ll) => ll.filter((z) => z.id !== y.id)), retirerPrep(y.id)) : undefined}
                    />
                  </View>
                );
              })}
              {lecture ? (
                !notes.length && <Vide texte="Rien de noté pour l’instant." />
              ) : (
                <SaisiePoint
                  key={filtreType || 'tous'}
                  premiere={!notes.filter((y) => !filtreType || y.type === filtreType).length}
                  types={TYPES_NOTE}
                  typeDefaut={filtreType || 'information'}
                  titre={filtreType === 'blocage' || filtreType === 'decision' || filtreType === 'action' ? TITRE_TYPE[filtreType] : `Nouvelle note · ${courant.nom}`}
                  jour={jour}
                  placeholder={`＋ Ajouter pour ${courant.nom}…`}
                  stories={situation.cartes.filter((t) => t.responsable === courant.id)}
                  onAjouter={(type, texte, element, c, sous_type) => ajouter({ personne: m, type, texte, element, sous_type, ...(c?.c === 'rien' ? { concretisation: 'rien' as const } : {}) })}
                />
              )}
            </BlocBrique>
            </>
          </>
        );
      }
      case 'concretisation': {
        const origine = (pt: PointReunion) => [`Notée par ${nomDe(pt.personne)}${pt.reunion.slice(-10) < jour ? ` le ${jourCourt(pt.reunion.slice(-10))}` : ''}`, libelleElement(pt.element, h)].filter(Boolean).join(' · ');
        if (lecture) {
          // Lecture seule : le choix déjà fait par le SM (compte rendu envoyé), sinon « à décider »
          const faits = duSheet.filter((pt) => !!pt.concretisation).length;
          return (
            <>
              <TitreFiche icone="🧩" titre="Concrétisation" vide="" sous={`${pluriel(duSheet.length, 'note')} : ${faits} concrétisée${faits > 1 ? 's' : ''}, ${duSheet.length - faits} à décider par le SM`} />
              {!duSheet.length && <Vide texte="Aucune note à concrétiser." />}
              {duSheet.map((pt) => (
                <View key={pt.id} style={st.carteConcret}>
                  <View style={st.ligneHaut}>
                    <View style={st.corps}>
                      <Text style={st.texte}>{pt.texte}</Text>
                      <Text style={st.sous}>{origine(pt)}</Text>
                    </View>
                    <Pastille texte={libelleNote(pt)} ton={tonType(pt.type)} />
                  </View>
                  <Text style={[st.choixLecture, !pt.concretisation && st.choixADecider]}>{pt.concretisation ? resumePoint(pt, nomDe, h) : 'À décider'}</Text>
                </View>
              ))}
            </>
          );
        }
        const moiP = { email: mail, nom: nomDe(mail), meta: 'vous' };
        const equipeP = personnes.map((y) => ({ email: y.email.toLowerCase(), nom: y.nom, meta: libelleRole(y.email) }));
        const animateur = (reunion.organisateur || mail).toLowerCase();
        const validateurs = [...new Map([...equipeP, ...escaladesDaily, moiP].map((y) => [y.email, y.email === animateur ? { ...y, meta: 'anime le daily' } : y])).values()];
        return (
          <>
            <TitreFiche icone="🧩" titre="Concrétisation" vide="" sous={sous(`${pluriel(aDecider.length, 'note')} : blocages, décisions, demandes d’action`)} />
            {!aDecider.length && <Vide texte="Aucune note à concrétiser." />}
            {aDecider.map((pt) => {
              const x = choixDe(pt);
              const choisi = !!choix[pt.id];
              const resume = resumeConcret(x, nomDe, h);
              return (
                <View key={pt.id} style={st.carteConcret}>
                  <View style={st.ligneHaut}>
                    <View style={st.corps}>
                      <Text style={st.texte}>{pt.texte}</Text>
                      <Text style={st.sous}>{origine(pt)}</Text>
                    </View>
                    <Pastille texte={libelleNote(pt)} ton={tonType(pt.type)} />
                  </View>
                  {/* Un seul bouton « Concrétiser » : une feuille, une section par question (08/10) */}
                  <Pressable onPress={() => setFeuille({ id: pt.id })} style={[st.boutonSynchro, choisi && st.boutonSynchroChoisi]} accessibilityRole="button">
                    <Text style={[st.boutonSynchroTexte, choisi && st.boutonSynchroTexteChoisi]}>{choisi ? `${resume} ›` : 'Concrétiser ›'}</Text>
                  </Pressable>
                  {!choisi && <Text style={st.sous}>Proposé : {resume}</Text>}
                </View>
              );
            })}
            {feuille &&
              (() => {
                const pt = aDecider.find((y) => y.id === feuille.id);
                if (!pt) return null;
                return (
                  <FeuilleConcretiser
                    sous={`${libelleNote(pt)} · notée par ${nomDe(pt.personne)} : « ${pt.texte} »`}
                    valeur={choixDe(pt)}
                    autres={equipe ? autresEquipesDuTrain(equipe.id, org) : []}
                    nomEquipe={equipe?.nom ?? ''}
                    nomDessus={e.train ? `Train ${e.train.nom}` : ''}
                    moi={moiP}
                    equipe={equipeP}
                    dessus={escaladesDaily}
                    validateurs={validateurs}
                    contexte={situation.cartes.map((t) => t.id)}
                    budget={budgetConcret}
                    onValider={(c) => {
                      setChoix((mm) => ({ ...mm, [pt.id]: c }));
                      setFeuille(null);
                    }}
                    onFermer={() => setFeuille(null)}
                  />
                );
              })()}
            <BlocBrique titre="Note oubliée">
              <SaisiePoint premiere types={TYPES_NOTE} typeDefaut="information" titre="Nouvelle note oubliée" jour={jour} placeholder="＋ Note oubliée" stories={situation.cartes} onAjouter={(type, texte, element, c, sous_type) => ajouter({ personne: mail, type, texte, element, sous_type, ...(c?.c === 'rien' ? { concretisation: 'rien' as const } : {}) })} />
            </BlocBrique>
          </>
        );
      }
      default: {
        // Compte rendu ; en lecture seule (bandeau En direct, onglet « Compte rendu · date »), ce que le SM a déjà
        // concrétisé (dans le Sheet) et ce qui reste à décider
        const duSheet = duSheetDe(x.cle === 'cr_lecture' ? dernierCR : reunion.id);
        const decides = lecture
          ? duSheet.filter((pt) => !!pt.concretisation).map((pt) => ({ pt, c: pt.concretisation as Concretisation, resp: pt.responsable || pt.personne, a: pt.responsable }))
          : aDecider.map((pt) => ({ pt, ...choixDe(pt) }));
        const restants = lecture ? duSheet.filter((pt) => !pt.concretisation) : [];
        const crees = decides.filter((d) => d.c === 'sous_tache' || d.c === 'tache');
        const escalades = decides.filter((d) => d.c === 'escalade');
        const synchros = decides.filter((d) => d.c === 'synchro');
        const notes = decides.filter((d) => d.c === 'rien');
        const suivis = decides.filter((d) => d.c === 'suivi');
        const resumeD = (d: { pt: PointReunion } & Partial<ChoixConcret>) => (lecture || !d.que ? resumePoint(d.pt, nomDe, h) : resumeConcret(d as ChoixConcret, nomDe, h));
        return (
          <>
            <TitreFiche
              icone="📨"
              titre="Compte rendu"
              vide=""
              sous={
                lecture
                  ? restants.length || !decides.length
                    ? `Pas encore envoyé : ${sm ? `${sm.nom} (SM)` : 'l’organisateur'} l’enverra${rte?.email ? ` à ${rte.nom} (RTE)` : ''}`
                    : `Envoyé par ${sm ? `${sm.nom} (SM)` : 'l’organisateur'}${rte?.email ? ` à ${rte.nom} (RTE)` : ''}`
                  : sous(rte?.email ? `Envoyé à ${rte.nom} (RTE du train ${e.train?.nom ?? ''})` : 'Pas de train ni de RTE : les tâches sont créées, le compte rendu n’est envoyé à personne.')
              }
            />
            {restants.length > 0 && (
              <BlocBrique titre={`À décider · ${restants.length}`}>
                {restants.map((pt, i) => (
                  <Ligne key={pt.id} premiere={i === 0} texte={pt.texte} sous={`par ${nomDe(pt.personne)} · à décider par le SM`} pastille={{ texte: libelleNote(pt), ton: tonType(pt.type) }} />
                ))}
              </BlocBrique>
            )}
            <BlocBrique titre={`Créé · ${crees.length}`}>
              {crees.length ? (
                crees.map((d, i) => (
                  <Ligne
                    key={d.pt.id}
                    premiere={i === 0}
                    texte={d.pt.texte}
                    sous={resumeD(d)}
                    pastille={{ texte: libelleNote(d.pt), ton: tonType(d.pt.type) }}
                  />
                ))
              ) : (
                <Vide texte="Rien à créer." />
              )}
            </BlocBrique>
            <BlocBrique titre={`Suivis · ${suivis.length}`}>
              {suivis.length ? suivis.map((d, i) => <Ligne key={d.pt.id} premiere={i === 0} texte={d.pt.texte} sous={resumeD(d)} pastille={{ texte: libelleNote(d.pt), ton: tonType(d.pt.type) }} />) : <Vide texte="Rien à suivre." />}
            </BlocBrique>
            {/* Transmis (validation du 08/10) : l'ancienne escalade et la transmission, une seule section */}
            <BlocBrique titre={`Transmis · ${escalades.length + synchros.length}`}>
              {escalades.map((d, i) => <Ligne key={d.pt.id} premiere={i === 0} texte={d.pt.texte} sous={resumeD(d)} pastille={{ texte: libelleNote(d.pt), ton: tonType(d.pt.type) }} />)}
              {synchros.map((d, i) => <Ligne key={d.pt.id} premiere={!escalades.length && i === 0} texte={d.pt.texte} sous={`${nomDe(d.pt.personne)} → ${nomDe(d.a)} · message envoyé`} pastille={{ texte: libelleNote(d.pt), ton: tonType(d.pt.type) }} />)}
              {!escalades.length && !synchros.length && <Vide texte="Rien de transmis." />}
            </BlocBrique>
            <BlocBrique titre={`Clos · ${notes.length}`}>
              {notes.length ? (
                notes.map((d, i) => <Ligne key={d.pt.id} premiere={i === 0} texte={d.pt.texte} sous={`Rien (clos) · noté par ${nomDe(d.pt.personne)}`} pastille={{ texte: libelleNote(d.pt), ton: 'gris' }} />)
              ) : (
                <Vide texte="Rien." />
              )}
            </BlocBrique>
            {/* Avancement (13/10) : même filtre qu'à la Situation ; compte rendu déjà envoyé : la photo et le filtre de l'envoi */}
            <BlocArbre av={x.cle === 'cr_lecture' ? avancementCR : avancement} titre="Éléments du sprint" cles={situation.elements.map((t) => `t:${t.id}`)} montrerResponsable nom={nomDe} lecture={x.cle === 'cr_lecture'} onOuvrir={lecture ? undefined : onOpenTask} onOuvrirEntite={lecture ? undefined : onOpenEntite} />
          </>
        );
      }
    }
  };

  // « ↻ Actualiser » : points, tâches et échanges relus en une lecture groupée ; vos saisies non envoyées (préparation,
  // points notés, concrétisations, réponses) et l'étape en cours sont gardées
  const actualiser = async () => {
    const l = actions.actualiser ? await actions.actualiser(espace, prefixe) : await actions.lirePoints(espace, prefixe);
    setLus(l);
    setServeur(sansTech(l));
    setCharge(true);
  };

  const dernier = personnes.length - 1;
  const onglets: OngletReunion[] = parcours.map((o) => {
    const cleDe = (k: number) => o.etapes[k]?.cle ?? '';
    const sm_ = o.role === 'sm';
    return {
      cle: o.lecture ? 'suivre' : o.role,
      libelle: ongletParcours(o),
      etapes: o.etapes.map((x) => x.nom),
      libelleFin: sm_
        ? o.lecture
          ? 'Fermer'
          : 'Envoyer le compte rendu'
        : anime
          ? 'Enregistrer mon point'
          : `Envoyer au SM${sm ? ` · ${sm.nom}` : ''}`,
      renduEtape: (k) =>
        o.etapes[k] ? (
          <>
            {o.lecture && (
              <View style={st.bandeauLecture}>
                <Text style={st.bandeauLectureTexte}>🔒 Lecture seule : c’est le SM qui anime</Text>
              </View>
            )}
            {rendu(o.etapes[k], o)}
          </>
        ) : null,
      onEtape: (k) => {
        setCle(cleDe(k));
        if (sm_) setEtapeSm(cleDe(k));
        if (cleDe(k) === 'tour') setMembre((m) => Math.min(m, Math.max(0, dernier)));
      },
      onSuivant: sm_
        ? (k) => {
            if (cleDe(k) === 'tour' && membre < dernier) {
              setMembre(membre + 1);
              return true;
            }
            return false;
          }
        : undefined,
      onTerminer: sm_ ? (o.lecture ? undefined : envoyerCompteRendu) : () => envoyerPreparation(o.role === 'po' ? 'po' : 'membre'),
      fermer: sm_,
      // R5d : préparation déjà envoyée et du nouveau à placer → ouverture directe sur le Plan du jour
      etapeInitiale: !sm_ && o.role !== 'po' && charge && nouvelles.size > 0 ? Math.max(0, o.etapes.findIndex((x) => x.cle === 'plan')) || undefined : undefined,
    };
  });
  // Onglet « Compte rendu · date » : le dernier compte rendu de la série, en lecture seule
  const lectureCR: ParcoursRole = { role: 'sm', lecture: true, etapes: [{ cle: 'cr_lecture', nom: 'Compte rendu' }] };
  if (dernierCR)
    onglets.push({
      cle: 'cr',
      libelle: `Compte rendu · ${dateCourte(dernierCR.slice(-10))}`,
      etapes: ['Compte rendu'],
      libelleFin: 'Fermer',
      renduEtape: () => rendu(lectureCR.etapes[0], lectureCR),
      fermer: true,
    });
  // Bandeau « ● En direct » : participant d'un daily lancé à plusieurs ; « ▴ » montre l'écran de l'animateur
  const etat = live.etat;
  const lance = !!etat && !!etat.lance && !etat.fin;
  const ecranAnim: ParcoursRole = { role: 'sm', lecture: true, etapes: CATALOGUE.sm };
  const etapeAnim = CATALOGUE.sm.find((x) => x.cle === etat?.etape);
  const direct =
    !anime && live.live && lance && etat
      ? { texte: texteDirect(etat, prenom(nomDe(etat.anim))), animateur: prenom(nomDe(etat.anim)), contenu: etapeAnim ? rendu(etapeAnim, ecranAnim) : undefined }
      : undefined;
  return (
    <FenetreReunion
      visible={visible}
      reunion={reunion}
      mode={anime ? 'organisateur' : 'participant'}
      fil={fil}
      onglets={onglets}
      ongletInitial={dernierCR === reunion.id && !anime ? onglets.length - 1 : parcoursParDefaut(parcours)}
      onActualiser={actualiser}
      onFermer={onFermer}
      direct={direct}
    />
  );
}

