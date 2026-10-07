import { addDays, toDateString } from './dates';
import { lireNiveau } from './echange/hierarchieEchange';
import { calendrierEquipe, membresDe, type OrgValue } from './organisation';
import { type Calendrier, calendrierCourant, lireCalendrier } from './pi';
import { occurrences, type SerieReunion, type UniteSerie } from './series';
import { type RepetitionReunion, type Reunion, type TypeReunion, TYPES_REUNION } from './types';

/**
 * Réunions SAFe et agiles (lot 6) : pour l'instant **calculées, pas enregistrées**. Chacun voit les réunions de ses
 * rôles dans l'Organisation, d'après la cadence SAFe (src/pi.ts : un PI = un trimestre, 6 itérations de 14 jours
 * puis la semaine IP) :
 * - équipe (membre, SM ou PO) : daily chaque jour ouvré (9:30), planification au 1er jour de l'itération, affinage
 *   au milieu, revue et rétrospective au dernier jour (pas pendant la semaine IP) ; dans un train, la planification
 *   de l'IT1 se fait dans le PI Planning ;
 * - train : ART sync chaque semaine (mercredi) pour le RTE, le PM, les SM et les PO ; System demo à la fin de chaque
 *   itération, PI Planning au début du PI et Inspect & Adapt à la fin, pour tout le train ;
 * - portfolio (Epic Owner, RTE et PM de ses trains) : revue du portfolio chaque mois (1er mardi), revue des OKR
 *   chaque trimestre (dernier jour du PI, après l'Inspect & Adapt).
 * Mode Simple (seul, sans compte rendu) : point perso chaque matin, bilan du soir, revue de la semaine (lundi), revue
 * des objectifs (1er du mois).
 * Un jour ouvré = du lundi au vendredi ; une échéance qui tombe un week-end passe au jour ouvré le plus proche dans
 * la période (début : le suivant ; fin : le précédent).
 */

const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const ouvre = (d: Date) => d.getDay() >= 1 && d.getDay() <= 5;
/** Premier jour ouvré à partir de `s` */
const premierOuvre = (s: string | Date) => {
  let d = typeof s === 'string' ? parse(s) : s;
  while (!ouvre(d)) d = addDays(d, 1);
  return toDateString(d);
};
/** Dernier jour ouvré jusqu'à `s` */
const dernierOuvre = (s: string | Date) => {
  let d = typeof s === 'string' ? parse(s) : s;
  while (!ouvre(d)) d = addDays(d, -1);
  return toDateString(d);
};

/** Heure de début et répétition de chaque type */
const CADENCE: Record<TypeReunion, { heure: string; repetition: RepetitionReunion }> = {
  daily: { heure: '09:30', repetition: 'quotidienne' },
  planification: { heure: '10:00', repetition: 'iteration' },
  affinage: { heure: '14:00', repetition: 'iteration' },
  revue: { heure: '14:00', repetition: 'iteration' },
  retro: { heure: '15:30', repetition: 'iteration' },
  art_sync: { heure: '10:30', repetition: 'hebdomadaire' },
  system_demo: { heure: '11:00', repetition: 'iteration' },
  pi_planning: { heure: '09:00', repetition: 'pi' },
  inspect_adapt: { heure: '09:00', repetition: 'pi' },
  revue_portfolio: { heure: '10:00', repetition: 'mensuelle' },
  revue_okr: { heure: '14:00', repetition: 'trimestrielle' },
  affinage_train: { heure: '11:00', repetition: 'iteration' },
  prepa_pi: { heure: '14:00', repetition: 'pi' },
  sync_portfolio: { heure: '11:00', repetition: 'iteration' },
  budget: { heure: '09:00', repetition: 'pi' },
  iteration_ip: { heure: '10:00', repetition: 'pi' },
  point_perso: { heure: '08:30', repetition: 'quotidienne' },
  bilan_soir: { heure: '18:30', repetition: 'quotidienne' },
  revue_semaine: { heure: '08:00', repetition: 'hebdomadaire' },
  revue_objectifs: { heure: '09:00', repetition: 'mensuelle' },
  revue_trimestre: { heure: '09:30', repetition: 'trimestrielle' },
  point_annuel: { heure: '10:00', repetition: 'annuelle' },
  reunion: { heure: '10:00', repetition: 'hebdomadaire' },
};

