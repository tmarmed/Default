import { addDays, toDateString } from './dates';
import { lireNiveau } from './echange/hierarchieEchange';
import { membresDe, type OrgValue } from './organisation';
import { iterationOf, piEnd, piOf, piStart } from './pi';
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
  point_perso: { heure: '08:30', repetition: 'quotidienne' },
  bilan_soir: { heure: '18:30', repetition: 'quotidienne' },
  revue_semaine: { heure: '08:00', repetition: 'hebdomadaire' },
  revue_objectifs: { heure: '09:00', repetition: 'mensuelle' },
};

/** Repères du calendrier SAFe d'un jour */
function reperes(jour: string) {
  const it = iterationOf(jour);
  const pi = piOf(jour);
  const sprint = it.code !== 'IP';
  const d = parse(jour);
  const debutPI = jour === premierOuvre(piStart(pi));
  return {
    ouvre: ouvre(d),
    debutIt: sprint && jour === premierOuvre(it.start),
    premiereIt: it.code === 'IT1',
    milieuIt: sprint && jour === premierOuvre(addDays(parse(it.start), 7)),
    finIt: sprint && jour === dernierOuvre(it.end),
    debutPI,
    finPI: jour === dernierOuvre(piEnd(pi)),
    // ART sync : chaque mercredi, sauf les jours du PI Planning et de l'Inspect & Adapt
    mercredi: d.getDay() === 3,
    // Revue du portfolio : 1er mardi du mois
    premierMardi: d.getDay() === 2 && d.getDate() <= 7,
    lundi: d.getDay() === 1,
    premierDuMois: d.getDate() === 1,
  };
}

/**
 * Réunions de `moi` (e-mail) du jour `aujourdhui` (AAAA-MM-JJ) inclus, sur `jours` jours, triées par début.
 * `safeActif` : réunions SAFe d'après les rôles de l'Organisation ; sinon les rituels personnels du mode Simple.
 */
export function reunionsAVenir(org: OrgValue, moi: string, aujourdhui: string, safeActif: boolean, jours = 92): Reunion[] {
  const out: Reunion[] = [];
  const mail = moi.toLowerCase();
  const emailDe = (pid: string) => org.personne.get(pid)?.email?.toLowerCase() ?? '';
  const ajouter = (type: TypeReunion, jour: string, niveau: string, organisateur: string, espace?: string) => {
    const c = CADENCE[type];
    const t = TYPES_REUNION[type];
    out.push({
      espace,
      id: `${type}-${niveau || 'perso'}-${jour}`,
      type,
      titre: t.libelle,
      niveau,
      organisateur,
      debut: `${jour}T${c.heure}`,
      duree_min: t.duree,
      repetition: c.repetition,
      cree_le: '',
      modifie_le: '',
    });
  };
  const listeJours = Array.from({ length: Math.max(0, jours) }, (_, k) => toDateString(addDays(parse(aujourdhui), k)));

  if (!safeActif) {
    for (const j of listeJours) {
      const r = reperes(j);
      ajouter('point_perso', j, '', mail, 'moi');
      if (r.lundi) ajouter('revue_semaine', j, '', mail, 'moi');
      if (r.premierDuMois) ajouter('revue_objectifs', j, '', mail, 'moi');
      ajouter('bilan_soir', j, '', mail, 'moi');
    }
    return trier(out);
  }

  // Vous : toutes vos fiches de personne (une par entreprise ou espace Équipe), d'après votre e-mail
  const moiIds = new Set(org.personnes.filter((p) => !!mail && p.email?.toLowerCase() === mail).map((p) => p.id));
  if (!moiIds.size) return [];
  const est = (id: string) => !!id && moiIds.has(id);
  // Vos équipes (membre, SM ou PO), vos trains, vos portfolios
  const equipes = org.equipes.filter((e) => est(e.sm) || est(e.po) || membresDe(e).some(est));
  const pilote = (t: { id: string; rte: string; pm: string }) => est(t.rte) || est(t.pm);
  const trainsSync = org.trains.filter((t) => pilote(t) || equipes.some((e) => e.train === t.id && (est(e.sm) || est(e.po))));
  const trainsTous = org.trains.filter((t) => pilote(t) || equipes.some((e) => e.train === t.id));
  const portfolios = org.portfolios.filter((p) => est(p.epic_owner) || org.trains.some((t) => t.portfolio === p.id && pilote(t)));
  // Organisateur d'après le rôle ; à défaut, l'autre pilote de l'équipe (SM ↔ PO) ou du train (RTE ↔ PM)
  const orgaEquipe = (e: { sm: string; po: string }, role: 'sm' | 'po') => emailDe(role === 'sm' ? e.sm || e.po : e.po || e.sm);
  const orgaTrain = (t: { rte: string; pm: string }, role: 'rte' | 'pm') => emailDe(role === 'rte' ? t.rte || t.pm : t.pm || t.rte);

  for (const j of listeJours) {
    const r = reperes(j);
    if (!r.ouvre) continue;
    for (const e of equipes) {
      const niveau = `equipeagile:${e.id}`;
      const enTrain = !!e.train && org.train.has(e.train);
      // Le jour du PI Planning, le train planifie ensemble (pas de daily ni de planification d'équipe)
      if (enTrain && r.debutPI) continue;
      ajouter('daily', j, niveau, orgaEquipe(e, 'sm'), e.espace);
      if (r.debutIt && !(enTrain && r.premiereIt)) ajouter('planification', j, niveau, orgaEquipe(e, 'sm'), e.espace);
      if (r.milieuIt) ajouter('affinage', j, niveau, orgaEquipe(e, 'po'), e.espace);
      if (r.finIt) {
        ajouter('revue', j, niveau, orgaEquipe(e, 'po'), e.espace);
        ajouter('retro', j, niveau, orgaEquipe(e, 'sm'), e.espace);
      }
    }
    for (const t of trainsTous) {
      const niveau = `train:${t.id}`;
      if (r.debutPI) ajouter('pi_planning', j, niveau, orgaTrain(t, 'rte'), t.espace);
      if (r.finIt) ajouter('system_demo', j, niveau, orgaTrain(t, 'pm'), t.espace);
      if (r.finPI) ajouter('inspect_adapt', j, niveau, orgaTrain(t, 'rte'), t.espace);
      if (r.mercredi && !r.debutPI && !r.finPI && trainsSync.includes(t)) ajouter('art_sync', j, niveau, orgaTrain(t, 'rte'), t.espace);
    }
    for (const p of portfolios) {
      const niveau = `portfolio:${p.id}`;
      const orga = emailDe(p.epic_owner);
      if (r.premierMardi) ajouter('revue_portfolio', j, niveau, orga, p.espace);
      if (r.finPI) ajouter('revue_okr', j, niveau, orga, p.espace);
    }
  }
  return trier(out);
}

