import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  aConcretiser,
  backlogAPreparer,
  concretisationParDefaut,
  dateCourte,
  dateRelative,
  enRetard,
  jourReunion,
  LIBELLE_CONCRETISATION,
  LIBELLE_TYPE_POINT,
  PARCOURS_DAILY,
  pastillePoint,
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
import { lireNiveau, personneParEmail } from '../echange/hierarchieEchange';
import { useHierarchy } from '../hierarchyContext';
import { membresDe, type OrgValue, porteurs } from '../organisation';
import { fmtPoints, iterationOf, piOf, pointsOf } from '../pi';
import { type EtapeParcours, etapesParcours, LIBELLE_ROLE_REUNION, libellesParcours, participantsReunion, plusieursRoles, type RoleReunion } from '../reunions';
import { useSafe } from '../safe';
import { subtaskMap } from '../subtasks';
import { colors } from '../theme';
import { type Concretisation, type Echange, type EchangeInput, type Item, type ItemInput, type PointReunion, RECURRENCE_DEFAUTS, type Reunion, type Statut, type TypePoint } from '../types';
import { FeuilleChoix, LigneChoix, SectionFiche } from './Choix';
import { estAutre, placeholderNote, reponsePrete } from './EchangesView';
import { FenetreReunion, type ModeReunion } from './FenetreReunion';
import { TitreFiche } from './FormSheet';

/**
 * Daily (lot 6, validé le 01/10 ; règles ajoutées le 01/10) : contenu de la fenêtre de réunion. Une seule fenêtre et
 * une seule barre d'étapes qui enchaîne, dans cet ordre, les étapes de chacun des rôles de la personne
 * (`etapesParcours`) :
 * - membre : Hier · date (ses stories et tâches de l'itération, y compris celles nées des réunions, avec à droite
 *   « Action · 29/09 »), Aujourd'hui · date, Blocages ;
 * - PO : Stories à accepter (terminées dans l'itération), Backlog à préparer (stories des features du PI sans
 *   estimation ou trop grosses), Questions de l'équipe (échanges 🔄 Synchro que les membres lui adressent sur les
 *   stories de l'itération ; il y répond avec les choix de l'échange : à l'envoi de son point, la réponse part dans
 *   l'échange et est dupliquée en point « décision » de la réunion, que le SM concrétise ; une réponse déjà donnée
 *   dans la Synchro est dupliquée de même) ;
 *   s'il n'est pas membre, il fait aussi Hier et Aujourd'hui pour ses propres tâches ;
 * - participant : « Prêt » (récapitulatif, envoyé au SM) ;
 * - Scrum Master (organisateur) : Situation (compteurs de l'itération, « Suivi · n », objectifs) · Tour de table (un
 *   membre à la fois : ses stories, un seul bloc « Points notés » pour ce qu'il a préparé et ce que note le SM) ·
 *   Concrétisation (sous-tâche de la story, tâche à part, rien, escalade au RTE, ou pour un blocage échange
 *   « Transmettre à » le PO, le SM ou un membre, via un bouton « Concrétiser » qui ouvre toutes les possibilités ; avec un responsable) · Compte rendu (tâches créées en un lot ;
 *   échanges Synchro, escalades et compte rendu au RTE envoyés en un lot). Sa propre préparation (s'il est
 *   aussi membre) n'est pas envoyée : elle rejoint directement ses points notés.
 * Une story ou une tâche qui a des sous-tâches affiche « n sous-tâches » et un › : la toucher ouvre sa fiche.
 * Points rangés dans l'onglet PointsReunion du Sheet de l'espace de l'équipe : une lecture à l'ouverture, une
 * relecture en arrivant sur chaque membre au tour de table (au plus une par membre), une écriture groupée à l'envoi.
 */

/** Opérations du daily (fournies par l'application : Sheets, état des tâches et des échanges) */
export interface ActionsDaily {
  lirePoints: (espace: string, prefixe: string) => Promise<PointReunion[]>;
  ecrirePoints: (espace: string, creer: Omit<PointReunion, 'id' | 'cree_le'>[], modifier: (Partial<PointReunion> & { id: string })[], retirer: string[]) => Promise<unknown>;
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

type Local = Omit<PointReunion, 'id' | 'cree_le'> & { id: string; cree_le: string };
const prenom = (nom: string) => nom.split(' ')[0] || nom;
const arrondi = (n: number) => String(Math.round(n * 10) / 10);
let compteurLocal = 0;
const idLocal = () => `local-${Date.now()}-${++compteurLocal}`;
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;
/** Ordre des points dans un récapitulatif */
const ORDRE: TypePoint[] = ['hier', 'aujourdhui', 'blocage', 'decision', 'action'];

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
  const parId = new Map(h.items.map((t) => [t.id, t]));
  const subs = useMemo(() => subtaskMap(h.items), [h.items]);
  return { h, equipe, jour, it, situation, bloquees, personnes, role, nomDe, train, rte, parId, subs, dansEquipe };
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
  /** Ids des points déjà envoyés que la préparation reprend (retirés à l'envoi) */
  const [anciens, setAnciens] = useState<string[]>([]);
  /** Notés par l'organisateur pendant la réunion */
  const [locaux, setLocaux] = useState<Local[]>([]);
  const [choix, setChoix] = useState<Record<string, { c?: Concretisation; resp?: string; a?: string }>>({});
  /** Feuille « Concrétiser » ouverte sur un point : choix de la concrétisation, puis du responsable */
  /** Tour de table : filtre des points notés par type (bloc « Filtres » ouvert par défaut, repliable) */
  const [filtreType, setFiltreType] = useState<TypePoint | ''>('');
  const [filtresOuverts, setFiltresOuverts] = useState(true);
  const [feuille, setFeuille] = useState<{ id: string; etape: 'quoi' | 'responsable' } | null>(null);
  /** PO : ses réponses aux questions de l'équipe (par échange), envoyées avec son point */
  const [reponses, setReponses] = useState<Record<string, { c: string; note: string }>>({});
  const [membre, setMembre] = useState(0);
  const [cle, setCle] = useState('');
  const relus = useRef(new Set<string>());