/** Règle par défaut de chaque type (07/10 : séries de réunions, modifiables dans l'onglet Reunions) */
export const REGLES: Record<TypeReunion, Pick<SerieReunion, 'unite'> & Partial<SerieReunion>> = {
  daily: { unite: 'jour', jours: 'ouvres' },
  planification: { unite: 'sprint', ancre: 'debut' },
  affinage: { unite: 'sprint', ancre: 'milieu' },
  revue: { unite: 'sprint', ancre: 'fin' },
  retro: { unite: 'sprint', ancre: 'fin' },
  pi_planning: { unite: 'pi', ancre: 'debut' },
  art_sync: { unite: 'semaine', jours: '3', sauf: 'debut_pi;fin_pi' },
  system_demo: { unite: 'sprint', ancre: 'fin' },
  inspect_adapt: { unite: 'pi', ancre: 'fin' },
  revue_portfolio: { unite: 'mois', ancre: 'debut', jours: '2' },
  revue_okr: { unite: 'pi', ancre: 'fin' },
  affinage_train: { unite: 'sprint', ancre: 'milieu' },
  prepa_pi: { unite: 'pi', ancre: 'ip' },
  sync_portfolio: { unite: 'sprint', ancre: 'milieu' },
  // Budget participatif : chaque semestre (un PI sur deux, à partir de celui de janvier)
  budget: { unite: 'pi', ancre: 'debut', tous: '2', debut: '2026-01-15' },
  iteration_ip: { unite: 'pi', ancre: 'ip' },
  point_perso: { unite: 'jour' },
  bilan_soir: { unite: 'jour' },
  revue_semaine: { unite: 'semaine', jours: '1' },
  revue_objectifs: { unite: 'mois', ancre: 'debut', sauf: 'trimestre' },
  revue_trimestre: { unite: 'trimestre', ancre: 'debut', sauf: 'annee' },
  point_annuel: { unite: 'annee', ancre: 'debut' },
  reunion: { unite: 'semaine', jours: '1' },
};
const REPETITION: Record<UniteSerie, RepetitionReunion> = { jour: 'quotidienne', semaine: 'hebdomadaire', mois: 'mensuelle', trimestre: 'trimestrielle', annee: 'annuelle', sprint: 'iteration', pi: 'pi' };

/** Série vierge (tous les champs), avec `x` */
export function serieVide(x: Partial<SerieReunion> & Pick<SerieReunion, 'id'>): SerieReunion {
  return { type_reunion: '', titre: '', niveau: '', unite: 'semaine', ancre: '', ecart: '', jours: '', tous: '', sauf: '', heure: '09:00', duree: '30', animateur: '', editeurs: '', participants: '', debut: '', fin: '', exceptions: '', actif: '', cree_le: '', modifie_le: '', ...x };
}
/** Série par défaut d'un type à un niveau (id : « type-niveau », ou « type-perso ») */
export function serieParDefaut(type: TypeReunion, niveau: string, sauf: string[] = [], espace?: string): SerieReunion {
  const r = REGLES[type];
  return serieVide({
    espace,
    id: `${type}-${niveau || 'perso'}`,
    type_reunion: type,
    titre: '',
    niveau,
    ...r,
    sauf: [...(r.sauf ? r.sauf.split(';') : []), ...sauf].filter((x, i, l) => l.indexOf(x) === i).join(';'),
    heure: CADENCE[type].heure,
    duree: String(TYPES_REUNION[type].duree),
  });
}

/** Une série à afficher : la série, son espace, l'animateur d'après le rôle et le calendrier de son niveau */
export interface SerieVue {
  serie: SerieReunion;
  type: TypeReunion;
  /** Animateur d'après l'Organisation (si la série n'en choisit pas) */
  orgaDefaut: string;
  cal: Calendrier;
  /** Série d'après l'Organisation (pas encore enregistrée) */
  defaut: boolean;
}

/**
 * Séries de `moi` (e-mail) : d'après vos rôles dans l'Organisation (mode SAFe) ou les rituels personnels (mode
 * Simple), remplacées par leur version enregistrée (onglet Reunions) quand elle existe ; plus les 📅 réunions libres
 * où vous êtes (animateur, participant, peut modifier, ou à votre niveau).
 */
