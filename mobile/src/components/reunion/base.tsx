import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import {
  aConcretiser,
  concretisationParDefaut,
  dateCourte,
  jourReunion,
  LIBELLE_CONCRETISATION,
  LIBELLE_TYPE_POINT,
  pastilleSuivi,
  prefixeReunion,
  questionsEquipe,
  situationIteration,
  storiesBloquees,
  suivis as calculerSuivis,
  suivisSynchro,
  texteReponse,
} from '../../daily';
import { destinatairesTransfert, lireNiveau, personneParEmail } from '../../echange/hierarchieEchange';
import { etatDe, lireDonnee, lireVote, texteDirect, type Vote } from '../../etatReunion';
import { useHierarchy } from '../../hierarchyContext';
import { membresDe, type OrgValue, porteurs } from '../../organisation';
import { iterationOf } from '../../pi';
import { type CatalogueParcours, type EtapeCatalogue, etapesParcours, ongletParcours, type ParcoursRole, parcoursParDefaut, participantsReunion } from '../../reunions';
import { subtaskMap } from '../../subtasks';
import { aReprendre, parEspace, pointsEscalade, titreEscalade, titreTransmis } from '../../suiviEscalade';
import { colors } from '../../theme';
import { type Concretisation, type Echange, type EchangeInput, estTechnique, type Item, type ItemInput, type PointReunion, RECURRENCE_DEFAUTS, type Reunion, type TypePoint, TYPES_REUNION } from '../../types';
import { FeuilleChoix, SectionFiche } from '../Choix';
import type { ActionsDaily } from '../Daily';
import { estAutre, placeholderNote, reponsePrete } from '../EchangesView';
import { FenetreReunion, type OngletReunion } from '../FenetreReunion';
import { TitreFiche } from '../FormSheet';
import { useLive } from '../useLive';
import { Compteur, FiltresType, Ligne, Pastille, PastilleFiltres, Pastilles, pluriel, SaisiePoint, st, TITRE_TYPE, tonType, Vide } from './ui';

/**
 * Socle commun des réunions d'équipe (07/10) : Planification, Revue, Rétrospective, Affinage (le Daily, validé le
 * premier, a le sien, avec les mêmes règles). Mêmes règles partout (docs/regles-reunions.html) :
 * - un onglet par rôle (Mon point, PO, Animer), plus « Compte rendu · date » après la réunion ; pas d'étape « Prêt » :
 *   on envoie depuis la dernière étape utile ; l'animateur aussi membre « enregistre » son point ;
 * - points notés (Blocage, Décision, Action) en une fenêtre ; préparations propres à chaque réunion en lignes
 *   `donnee` (texte JSON) ; votes en lignes `vote` ; tout dans l'onglet PointsReunion du Sheet de l'équipe ;
 * - Concrétisation en 4 écrans (Concrétiser › : sous-tâche, tâche à part, rien · Transmettre à · Escalader ;
 *   Responsable) ; rien n'est créé avant « Envoyer le compte rendu » : tâches, stories modifiées, échanges et points
 *   partent en écritures groupées ;
 * - live : ligne d'état publiée par l'animateur, bandeau « ● En direct » chez les participants (à plusieurs).
 */

let compteur = 0;
const idLocal = () => `local-${Date.now()}-${++compteur}`;
export const prenom = (nom: string) => nom.split(' ')[0] || nom;
export type Onglet = 'membre' | 'po';
/** Point ou donnée pas encore envoyé (ou repris de ce qui a été envoyé) */
export type Local = Omit<PointReunion, 'id' | 'cree_le'> & { id: string; cree_le: string; onglet?: Onglet };
const aEcrire = ({ id: _i, cree_le: _c, onglet: _o, espace: _e, ...x }: Local | (PointReunion & { onglet?: Onglet })) => x;
export const sansTech = (l: PointReunion[]) => l.filter((x) => !estTechnique(x));

/** Équipe d'une réunion, ses personnes, sa situation d'itération */
export function useEquipe(reunion: Reunion, org: OrgValue, aujourdhui: string, points: PointReunion[], echanges: Echange[]) {
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
  const sm = equipe?.sm ? org.personne.get(equipe.sm) : undefined;
  const po = equipe?.po ? org.personne.get(equipe.po) : undefined;
  const parId = new Map(h.items.map((t) => [t.id, t]));
  const subs = useMemo(() => subtaskMap(h.items), [h.items]);
  return { h, equipe, jour, it, situation, bloquees, personnes, role, nomDe, train, rte, pm, sm, po, parId, subs, dansEquipe };
}
export type Equipe = ReturnType<typeof useEquipe>;

export interface PropsReunion {
  visible: boolean;
  reunion: Reunion;
  org: OrgValue;
  moi: string;
  aujourdhui: string;
  fil?: string;
  actions: ActionsDaily;
  onFermer: () => void;
  onFini?: () => void;
  onInfo?: (texte: string) => void;
  onOpenTask?: (t: Item) => void;
  echanges?: Echange[];
}

/**
 * Données et opérations d'une réunion d'équipe : lecture à l'ouverture, préparation de chacun (points et données,
 * reprises si déjà envoyées), points notés en séance, réponses du PO aux questions de l'équipe, concrétisation,
 * compte rendu, live.
 */