const trier = (l: Reunion[]) => l.sort((a, b) => a.debut.localeCompare(b.debut) || a.titre.localeCompare(b.titre));

/**
 * Participants d'une réunion (ids de l'Organisation) : l'équipe (SM, PO, membres) ; pour l'ART sync, le RTE, le PM,
 * les SM et les PO du train ; pour les autres réunions du train, tout le train ; au portfolio, l'Epic Owner, les RTE et les PM de ses trains. Réunion personnelle : personne.
 */
export function participantsReunion(r: Pick<Reunion, 'type' | 'niveau'>, org: OrgValue): string[] {
  const n = lireNiveau(r.niveau);
  if (!n) return [];
  const ids: string[] = [];
  if (n.kind === 'equipeagile') {
    const e = org.equipe.get(n.id);
    if (e) ids.push(e.sm, e.po, ...membresDe(e));
  } else if (n.kind === 'train') {
    const t = org.train.get(n.id);
    if (t) {
      const eqs = org.equipes.filter((e) => e.train === t.id);
      ids.push(t.rte, t.pm, ...eqs.flatMap((e) => [e.sm, e.po]));
      if (r.type !== 'art_sync') ids.push(...eqs.flatMap(membresDe));
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
  /** Dernière étape d'un parcours de participant (« Prêt » : récapitulatif, envoi à l'organisateur) */
  fin: EtapeCatalogue;
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
 * Parcours séparés (06/10, remplace le parcours fusionné) : chaque rôle de la personne a son propre parcours, dans
 * son onglet, avec sa barre d'étapes et sa dernière étape ; pas d'ordre imposé. Les onglets, dans cet ordre :
 * - membre (s'il est membre) : ses étapes, puis `fin` (« Prêt ») ;
 * - PO (s'il est PO) : ses étapes, précédées de celles du membre listées dans `poSansMembre` s'il n'est pas membre
 *   de l'équipe (ses propres tâches), puis `fin` ;
 * - SM : l'animation s'il anime (Scrum Master, ou organisateur) ; sinon, pour le PO, le même parcours en lecture
 *   seule (« Suivre »).
 * Sans aucun rôle : membre.
 */
export function etapesParcours(roles: Partial<Record<RoleReunion, boolean>>, c: CatalogueParcours): ParcoursRole[] {
  const r = roles.membre || roles.po || roles.sm ? roles : { membre: true };
  const out: ParcoursRole[] = [];
  if (r.membre) out.push({ role: 'membre', lecture: false, etapes: [...c.membre, c.fin] });
  if (r.po) out.push({ role: 'po', lecture: false, etapes: [...(r.membre ? [] : c.membre.filter((e) => c.poSansMembre?.includes(e.cle))), ...c.po, c.fin] });
  if (r.sm) out.push({ role: 'sm', lecture: false, etapes: c.sm });
  else if (r.po) out.push({ role: 'sm', lecture: true, etapes: c.sm });
  return out;
}
/** Onglet ouvert par défaut : « Animer » pour celui qui anime, sinon le premier */
export const parcoursParDefaut = (l: Pick<ParcoursRole, 'role' | 'lecture'>[]) => Math.max(0, l.findIndex((p) => p.role === 'sm' && !p.lecture));