export function seriesDe(org: OrgValue, moi: string, safeActif: boolean, stockees: SerieReunion[] = []): SerieVue[] {
  const mail = moi.toLowerCase();
  const emailDe = (pid: string) => org.personne.get(pid)?.email?.toLowerCase() ?? '';
  const cals = new Map<string, Calendrier>();
  const calDe = (json: string) => {
    if (!json) return calendrierCourant();
    if (!cals.has(json)) cals.set(json, lireCalendrier(json));
    return cals.get(json)!;
  };
  const defauts: SerieVue[] = [];
  const ajouter = (type: TypeReunion, niveau: string, orga: string, espace: string | undefined, cal: Calendrier, sauf: string[] = []) =>
    defauts.push({ serie: serieParDefaut(type, niveau, sauf, espace), type, orgaDefaut: orga, cal, defaut: true });
  const niveaux = new Set<string>();

  if (!safeActif) {
    for (const t of ['point_perso', 'revue_semaine', 'revue_objectifs', 'revue_trimestre', 'point_annuel', 'bilan_soir'] as TypeReunion[]) ajouter(t, '', mail, 'moi', calendrierCourant());
    niveaux.add('');
  } else {
    // Vous : toutes vos fiches de personne (une par entreprise ou espace Équipe), d'après votre e-mail
    const moiIds = new Set(org.personnes.filter((p) => !!mail && p.email?.toLowerCase() === mail).map((p) => p.id));
    const est = (id: string) => !!id && moiIds.has(id);
    // Vos équipes (membre, SM ou PO), vos trains, vos portfolios
    const equipes = org.equipes.filter((e) => est(e.sm) || est(e.po) || membresDe(e).some(est));
    const pilote = (t: { id: string; rte: string; pm: string }) => est(t.rte) || est(t.pm);
    const trainsSync = org.trains.filter((t) => pilote(t) || equipes.some((e) => e.train === t.id && (est(e.sm) || est(e.po))));
    const trainsTous = org.trains.filter((t) => pilote(t) || equipes.some((e) => e.train === t.id));
    const portfolios = org.portfolios.filter((p) => est(p.epic_owner) || org.trains.some((t) => t.portfolio === p.id && pilote(t)));
    // Organisateur d'après le rôle ; à défaut, l'autre pilote de l'équipe (SM ↔ PO) ou du train (RTE ↔ PM)
    const orgaEquipe = (e: { sm: string; po: string }) => emailDe(e.sm || e.po);
    const orgaTrain = (t: { rte: string; pm: string }, role: 'rte' | 'pm') => emailDe(role === 'rte' ? t.rte || t.pm : t.pm || t.rte);
    const pourEquipe = (e: (typeof org.equipes)[number], types: TypeReunion[]) => {
      const niveau = `equipeagile:${e.id}`;
      niveaux.add(niveau);
      // Dans un train : le jour du PI Planning, le train planifie ensemble (ni daily ni réunion d'équipe) ; la
      // planification du 1er sprint se fait dans le PI Planning
      const enTrain = !!e.train && org.train.has(e.train);
      const cal = calDe(calendrierEquipe(org, e));
      for (const t of types) ajouter(t, niveau, orgaEquipe(e), e.espace, cal, enTrain ? (t === 'planification' ? ['debut_pi', 'sprint1'] : ['debut_pi']) : []);
    };
    for (const e of equipes) pourEquipe(e, ['daily', 'planification', 'affinage', 'revue', 'retro']);
    // Revue de sprint : le PM du train y est invité comme partie prenante (ses retours), pour chaque équipe du train
    for (const t of org.trains.filter((x) => est(x.pm))) for (const e of org.equipes.filter((x) => x.train === t.id && !equipes.includes(x))) pourEquipe(e, ['revue']);
    for (const t of trainsTous) {
      const niveau = `train:${t.id}`;
      niveaux.add(niveau);
      const cal = calDe(t.calendrier?.trim() ?? '');
      ajouter('pi_planning', niveau, orgaTrain(t, 'rte'), t.espace, cal);
      ajouter('system_demo', niveau, orgaTrain(t, 'pm'), t.espace, cal);
      ajouter('inspect_adapt', niveau, orgaTrain(t, 'rte'), t.espace, cal);
      ajouter('iteration_ip', niveau, orgaTrain(t, 'rte'), t.espace, cal);
      if (trainsSync.includes(t)) {
        ajouter('art_sync', niveau, orgaTrain(t, 'rte'), t.espace, cal);
        // Affinage du backlog du train (PM, avec les PO) au milieu de chaque sprint ; IP : préparation du PI
        ajouter('affinage_train', niveau, orgaTrain(t, 'pm'), t.espace, cal);
        ajouter('prepa_pi', niveau, orgaTrain(t, 'rte'), t.espace, cal);
      }
    }
    for (const p of portfolios) {
      const niveau = `portfolio:${p.id}`;
      niveaux.add(niveau);
      const orga = emailDe(p.epic_owner);
      for (const t of ['revue_portfolio', 'revue_okr', 'sync_portfolio', 'budget'] as TypeReunion[]) ajouter(t, niveau, orga, p.espace, calendrierCourant());
    }
  }

  // Versions enregistrées : la série elle-même, et ses morceaux « celle-ci et les suivantes » (id~date)
  const out: SerieVue[] = [];
  const prises = new Set<string>();
  for (const d of defauts) {
    const l = stockees.filter((x) => x.id === d.serie.id || x.id.startsWith(`${d.serie.id}~`));
    if (!l.length) out.push(d);
    for (const x of l) {
      prises.add(x.id);
      out.push({ ...d, serie: { ...x, espace: x.espace ?? d.serie.espace }, defaut: false });
    }
  }
  // 📅 Réunions libres (et séries d'autres niveaux que vous animez ou pouvez modifier)
  const dans = (liste: string) => liste.toLowerCase().split(';').map((x) => x.trim()).includes(mail);
  for (const x of stockees) {
    if (prises.has(x.id) || x.actif === 'non') continue;
    const type = (x.type_reunion && x.type_reunion in TYPES_REUNION ? x.type_reunion : 'reunion') as TypeReunion;
    if (type !== 'reunion' && !safeActif) continue;
    const moiDedans = (!!mail && x.animateur.toLowerCase() === mail) || dans(x.participants) || dans(x.editeurs) || (type === 'reunion' && !!x.niveau && niveaux.has(x.niveau));
    if (!moiDedans) continue;
    const n = lireNiveau(x.niveau);
    const cal =
      n?.kind === 'equipeagile' ? calDe(calendrierEquipe(org, org.equipe.get(n.id))) : n?.kind === 'train' ? calDe(org.train.get(n.id)?.calendrier?.trim() ?? '') : calendrierCourant();
    out.push({ serie: x, type, orgaDefaut: x.animateur.toLowerCase() || mail, cal, defaut: false });
  }
  return out;
}