  const tous = useMemo(() => [...serveur.filter((x) => !anciens.includes(x.id)), ...prep, ...locaux] as PointReunion[], [serveur, anciens, prep, locaux]);
  const e = useEquipeDaily(reunion, org, aujourdhui, tous, echanges);
  const { h, equipe, jour, it, situation, personnes, nomDe, rte, parId, subs } = e;
  const veille = veilleOuvree(jour);
  const dela = (pt: PointReunion) => pt.reunion === reunion.id;
  const moiP = personneParEmail(mail, org);
  const sm = equipe?.sm ? org.personne.get(equipe.sm) : undefined;
  const po = equipe?.po ? org.personne.get(equipe.po) : undefined;

  // Rôles de la personne dans ce daily, et son parcours (étapes de chaque rôle, dans l'ordre membre, PO, SM)
  const anime = mode === 'organisateur';
  const estMembre = !!moiP && !!equipe && membresDe(equipe).includes(moiP.id);
  const estPO = !!moiP && equipe?.po === moiP.id;
  const parcours = useMemo(() => etapesParcours({ membre: estMembre, po: estPO, sm: anime }, PARCOURS_DAILY), [estMembre, estPO, anime]);
  const multi = plusieursRoles(parcours);
  const libRoles: Record<RoleReunion, string> = { ...LIBELLE_ROLE_REUNION, sm: !sm || sm.id === moiP?.id ? LIBELLE_ROLE_REUNION.sm : 'organisateur' };
  const etapes = libellesParcours(parcours, (x) => (x.cle === 'hier' ? 'Hier' : x.cle === 'aujourdhui' ? 'Aujourd’hui' : x.nom), libRoles);
  /** Sous-titre d'un écran : avec plusieurs rôles, il rappelle le rôle (« Paul Leroy (PO) · … ») */
  const sousRole = (role: RoleReunion, sous: string) => (multi ? `${moiP?.nom ?? prenom(nomDe(mail))} (${libRoles[role]}) · ${sous}` : sous);