export function useReunion(p: PropsReunion, catalogue: CatalogueParcours, opts: { nomCourt: string; libelleEtape: (cle: string) => string }) {
  const { visible, reunion, org, moi, aujourdhui, actions, onInfo, echanges = [] } = p;
  const mail = moi.toLowerCase();
  const espace = reunion.espace || 'moi';
  const prefixe = prefixeReunion(reunion);
  const [lus, setLus] = useState<PointReunion[]>([]);
  const [charge, setCharge] = useState(false);
  const [prep, setPrep] = useState<Local[]>([]);
  /** Déjà envoyés, repris dans la préparation (id → onglet), retirés au renvoi de leur onglet */
  const [anciens, setAnciens] = useState<Record<string, Onglet>>({});
  const [locaux, setLocaux] = useState<Local[]>([]);
  const [choix, setChoix] = useState<Record<string, { c?: Concretisation; resp?: string; a?: string }>>({});
  const [reponses, setReponses] = useState<Record<string, { c: string; note: string }>>({});
  const serveur = useMemo(() => sansTech(lus), [lus]);
  const ici = (x: Pick<PointReunion, 'reunion'>) => x.reunion === reunion.id;
  const tous = useMemo(() => [...serveur.filter((x) => !(x.id in anciens)), ...prep.filter((x) => !estTechnique(x)), ...locaux] as PointReunion[], [serveur, anciens, prep, locaux]);
  const e = useEquipe(reunion, org, aujourdhui, tous, echanges);
  const moiP = personneParEmail(mail, org);
  const anime = reunion.organisateur.toLowerCase() === mail;
  const estMembre = !!moiP && !!e.equipe && membresDe(e.equipe).includes(moiP.id);
  const estPO = !!moiP && e.equipe?.po === moiP.id;
  const parcours = useMemo(() => etapesParcours({ membre: estMembre, po: estPO, sm: anime }, catalogue), [estMembre, estPO, anime, catalogue]);

  /** Onglet d'origine d'un point ou d'une donnée envoyés */
  const ongletDe = (x: PointReunion): Onglet => {
    if (x.type === 'donnee') return (lireDonnee<{ o?: Onglet }>(x)?.o as Onglet) || 'membre';
    return estPO && x.type === 'decision' && !!x.tache ? 'po' : 'membre';
  };
  const reprendre = (l: PointReunion[]) => {
    const miens = l.filter((x) => ici(x) && x.personne === mail && x.auteur === mail && !x.concretisation && x.type !== 'etat' && x.type !== 'vote');
    setAnciens(Object.fromEntries(miens.map((x) => [x.id, ongletDe(x)])));
    setPrep(miens.map((x) => ({ ...x, id: idLocal(), onglet: ongletDe(x) })));
  };

  useEffect(() => {
    if (!visible) return;
    setLus([]);
    setPrep([]);
    setAnciens({});
    setLocaux([]);
    setChoix({});
    setReponses({});
    setCharge(false);
    let actif = true;
    actions
      .lirePoints(espace, prefixe)
      .then((l) => {
        if (!actif) return;
        setLus(l);
        reprendre(l);
        setCharge(true);
      })
      .catch((err) => actif && (setCharge(true), onInfo?.(`Points de la réunion non lus : ${(err as Error).message}`)));
    return () => {
      actif = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, reunion.id]);

  const live = useLive({
    visible,
    reunion,
    espace,
    anime,
    nbParticipants: e.personnes.length,
    moi: mail,
    actions,
    charge,
    pointsInitiaux: lus,
    onPoints: (l) => setLus((avant) => [...avant.filter((x) => !ici(x)), ...l.filter(ici)]),
  });

  /** Nouveau point (ou donnée) de votre préparation */
  const nouveau = (type: TypePoint, texte: string, element = '', onglet: Onglet = 'membre', tache = ''): Local => ({
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
  /** Données de préparation (lignes `donnee`) : les vôtres en cours, celles des autres déjà envoyées */
  const donneesDe = <T,>(k: string) => {
    const autres = lus.filter((x) => ici(x) && x.type === 'donnee' && !(x.id in anciens));
    return [...autres, ...prep.filter((x) => x.type === 'donnee')]
      .map((x) => ({ p: x, d: lireDonnee<T & { c?: string }>(x) }))
      .filter((x): x is { p: PointReunion | Local; d: T & { k: string; c?: string } } => !!x.d && x.d.k === k);
  };
  /** Pose (ou remplace) une donnée de votre préparation : `cle` identifie la donnée (une par clé) */
  const poserDonnee = (k: string, cle: string, valeur: Record<string, unknown> | null, onglet: Onglet = 'membre', element = '') =>
    setPrep((l) => {
      const reste = l.filter((x) => !(x.type === 'donnee' && lireDonnee<{ c?: string }>(x)?.k === k && lireDonnee<{ c?: string }>(x)?.c === cle));
      return valeur ? [...reste, nouveau('donnee', JSON.stringify({ k, c: cle, o: onglet, ...valeur }), element, onglet)] : reste;
    });
  const ajouterPrep = (type: TypePoint, texte: string, element: string, onglet: Onglet = 'membre') => setPrep((l) => [...l, nouveau(type, texte, element, onglet)]);
  const retirerPrep = (id: string) => setPrep((l) => l.filter((y) => y.id !== id));
  /** Noté en séance par l'animateur, pour une personne */
  const noter = (x: { personne: string; type: TypePoint; texte: string; element: string }) => {
    const pt = { ...nouveau(x.type, x.texte, x.element), personne: x.personne.toLowerCase() };
    setLocaux((l) => [...l, pt]);
    return pt;
  };
  const retirerNote = (id: string) => (setLocaux((l) => l.filter((z) => z.id !== id)), retirerPrep(id));

  // ---- Questions de l'équipe au PO (mêmes qu'au daily) ----
  const idsIteration = new Set(e.situation.elements.map((t) => t.id));
  const questions = estPO ? questionsEquipe(echanges, mail, e.personnes.map((x) => x.email), idsIteration) : [];
  const reponseNotee = (q: Echange) => tous.some((x) => x.type === 'decision' && x.personne === mail && (x.tache === q.id || x.texte === texteReponse(q)));
  const reponsesPO = questions.flatMap((q) => {
    const r = reponses[q.id];
    const icic = q.statut === 'envoye' && !!r && reponsePrete(r.c, r.note);
    if (!icic && (q.statut !== 'repondu' || reponseNotee(q))) return [];
    const ech = icic ? { ...q, reponse: r.c, note: r.note.trim() } : q;
    return [{ q: ech, ici: icic, pt: { ...nouveau('decision', texteReponse(ech), q.element, 'po', q.id), id: `local-rep-${q.id}` } }];
  });
  const preparation = [...prep, ...reponsesPO.map((r) => r.pt)];

  /** Envoi d'un onglet (Mon point, PO) : réponses aux échanges (un lot), puis points et données (un lot) */
  const envoyerPrep = async (o: Onglet) => {
    const pts = preparation.filter((x) => (x.onglet ?? 'membre') === o);
    const icic = o === 'po' ? reponsesPO.filter((r) => r.ici) : [];
    if (icic.length) await actions.repondreEchanges(icic.map((r) => ({ e: r.q, reponse: r.q.reponse, note: r.q.note })));
    const retires = Object.keys(anciens).filter((id) => anciens[id] === o);
    const { crees } = await actions.ecrirePoints(espace, pts.map(aEcrire), [], retires);
    setLus((l) => [...l.filter((x) => !retires.includes(x.id)), ...crees]);
    setAnciens((a) => ({ ...Object.fromEntries(Object.entries(a).filter(([id]) => !retires.includes(id))), ...Object.fromEntries(crees.map((x) => [x.id, o])) }));
    setPrep((l) => [...l.filter((x) => (x.onglet ?? 'membre') !== o), ...crees.map((x) => ({ ...x, id: idLocal(), onglet: o }))]);
    if (o === 'po') setReponses({});
    const n = pts.filter((x) => !estTechnique(x)).length;
    onInfo?.(
      anime
        ? `Point enregistré : ${pluriel(n, 'point')}, il rejoint vos étapes d'animation.`
        : `Envoyé${e.sm ? ` à ${prenom(e.sm.nom)} (SM)` : ''} : ${pluriel(n, 'point')}${pts.length > n ? ' et votre préparation' : ''}${icic.length ? `, ${pluriel(icic.length, 'réponse')} dans le chat` : ''}.`,
    );
  };

  // ---- Votes (lignes `vote`) ----
  const votes = useMemo(() => {
    const l = [...lus.filter((x) => ici(x) && x.type === 'vote'), ...prep.filter((x) => x.type === 'vote')];
    return l.map((x) => ({ p: x, v: lireVote(x) })).filter((x): x is { p: PointReunion; v: Vote } => !!x.v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lus, prep]);
  /**
   * Envoie vos votes d'un tour (un ou plusieurs éléments) en une écriture ; vos votes précédents de ce tour sur ces
   * éléments sont remplacés. `val` vide : vote retiré.
   */
  const voterLot = async (l: { el: string; val: string }[], tour: number) => {
    const els = new Set(l.map((x) => x.el));
    const avant = lus.filter((x) => ici(x) && x.type === 'vote' && x.personne === mail && els.has(lireVote(x)?.el ?? '') && lireVote(x)?.tour === tour).map((x) => x.id);
    const pts = l.filter((x) => !!x.val).map((x) => aEcrire(nouveau('vote', JSON.stringify({ el: x.el, val: x.val, tour }), '')));
    const { crees } = await actions.ecrirePoints(espace, pts, [], avant);
    setLus((ll) => [...ll.filter((x) => !avant.includes(x.id)), ...crees]);
  };
  const voter = (el: string, val: string, tour: number) => voterLot([{ el, val }], tour);

  // ---- Concrétisation (animateur) ----
  const reportes = useMemo(() => (anime ? aReprendre(serveur, reunion.id).filter(aConcretiser) : []), [anime, serveur, reunion.id]);
  const aDecider = [...[...tous, ...(anime ? reponsesPO.map((r) => r.pt) : [])].filter((x) => ici(x) && aConcretiser(x) && !x.concretisation), ...reportes];
  const choixDe = (pt: PointReunion) => {
    const c = choix[pt.id]?.c ?? concretisationParDefaut(pt);
    const cc: Concretisation = (c === 'sous_tache' && !pt.element) || (c === 'escalade' && !e.rte?.email && !e.pm?.email) ? 'tache' : c;
    const defautA =
      cc === 'escalade' ? (e.rte?.email || e.pm?.email || '').toLowerCase() : ([e.po?.email, e.sm?.email].find((x) => !!x && x.toLowerCase() !== pt.personne)?.toLowerCase() ?? '');
    const a = choix[pt.id]?.a ?? defautA;
    // Responsable par défaut : qui a noté le point, s'il fait partie de l'équipe ; sinon le PO
    const dansEq = e.personnes.some((x) => x.email.toLowerCase() === (pt.responsable || pt.personne));
    const resp = choix[pt.id]?.resp ?? (dansEq ? pt.responsable || pt.personne : (e.po?.email.toLowerCase() ?? pt.personne));
    return { c: cc === 'synchro' && pt.type !== 'blocage' ? ('tache' as Concretisation) : cc, resp, a };
  };
  const poserChoix = (id: string, y: { c?: Concretisation; resp?: string; a?: string }) => setChoix((m) => ({ ...m, [id]: { ...m[id], ...y } }));

  /** Tâche née d'un point : sous-tâche de sa story ou tâche à part dans l'itération, avec son responsable */
  const entreeTache = (pt: Pick<PointReunion, 'texte' | 'type' | 'personne' | 'element'>, c: 'sous_tache' | 'tache', resp: string, iteration: string): ItemInput => ({
    ...RECURRENCE_DEFAUTS,
    espace,
    titre: pt.texte,
    type: 'tache',
    date: '',
    heure: '',
    heure_fin: '',
    date_fin: '',
    lieu: '',
    description: `${LIBELLE_TYPE_POINT[pt.type]} noté ${opts.nomCourt} ${e.equipe?.nom ?? ''} du ${dateCourte(e.jour)} (${prenom(e.nomDe(pt.personne))}).`,
    priorite: pt.type === 'blocage' ? 'haute' : 'normale',
    statut: 'a_faire',
    parent: c === 'sous_tache' ? pt.element : '',
    feature: '',
    epic: '',
    objectif: '',
    domaine: '',
    points: '',
    iteration,
    telephone: '',
    equipe: e.equipe?.id ?? '',
    responsable: personneParEmail(resp, org)?.id ?? '',
  });

  /**
   * Envoi du compte rendu : stories modifiées (un lot), tâches (un lot), réponses du PO (un lot), échanges (Synchro,
   * escalades, compte rendu au RTE : un lot), points (un lot, votre préparation comprise) ; puis la ligne d'état
   * « finie ». `iteration` : itération des tâches créées ; `stories` : modifications des stories (engagées,
   * acceptées, estimées…) ; `lignes` : le résumé propre à la réunion, en tête du compte rendu ; `retirer` : points à
   * supprimer (fin de suivi).
   */
  const envoyerCompteRendu = async (o: { iteration: string; stories?: (Partial<Item> & { id: string })[]; lignes: string[]; retirer?: string[]; creerStories?: ItemInput[] }) => {
    if (o.stories?.length && actions.modifierItems) await actions.modifierItems(espace, o.stories);
    if (o.creerStories?.length) await actions.creerTaches(espace, o.creerStories);
    const decides = aDecider.map((pt) => ({ pt, ...choixDe(pt) }));
    const aCreer = decides.filter((d) => d.c === 'sous_tache' || d.c === 'tache');
    const creees = await actions.creerTaches(espace, aCreer.map(({ pt, c, resp }) => entreeTache(pt, c as 'sous_tache' | 'tache', resp, o.iteration)));
    const tacheDe = new Map(aCreer.map((d, i) => [d.pt.id, creees[i]?.id ?? '']));
    const icic = reponsesPO.filter((r) => r.ici);
    if (icic.length) await actions.repondreEchanges(icic.map((r) => ({ e: r.q, reponse: r.q.reponse, note: r.q.note })));
    const escalades = decides.filter((d) => d.c === 'escalade');
    const synchros = decides.filter((d) => d.c === 'synchro' && !!d.a);
    const story = (id: string) => (id ? e.parId.get(id)?.titre : undefined);
    const quand = `${opts.nomCourt} ${e.equipe?.nom ?? ''} du ${dateCourte(e.jour)}`;
    const lot: EchangeInput[] = synchros.map((d) => ({
      de: d.pt.personne,
      a: d.a,
      type: 'question' as const,
      titre: titreTransmis(`${LIBELLE_TYPE_POINT[d.pt.type]} · ${d.pt.texte}`),
      texte: `${LIBELLE_TYPE_POINT[d.pt.type]} noté ${quand} pour ${e.nomDe(d.pt.personne)}${story(d.pt.element) ? ` (story « ${story(d.pt.element)} »)` : ''} : peux-tu le lever ?`,
      choix: 'Je m’en occupe;On en parle après la réunion;Autre',
      reponse: '',
      note: '',
      statut: 'envoye' as const,
      element: d.pt.element,
      niveau: e.equipe ? `equipeagile:${e.equipe.id}` : '',
      transmis_par: d.pt.personne === mail ? '' : mail,
      prive: '1',
      pieces_jointes: '',
      espace,
    }));
    const escaladesEnvoyees = e.train ? escalades.filter((d) => !!d.a) : [];
    if (e.train) {
      const base = { de: mail, a: (e.rte?.email ?? '').toLowerCase(), type: 'message' as const, choix: '', reponse: '', note: '', statut: 'envoye' as const, niveau: `train:${e.train.id}`, transmis_par: '', prive: '1', pieces_jointes: '', espace };
      const l: string[] = [`${TYPES_REUNION[reunion.type].libelle} ${e.equipe?.nom ?? ''} du ${dateCourte(e.jour)}.`, '', ...o.lignes];
      const bloc = (titre: string, x: string[]) => x.length && l.push('', `${titre} · ${x.length}`, ...x.map((y) => `• ${y}`));
      bloc('Créé', aCreer.map((d) => `${d.pt.texte} (${d.c === 'sous_tache' ? `sous-tâche de « ${story(d.pt.element) ?? 'la story'} »` : 'tâche à part'} · ${prenom(e.nomDe(d.resp))})`));
      bloc('Escaladé', escalades.map((d) => d.pt.texte));
      bloc('Transmis', synchros.map((d) => `${d.pt.texte} (${prenom(e.nomDe(d.pt.personne))} → ${prenom(e.nomDe(d.a))})`));
      bloc('Noté seulement', decides.filter((d) => d.c === 'rien').map((d) => d.pt.texte));
      lot.push(
        ...escaladesEnvoyees.map((d) => ({
          ...base,
          a: d.a,
          titre: titreEscalade(`${LIBELLE_TYPE_POINT[d.pt.type]} · ${d.pt.texte}`),
          texte: `${LIBELLE_TYPE_POINT[d.pt.type]} noté ${quand} pour ${e.nomDe(d.pt.personne)}${story(d.pt.element) ? ` (story « ${story(d.pt.element)} »)` : ''} : l'équipe ne peut pas le lever seule.`,
          element: d.pt.element,
        })),
        ...(e.rte?.email ? [{ ...base, titre: `Compte rendu · ${TYPES_REUNION[reunion.type].libelle} ${e.equipe?.nom ?? ''} du ${dateCourte(e.jour)}`, texte: l.join('\n'), element: '' }] : []),
      );
    }
    const envoyes = lot.length ? await actions.envoyerEchanges(espace, lot) : [];
    const echangeDuPoint = new Map([...synchros, ...escaladesEnvoyees].map((d, i) => [d.pt.id, envoyes[i]?.id ?? '']));
    const patch = (d: (typeof decides)[number]) => ({
      concretisation: d.c,
      tache: tacheDe.get(d.pt.id) || echangeDuPoint.get(d.pt.id) || (d.pt.type === 'decision' && d.c === 'rien' ? d.pt.tache : ''),
      responsable: d.c === 'escalade' || d.c === 'synchro' ? d.a : d.resp,
    });
    const parPoint = new Map(decides.map((d) => [d.pt.id, d]));
    const creer = [...preparation, ...locaux].map((y) => {
      const d = parPoint.get(y.id);
      return d ? { ...aEcrire(y), ...patch(d) } : aEcrire(y);
    });
    const modifier = decides.filter((d) => !d.pt.id.startsWith('local-')).map((d) => ({ id: d.pt.id, ...patch(d) }));
    const recus = parEspace(
      escaladesEnvoyees.flatMap((d) => {
        const id = echangeDuPoint.get(d.pt.id);
        if (!id) return [];
        const ech = { id, titre: titreEscalade(`Blocage · ${d.pt.texte}`), texte: d.pt.texte, element: d.pt.element };
        return pointsEscalade({ echange: ech, par: mail, vers: d.a, avant: e.equipe ? { kind: 'equipeagile', id: e.equipe.id } : null, apres: e.train ? { kind: 'train', id: e.train.id } : null, jour: e.jour, org, dejaNote: true });
      }),
    );
    // Lignes d'état des réunions précédentes de la série : retirées (celle-ci reste jusqu'au compte rendu suivant)
    const etatsAnciens = lus.filter((x) => x.type === 'etat' && !ici(x)).map((x) => x.id);
    await actions.ecrirePoints(espace, [...creer, ...(recus.get(espace) ?? [])], modifier, [...Object.keys(anciens), ...etatsAnciens, ...(o.retirer ?? [])]);
    for (const [esp, l] of recus) if (esp !== espace) await actions.ecrirePoints(esp, l, [], []);
    live.terminer();
    p.onFini?.();
    onInfo?.(
      `Compte rendu envoyé : ${pluriel(creees.length, 'tâche')} créée${creees.length > 1 ? 's' : ''}` +
        (o.stories?.length ? `, ${pluriel(o.stories.length, 'story')} mise${o.stories.length > 1 ? 's' : ''} à jour` : '') +
        (escalades.length ? `, ${escalades.length} escaladé${escalades.length > 1 ? 's' : ''}` : '') +
        (synchros.length ? `, ${synchros.length} transmis` : '') +
        (e.rte?.email ? ` ; envoyé à ${e.nomDe(e.rte.email)} (RTE).` : '.'),
    );
  };

  /** Dernier compte rendu de la série (aujourd'hui ou la réunion d'avant), pour l'onglet « Compte rendu · date » */
  const dernierCR = useMemo(() => {
    const ids = lus
      .filter((x) => x.reunion.startsWith(prefixe) && x.reunion.slice(-10) <= e.jour && (x.type === 'etat' ? !!etatDe([x], x.reunion)?.fin : aConcretiser(x) && !!x.concretisation))
      .map((x) => x.reunion);
    return ids.sort().pop() ?? '';
  }, [lus, prefixe, e.jour]);

  return {
    e,
    org,
    echanges,
    reunionId: reunion.id,
    mail,
    espace,
    anime,
    estMembre,
    estPO,
    parcours,
    charge,
    setCharge,
    lus,
    setLus,
    serveur,
    tous,
    prep,
    preparation,
    locaux,
    ici,
    nouveau,
    donneesDe,
    poserDonnee,
    ajouterPrep,
    retirerPrep,
    noter,
    retirerNote,
    questions,
    reponses,
    setReponses,
    reponsesPO,
    envoyerPrep,
    votes,
    voter,
    voterLot,
    reportes,
    aDecider,
    choix,
    choixDe,
    poserChoix,
    envoyerCompteRendu,
    dernierCR,
    live,
    libelleEtape: opts.libelleEtape,
  };
}
export type R = ReturnType<typeof useReunion>;

// ---------------------------------------------------------------------------
// Fenêtre : onglets des rôles, onglet « Compte rendu · date », bandeau « En direct »
// ---------------------------------------------------------------------------
export function FenetreEquipe({
  p,
  r,
  catalogue,
  rendu,
  libelleFin,
  etapeAnim,
  onSuivant,
  libelleSuivant,
  onEtape,
  envoyerCR,
  renduCR,
}: {
  p: PropsReunion;
  r: R;
  catalogue: CatalogueParcours;
  /** Contenu d'une étape d'un parcours ; `lecture` : écran de l'animateur vu dans le bandeau « En direct » */
  rendu: (x: EtapeCatalogue, o: ParcoursRole, lecture: boolean) => React.ReactNode;
  /** Bouton de la dernière étape d'un parcours de participant (« Envoyer à Nina », « Envoyer mes idées »…) */
  libelleFin?: (o: ParcoursRole) => string;
  /** Étape de l'onglet Animer : publiée dans la ligne d'état (avec un détail : membre, story…) */
  etapeAnim: { cle: string; detail?: string; element?: string; setCle: (c: string) => void };
  /** « Suivant » à l'intérieur d'une étape (story suivante…) : vrai si l'étape l'a pris en charge */
  onSuivant?: (role: ParcoursRole['role'], cle: string) => boolean;
  libelleSuivant?: (role: ParcoursRole['role'], cle: string) => string | undefined;
  /** Étape affichée dans un onglet */
  onEtape?: (role: ParcoursRole['role'], cle: string) => void;
  envoyerCR: () => Promise<void>;
  /** Compte rendu en lecture seule d'une réunion de la série (onglet « Compte rendu · date ») */
  renduCR: (reunionId: string) => React.ReactNode;
}) {
  const { reunion, fil, onFermer } = p;
  const { e, anime, live, charge } = r;
  // L'animateur publie son étape et son élément
  useEffect(() => {
    if (!p.visible || !anime || !charge || !etapeAnim.cle) return;
    live.publier({ etape: etapeAnim.cle, libelle: r.libelleEtape(etapeAnim.cle), detail: etapeAnim.detail ?? '', element: etapeAnim.element ?? '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.visible, anime, charge, etapeAnim.cle, etapeAnim.detail, etapeAnim.element]);

  const onglets: OngletReunion[] = r.parcours.map((o) => {
    const sm = o.role === 'sm';
    const cleDe = (k: number) => o.etapes[k]?.cle ?? '';
    return {
      cle: o.role,
      libelle: ongletParcours(o),
      etapes: o.etapes.map((x) => x.nom),
      libelleFin: sm ? 'Envoyer le compte rendu' : anime ? 'Enregistrer mon point' : (libelleFin?.(o) ?? `Envoyer${e.sm ? ` à ${prenom(e.sm.nom)}` : ''}`),
      renduEtape: (k) => (o.etapes[k] ? (charge ? rendu(o.etapes[k], o, false) : <Vide texte="Lecture de la réunion…" />) : null),
      onEtape: (k) => {
        if (sm) etapeAnim.setCle(cleDe(k));
        onEtape?.(o.role, cleDe(k));
      },
      onSuivant: onSuivant ? (k) => onSuivant(o.role, cleDe(k)) : undefined,
      libelleSuivant: libelleSuivant ? (k) => libelleSuivant(o.role, cleDe(k)) : undefined,
      onTerminer: sm ? envoyerCR : () => r.envoyerPrep(o.role === 'po' ? 'po' : 'membre'),
      fermer: sm,
    };
  });
  if (r.dernierCR)
    onglets.push({
      cle: 'cr',
      libelle: `Compte rendu · ${dateCourte(r.dernierCR.slice(-10))}`,
      etapes: ['Compte rendu'],
      libelleFin: 'Fermer',
      renduEtape: () => renduCR(r.dernierCR),
      fermer: true,
    });
  const etat = live.etat;
  const lance = !!etat && !!etat.lance && !etat.fin;
  const animo: ParcoursRole = { role: 'sm', lecture: true, etapes: catalogue.sm };
  const etapeA = catalogue.sm.find((x) => x.cle === etat?.etape);
  const direct =
    !anime && live.live && lance && etat
      ? { texte: texteDirect(etat, prenom(e.nomDe(etat.anim))), animateur: prenom(e.nomDe(etat.anim)), contenu: etapeA ? rendu(etapeA, animo, true) : undefined }
      : undefined;
  const actualiser = async () => {
    const l = p.actions.actualiser ? await p.actions.actualiser(r.espace, prefixeReunion(reunion)) : await p.actions.lirePoints(r.espace, prefixeReunion(reunion));
    r.setLus(l);
    r.setCharge(true);
  };
  return (
    <FenetreReunion
      visible={p.visible}
      reunion={reunion}
      mode={anime ? 'organisateur' : 'participant'}
      fil={fil}
      onglets={onglets}
      ongletInitial={parcoursParDefaut(r.parcours)}
      onActualiser={actualiser}
      onFermer={onFermer}
      direct={direct}
    />
  );
}

// ---------------------------------------------------------------------------
// Blocs communs
// ---------------------------------------------------------------------------
/** « Suivi · n » de la Situation : points concrétisés non finis, échanges en attente, points reportés */
export function BlocSuivi({ r, lecture, onAjouter }: { r: R; lecture: boolean; onAjouter?: boolean }) {
  const { e } = r;
  const [filtre, setFiltre] = useState<TypePoint | ''>('');
  const [ouvert, setOuvert] = useState(false);
  const suivisEquipe = calculerSuivis(r.serveur, e.h.items);
  const suivisEch = suivisSynchro(r.serveur, r.echanges);
  const passe = (t: TypePoint) => !filtre || t === filtre;
  const n = suivisEquipe.length + suivisEch.length + r.reportes.length;
  const nf = suivisEquipe.filter((x) => passe(x.point.type)).length + suivisEch.filter((x) => passe(x.point.type)).length + r.reportes.filter((x) => passe(x.type)).length;
  let k = 0;
  return (
    <SectionFiche
      titre={`Suivi · ${filtre ? `${nf} sur ` : ''}${n}`}
      droite={<PastilleFiltres actif={!!filtre} ouvert={ouvert} onPress={() => setOuvert((o) => !o)} />}
      entete={ouvert && <FiltresType types={['blocage', 'decision', 'action']} value={filtre} onChange={setFiltre} />}
    >
      {suivisEquipe.filter((x) => passe(x.point.type)).map(({ point, tache }) => (
        <Ligne
          key={point.id}
          premiere={k++ === 0}
          texte={tache.titre}
          sous={`${LIBELLE_CONCRETISATION[point.concretisation]} · 👤 ${prenom(e.nomDe(point.responsable || point.personne))} · ${tache.statut === 'en_cours' ? 'en cours' : 'à faire'}`}
          pastille={{ ...pastilleSuivi(point, e.jour), ton: tonType(point.type) }}
        />
      ))}
      {suivisEch.filter((x) => passe(x.point.type)).map(({ point, echange }) => (
        <Ligne
          key={point.id}
          premiere={k++ === 0}
          texte={point.texte}
          sous={`${LIBELLE_CONCRETISATION[point.concretisation]} · 👤 ${prenom(e.nomDe(echange.a))} · ${echange.statut === 'repondu' ? 'répondu' : 'en attente'}`}
          pastille={{ ...pastilleSuivi(point, e.jour), ton: tonType(point.type) }}
        />
      ))}
      {r.reportes.filter((x) => passe(x.type)).map((point) => (
        <Ligne key={point.id} premiere={k++ === 0} texte={point.texte} sous={`${point.type === 'decision' ? 'réponse' : 'escalade reçue'} · à concrétiser`} pastille={{ ...pastilleSuivi(point, e.jour), ton: tonType(point.type) }} />
      ))}
      {!n && <Vide texte="✓ Rien en attente des réunions précédentes." />}
      {onAjouter && r.anime && !lecture && (
        <SaisiePoint
          types={['blocage', 'decision', 'action']}
          typeDefaut="action"
          titre="Nouveau point de suivi"
          jour={e.jour}
          placeholder="＋ Point de suivi oublié"
          stories={e.situation.cartes}
          concretiser={{ personnes: e.personnes.map((y) => ({ value: y.email.toLowerCase(), label: y.nom })), respDefaut: r.mail }}
          onAjouter={(type, texte, element, conc) => {
            const pt = r.noter({ personne: r.mail, type, texte, element });
            if (conc) r.poserChoix(pt.id, { c: conc.c, resp: conc.resp });
          }}
        />
      )}
    </SectionFiche>
  );
}

/**
 * « Points notés · n » (ou « Mes points »), filtre « Filtres ▾ » à côté du titre, « ＋ … » qui ouvre une seule
 * fenêtre (type, story préremplie, texte). `qui` : la personne dont on note les points (sinon : vous, en préparation).
 */
export function BlocPoints({
  r,
  titre = 'Points notés',
  points,
  lecture,
  element = '',
  stories,
  placeholder = '＋ Blocage, décision ou action',
  pourPrep,
  onglet = 'membre',
}: {
  r: R;
  titre?: string;
  points: PointReunion[];
  lecture?: boolean;
  /** Élément en cours (story affichée) : prérempli dans la fenêtre */
  element?: string;
  stories?: Item[];
  placeholder?: string;
  /** Points de votre préparation (sinon : notés en séance par l'animateur) */
  pourPrep?: boolean;
  onglet?: Onglet;
}) {
  const { e } = r;
  const [filtre, setFiltre] = useState<TypePoint | ''>('');
  const [ouvert, setOuvert] = useState(false);
  const liste = points.filter((y) => !estTechnique(y) && y.type !== 'hier' && y.type !== 'aujourdhui');
  const vus = liste.filter((y) => !filtre || y.type === filtre);
  return (
    <SectionFiche
      titre={`${titre} · ${filtre ? `${vus.length} sur ${liste.length}` : liste.length}`}
      droite={<PastilleFiltres actif={!!filtre} ouvert={ouvert} onPress={() => setOuvert((o) => !o)} />}
      entete={ouvert && <FiltresType types={['blocage', 'decision', 'action']} value={filtre} onChange={setFiltre} />}
    >
      {vus.map((y, i) => {
        const par = y.auteur === r.mail && !pourPrep && r.anime ? 'par le SM' : `par ${prenom(e.nomDe(y.personne))}`;
        const s = y.element ? e.parId.get(y.element)?.titre : '';
        return (
          <Ligne
            key={y.id}
            premiere={i === 0}
            texte={y.texte}
            sous={[par, s ? `sur 📖 ${s}` : ''].filter(Boolean).join(' · ')}
            pastille={{ texte: LIBELLE_TYPE_POINT[y.type], ton: tonType(y.type) }}
            onRetirer={!lecture && y.id.startsWith('local-') ? () => r.retirerNote(y.id) : undefined}
          />
        );
      })}
      {lecture ? (
        !vus.length && <Vide texte="Rien de noté pour l’instant." />
      ) : (
        <SaisiePoint
          key={filtre || 'tous'}
          premiere={!vus.length}
          types={['blocage', 'decision', 'action']}
          typeDefaut={filtre || 'blocage'}
          titre={filtre ? TITRE_TYPE[filtre] : undefined}
          jour={e.jour}
          placeholder={placeholder}
          stories={stories ?? e.situation.cartes}
          elementDefaut={element}
          onAjouter={(type, texte, el) => (pourPrep ? r.ajouterPrep(type, texte, el, onglet) : void r.noter({ personne: r.mail, type, texte, element: el }))}
        />
      )}
    </SectionFiche>
  );
}

/** Questions de l'équipe au PO (même liste qu'au daily) : il répond avec les choix de l'échange */
export function QuestionsEquipe({ r }: { r: R }) {
  const { e } = r;
  const notees = new Set(r.reponsesPO.map((x) => x.q.id));
  return (
    <>
      <TitreFiche icone="❓" titre={`Questions de l’équipe · ${r.questions.length}`} vide="" sous="Questions de l’équipe (💬 Chat), encore sans réponse ; votre réponse part dans leur message et devient une décision" />
      {!r.questions.length && (
        <SectionFiche titre="Questions · 0">
          <Vide texte="✓ Aucune question de l’équipe en attente." />
        </SectionFiche>
      )}
      {r.questions.map((q) => {
        const repondu = q.statut === 'repondu';
        const rep = r.reponses[q.id] ?? { c: '', note: '' };
        const poser = (y: Partial<typeof rep>) => r.setReponses((mm) => ({ ...mm, [q.id]: { ...rep, ...y } }));
        const choixQ = q.choix.split(';').map((c) => c.trim()).filter(Boolean);
        const s = q.element ? e.parId.get(q.element)?.titre : '';
        return (
          <View key={q.id} style={st.carteConcret}>
            <View style={st.ligneHaut}>
              <View style={st.corps}>
                <Text style={st.texte}>{q.titre.replace(/^Blocage · /, '').replace(/^↪ /, '')}</Text>
                <Text style={st.sous}>{[`De ${prenom(e.nomDe(q.de))}`, q.transmis_par ? `transmis par ${prenom(e.nomDe(q.transmis_par))}` : '', s ? `sur 📖 ${s}` : ''].filter(Boolean).join(' · ')}</Text>
              </View>
              <Pastille {...(repondu ? { texte: 'Répondu', ton: 'vert' as const } : { texte: 'Blocage', ton: 'rouge' as const })} />
            </View>
            {repondu ? (
              <Text style={st.sous}>↳ {estAutre(q.reponse) ? q.note : [q.reponse, q.note].filter(Boolean).join(' — ')}</Text>
            ) : (
              <>
                <Pastilles options={choixQ.map((c) => ({ value: c, label: c }))} value={rep.c} onChange={(v) => poser({ c: v })} />
                {!!rep.c && (
                  <TextInput value={rep.note} onChangeText={(v) => poser({ note: v })} placeholder={placeholderNote(rep.c)} placeholderTextColor={colors.muted} style={st.note} accessibilityLabel={placeholderNote(rep.c)} />
                )}
                {notees.has(q.id) && <Text style={st.sous}>✓ Partira dans le message à l’envoi, notée comme décision</Text>}
              </>
            )}
          </View>
        );
      })}
    </>
  );
}

/** Concrétisation (4 écrans, partout) : un bouton « Concrétiser › » par point ; feuilles Concrétiser et Responsable */
export function EtapeConcretisation({ r, lecture, iterationCode }: { r: R; lecture: boolean; iterationCode: string }) {
  const { e } = r;
  const [feuille, setFeuille] = useState<{ id: string; etape: 'quoi' | 'responsable' } | null>(null);
  const resume = (c: Concretisation | '', resp: string, a: string) =>
    c === 'sous_tache' || c === 'tache'
      ? `${c === 'sous_tache' ? 'Sous-tâche' : `Tâche à part (${iterationCode})`} · 👤 ${prenom(e.nomDe(resp))}`
      : c === 'synchro'
        ? `Transmettre à ${a ? prenom(e.nomDe(a)) : '…'}`
        : c === 'escalade'
          ? `⤴ Escalader aux ${a && a === e.pm?.email?.toLowerCase() ? 'PO' : 'SM'} du train`
          : 'Rien';
  const liste = lecture ? r.serveur.filter((y) => r.ici(y) && aConcretiser(y)) : r.aDecider;
  return (
    <>
      <TitreFiche icone="🛠️" titre="Concrétisation" vide="" sous={lecture ? 'Choix de l’animateur' : `${pluriel(liste.length, 'point')} · touchez « Concrétiser › »`} />
      {!liste.length && <Vide texte="Aucun blocage, décision ou action noté." />}
      {liste.map((pt) => {
        const s = pt.element ? e.parId.get(pt.element) : undefined;
        if (lecture)
          return (
            <View key={pt.id} style={st.carteConcret}>
              <View style={st.ligneHaut}>
                <View style={st.corps}>
                  <Text style={st.texte}>{pt.texte}</Text>
                  <Text style={st.sous}>{`par ${prenom(e.nomDe(pt.personne))}${s ? ` · sur 📖 ${s.titre}` : ''}`}</Text>
                </View>
                <Pastille texte={LIBELLE_TYPE_POINT[pt.type]} ton={tonType(pt.type)} />
              </View>
              <Text style={[st.choixLecture, !pt.concretisation && st.choixADecider]}>{pt.concretisation ? `→ ${resume(pt.concretisation, pt.responsable || pt.personne, pt.responsable)}` : 'À décider'}</Text>
            </View>
          );
        const { c, resp, a } = r.choixDe(pt);
        const choisi = !!r.choix[pt.id]?.c;
        const res = resume(c, resp, a);
        return (
          <View key={pt.id} style={st.carteConcret}>
            <View style={st.ligneHaut}>
              <View style={st.corps}>
                <Text style={st.texte}>{pt.texte}</Text>
                <Text style={st.sous}>{`par ${prenom(e.nomDe(pt.personne))}${s ? ` · sur 📖 ${s.titre}` : ''}`}</Text>
              </View>
              <Pastille texte={LIBELLE_TYPE_POINT[pt.type]} ton={tonType(pt.type)} />
            </View>
            <Pressable onPress={() => setFeuille({ id: pt.id, etape: 'quoi' })} style={[st.boutonSynchro, choisi && st.boutonSynchroChoisi]} accessibilityRole="button">
              <Text style={[st.boutonSynchroTexte, choisi && st.boutonSynchroTexteChoisi]} numberOfLines={1}>
                {choisi ? `${res} ›` : 'Concrétiser ›'}
              </Text>
            </Pressable>
            {!choisi && <Text style={st.sous}>Par défaut : {res.charAt(0).toLowerCase() + res.slice(1)}</Text>}
          </View>
        );
      })}
      {feuille &&
        (() => {
          const pt = r.aDecider.find((x) => x.id === feuille.id);
          if (!pt) return null;
          const { c, resp, a } = r.choixDe(pt);
          if (feuille.etape === 'responsable')
            return (
              <FeuilleChoix
                titre="Responsable"
                value={resp}
                groupes={[{ options: e.personnes.map((y) => ({ value: y.email.toLowerCase(), label: y.nom, meta: e.role(y.id) === 'Membre' ? '' : e.role(y.id) })) }]}
                onChoisir={(v) => {
                  if (v) r.poserChoix(pt.id, { resp: v });
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
                    ...(pt.element ? [{ value: 'c:sous_tache', label: 'Sous-tâche de la story', meta: e.parId.get(pt.element)?.titre }] : []),
                    { value: 'c:tache', label: `Tâche à part (${iterationCode})` },
                    { value: 'c:rien', label: 'Rien', meta: 'noté seulement' },
                  ],
                },
                ...(pt.type === 'blocage'
                  ? [
                      ...destinatairesTransfert(r.mail, null, r.org, [r.mail, pt.personne]).map((g) => ({
                        titre: `Transmettre à · ${g.titre}`,
                        options: g.emails.map((x) => ({ value: `t:${x}`, label: e.nomDe(x) })),
                      })),
                      ...(e.rte?.email || e.pm?.email
                        ? [
                            {
                              titre: 'Escalader',
                              options: [
                                ...(e.rte?.email ? [{ value: `e:${e.rte.email.toLowerCase()}`, label: '⤴ Aux SM du train', meta: `obstacle, organisation · ${e.rte.nom} (RTE)` }] : []),
                                ...(e.pm?.email ? [{ value: `e:${e.pm.email.toLowerCase()}`, label: '⤴ Aux PO du train', meta: `contenu, priorité · ${e.pm.nom} (PM)` }] : []),
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
                  r.poserChoix(pt.id, { c: 'synchro', a: v.slice(2) });
                  return setFeuille(null);
                }
                if (v.startsWith('e:')) {
                  r.poserChoix(pt.id, { c: 'escalade', a: v.slice(2) });
                  return setFeuille(null);
                }
                const cc = v.slice(2) as Concretisation;
                r.poserChoix(pt.id, { c: cc });
                setFeuille(cc === 'sous_tache' || cc === 'tache' ? { id: pt.id, etape: 'responsable' } : null);
              }}
              onFermer={() => setFeuille(null)}
            />
          );
        })()}
      {!lecture && (
        <SectionFiche titre="Point oublié">
          <SaisiePoint
            premiere
            types={['blocage', 'decision', 'action']}
            typeDefaut="blocage"
            titre="Nouveau point oublié"
            jour={e.jour}
            placeholder="＋ Blocage, décision ou action oublié"
            stories={e.situation.cartes}
            onAjouter={(type, texte, element) => void r.noter({ personne: r.mail, type, texte, element })}
          />
        </SectionFiche>
      )}
    </>
  );
}

/**
 * Compte rendu : `entete` (le résumé propre à la réunion : engagé, acceptées, idées…), puis Créé, Escaladé, Transmis,
 * Noté seulement ; en lecture seule pour une réunion de la série (`reunionId`), d'après le Sheet.
 */
export function EtapeCompteRendu({ r, lecture, reunionId, entete, iterationCode }: { r: R; lecture: boolean; reunionId?: string; entete?: React.ReactNode; iterationCode: string }) {
  const { e } = r;
  const id = reunionId ?? r.reunionId;
  const decides = lecture
    ? r.serveur
        .filter((y) => y.reunion === id && aConcretiser(y) && !!y.concretisation)
        .map((pt) => ({ pt, c: pt.concretisation as Concretisation, resp: pt.responsable || pt.personne, a: pt.responsable }))
    : r.aDecider.map((pt) => ({ pt, ...r.choixDe(pt) }));
  const crees = decides.filter((d) => d.c === 'sous_tache' || d.c === 'tache');
  const escalades = decides.filter((d) => d.c === 'escalade');
  const synchros = decides.filter((d) => d.c === 'synchro');
  const notes = decides.filter((d) => d.c === 'rien');
  const dest = e.rte?.email ? `${e.rte.nom} (RTE du train ${e.train?.nom ?? ''})` : '';
  return (
    <>
      <TitreFiche
        icone="📨"
        titre={lecture ? `Compte rendu du ${dateCourte(id.slice(-10))}` : 'Compte rendu'}
        vide=""
        sous={lecture ? `Lecture seule${dest ? ` · envoyé à ${dest}` : ''}` : dest ? `Envoyé à ${dest}` : 'Pas de train ni de RTE : les tâches sont créées, le compte rendu n’est envoyé à personne.'}
      />
      {entete}
      <SectionFiche titre={`Créé · ${crees.length}`}>
        {crees.length ? (
          crees.map((d, i) => (
            <Ligne
              key={d.pt.id}
              premiere={i === 0}
              texte={d.pt.texte}
              sous={`${d.c === 'sous_tache' ? `Sous-tâche de 📖 ${e.parId.get(d.pt.element)?.titre ?? 'la story'}` : `Tâche à part · ${iterationCode}`} · 👤 ${prenom(e.nomDe(d.resp))}`}
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
            <Ligne key={d.pt.id} premiere={i === 0} texte={d.pt.texte} sous={`⤴ ${d.a && d.a === e.pm?.email?.toLowerCase() ? `PO du train · ${e.pm?.nom}` : `SM du train · ${e.rte?.nom ?? 'RTE'}`}`} pastille={{ texte: 'Blocage', ton: 'rouge' }} />
          ))}
        </SectionFiche>
      )}
      {synchros.length > 0 && (
        <SectionFiche titre={`Transmis · ${synchros.length}`}>
          {synchros.map((d, i) => (
            <Ligne key={d.pt.id} premiere={i === 0} texte={d.pt.texte} sous={`${prenom(e.nomDe(d.pt.personne))} → ${prenom(e.nomDe(d.a))} · message envoyé`} pastille={{ texte: 'Blocage', ton: 'rouge' }} />
          ))}
        </SectionFiche>
      )}
      <SectionFiche titre={`Noté seulement · ${notes.length}`}>
        {notes.length ? notes.map((d, i) => <Ligne key={d.pt.id} premiere={i === 0} texte={d.pt.texte} sous={`par ${prenom(e.nomDe(d.pt.personne))}`} pastille={{ texte: LIBELLE_TYPE_POINT[d.pt.type], ton: 'gris' }} />) : <Vide texte="Rien." />}
      </SectionFiche>
    </>
  );
}

/** Compteurs en tête d'une étape */
export function Compteurs({ l }: { l: { valeur: string; libelle: string; ton?: 'rouge' | 'orange' | 'vert' }[] }) {
  return (
    <View style={st.compteurs}>
      {l.map((x) => (
        <Compteur key={x.libelle} valeur={x.valeur} libelle={x.libelle} ton={x.ton} />
      ))}
    </View>
  );
}