/** Préfixe des réunions d'une série (avant la date d'origine) : « daily-equipeagile:a1- », « reunion-r-xx- » */
export const prefixeSerie = (v: Pick<SerieVue, 'serie' | 'type'>) => (v.type === 'reunion' ? `reunion-${v.serie.id.split('~')[0]}-` : `${v.type}-${v.serie.niveau || 'perso'}-`);
/** Qui anime une série : celui qu'elle choisit, sinon d'après le rôle */
export const animateurSerie = (v: Pick<SerieVue, 'serie' | 'orgaDefaut'>) => v.serie.animateur.trim().toLowerCase() || v.orgaDefaut;
/** Peut modifier ou annuler la série et ses réunions : celui qui anime, et les personnes ajoutées */
export const peutModifierSerie = (v: Pick<SerieVue, 'serie' | 'orgaDefaut'>, moi: string) =>
  !!moi && (animateurSerie(v) === moi.toLowerCase() || v.serie.editeurs.toLowerCase().split(';').map((x) => x.trim()).includes(moi.toLowerCase()));

/** Réunions d'une série sur [de, de + jours[ (sans les annulées) */
export function reunionsDeSerie(v: SerieVue, de: string, jours: number): Reunion[] {
  const a = toDateString(addDays(parse(de), Math.max(0, jours - 1)));
  const t = TYPES_REUNION[v.type];
  const prefixe = prefixeSerie(v);
  return occurrences(v.serie, de, a, v.cal)
    .filter((o) => !o.annulee && o.debut.slice(0, 10) >= de && o.debut.slice(0, 10) <= a)
    .map((o) => ({
      espace: v.serie.espace,
      id: `${prefixe}${o.origine}`,
      type: v.type,
      titre: v.serie.titre.trim() || t.libelle,
      niveau: v.serie.niveau,
      organisateur: animateurSerie(v),
      debut: o.debut,
      duree_min: o.duree,
      repetition: REPETITION[v.serie.unite] ?? '',
      cree_le: v.serie.cree_le,
      modifie_le: v.serie.modifie_le,
      serie: v.serie.id,
      origine: o.origine,
      deplacee: o.deplacee || undefined,
      participants: v.type === 'reunion' && v.serie.participants ? v.serie.participants.split(';').map((x) => x.trim().toLowerCase()).filter(Boolean) : undefined,
    }));
}

