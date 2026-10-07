import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  aConcretiser,
  backlogAPreparer,
  concretisationParDefaut,
  dateCourte,
  ageAffiche,
  enRetard,
  jourReunion,
  LIBELLE_CONCRETISATION,
  LIBELLE_TYPE_POINT,
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
import { membresDe, type OrgValue, porteurs } from '../organisation';
import { fmtPoints, iterationOf, piOf, pointsOf } from '../pi';
import { type EtapeCatalogue, etapesParcours, ongletParcours, type ParcoursRole, parcoursParDefaut, participantsReunion } from '../reunions';
import { PARCOURS_DAILY as CATALOGUE } from '../daily';
import { useSafe } from '../safe';
import { subtaskMap } from '../subtasks';
import { colors } from '../theme';
import { type Concretisation, type Echange, type EchangeInput, estTechnique, type Item, type ItemInput, type PointReunion, RECURRENCE_DEFAUTS, type Reunion, type Statut, type TypePoint } from '../types';
import { etatDe, texteDirect } from '../etatReunion';
import { useLive } from './useLive';
import { FeuilleChoix, SectionFiche } from './Choix';
import { estAutre, placeholderNote, reponsePrete } from './EchangesView';
import { FenetreReunion, type ModeReunion, type OngletReunion } from './FenetreReunion';
import { TitreFiche } from './FormSheet';
import { Compteur, pluriel, Entonnoir, FiltresType, Ligne, LigneCase, LigneStory, Pastille, PastilleFiltres, Pastilles, pastilleStatut, SaisiePoint, st, TITRE_TYPE, titreAjout, type Ton, TONS, tonType, Vide } from './reunion/ui';

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
  /** Crée des tâches en un seul passage ; renvoie les tâches créées dans l'ordre */
  creerTaches: (espace: string, inputs: ItemInput[]) => Promise<Item[]>;
  /** Envoie des échanges (Synchro, escalades, compte rendu) en un seul passage ; renvoie les échanges créés dans l'ordre */
  envoyerEchanges: (espace: string, inputs: EchangeInput[]) => Promise<Echange[]>;
  /** Réponses du PO aux échanges de l'équipe (réponse normale à l'échange), en un seul passage */
  repondreEchanges: (reponses: { e: Echange; reponse: string; note: string }[]) => Promise<void>;
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
  const nomDe = (email: string) => personneParEmail(email, org)?.nom ?? email.split('@')[0];
  const train = equipe?.train ? org.train.get(equipe.train) : undefined;
  const rte = train?.rte ? org.personne.get(train.rte) : undefined;
  const pm = train?.pm ? org.personne.get(train.pm) : undefined;
  const parId = new Map(h.items.map((t) => [t.id, t]));
  const subs = useMemo(() => subtaskMap(h.items), [h.items]);
  return { h, equipe, jour, it, situation, bloquees, personnes, role, nomDe, train, rte, pm, parId, subs, dansEquipe };
}