  // Ouverture : une lecture (points de ce daily et des dailies précédents de l'équipe, pour le suivi)
  useEffect(() => {
    if (!visible) return;
    setServeur([]);
    setPrep([]);
    setAnciens([]);
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
        setServeur(l);
        // Déjà envoyé : la préparation reprend ce qui a été envoyé (pas encore concrétisé)
        const miens = l.filter((x) => x.reunion === reunion.id && x.personne === mail && x.auteur === mail && !x.concretisation);
        setAnciens(miens.map((x) => x.id));
        setPrep(miens.map((x) => ({ ...x, id: idLocal() })));
        setCharge(true);
      })
      .catch((err) => actif && (setCharge(true), onInfo?.(`Points du daily non lus : ${(err as Error).message}`)));
    return () => {
      actif = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, reunion.id]);

  // Tour de table : en arrivant sur un membre, on relit ses points (préparés depuis l'ouverture) — une fois par membre
  const courant = personnes[Math.min(membre, Math.max(0, personnes.length - 1))];
  useEffect(() => {
    if (!visible || cle !== 'tour' || !courant || relus.current.has(courant.email.toLowerCase())) return;
    const m = courant.email.toLowerCase();
    relus.current.add(m);
    actions
      .lirePoints(espace, reunion.id)
      .then((l) => setServeur((avant) => [...avant.filter((x) => !(dela(x) && x.personne === m)), ...l.filter((x) => x.personne === m)]))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, cle, courant?.email]);

  /** Nouveau point de votre préparation */
  const nouveau = (type: TypePoint, texte: string, element: string, tache = ''): Local => ({
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
  const basculer = (type: TypePoint, t: Item, texte: string) =>
    setPrep((l) => (coche(type, t, texte) ? l.filter((x) => !(x.type === type && x.element === t.id && x.texte === texte)) : [...l, nouveau(type, texte, t.id)]));

  /** Ligne d'une de vos tâches : case à cocher, sous-tâches (›), à droite son état ou « Action · 29/09 » */
  const ligneTache = (type: TypePoint, t: Item, i: number) => {
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
        onBasculer={() => basculer(type, t, t.titre)}
        onOuvrir={ouvrir(t)}
        pastille={pt ? { ...pastilleSuivi(pt, jour), ton: tonType(pt.type) } : pastilleStatut(t.statut)}
      />
    );
  };
  const listeTaches = (type: TypePoint, liste: Item[], vide: string) => (liste.length ? liste.map((t, i) => ligneTache(type, t, i)) : <Vide texte={vide} />);
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
    return [{ q: e, ici, pt: { ...nouveau('decision', texteReponse(e), q.element, q.id), id: `local-rep-${q.id}` } }];
  });
  const preparation = [...prep, ...reponsesPO.map((r) => r.pt)];

  // ---- Envoi de votre point au SM : réponses aux échanges (un lot), puis points (un lot) ----
  const envoyerPreparation = async () => {
    const ici = reponsesPO.filter((r) => r.ici);
    if (ici.length) await actions.repondreEchanges(ici.map((r) => ({ e: r.q, reponse: r.q.reponse, note: r.q.note })));
    await actions.ecrirePoints(
      espace,
      preparation.map(({ id: _i, cree_le: _c, ...x }) => x),
      [],
      anciens,
    );
    onInfo?.(
      (preparation.length ? `Point envoyé${sm ? ` à ${prenom(sm.nom)} (SM)` : ''} : ${pluriel(preparation.length, 'élément')}` : 'Préparation vide envoyée : rien de noté') +
        (ici.length ? `, ${pluriel(ici.length, 'réponse')} envoyée${ici.length > 1 ? 's' : ''} dans la Synchro.` : '.'),
    );
  };

  // ---------------------------------------------------------------------------
  // Animation (Scrum Master)
  // ---------------------------------------------------------------------------
  // Suivi : points concrétisés (dailies précédents, ou celui-ci déjà envoyé) dont la tâche n'est pas finie
  const suivisEquipe = useMemo(() => calculerSuivis(serveur, h.items), [serveur, h.items]);
  const suivisEchanges = useMemo(() => suivisSynchro(serveur, echanges), [serveur, echanges]);
  // À concrétiser : ce qui ne l'a pas encore été (un compte rendu déjà envoyé ne recrée rien)
  const aDecider = [...tous, ...(anime ? reponsesPO.map((r) => r.pt) : [])].filter((x) => dela(x) && aConcretiser(x) && !x.concretisation);
  const choixDe = (pt: PointReunion) => {
    const c = choix[pt.id]?.c ?? concretisationParDefaut(pt);
    // Sous-tâche impossible sans story ; escalade impossible sans RTE
    const cc: Concretisation = (c === 'sous_tache' && !pt.element) || (c === 'escalade' && !rte?.email) ? 'tache' : c;
    // Échange 🔄 Synchro : vers le PO par défaut (sinon le SM), jamais vers la personne qui a le blocage
    const defautA = [po?.email, sm?.email].find((x) => !!x && x.toLowerCase() !== pt.personne)?.toLowerCase() ?? '';
    return { c: cc === 'synchro' && pt.type !== 'blocage' ? 'tache' : cc, resp: choix[pt.id]?.resp ?? (pt.responsable || pt.personne), a: choix[pt.id]?.a ?? defautA };
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
      titre: `Blocage · ${d.pt.texte}`.slice(0, 200),
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
    if (rte?.email && e.train) {
      const base = { de: mail, a: rte.email.toLowerCase(), type: 'message' as const, choix: '', reponse: '', note: '', statut: 'envoye' as const, niveau: `train:${e.train.id}`, transmis_par: '', prive: '1', pieces_jointes: '', espace };
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
        ...escalades.map((d) => ({
          ...base,
          titre: `Blocage · ${d.pt.texte}`.slice(0, 200),
          texte: `Blocage noté au daily ${equipe?.nom ?? ''} du ${dateCourte(jour)} pour ${nomDe(d.pt.personne)}${story(d.pt.element) ? ` (story « ${story(d.pt.element)} »)` : ''} : l'équipe ne peut pas le lever seule.`,
          element: d.pt.element,
        })),
        { ...base, titre: `Compte rendu · Daily ${equipe?.nom ?? ''} du ${dateCourte(jour)}`, texte, element: '' },
      );
    }
    const envoyes = lot.length ? await actions.envoyerEchanges(espace, lot) : [];
    // Le point garde l'échange créé (Synchro, escalade) pour le suivi
    const echangeDuPoint = new Map([...synchros, ...(rte?.email && e.train ? escalades : [])].map((d, i) => [d.pt.id, envoyes[i]?.id ?? '']));

    // Une réponse du PO (décision) garde le lien vers sa question, sauf si elle devient une tâche
    const patch = (d: (typeof decides)[number]) => ({
      concretisation: d.c,
      tache: tacheDe.get(d.pt.id) || echangeDuPoint.get(d.pt.id) || (d.pt.type === 'decision' && d.c === 'rien' ? d.pt.tache : ''),
      responsable: d.c === 'escalade' ? '' : d.c === 'synchro' ? d.a : d.resp,
    });
    const parPoint = new Map(decides.map((d) => [d.pt.id, d]));
    const creer = [...preparation, ...locaux].map(({ id: _i, cree_le: _c, ...x }) => {
      const d = parPoint.get(_i);
      return d ? { ...x, ...patch(d) } : x;
    });
    const modifier = decides.filter((d) => !d.pt.id.startsWith('local-')).map((d) => ({ id: d.pt.id, ...patch(d) }));
    await actions.ecrirePoints(espace, creer, modifier, anciens);
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
  const rendu = (x: EtapeParcours) => {
    if (!charge) return <Vide texte="Lecture des points du daily…" />;
    const sous = (s: string) => sousRole(x.role, s);
    switch (x.cle) {
      case 'hier':
        return (
          <>
            <TitreFiche icone="⏪" titre="Hier" vide="" sous={sous('Cochez ce dont vous parlerez')} />
            <SectionFiche titre={`Mes stories et tâches · ${hierListe.length}`}>
              {listeTaches('hier', hierListe, 'Rien en cours ni terminé hier.')}
              {listeLibres('hier', hierListe)}
              <SaisiePoint types={[]} jour={jour} placeholder="＋ Autre chose fait hier" onAjouter={(_, texte) => setPrep((l) => [...l, nouveau('hier', texte, '')])} />
            </SectionFiche>
          </>
        );
      case 'aujourdhui':
        return (
          <>
            <TitreFiche icone="▶️" titre="Aujourd’hui" vide="" sous={sous('Ce que vous allez faire')} />
            <SectionFiche titre={`Mes stories et tâches · ${aujListe.length}`}>
              {listeTaches('aujourdhui', aujListe, 'Rien à votre nom dans l’itération.')}
              {listeLibres('aujourdhui', aujListe)}
              <SaisiePoint types={[]} jour={jour} placeholder="＋ Autre chose aujourd’hui" onAjouter={(_, texte) => setPrep((l) => [...l, nouveau('aujourdhui', texte, '')])} />
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
                types={[]}
                jour={jour}
                placeholder="＋ Blocage"
                stories={situation.cartes.filter((t) => !!moiP && t.responsable === moiP.id)}
                onAjouter={(_, texte, element) => setPrep((l) => [...l, nouveau('blocage', texte, element)])}
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
                      onBasculer={() => basculer('aujourdhui', t, texte)}
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
                      onBasculer={() => basculer('aujourdhui', t, texte)}
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
                    <Pastille {...(repondu ? { texte: 'Répondu', ton: 'vert' as const } : { texte: 'Blocage', date: dateRelative(q.cree_le.slice(0, 10), jour).replace(/^./, (c) => c.toUpperCase()), ton: 'rouge' as const })} />
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
      case 'pret': {
        const recap = [...preparation].sort((a, b) => ORDRE.indexOf(a.type) - ORDRE.indexOf(b.type));
        return (
          <>
            <TitreFiche icone="✅" titre="Prêt" vide="" sous={sous(`Envoyé à ${sm ? `${sm.nom} (SM)` : 'l’organisateur'} · préparation facultative`)} />
            <SectionFiche titre={`Mon point · ${recap.length}`}>
              {recap.map((y, i) => {
                const q = echangeDe(y);
                return (
                  <Ligne
                    key={y.id}
                    premiere={i === 0}
                    texte={y.texte}
                    sous={[q ? `réponse à ${prenom(nomDe(q.de))}` : '', concretise(y), surStory(y)].filter(Boolean).join(' · ')}
                    pastille={{ texte: pastillePoint(y.type, jour), ton: tonType(y.type) }}
                  />
                );
              })}
              {!recap.length && <Vide texte="Rien de préparé : vous ferez votre point de vive voix." />}
            </SectionFiche>
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
            <SectionFiche titre={`Suivi · ${suivisEquipe.length + suivisEchanges.length}`}>
              {suivisEquipe.map(({ point, tache }, i) => (
                <Ligne
                  key={point.id}
                  premiere={i === 0}
                  texte={tache.titre}
                  sous={`${LIBELLE_CONCRETISATION[point.concretisation]} · 👤 ${prenom(nomDe(point.responsable || point.personne))} · ${tache.statut === 'en_cours' ? 'en cours' : 'à faire'}`}
                  pastille={{ ...pastilleSuivi(point, jour), ton: tonType(point.type) }}
                />
              ))}
              {/* Blocages passés en 🔄 Synchro : suivis tant que l'échange existe (sans historique) */}
              {suivisEchanges.map(({ point, echange }, i) => (
                <Ligne
                  key={point.id}
                  premiere={!suivisEquipe.length && i === 0}
                  texte={point.texte}
                  sous={
                    point.type === 'decision'
                      ? `${LIBELLE_CONCRETISATION.synchro} · 👤 ${prenom(nomDe(echange.de))} · à prendre en compte`
                      : `${LIBELLE_CONCRETISATION.synchro} · 👤 ${prenom(nomDe(echange.a))} · ${echange.statut === 'repondu' ? 'répondu' : 'en attente'}`
                  }
                  pastille={{ ...pastilleSuivi(point, jour), ton: tonType(point.type) }}
                />
              ))}
              {!suivisEquipe.length && !suivisEchanges.length && <Vide texte="✓ Rien en attente des dailies précédents." />}
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
        const notes = tous.filter((y) => dela(y) && y.personne === m).sort((a, b) => a.cree_le.localeCompare(b.cree_le));
        return (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.membres}>
              {personnes.map((y, i) => (
                <Pressable key={y.id} onPress={() => setMembre(i)} style={[st.membre, i === membre && st.membreOn]} accessibilityRole="button" accessibilityState={{ selected: i === membre }}>
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
            {/* Filtre par type, au-dessus des points : même présentation que les filtres des autres écrans */}
            <View style={st.filtresTete}>
              <Pressable
                onPress={() => setFiltresOuverts((o) => !o)}
                style={[st.pastilleFiltres, !!filtreType && st.pastilleFiltresActive]}
                accessibilityRole="button"
                accessibilityLabel={`${filtresOuverts ? 'Replier' : 'Déplier'} les filtres`}
              >
                <Entonnoir couleur={filtreType ? colors.primary : colors.text} />
                <Text style={[st.pastilleFiltresTexte, !!filtreType && { color: colors.primary }]}>Filtres {filtresOuverts ? '▴' : '▾'}</Text>
                {!!filtreType && (
                  <View style={st.pastilleFiltresNb}>
                    <Text style={st.pastilleFiltresNbTexte}>1</Text>
                  </View>
                )}
              </Pressable>
              {!filtresOuverts && !!filtreType && <Text style={st.sous}>{LIBELLE_TYPE_POINT[filtreType]}</Text>}
            </View>
            {filtresOuverts && (
              <View style={st.filtresBloc}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.filtreLigne}>
                  {(['', 'hier', 'aujourdhui', 'blocage', 'decision', 'action'] as const).map((x) => {
                    const on = filtreType === x;
                    const n = x ? notes.filter((y) => y.type === x).length : notes.length;
                    return (
                      <Pressable key={x || 'tous'} onPress={() => setFiltreType(x)} style={[st.itChip, on && st.itChipOn]} accessibilityRole="button" accessibilityState={{ selected: on }}>
                        <Text style={[st.itChipText, on && st.itChipTextOn]}>
                          {x ? LIBELLE_TYPE_POINT[x] : 'Tous'} · {n}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}
            <SectionFiche titre={`Points notés · ${filtreType ? `${notes.filter((y) => y.type === filtreType).length} sur ${notes.length}` : notes.length}`}>
              {notes.filter((y) => !filtreType || y.type === filtreType).map((y, i) => {
                const q = echangeDe(y);
                const par = y.auteur === y.personne ? `par ${prenom(courant.nom)}` : y.auteur === mail ? 'par le SM' : `par ${prenom(nomDe(y.auteur))}`;
                const story = surStory(y);
                return (
                  <Ligne
                    key={y.id}
                    premiere={i === 0}
                    texte={y.texte}
                    sous={[par, q ? `réponse à ${prenom(nomDe(q.de))}` : '', concretise(y), story].filter(Boolean).join(' · ')}
                    pastille={{ texte: pastillePoint(y.type, jour), ton: tonType(y.type) }}
                    onRetirer={y.id.startsWith('local-') ? () => (setLocaux((l) => l.filter((z) => z.id !== y.id)), retirerPrep(y.id)) : undefined}
                  />
                );
              })}
              <SaisiePoint
                key={filtreType || 'tous'}
                premiere={!notes.filter((y) => !filtreType || y.type === filtreType).length}
                types={[filtreType || 'blocage']}
                aide={filtreType ? undefined : 'Type : Blocage (choisissez un autre type dans les filtres ci-dessus)'}
                jour={jour}
                placeholder={`＋ Ajouter pour ${prenom(courant.nom)}…`}
                stories={stories}
                onAjouter={(type, texte, element) => ajouter({ personne: m, type, texte, element })}
              />
            </SectionFiche>
          </>
        );
      }
      case 'concretisation':
        return (
          <>
            <TitreFiche icone="🧩" titre="Concrétisation" vide="" sous={sous(`${pluriel(aDecider.length, 'point')} : blocages, décisions, actions`)} />
            {!aDecider.length && <Vide texte="Aucun blocage, décision ou action noté." />}
            {aDecider.map((pt) => {
              const { c, resp, a } = choixDe(pt);
              const poser = (y: { c?: Concretisation; resp?: string; a?: string }) => setChoix((mm) => ({ ...mm, [pt.id]: { ...mm[pt.id], ...y } }));
              const story = pt.element ? parId.get(pt.element) : undefined;
              const choisi = !!choix[pt.id]?.c;
              const resume =
                c === 'sous_tache' || c === 'tache'
                  ? `${c === 'sous_tache' ? 'Sous-tâche' : `Tâche à part (${it.code})`} · 👤 ${prenom(nomDe(resp))}`
                  : c === 'synchro'
                    ? `Transmettre à ${a ? prenom(nomDe(a)) : '…'}`
                    : c === 'escalade'
                      ? '⤴ Escalader au RTE'
                      : 'Rien';
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
                const valeur = c === 'synchro' ? `t:${a}` : c === 'escalade' ? 'e:rte' : `c:${c}`;
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
                            {
                              titre: 'Transmettre à',
                              options: personnes
                                .filter((y) => y.email.toLowerCase() !== pt.personne)
                                .map((y) => ({ value: `t:${y.email.toLowerCase()}`, label: `${y.nom}${y.id === equipe?.po ? ' (PO)' : y.id === equipe?.sm ? ' (SM)' : ''}` })),
                            },
                            ...(rte?.email ? [{ titre: 'Escalader', options: [{ value: 'e:rte', label: `⤴ ${rte.nom}`, meta: 'RTE du train' }] }] : []),
                          ]
                        : []),
                    ]}
                    onChoisir={(v) => {
                      if (!v) return setFeuille(null);
                      if (v.startsWith('t:')) {
                        poser({ c: 'synchro', a: v.slice(2) });
                        return setFeuille(null);
                      }
                      if (v === 'e:rte') {
                        poser({ c: 'escalade' });
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
              <SaisiePoint premiere types={['blocage', 'decision', 'action']} jour={jour} placeholder="＋ Blocage, décision ou action oublié" stories={situation.cartes} onAjouter={(type, texte, element) => ajouter({ personne: mail, type, texte, element })} />
            </SectionFiche>
          </>
        );
      default: {
        // Compte rendu
        const decides = aDecider.map((pt) => ({ pt, ...choixDe(pt) }));
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
              sous={sous(rte?.email ? `Envoyé à ${rte.nom} (RTE du train ${e.train?.nom ?? ''})` : 'Pas de train ni de RTE : les tâches sont créées, le compte rendu n’est envoyé à personne.')}
            />
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
              <SectionFiche titre={`Escaladé au RTE · ${escalades.length}`}>
                {escalades.map((d, i) => (
                  <Ligne key={d.pt.id} premiere={i === 0} texte={d.pt.texte} sous={`👤 ${prenom(nomDe(d.pt.personne))} · ⤴ ${rte?.nom ?? 'RTE'}`} pastille={{ texte: 'Blocage', ton: 'rouge' }} />
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

  const dernier = personnes.length - 1;
  const cleDe = (k: number) => parcours[k]?.cle ?? '';
  return (
    <FenetreReunion
      visible={visible}
      reunion={reunion}
      mode={anime ? 'organisateur' : 'participant'}
      fil={fil}
      etapes={etapes}
      libelleFin={anime ? 'Envoyer le compte rendu' : `Envoyer au SM${sm ? ` · ${prenom(sm.nom)}` : ''}`}
      renduEtape={(k) => (parcours[k] ? rendu(parcours[k]) : null)}
      onEtape={(k) => {
        setCle(cleDe(k));
        if (cleDe(k) === 'tour') setMembre((m) => Math.min(m, Math.max(0, dernier)));
      }}
      onSuivant={(k) => {
        if (cleDe(k) === 'tour' && membre < dernier) {
          setMembre(membre + 1);
          return true;
        }
        return false;
      }}
      onFermer={onFermer}
      onTerminer={anime ? envoyerCompteRendu : envoyerPreparation}
    />
  );
}

// ---------------------------------------------------------------------------
// Éléments d'affichage
// ---------------------------------------------------------------------------
type Ton = 'bleu' | 'vert' | 'rouge' | 'orange' | 'gris';
const TONS: Record<Ton, { fond: string; texte: string }> = {
  bleu: { fond: '#E8F0FE', texte: '#1557B0' },
  vert: { fond: '#E6F4EA', texte: '#137333' },
  rouge: { fond: '#FCE8E6', texte: '#B3261E' },
  orange: { fond: '#FEF3E2', texte: '#B45309' },
  gris: { fond: '#EEF1F6', texte: colors.muted },
};
const pastilleStatut = (s: Statut): { texte: string; ton: Ton } =>
  s === 'termine' ? { texte: 'terminée', ton: 'vert' } : s === 'en_cours' ? { texte: 'en cours', ton: 'bleu' } : { texte: 'à faire', ton: 'gris' };
/** Couleur de la pastille d'un point selon son type */
const tonType = (t: TypePoint): Ton => (t === 'blocage' ? 'rouge' : t === 'decision' || t === 'action' ? 'orange' : 'bleu');

/** Pastille ; `date` : une seconde pastille grise à côté (le type et la date séparés, règle du 06/10) */
function Pastille({ texte, ton, date }: { texte: string; ton: Ton; date?: string }) {
  const une = (t: string, tn: Ton) => (
    <View style={[st.pastille, { backgroundColor: TONS[tn].fond }]}>
      <Text style={[st.pastilleTexte, { color: TONS[tn].texte }]} numberOfLines={1}>
        {t}
      </Text>
    </View>
  );
  if (!date) return une(texte, ton);
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {une(texte, ton)}
      {une(date, 'gris')}
    </View>
  );
}

function Compteur({ valeur, libelle, ton }: { valeur: string; libelle: string; ton?: Ton }) {
  return (
    <View style={st.compteur}>
      <Text style={[st.compteurValeur, ton && { color: TONS[ton].texte }]} numberOfLines={1} adjustsFontSizeToFit>
        {valeur}
      </Text>
      <Text style={st.compteurLibelle}>{libelle}</Text>
    </View>
  );
}

/**
 * Ligne : texte seul, sous-ligne grise, pastille à droite au même niveau ; avec `onOuvrir`, toute la ligne ouvre la
 * fiche (chevron ›)
 */
function Ligne({
  texte,
  sous,
  pastille,
  premiere,
  onRetirer,
  onOuvrir,
}: {
  texte: string;
  sous?: string;
  pastille?: { texte: string; ton: Ton; date?: string };
  premiere?: boolean;
  onRetirer?: () => void;
  onOuvrir?: () => void;
}) {
  const contenu = (
    <>
      <View style={st.corps}>
        <Text style={st.texte}>{texte}</Text>
        {!!sous && <Text style={st.sous}>{sous}</Text>}
      </View>
      {pastille && <Pastille {...pastille} />}
      {onRetirer && (
        <Pressable onPress={onRetirer} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Retirer « ${texte} »`}>
          <Text style={st.retirer}>✕</Text>
        </Pressable>
      )}
      {onOuvrir && <Text style={st.chevron}>›</Text>}
    </>
  );
  return onOuvrir ? (
    <Pressable onPress={onOuvrir} style={[st.ligne, !premiere && st.bord]} accessibilityRole="button" accessibilityLabel={`Ouvrir « ${texte} »`}>
      {contenu}
    </Pressable>
  ) : (
    <View style={[st.ligne, !premiere && st.bord]}>{contenu}</View>
  );
}

/**
 * Ligne à cocher (Hier, Aujourd'hui, stories à accepter…) : la case coche ; une tâche qui a des sous-tâches s'ouvre
 * (le reste de la ligne et ›), sinon toute la ligne coche
 */
function LigneCase({
  texte,
  sous,
  pastille,
  premiere,
  coche,
  onBasculer,
  onOuvrir,
}: {
  texte: string;
  sous?: string;
  pastille: { texte: string; ton: Ton; date?: string };
  premiere?: boolean;
  coche: boolean;
  onBasculer: () => void;
  onOuvrir?: () => void;
}) {
  return (
    <View style={[st.ligne, !premiere && st.bord]}>
      <Pressable onPress={onBasculer} hitSlop={10} accessibilityRole="checkbox" accessibilityState={{ checked: coche }} accessibilityLabel={texte}>
        <Text style={[st.caseACocher, coche && st.caseCochee]}>{coche ? '✓' : ''}</Text>
      </Pressable>
      <Pressable onPress={onOuvrir ?? onBasculer} style={st.ligneCorps} accessibilityRole="button" accessibilityLabel={onOuvrir ? `Ouvrir « ${texte} »` : texte}>
        <View style={st.corps}>
          <Text style={st.texte}>{texte}</Text>
          {!!sous && <Text style={st.sous}>{sous}</Text>}
        </View>
        <Pastille {...pastille} />
        {onOuvrir && <Text style={st.chevron}>›</Text>}
      </Pressable>
    </View>
  );
}

function LigneStory({
  t,
  premiere,
  bloquee,
  retard,
  fmt,
  nbSous,
  onOuvrir,
}: {
  t: Item;
  premiere: boolean;
  bloquee: boolean;
  retard: boolean;
  fmt: (n: number) => string;
  nbSous: number;
  onOuvrir?: () => void;
}) {
  const p = parseFloat(t.points);
  return (
    <Ligne
      premiere={premiere}
      texte={`${t.type === 'story' ? '📖 ' : ''}${t.titre}`}
      sous={[pastilleStatut(t.statut).texte, p > 0 ? fmt(p) : '', t.date ? `prévu le ${dateCourte(t.date)}` : '', nbSous ? pluriel(nbSous, 'sous-tâche') : ''].filter(Boolean).join(' · ')}
      pastille={bloquee ? { texte: 'bloquée', ton: 'rouge' } : retard ? { texte: 'en retard', ton: 'orange' } : pastilleStatut(t.statut)}
      onOuvrir={onOuvrir}
    />
  );
}

function Vide({ texte }: { texte: string }) {
  return <Text style={st.vide}>{texte}</Text>;
}

/** Choix en pastilles (un seul) ; une option `off` est grisée */
function Pastilles({ options, value, onChange, petit }: { options: { value: string; label: string; off?: boolean }[]; value: string; onChange: (v: string) => void; petit?: boolean }) {
  return (
    <View style={st.choix}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            disabled={o.off}
            onPress={() => onChange(o.value)}
            style={[st.choixPastille, petit && st.choixPetit, on && st.choixOn, o.off && st.choixOff]}
            accessibilityRole="radio"
            accessibilityState={{ selected: on, disabled: !!o.off }}
          >
            <Text style={[st.choixTexte, petit && st.choixTextePetit, on && st.choixTexteOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Saisie rapide d'un point : type en pastilles (si plusieurs), story facultative, Entrée pour ajouter */
function SaisiePoint({
  types,
  jour,
  placeholder,
  stories = [],
  premiere,
  aide,
  onAjouter,
}: {
  /** Ligne d'aide sous la saisie (ex. le type utilisé quand le filtre est sur « Tous ») */
  aide?: string;
  types: TypePoint[];
  jour: string;
  placeholder: string;
  stories?: Item[];
  premiere?: boolean;
  onAjouter: (type: TypePoint, texte: string, element: string) => void;
}) {
  const [type, setType] = useState<TypePoint>(types[types.length > 2 ? 2 : 0] ?? 'hier');
  const [texte, setTexte] = useState('');
  const [element, setElement] = useState('');
  const valider = () => {
    const t = texte.trim();
    if (!t) return;
    onAjouter(type, t, element);
    setTexte('');
  };
  const typeLibelle = (x: TypePoint) => (x === 'hier' || x === 'aujourdhui' ? pastillePoint(x, jour) : LIBELLE_TYPE_POINT[x]);
  return (
    <View style={[st.saisieBloc, !premiere && st.bord]}>
      {/* Présentation standard (06/10) : le type en pastilles sous son libellé, la story en une ligne de choix */}
      {types.length > 1 && (
        <View style={st.champ}>
          <Text style={st.champLibelle}>Type</Text>
          <Pastilles petit options={types.map((x) => ({ value: x, label: typeLibelle(x) }))} value={type} onChange={(v) => setType(v as TypePoint)} />
        </View>
      )}
      {stories.length > 0 && (
        <View style={st.champStory}>
          <LigneChoix
            label="Story"
            value={element}
            vide="Aucune (point général)"
            sans="Aucune (point général)"
            groupes={[{ titre: 'Stories de l’itération', options: stories.map((t) => ({ value: t.id, label: `📖 ${t.titre}` })) }]}
            onChange={setElement}
          />
        </View>
      )}
      <View style={st.saisieLigne}>
        <TextInput
          value={texte}
          onChangeText={setTexte}
          placeholder={placeholder}
          placeholderTextColor={colors.primary}
          onSubmitEditing={valider}
          submitBehavior="submit"
          returnKeyType="done"
          style={st.saisie}
          accessibilityLabel={placeholder.replace('＋ ', '')}
        />
        {!!texte.trim() && (
          <Pressable onPress={valider} hitSlop={8} style={st.ajouter} accessibilityRole="button" accessibilityLabel="Ajouter">
            <Text style={st.ajouterTexte}>Ajouter</Text>
          </Pressable>
        )}
      </View>
      {!!aide && <Text style={st.sous}>{aide}</Text>}
    </View>
  );
}

/** Entonnoir des filtres (même dessin que l'en-tête des écrans) */
function Entonnoir({ couleur }: { couleur: string }) {
  return (
    <View style={{ alignItems: 'center', width: 12 }}>
      <View style={{ width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 6, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: couleur }} />
      <View style={{ width: 2.5, height: 5, backgroundColor: couleur, marginTop: -1 }} />
    </View>
  );
}

const st = StyleSheet.create({
  filtresTete: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, marginHorizontal: 4 },
  pastilleFiltres: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 28, paddingHorizontal: 8, borderRadius: 15, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  pastilleFiltresActive: { backgroundColor: '#EAF2FE', borderColor: '#CFE0FB' },
  pastilleFiltresTexte: { fontSize: 12, fontWeight: '700', color: colors.text },
  pastilleFiltresNb: { position: 'absolute', top: -6, right: -6, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.danger, borderWidth: 2, borderColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  pastilleFiltresNbTexte: { color: '#fff', fontSize: 10, fontWeight: '800' },
  filtresBloc: { marginTop: 8, backgroundColor: colors.bg, borderRadius: 14, borderWidth: 1, borderColor: '#EEF1F5', padding: 9 },
  filtreLigne: { gap: 6, alignItems: 'center' },
  itChip: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 18, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.card },
  itChipOn: { backgroundColor: colors.primary },
  itChipText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  itChipTextOn: { color: '#fff' },
  compteurs: { flexDirection: 'row', gap: 8 },
  compteur: { flex: 1, backgroundColor: colors.card, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center', gap: 2 },
  compteurValeur: { fontSize: 18, fontWeight: '800', color: colors.text },
  compteurLibelle: { fontSize: 11.5, color: colors.muted, textAlign: 'center' },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11 },
  bord: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  champ: { gap: 6 },
  champLibelle: { fontSize: 12, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.4 },
  champStory: { marginHorizontal: -14, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  corps: { flex: 1, minWidth: 0, gap: 2 },
  texte: { fontSize: 15, color: colors.text },
  sous: { fontSize: 12.5, color: colors.muted },
  pastille: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10, maxWidth: 150 },
  pastilleTexte: { fontSize: 12, fontWeight: '700' },
  retirer: { fontSize: 14, color: colors.muted, paddingHorizontal: 2 },
  ligneCorps: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  note: { fontSize: 14.5, color: colors.text, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  chevron: { fontSize: 22, lineHeight: 24, color: colors.muted, marginLeft: -2 },
  vide: { fontSize: 14, color: colors.muted, paddingHorizontal: 14, paddingVertical: 12 },
  membres: { gap: 6, paddingBottom: 10, paddingHorizontal: 2 },
  membre: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  membreOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  membreTexte: { fontSize: 13, color: colors.text },
  membreTexteOn: { color: '#fff', fontWeight: '700' },
  carteConcret: { backgroundColor: colors.card, borderRadius: 12, padding: 12, gap: 8, marginTop: 10 },
  boutonSynchro: { alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.primary, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, maxWidth: '100%' },
  boutonSynchroChoisi: { backgroundColor: colors.primary },
  boutonSynchroTexte: { color: colors.primary, fontSize: 13.5, fontWeight: '700' },
  boutonSynchroTexteChoisi: { color: '#fff' },
  ligneHaut: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  petitTitre: { fontSize: 11.5, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  choix: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  choixPastille: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  choixPetit: { paddingHorizontal: 9, paddingVertical: 4 },
  choixOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  choixOff: { opacity: 0.35 },
  choixTexte: { fontSize: 13, color: colors.text },
  choixTextePetit: { fontSize: 12.5 },
  choixTexteOn: { color: '#fff', fontWeight: '600' },
  saisieBloc: { paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  saisieLigne: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  saisie: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: 6 },
  ajouter: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: colors.primary },
  ajouterTexte: { color: '#fff', fontWeight: '700', fontSize: 13 },
  caseACocher: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: '#A0A6B1', textAlign: 'center', lineHeight: 19, fontSize: 14, color: '#fff', overflow: 'hidden' },
  caseCochee: { backgroundColor: colors.primary, borderColor: colors.primary },
});