/**
 * Réunions de `moi` (e-mail) du jour `aujourdhui` (AAAA-MM-JJ) inclus, sur `jours` jours, triées par début.
 * `safeActif` : réunions SAFe d'après les rôles de l'Organisation ; sinon les rituels personnels du mode Simple.
 * `stockees` : les séries enregistrées (onglet Reunions) des espaces affichés.
 */
export function reunionsAVenir(org: OrgValue, moi: string, aujourdhui: string, safeActif: boolean, jours = 92, stockees: SerieReunion[] = []): Reunion[] {
  return trier(seriesDe(org, moi, safeActif, stockees).flatMap((v) => reunionsDeSerie(v, aujourdhui, jours)));
}

/** Séries d'après l'Organisation pas encore enregistrées (mode SAFe), par espace : créées au démarrage, en une écriture par espace */
export function seriesACreer(org: OrgValue, moi: string, stockees: SerieReunion[]): Map<string, SerieReunion[]> {
  const m = new Map<string, SerieReunion[]>();
  for (const v of seriesDe(org, moi, true, stockees))
    if (v.defaut && v.serie.espace && v.serie.espace !== 'moi') m.set(v.serie.espace, [...(m.get(v.serie.espace) ?? []), v.serie]);
  return m;
}

const trier = (l: Reunion[]) => l.sort((a, b) => a.debut.localeCompare(b.debut) || a.titre.localeCompare(b.titre));

/**
 * Participants d'une réunion (ids de l'Organisation) : l'équipe (SM, PO, membres) ; pour l'ART sync, le RTE, le PM,
 * les SM et les PO du train ; pour les autres réunions du train, tout le train ; au portfolio, l'Epic Owner, les RTE et les PM de ses trains. Réunion personnelle : personne.
 */
export function participantsReunion(r: Pick<Reunion, 'type' | 'niveau'> & { participants?: string[]; organisateur?: string }, org: OrgValue): string[] {
  // 📅 Réunion libre avec ses participants (e-mails) : les personnes connues de l'Organisation, plus l'animateur
  if (r.participants?.length) {
    const mails = new Set([...r.participants, r.organisateur ?? ''].map((x) => x.toLowerCase()).filter(Boolean));
    return [...new Set(org.personnes.filter((p) => mails.has(p.email?.toLowerCase() ?? '')).map((p) => p.id))];
  }
  const n = lireNiveau(r.niveau);
  if (!n) return [];
  const ids: string[] = [];
  if (n.kind === 'equipeagile') {
    const e = org.equipe.get(n.id);
    if (e) ids.push(e.sm, e.po, ...membresDe(e));
    // Revue : le PM du train, partie prenante
    if (e && r.type === 'revue' && e.train) ids.push(org.train.get(e.train)?.pm ?? '');
  } else if (n.kind === 'train') {
    const t = org.train.get(n.id);
    if (t) {
      const eqs = org.equipes.filter((e) => e.train === t.id);
      ids.push(t.rte, t.pm, ...eqs.flatMap((e) => [e.sm, e.po]));
      if (r.type !== 'art_sync' && r.type !== 'affinage_train' && r.type !== 'prepa_pi') ids.push(...eqs.flatMap(membresDe));
    }
  } else if (n.kind === 'portfolio') {
    const p = org.portfolio.get(n.id);
    if (p) ids.push(p.epic_owner, ...org.trains.filter((t) => t.portfolio === p.id).flatMap((t) => [t.rte, t.pm]));
  }
  return [...new Set(ids.filter(Boolean))];
}