function Daily({ visible, reunion, mode, org, moi, aujourdhui, fil, actions, onFermer, onInfo, onOpenTask, echanges = [] }: Props & { reunion: Reunion }) {
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
  const [choix, setChoix] = useState<Record<string, { c?: Concretisation; resp?: string; a?: string }>>({});
  /** Feuille « Concrétiser » ouverte sur un point : choix de la concrétisation, puis du responsable */
  /** Tour de table : filtre des points notés par type (pastille « Filtres » à côté du titre, fermé et « Tous » par défaut) */
  const [filtreType, setFiltreType] = useState<TypePoint | ''>('');
  const [filtresOuverts, setFiltresOuverts] = useState(false);
  /** Situation : même filtre sur le suivi (fermé, « Tous » par défaut) */
  const [filtreSuivi, setFiltreSuivi] = useState<TypePoint | ''>('');
  const [filtresSuiviOuverts, setFiltresSuiviOuverts] = useState(false);
  const [feuille, setFeuille] = useState<{ id: string; etape: 'quoi' | 'responsable' } | null>(null);
  /** PO : ses réponses aux questions de l'équipe (par échange), envoyées avec son point */
  const [reponses, setReponses] = useState<Record<string, { c: string; note: string }>>({});
  const [membre, setMembre] = useState(0);
  /** Étape affichée (clé), dans l'onglet ouvert */
  const [cle, setCle] = useState('');
  const relus = useRef(new Set<string>());
  /** Tout ce qui a été lu (lignes techniques comprises : ligne d'état de chaque daily de la série) */
  const [lus, setLus] = useState<PointReunion[]>([]);

  const tous = useMemo(() => [...serveur.filter((x) => !(x.id in anciens)), ...prep, ...locaux] as PointReunion[], [serveur, anciens, prep, locaux]);
  const e = useEquipeDaily(reunion, org, aujourdhui, tous, echanges);
  const { h, equipe, jour, it, situation, personnes, nomDe, rte, pm, parId, subs } = e;
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
    x.type === 'decision' && (x.concretisation === 'sous_tache' || x.concretisation === 'tache') ? `→ ${LIBELLE_CONCRETISATION[x.concretisation]} · 👤 ${prenom(nomDe(x.responsable))}` : '';
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
  const miens = moiP ? h.items.filter((t) => t.responsable === moiP.id && (idsIteration.has(t.id) || pointDeTache.has(t.id))) : [];
  const hierListe = miens.filter(
    (t) => t.statut === 'en_cours' || (t.statut === 'termine' && (!t.termine_le || t.termine_le >= veille)) || (pointDeTache.has(t.id) && t.statut !== 'termine'),
  );
  const aujListe = miens.filter((t) => t.statut !== 'termine');
  const coche = (type: TypePoint, t: Item, texte: string) => prep.some((x) => x.type === type && x.element === t.id && x.texte === texte);
  const basculer = (type: TypePoint, t: Item, texte: string, onglet: Prep) =>
    setPrep((l) => (coche(type, t, texte) ? l.filter((x) => !(x.type === type && x.element === t.id && x.texte === texte)) : [...l, nouveau(type, texte, t.id, '', onglet)]));

  /** Ligne d'une de vos tâches : case à cocher, sous-tâches (›), à droite son état ou « Action · 29/09 » */
  const ligneTache = (type: TypePoint, t: Item, i: number, onglet: Prep) => {
    const pt = pointDeTache.get(t.id);
    const n = subs.get(t.id)?.length ?? 0;
    const sous = n ? pluriel(n, 'sous-tâche') : t.parent ? `Sous-tâche de ${parId.get(t.parent)?.titre ?? 'la story'}` : '';
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
      />
    );
  };
  const listeTaches = (type: TypePoint, liste: Item[], vide: string, onglet: Prep) => (liste.length ? liste.map((t, i) => ligneTache(type, t, i, onglet)) : <Vide texte={vide} />);
  /** Points ajoutés à la main (pas une tâche de la liste) */
  const listeLibres = (type: TypePoint, liste: Item[]) =>
    prep
      .filter((x) => x.type === type && !liste.some((t) => x.element === t.id && x.texte === t.titre))
      .map((x) => <Ligne key={x.id} texte={x.texte} sous={surStory(x) || 'ajouté par vous'} onRetirer={() => retirerPrep(x.id)} />);

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
    const pts = preparationDe(o);
    const ici = o === 'po' ? reponsesPO.filter((r) => r.ici) : [];
    if (ici.length) await actions.repondreEchanges(ici.map((r) => ({ e: r.q, reponse: r.q.reponse, note: r.q.note })));
    const retires = Object.keys(anciens).filter((id) => anciens[id] === o);
    const { crees } = await actions.ecrirePoints(espace, pts.map(aEcrire), [], retires);
    setServeur((l) => [...l.filter((x) => !retires.includes(x.id)), ...crees]);
    setAnciens((a) => ({ ...Object.fromEntries(Object.entries(a).filter(([id]) => !retires.includes(id))), ...Object.fromEntries(crees.map((x) => [x.id, o])) }));
    setPrep((l) => [...l.filter((x) => (x.onglet ?? 'membre') !== o), ...crees.map((x) => ({ ...x, id: idLocal(), onglet: o }))]);
    if (o === 'po') setReponses({});
    const quoi = o === 'po' ? 'Point PO' : 'Point';
    onInfo?.(
      (anime
        ? `${quoi} enregistré : ${pluriel(pts.length, 'élément')}, il rejoint vos points notés`
        : pts.length
          ? `${quoi} envoyé${sm ? ` à ${prenom(sm.nom)} (SM)` : ''} : ${pluriel(pts.length, 'élément')}`
          : 'Préparation vide envoyée : rien de noté') + (ici.length ? `, ${pluriel(ici.length, 'réponse')} envoyée${ici.length > 1 ? 's' : ''} dans la Synchro.` : '.'),
    );
  };

  // ---------------------------------------------------------------------------
  // Animation (Scrum Master)
  // ---------------------------------------------------------------------------
  // Suivi : points concrétisés (dailies précédents, ou celui-ci déjà envoyé) dont la tâche n'est pas finie
  const suivisEquipe = useMemo(() => calculerSuivis(serveur, h.items), [serveur, h.items]);
  const suivisEchanges = useMemo(() => suivisSynchro(serveur, echanges), [serveur, echanges]);
  // À concrétiser : ce qui ne l'a pas encore été (un compte rendu déjà envoyé ne recrée rien)
  // Points de suivi reportés des réunions précédentes (escalades reçues, réponses recopiées) : à concrétiser aussi
  const reportes = useMemo(() => (anime ? aReprendre(serveur, reunion.id).filter(aConcretiser) : []), [anime, serveur, reunion.id]);
  const aDecider = [...[...tous, ...(anime ? reponsesPO.map((r) => r.pt) : [])].filter((x) => dela(x) && aConcretiser(x) && !x.concretisation), ...reportes];
  const choixDe = (pt: PointReunion) => {
    const c = choix[pt.id]?.c ?? concretisationParDefaut(pt);
    // Sous-tâche impossible sans story ; escalade impossible sans RTE ni PM
    const cc: Concretisation = (c === 'sous_tache' && !pt.element) || (c === 'escalade' && !rte?.email && !pm?.email) ? 'tache' : c;
    // Échange 🔄 Synchro : vers le PO par défaut (sinon le SM), jamais vers la personne qui a le blocage ;
    // escalade : aux SM du train (RTE) par défaut, sinon aux PO du train (PM)
    const defautA =
      cc === 'escalade'
        ? (rte?.email || pm?.email || '').toLowerCase()
        : ([po?.email, sm?.email].find((x) => !!x && x.toLowerCase() !== pt.personne)?.toLowerCase() ?? '');
    // « Transmettre à » et « Escalader » posent toujours leur destinataire avec leur choix
    const a = choix[pt.id]?.a ?? defautA;
    return { c: cc === 'synchro' && pt.type !== 'blocage' ? 'tache' : cc, resp: choix[pt.id]?.resp ?? (pt.responsable || pt.personne), a };
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
      description: `${LIBELLE_TYPE_POINT[pt.type]} noté au daily ${equipe?.nom ?? ''} du ${dateCourte(jour)} (${prenom(nomDe(pt.personne))}).`,
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
  const ajouter = (x: { personne: string; type: TypePoint; texte: string; element: string }) =>
    setLocaux((l) => [...l, { ...nouveau(x.type, x.texte, x.element), personne: x.personne.toLowerCase() }]);

  // ---- Envoi du compte rendu : tâches (un lot), échanges (un lot), points (un lot, votre préparation comprise) ----
  const envoyerCompteRendu = async () => {
    const decides = aDecider.map((pt) => ({ pt, ...choixDe(pt) }));
    const aCreer = decides.filter((d) => d.c === 'sous_tache' || d.c === 'tache');
    const creees = await actions.creerTaches(espace, aCreer.map(({ pt, c, resp }) => entreeTache(pt, c as 'sous_tache' | 'tache', resp)));
    const tacheDe = new Map(aCreer.map((d, i) => [d.pt.id, creees[i]?.id ?? '']));
    // Vous êtes aussi le PO : vos réponses données ici partent dans leurs échanges (un lot)
    const ici = reponsesPO.filter((r) => r.ici);
    if (ici.length) await actions.repondreEchanges(ici.map((r) => ({ e: r.q, reponse: r.q.reponse, note: r.q.note })));

    const escalades = decides.filter((d) => d.c === 'escalade');
    const synchros = decides.filter((d) => d.c === 'synchro' && !!d.a);
    const decisions = decides.filter((d) => d.pt.type === 'decision');
    const story = (id: string) => (id ? parId.get(id)?.titre : undefined);
    // Échanges en un seul lot : blocages passés en 🔄 Synchro (de la personne qui a le blocage, transmis par vous),
    // puis, s'il y a un RTE, escalades et compte rendu
    const lot: EchangeInput[] = synchros.map((d) => ({
      de: d.pt.personne,
      a: d.a,
      type: 'question' as const,
      titre: titreTransmis(`Blocage · ${d.pt.texte}`),
      texte: `Blocage noté au daily ${equipe?.nom ?? ''} du ${dateCourte(jour)} pour ${nomDe(d.pt.personne)}${story(d.pt.element) ? ` (story « ${story(d.pt.element)} »)` : ''} : peux-tu le lever ?`,
      choix: 'Je m’en occupe;On en parle après le daily;Autre',
      reponse: '',
      note: '',
      statut: 'envoye' as const,
      element: d.pt.element,
      niveau: equipe ? `equipeagile:${equipe.id}` : '',
      transmis_par: d.pt.personne === mail ? '' : mail,
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
        creees: aCreer.map((d) => ({ titre: d.pt.texte, sous: `${d.c === 'sous_tache' ? `sous-tâche de « ${story(d.pt.element) ?? 'la story'} »` : `tâche à part, ${it.code}`} · ${prenom(nomDe(d.resp))}` })),
        escalades: escalades.map((d) => `${d.pt.texte} (${prenom(nomDe(d.pt.personne))}${story(d.pt.element) ? `, « ${story(d.pt.element)} »` : ''})`),
        synchros: synchros.map((d) => `${d.pt.texte} (${prenom(nomDe(d.pt.personne))} → ${prenom(nomDe(d.a))})`),
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
    const echangeDuPoint = new Map([...synchros, ...escaladesEnvoyees].map((d, i) => [d.pt.id, envoyes[i]?.id ?? '']));

    // Une réponse du PO (décision) garde le lien vers sa question, sauf si elle devient une tâche
    const patch = (d: (typeof decides)[number]) => ({
      concretisation: d.c,
      tache: tacheDe.get(d.pt.id) || echangeDuPoint.get(d.pt.id) || (d.pt.type === 'decision' && d.c === 'rien' ? d.pt.tache : ''),
      // Escalade et Transmettre à : le destinataire (RTE ou PM ; personne de l'équipe)
      responsable: d.c === 'escalade' || d.c === 'synchro' ? d.a : d.resp,
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
    await actions.ecrirePoints(espace, [...creer, ...(recus.get(espace) ?? [])], modifier, [...Object.keys(anciens), ...etatsAnciens]);
    for (const [esp, l] of recus) if (esp !== espace) await actions.ecrirePoints(esp, l, [], []);
    live.terminer();
    onInfo?.(
      `Compte rendu du daily : ${pluriel(creees.length, 'tâche')} créée${creees.length > 1 ? 's' : ''}` +
        (escalades.length ? `, ${pluriel(escalades.length, 'blocage')} escaladé${escalades.length > 1 ? 's' : ''}` : '') +
        (synchros.length ? `, ${pluriel(synchros.length, 'point')} transmis` : '') +
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
      ? `${c === 'sous_tache' ? 'Sous-tâche' : `Tâche à part (${it.code})`} · 👤 ${prenom(nomDe(resp))}`
      : c === 'synchro'
        ? `Transmettre à ${a ? prenom(nomDe(a)) : '…'}`
        : c === 'escalade'
          ? `⤴ Escalader aux ${a && a === pm?.email?.toLowerCase() ? 'PO' : 'SM'} du train`
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
        return (
          <>
            <TitreFiche icone="⏪" titre="Hier" vide="" sous={sous('Cochez ce dont vous parlerez')} />
            <SectionFiche titre={`Mes stories et tâches · ${hierListe.length}`}>
              {listeTaches('hier', hierListe, 'Rien en cours ni terminé hier.', pr)}
              {listeLibres('hier', hierListe)}
              <SaisiePoint types={['hier']} jour={jour} placeholder="＋ Autre chose fait hier" stories={mesStories} onAjouter={(type, texte, element) => setPrep((l) => [...l, nouveau(type, texte, element, '', pr)])} />
            </SectionFiche>
          </>
        );
      case 'aujourdhui':
        return (
          <>
            <TitreFiche icone="▶️" titre="Aujourd’hui" vide="" sous={sous('Ce que vous allez faire')} />
            <SectionFiche titre={`Mes stories et tâches · ${aujListe.length}`}>
              {listeTaches('aujourdhui', aujListe, 'Rien à votre nom dans l’itération.', pr)}
              {listeLibres('aujourdhui', aujListe)}
              <SaisiePoint types={['aujourdhui']} jour={jour} placeholder="＋ Autre chose aujourd’hui" stories={mesStories} onAjouter={(type, texte, element) => setPrep((l) => [...l, nouveau(type, texte, element, '', pr)])} />
            </SectionFiche>
          </>
        );
      case 'blocages': {
        const liste = prep.filter((y) => y.type === 'blocage');
        return (
          <>
            <TitreFiche icone="🧱" titre="Blocages" vide="" sous={sous('Ce qui vous empêche d’avancer')} />
            <SectionFiche titre={`Blocages · ${liste.length}`}>
              {liste.map((y, i) => (
                <Ligne key={y.id} premiere={i === 0} texte={y.texte} sous={surStory(y) || 'sans story'} onRetirer={() => retirerPrep(y.id)} />
              ))}
              <SaisiePoint
                premiere={!liste.length}
                types={['blocage']}
                jour={jour}
                placeholder="＋ Blocage"
                stories={mesStories}
                onAjouter={(type, texte, element) => setPrep((l) => [...l, nouveau(type, texte, element, '', pr)])}
              />
            </SectionFiche>
          </>
        );
      }
      case 'accepter':
        return (
          <>
            <TitreFiche icone="🏁" titre="Stories à accepter" vide="" sous={sous(`${it.code} · terminées, cochez celles que vous accepterez aujourd’hui`)} />
            <SectionFiche titre={`Terminées · ${aAccepter.length}`}>
              {aAccepter.length ? (
                aAccepter.map((t, i) => {
                  const n = subs.get(t.id)?.length ?? 0;
                  const resp = t.responsable ? org.personne.get(t.responsable) : undefined;
                  const texte = `Accepter « ${t.titre} »`;
                  return (
                    <LigneCase
                      key={t.id}
                      premiere={i === 0}
                      texte={`📖 ${t.titre}`}
                      sous={[resp ? `👤 ${prenom(resp.nom)}` : '', pointsOf(t) ? fmt(pointsOf(t)) : '', n ? pluriel(n, 'sous-tâche') : ''].filter(Boolean).join(' · ')}
                      coche={coche('aujourdhui', t, texte)}
                      onBasculer={() => basculer('aujourdhui', t, texte, 'po')}
                      onOuvrir={ouvrir(t)}
                      pastille={pastilleStatut(t.statut)}
                    />
                  );
                })
              ) : (
                <Vide texte="Aucune story terminée dans l’itération." />
              )}
            </SectionFiche>
          </>
        );
      case 'backlog':
        return (
          <>
            <TitreFiche icone="🪄" titre="Backlog à préparer" vide="" sous={sous(`Stories des features du PI sans estimation ou trop grosses (plus de ${fmt(8)})`)} />
            <SectionFiche titre={`À préparer · ${aPreparer.length}`}>
              {aPreparer.length ? (
                aPreparer.map(({ story: t, raison }, i) => {
                  const n = subs.get(t.id)?.length ?? 0;
                  const texte = `Préparer « ${t.titre} »`;
                  const f = h.features.get(t.feature);
                  return (
                    <LigneCase
                      key={t.id}
                      premiere={i === 0}
                      texte={`📖 ${t.titre}`}
                      sous={[f ? `📦 ${f.titre}` : '', raison === 'trop_grosse' ? `${fmt(pointsOf(t))}, à découper` : '', n ? pluriel(n, 'sous-tâche') : ''].filter(Boolean).join(' · ')}
                      coche={coche('aujourdhui', t, texte)}
                      onBasculer={() => basculer('aujourdhui', t, texte, 'po')}
                      onOuvrir={ouvrir(t)}
                      pastille={{ texte: raison === 'trop_grosse' ? 'trop grosse' : 'sans estimation', ton: 'orange' }}
                    />
                  );
                })
              ) : (
                <Vide texte="✓ Backlog du PI prêt : toutes les stories sont estimées." />
              )}
            </SectionFiche>
          </>
        );
      case 'questions': {
        const notees = new Set(reponsesPO.map((r) => r.q.id));
        return (
          <>
            <TitreFiche icone="❓" titre="Questions de l’équipe" vide="" sous={sous('Échanges 🔄 Synchro des membres sur les stories de l’itération ; votre réponse part dans l’échange et rejoint votre point')} />
            {!questions.length && (
              <SectionFiche titre="Questions · 0">
                <Vide texte="✓ Aucune question de l’équipe en attente." />
              </SectionFiche>
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
                        {[`De ${prenom(nomDe(q.de))}`, q.transmis_par ? `transmis par ${prenom(nomDe(q.transmis_par))}` : '', surStory({ texte: '', element: q.element })].filter(Boolean).join(' · ')}
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
                      {notees.has(q.id) && <Text style={st.sous}>✓ Partira dans l’échange avec votre point, notée comme décision</Text>}
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
        return (
          <>
            <TitreFiche icone="☀️" titre="Situation" vide="" sous={sous(`${it.code} · du ${dateCourte(it.start)} au ${dateCourte(it.end)} · ${equipe?.nom ?? ''}`)} />
            <View style={st.compteurs}>
              <Compteur valeur={`${arrondi(s.faits)} / ${arrondi(s.prevus)}`} libelle={`${safe.pointsJours ? 'jours' : 'pts'} faits / prévus`} />
              <Compteur valeur={String(s.bloquees)} libelle={s.bloquees > 1 ? 'stories bloquées' : 'story bloquée'} ton={s.bloquees ? 'rouge' : undefined} />
              <Compteur valeur={String(s.retard)} libelle="en retard" ton={s.retard ? 'orange' : undefined} />
            </View>
            <SectionFiche
              titre={`Suivi · ${filtreSuivi ? `${[...suivisEquipe, ...suivisEchanges].filter((x) => x.point.type === filtreSuivi).length + reportes.filter((x) => x.type === filtreSuivi).length} sur ` : ''}${suivisEquipe.length + suivisEchanges.length + reportes.length}`}
              droite={<PastilleFiltres actif={!!filtreSuivi} ouvert={filtresSuiviOuverts} onPress={() => setFiltresSuiviOuverts((o) => !o)} />}
              entete={filtresSuiviOuverts && <FiltresType types={['blocage', 'decision', 'action']} value={filtreSuivi} onChange={setFiltreSuivi} />}
            >
              {suivisEquipe.filter((x) => !filtreSuivi || x.point.type === filtreSuivi).map(({ point, tache }, i) => (
                <Ligne
                  key={point.id}
                  premiere={i === 0}
                  texte={tache.titre}
                  sous={`${LIBELLE_CONCRETISATION[point.concretisation]} · 👤 ${prenom(nomDe(point.responsable || point.personne))} · ${tache.statut === 'en_cours' ? 'en cours' : 'à faire'}`}
                  pastille={{ ...pastilleSuivi(point, jour), ton: tonType(point.type) }}
                />
              ))}
              {/* Blocages passés en 🔄 Synchro : suivis tant que l'échange existe (sans historique) */}
              {suivisEchanges.filter((x) => !filtreSuivi || x.point.type === filtreSuivi).map(({ point, echange }, i) => (
                <Ligne
                  key={point.id}
                  premiere={!suivisEquipe.filter((x) => !filtreSuivi || x.point.type === filtreSuivi).length && i === 0}
                  texte={point.texte}
                  sous={
                    point.type === 'decision'
                      ? `${LIBELLE_CONCRETISATION.synchro} · 👤 ${prenom(nomDe(echange.de))} · à prendre en compte`
                      : `${LIBELLE_CONCRETISATION[point.concretisation]} · 👤 ${prenom(nomDe(echange.a))} · ${echange.statut === 'repondu' ? 'répondu' : 'en attente'}`
                  }
                  pastille={{ ...pastilleSuivi(point, jour), ton: tonType(point.type) }}
                />
              ))}
              {/* Points de suivi reportés : escalades reçues et réponses recopiées, à concrétiser (cas d'usage 1 et 2) */}
              {reportes.filter((x) => !filtreSuivi || x.type === filtreSuivi).map((point, i) => (
                <Ligne
                  key={point.id}
                  premiere={!suivisEquipe.length && !suivisEchanges.length && i === 0}
                  texte={point.texte}
                  sous={`${point.type === 'decision' ? 'réponse' : 'escalade reçue'} · 👤 ${prenom(nomDe(point.personne))} · à concrétiser`}
                  pastille={{ ...pastilleSuivi(point, jour), ton: tonType(point.type) }}
                />
              ))}
              {!suivisEquipe.length && !suivisEchanges.length && !reportes.length && <Vide texte="✓ Rien en attente des dailies précédents." />}
              {/* Un point à suivre oublié : ajouté ici, concrétisé dans la même fenêtre (07/10) */}
              {anime && !lecture && (
                <SaisiePoint
                  types={['blocage', 'decision', 'action']}
                  typeDefaut="action"
                  titre="Nouveau point de suivi"
                  jour={jour}
                  placeholder="＋ Point de suivi oublié"
                  stories={situation.cartes}
                  concretiser={{ personnes: personnes.map((y) => ({ value: y.email.toLowerCase(), label: y.nom })), respDefaut: mail }}
                  onAjouter={(type, texte, element, conc) => {
                    const pt = { ...nouveau(type, texte, element), personne: mail };
                    setLocaux((l) => [...l, pt]);
                    if (conc) setChoix((m) => ({ ...m, [pt.id]: { c: conc.c, resp: conc.resp } }));
                  }}
                />
              )}
            </SectionFiche>
            <SectionFiche titre="Objectifs de la réunion">
              <Ligne premiere texte="🎯 Se synchroniser sur l’objectif d’itération" sous="Chacun dit ce qu’il a fait hier et ce qu’il fera aujourd’hui (15 min)" />
              <Ligne texte="🧱 Lever les blocages" sous="Les noter pendant le tour de table, les concrétiser ensuite" />
            </SectionFiche>
          </>
        );
      }
      case 'tour': {
        if (!courant) return <Vide texte="Aucun participant dans l’équipe." />;
        const m = courant.email.toLowerCase();
        const stories = situation.cartes.filter((t) => t.responsable === courant.id);
        // Lecture seule : les points du Sheet (ce que chacun a envoyé, ce que le SM a noté et concrétisé)
        const notes = (lecture ? serveur : tous).filter((y) => dela(y) && y.personne === m).sort((a, b) => a.cree_le.localeCompare(b.cree_le));
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
            <SectionFiche titre={`Ses stories · ${stories.length}`}>
              {stories.length ? (
                stories.map((t, i) => (
                  <LigneStory key={t.id} t={t} premiere={i === 0} bloquee={e.bloquees.has(t.id)} retard={enRetard(t, aujourdhui)} fmt={fmt} nbSous={subs.get(t.id)?.length ?? 0} onOuvrir={ouvrir(t)} />
                ))
              ) : (
                <Vide texte="Aucune story de l’itération à son nom." />
              )}
            </SectionFiche>
            <SectionFiche
              titre={`Points notés · ${filtreType ? `${notes.filter((y) => y.type === filtreType).length} sur ${notes.length}` : notes.length}`}
              droite={<PastilleFiltres actif={!!filtreType} ouvert={filtresOuverts} onPress={() => setFiltresOuverts((o) => !o)} />}
              entete={filtresOuverts && <FiltresType types={['hier', 'aujourdhui', 'blocage', 'decision', 'action']} value={filtreType} onChange={setFiltreType} />}
            >
              {notes.filter((y) => !filtreType || y.type === filtreType).map((y, i) => {
                const q = echangeDe(y);
                const par =
                  y.auteur === y.personne ? `par ${prenom(courant.nom)}` : y.auteur === sm?.email.toLowerCase() || (anime && y.auteur === mail) ? 'par le SM' : `par ${prenom(nomDe(y.auteur))}`;
                const story = surStory(y);
                return (
                  <Ligne
                    key={y.id}
                    premiere={i === 0}
                    texte={y.texte}
                    sous={[par, q ? `réponse à ${prenom(nomDe(q.de))}` : '', concretise(y), story].filter(Boolean).join(' · ')}
                    pastille={{ texte: LIBELLE_TYPE_POINT[y.type], ton: tonType(y.type) }}
                    onRetirer={!lecture && y.id.startsWith('local-') ? () => (setLocaux((l) => l.filter((z) => z.id !== y.id)), retirerPrep(y.id)) : undefined}
                  />
                );
              })}
              {lecture ? (
                !notes.length && <Vide texte="Rien de noté pour l’instant." />
              ) : (
                <SaisiePoint
                  key={filtreType || 'tous'}
                  premiere={!notes.filter((y) => !filtreType || y.type === filtreType).length}
                  types={['blocage', 'decision', 'action']}
                  typeDefaut={filtreType || 'blocage'}
                  titre={filtreType === 'blocage' || filtreType === 'decision' || filtreType === 'action' ? TITRE_TYPE[filtreType] : `Nouveau point · ${prenom(courant.nom)}`}
                  jour={jour}
                  placeholder={`＋ Ajouter pour ${prenom(courant.nom)}…`}
                  stories={stories}
                  onAjouter={(type, texte, element) => ajouter({ personne: m, type, texte, element })}
                />
              )}
            </SectionFiche>
          </>
        );
      }
      case 'concretisation':
        if (lecture) {
          // Lecture seule : le choix déjà fait par le SM (compte rendu envoyé), sinon « à décider »
          const faits = duSheet.filter((pt) => !!pt.concretisation).length;
          return (
            <>
              <TitreFiche icone="🧩" titre="Concrétisation" vide="" sous={`${pluriel(duSheet.length, 'point')} : ${faits} concrétisé${faits > 1 ? 's' : ''}, ${duSheet.length - faits} à décider par le SM`} />
              {!duSheet.length && <Vide texte="Aucun blocage, décision ou action noté." />}
              {duSheet.map((pt) => {
                const story = pt.element ? parId.get(pt.element) : undefined;
                return (
                  <View key={pt.id} style={st.carteConcret}>
                    <View style={st.ligneHaut}>
                      <View style={st.corps}>
                        <Text style={st.texte}>{pt.texte}</Text>
                        <Text style={st.sous}>
                          {prenom(nomDe(pt.personne))}
                          {story ? ` · sur 📖 ${story.titre}` : ''}
                        </Text>
                      </View>
                      <Pastille texte={LIBELLE_TYPE_POINT[pt.type]} ton={tonType(pt.type)} />
                    </View>
                    <Text style={[st.choixLecture, !pt.concretisation && st.choixADecider]} numberOfLines={1}>
                      {pt.concretisation ? `→ ${resumeChoix(pt.concretisation, pt.responsable || pt.personne, pt.responsable)}` : 'À décider'}
                    </Text>
                  </View>
                );
              })}
            </>
          );
        }
        return (
          <>
            <TitreFiche icone="🧩" titre="Concrétisation" vide="" sous={sous(`${pluriel(aDecider.length, 'point')} : blocages, décisions, actions`)} />
            {!aDecider.length && <Vide texte="Aucun blocage, décision ou action noté." />}
            {aDecider.map((pt) => {
              const { c, resp, a } = choixDe(pt);
              const story = pt.element ? parId.get(pt.element) : undefined;
              const choisi = !!choix[pt.id]?.c;
              const resume = resumeChoix(c, resp, a);
              return (
                <View key={pt.id} style={st.carteConcret}>
                  <View style={st.ligneHaut}>
                    <View style={st.corps}>
                      <Text style={st.texte}>{pt.texte}</Text>
                      <Text style={st.sous}>
                        {prenom(nomDe(pt.personne))}
                        {story ? ` · sur 📖 ${story.titre}` : ''}
                      </Text>
                    </View>
                    <Pastille texte={LIBELLE_TYPE_POINT[pt.type]} ton={tonType(pt.type)} />
                  </View>
                  {/* Un seul bouton « Concrétiser » : toutes les possibilités s'ouvrent dans une feuille (règle du 06/10) */}
                  <Pressable onPress={() => setFeuille({ id: pt.id, etape: 'quoi' })} style={[st.boutonSynchro, choisi && st.boutonSynchroChoisi]} accessibilityRole="button">
                    <Text style={[st.boutonSynchroTexte, choisi && st.boutonSynchroTexteChoisi]} numberOfLines={1}>
                      {choisi ? `${resume} ›` : 'Concrétiser ›'}
                    </Text>
                  </Pressable>
                  {!choisi && <Text style={st.sous}>Par défaut : {resume.charAt(0).toLowerCase() + resume.slice(1)}</Text>}
                </View>
              );
            })}
            {feuille &&
              (() => {
                const pt = aDecider.find((x) => x.id === feuille.id);
                if (!pt) return null;
                const { c, resp, a } = choixDe(pt);
                const poser = (y: { c?: Concretisation; resp?: string; a?: string }) => setChoix((mm) => ({ ...mm, [pt.id]: { ...mm[pt.id], ...y } }));
                if (feuille.etape === 'responsable')
                  return (
                    <FeuilleChoix
                      titre="Responsable"
                      value={resp}
                      groupes={[{ options: personnes.map((y) => ({ value: y.email.toLowerCase(), label: y.nom })) }]}
                      onChoisir={(v) => {
                        if (v) poser({ resp: v });
                        setFeuille(null);
                      }}
                      onFermer={() => setFeuille(null)}
                    />
                  );
                const valeur = c === 'synchro' ? `t:${a}` : c === 'escalade' ? `e:${a}` : `c:${c}`;
                return (
                  <FeuilleChoix
                    titre="Concrétiser"
                    value={valeur}
                    groupes={[
                      {
                        titre: 'Concrétiser',
                        options: [
                          ...(pt.element ? [{ value: 'c:sous_tache', label: 'Sous-tâche de la story', meta: parId.get(pt.element)?.titre }] : []),
                          { value: 'c:tache', label: `Tâche à part (${it.code})` },
                          { value: 'c:rien', label: 'Rien', meta: 'noté seulement' },
                        ],
                      },
                      ...(pt.type === 'blocage'
                        ? [
                            // Transmettre à : une personne de l'une de vos équipes (votre équipe ; SM du train si vous êtes SM)
                            ...destinatairesTransfert(mail, null, org, [mail, pt.personne]).map((g) => ({
                              titre: `Transmettre à · ${g.titre}`,
                              options: g.emails.map((x) => ({ value: `t:${x}`, label: nomDe(x), meta: libelleRole(x) })),
                            })),
                            // Escalader : à l'équipe du dessus, par l'une des deux voies du train
                            ...(rte?.email || pm?.email
                              ? [
                                  {
                                    titre: 'Escalader',
                                    options: [
                                      ...(rte?.email ? [{ value: `e:${rte.email.toLowerCase()}`, label: '⤴ Aux SM du train', meta: `obstacle, organisation · ${rte.nom} (RTE)` }] : []),
                                      ...(pm?.email ? [{ value: `e:${pm.email.toLowerCase()}`, label: '⤴ Aux PO du train', meta: `contenu, priorité · ${pm.nom} (PM)` }] : []),
                                    ],
                                  },
                                ]
                              : []),
                          ]
                        : []),
                    ]}
                    onChoisir={(v) => {
                      if (!v) return setFeuille(null);
                      if (v.startsWith('t:')) {
                        poser({ c: 'synchro', a: v.slice(2) });
                        return setFeuille(null);
                      }
                      if (v.startsWith('e:')) {
                        poser({ c: 'escalade', a: v.slice(2) });
                        return setFeuille(null);
                      }
                      const cc = v.slice(2) as Concretisation;
                      poser({ c: cc });
                      setFeuille(cc === 'sous_tache' || cc === 'tache' ? { id: pt.id, etape: 'responsable' } : null);
                    }}
                    onFermer={() => setFeuille(null)}
                  />
                );
              })()}
            <SectionFiche titre="Point oublié">
              <SaisiePoint premiere types={['blocage', 'decision', 'action']} typeDefaut="blocage" titre="Nouveau point oublié" jour={jour} placeholder="＋ Blocage, décision ou action oublié" stories={situation.cartes} onAjouter={(type, texte, element) => ajouter({ personne: mail, type, texte, element })} />
            </SectionFiche>
          </>
        );
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
              <SectionFiche titre={`À décider · ${restants.length}`}>
                {restants.map((pt, i) => (
                  <Ligne key={pt.id} premiere={i === 0} texte={pt.texte} sous={`par ${prenom(nomDe(pt.personne))} · à décider par le SM`} pastille={{ texte: LIBELLE_TYPE_POINT[pt.type], ton: tonType(pt.type) }} />
                ))}
              </SectionFiche>
            )}
            <SectionFiche titre={`Créé · ${crees.length}`}>
              {crees.length ? (
                crees.map((d, i) => (
                  <Ligne
                    key={d.pt.id}
                    premiere={i === 0}
                    texte={d.pt.texte}
                    sous={`${d.c === 'sous_tache' ? `Sous-tâche de 📖 ${parId.get(d.pt.element)?.titre ?? 'la story'}` : `Tâche à part · ${it.code}`} · 👤 ${prenom(nomDe(d.resp))}`}
                    pastille={{ texte: LIBELLE_TYPE_POINT[d.pt.type], ton: tonType(d.pt.type) }}
                  />
                ))
              ) : (
                <Vide texte="Aucune tâche à créer." />
              )}
            </SectionFiche>
            {escalades.length > 0 && (
              <SectionFiche titre={`Escaladé · ${escalades.length}`}>
                {escalades.map((d, i) => (
                  <Ligne key={d.pt.id} premiere={i === 0} texte={d.pt.texte} sous={`👤 ${prenom(nomDe(d.pt.personne))} · ⤴ ${d.a && d.a === pm?.email?.toLowerCase() ? `PO du train · ${pm?.nom}` : `SM du train · ${rte?.nom ?? 'RTE'}`}`} pastille={{ texte: 'Blocage', ton: 'rouge' }} />
                ))}
              </SectionFiche>
            )}
            {synchros.length > 0 && (
              <SectionFiche titre={`Transmis · ${synchros.length}`}>
                {synchros.map((d, i) => (
                  <Ligne key={d.pt.id} premiere={i === 0} texte={d.pt.texte} sous={`${prenom(nomDe(d.pt.personne))} → ${prenom(nomDe(d.a))} · échange envoyé`} pastille={{ texte: 'Blocage', ton: 'rouge' }} />
                ))}
              </SectionFiche>
            )}
            <SectionFiche titre={`Noté seulement · ${notes.length}`}>
              {notes.length ? (
                notes.map((d, i) => <Ligne key={d.pt.id} premiere={i === 0} texte={d.pt.texte} sous={`par ${prenom(nomDe(d.pt.personne))}`} pastille={{ texte: LIBELLE_TYPE_POINT[d.pt.type], ton: 'gris' }} />)
              ) : (
                <Vide texte="Rien." />
              )}
            </SectionFiche>
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
          : `Envoyer au SM${sm ? ` · ${prenom(sm.nom)}` : ''}`,
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