/** « 9:30 », « 14:00 » */
export const heureReunion = (r: Pick<Reunion, 'debut'>) => r.debut.slice(11).replace(/^0/, '');
/** « 15 min », « 2 h », « 1 h 30 » */
export function dureeReunion(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}

// ---------------------------------------------------------------------------
// Parcours d'une réunion selon les rôles de la personne (règle du 06/10 : parcours séparés)
// ---------------------------------------------------------------------------
/** Rôle dans une réunion : membre de l'équipe, Product Owner, Scrum Master (ou l'organisateur qui anime) */
export type RoleReunion = 'membre' | 'po' | 'sm';
export interface EtapeCatalogue {
  /** Clé stable de l'étape (choisit son contenu) */
  cle: string;
  nom: string;
}
/** Étapes d'une réunion par rôle */
export interface CatalogueParcours {
  membre: EtapeCatalogue[];
  po: EtapeCatalogue[];
  /** Clés des étapes du membre que le PO fait aussi quand il n'est pas membre de l'équipe (ses propres tâches) */
  poSansMembre?: string[];
  /** Étapes d'animation (Scrum Master, ou l'organisateur) */
  sm: EtapeCatalogue[];
}
/**
 * Parcours d'un rôle, dans son onglet : « Mon point » (membre), « PO », « Animer » (celui qui anime) ou « Suivre »
 * (le parcours du SM en lecture seule, pour le PO qui n'anime pas)
 */
export interface ParcoursRole {
  role: RoleReunion;
  /** Le parcours du SM en lecture seule : le PO suit, c'est le SM qui anime */
  lecture: boolean;
  etapes: EtapeCatalogue[];
}
export const LIBELLE_ROLE_REUNION: Record<RoleReunion, string> = { membre: 'membre', po: 'PO', sm: 'SM' };
/** Libellé de l'onglet d'un parcours : « Mon point », « PO », « Animer », « Suivre » */
export const ongletParcours = (p: Pick<ParcoursRole, 'role' | 'lecture'>) => (p.role === 'membre' ? 'Mon point' : p.role === 'po' ? 'PO' : p.lecture ? 'Suivre' : 'Animer');

/**
 * Parcours séparés (06/10) : chaque rôle de la personne a son propre parcours, dans son onglet, avec sa barre
 * d'étapes ; pas d'ordre imposé. Harmonisation (07/10) : plus d'étape « Prêt » (l'envoi se fait depuis la dernière
 * étape utile) ni d'onglet « Suivre » (remplacé par le bandeau « ● En direct » et l'onglet « Compte rendu · date »).
 * Les onglets, dans cet ordre :
 * - membre (s'il est membre) : ses étapes ;
 * - PO (s'il est PO) : ses étapes, précédées de celles du membre listées dans `poSansMembre` s'il n'est pas membre
 *   de l'équipe (ses propres tâches) ;
 * - SM : l'animation s'il anime (Scrum Master, ou organisateur).
 * Sans aucun rôle : membre.
 */
export function etapesParcours(roles: Partial<Record<RoleReunion, boolean>>, c: CatalogueParcours): ParcoursRole[] {
  const r = roles.membre || roles.po || roles.sm ? roles : { membre: true };
  const out: ParcoursRole[] = [];
  if (r.membre && c.membre.length) out.push({ role: 'membre', lecture: false, etapes: c.membre });
  if (r.po && c.po.length) out.push({ role: 'po', lecture: false, etapes: [...(r.membre ? [] : c.membre.filter((e) => c.poSansMembre?.includes(e.cle))), ...c.po] });
  if (r.sm) out.push({ role: 'sm', lecture: false, etapes: c.sm });
  // Le PO sans parcours propre (rétro) fait celui du membre
  if (!out.length) out.push({ role: 'membre', lecture: false, etapes: c.membre });
  return out;
}
/** Onglet ouvert par défaut : « Animer » pour celui qui anime, sinon le premier */
export const parcoursParDefaut = (l: Pick<ParcoursRole, 'role' | 'lecture'>[]) => Math.max(0, l.findIndex((p) => p.role === 'sm' && !p.lecture));

