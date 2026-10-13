/**
 * Rôles transverses (13/10, session 3 ; docs/regles-reunions.html, bloc 15) : des droits donnés à une personne en
 * dehors de son rôle principal, sur un niveau (équipe, train, portfolio, entreprise) et ceux du dessous.
 *
 * Rangés dans la colonne « transverses » de l'onglet du niveau (Unites, Portfolios, Trains, EquipesAgiles) :
 * « personne|rôle|du|au|remplacé », séparés par « ; ». Le Suppléant a les droits de la personne qu'il remplace, entre
 * deux dates. Le Coach agile n'existe qu'en SAFe.
 */
import { membresDe, type OrgValue } from './organisation';

export type RoleTransverse = 'coach' | 'controleur' | 'direction' | 'partie_prenante' | 'suppleant';
export type DroitTransverse = 'voir' | 'participer' | 'animer' | 'budget';

export const ROLES_TRANSVERSES: { v: RoleTransverse; l: string; sous: string; safeSeulement?: boolean }[] = [
  { v: 'coach', l: 'Coach agile', sous: 'Voit tout, participe aux réunions et peut les animer', safeSeulement: true },
  { v: 'controleur', l: 'Contrôleur de gestion', sous: 'Voit tout, gère le budget, participe aux réunions du budget' },
  { v: 'direction', l: 'Direction (lecture)', sous: 'Voit tout, ne modifie rien' },
  { v: 'partie_prenante', l: 'Partie prenante', sous: 'Voit tout, invitée aux revues et démos' },
  { v: 'suppleant', l: 'Suppléant', sous: 'Les droits de la personne remplacée, entre deux dates' },
];
export const libelleRole = (r: string) => ROLES_TRANSVERSES.find((x) => x.v === r)?.l ?? r;

export interface Transverse {
  personne: string;
  role: RoleTransverse;
  /** Suppléant : période (AAAA-MM-JJ, vides = sans limite) et personne remplacée */
  du: string;
  au: string;
  remplace: string;
}

export function lireTransverses(s: string | undefined): Transverse[] {
  return (s ?? '')
    .split(';')
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => {
      const [personne = '', role = '', du = '', au = '', remplace = ''] = x.split('|');
      return { personne, role: role as RoleTransverse, du, au, remplace };
    })
    .filter((t) => !!t.personne && ROLES_TRANSVERSES.some((r) => r.v === t.role));
}
export const ecrireTransverses = (l: Transverse[]) => l.map((t) => [t.personne, t.role, t.du, t.au, t.remplace].join('|').replace(/\|+$/, '')).join(';');

/** Droits de chaque rôle (le Suppléant : ceux de la personne remplacée, calculés à part) */
const DROITS: Record<Exclude<RoleTransverse, 'suppleant'>, DroitTransverse[]> = {
  coach: ['voir', 'participer', 'animer'],
  controleur: ['voir', 'participer', 'budget'],
  direction: ['voir'],
  partie_prenante: ['voir', 'participer'],
};
export const droitsDuRole = (r: RoleTransverse): DroitTransverse[] => (r === 'suppleant' ? [] : DROITS[r]);

/** Réunions où un rôle participe (Coach : toutes ; Contrôleur : celles du budget ; Partie prenante : revues et démos) */
const REUNIONS_BUDGET = ['budget', 'comite_budget', 'sync_portfolio', 'art_sync', 'revue_mois', 'trimestre_simple', 'bilan_annuel', 'annuel_entreprise'];
const REUNIONS_PARTIE_PRENANTE = ['revue', 'system_demo', 'revue_mois'];
export function participeA(role: RoleTransverse, type: string): boolean {
  if (role === 'coach') return true;
  if (role === 'controleur') return REUNIONS_BUDGET.includes(type);
  if (role === 'partie_prenante') return REUNIONS_PARTIE_PRENANTE.includes(type);
  return false;
}

type Niv = { kind: 'equipeagile' | 'train' | 'portfolio' | 'unite'; id: string };
const enCours = (t: Transverse, jour: string) => (!t.du || t.du <= jour) && (!t.au || t.au >= jour);

/** Niveau et ceux du dessus (un rôle donné sur un niveau vaut pour ceux du dessous) */
export function ascendants(n: Niv, org: OrgValue): Niv[] {
  const out: Niv[] = [n];
  let espace = '';
  if (n.kind === 'equipeagile') {
    const e = org.equipe.get(n.id);
    espace = e?.espace || 'moi';
    if (e?.train) out.push(...ascendants({ kind: 'train', id: e.train }, org));
    else for (const u of org.unites.filter((x) => !x.parent && (x.espace || 'moi') === espace)) out.push({ kind: 'unite', id: u.id });
  } else if (n.kind === 'train') {
    const t = org.train.get(n.id);
    espace = t?.espace || 'moi';
    if (t?.portfolio) out.push(...ascendants({ kind: 'portfolio', id: t.portfolio }, org));
    else for (const u of org.unites.filter((x) => !x.parent && (x.espace || 'moi') === espace)) out.push({ kind: 'unite', id: u.id });
  } else if (n.kind === 'portfolio') {
    espace = org.portfolio.get(n.id)?.espace || 'moi';
    for (const u of org.unites.filter((x) => !x.parent && (x.espace || 'moi') === espace)) out.push({ kind: 'unite', id: u.id });
  } else {
    const u = org.unites.find((x) => x.id === n.id);
    if (u?.parent) out.push(...ascendants({ kind: 'unite', id: u.parent }, org));
  }
  return [...new Map(out.map((x) => [`${x.kind}:${x.id}`, x])).values()];
}

/** Rôles transverses rangés sur un niveau */
export function transversesDe(n: Niv, org: OrgValue): Transverse[] {
  const e = n.kind === 'equipeagile' ? org.equipe.get(n.id) : n.kind === 'train' ? org.train.get(n.id) : n.kind === 'portfolio' ? org.portfolio.get(n.id) : org.unites.find((x) => x.id === n.id);
  return lireTransverses((e as { transverses?: string } | undefined)?.transverses);
}

/** Rôles transverses d'une personne valables sur un niveau (donnés sur lui ou au-dessus), à une date */
export function rolesSur(pid: string, n: Niv, org: OrgValue, jour: string, safe = true): Transverse[] {
  return ascendants(n, org)
    .flatMap((x) => transversesDe(x, org))
    .filter((t) => t.personne === pid && enCours(t, jour) && (safe || t.role !== 'coach'));
}

/** La personne a-t-elle ce droit sur ce niveau par un rôle transverse ? */
export const aDroit = (pid: string, droit: DroitTransverse, n: Niv, org: OrgValue, jour: string, safe = true) => rolesSur(pid, n, org, jour, safe).some((t) => droitsDuRole(t.role).includes(droit));

/** Personnes que `pid` remplace aujourd'hui (Suppléant), où qu'elles soient : il prend leurs droits */
export function remplaces(pid: string, org: OrgValue, jour: string): string[] {
  const tous = [...org.equipes, ...org.trains, ...org.portfolios, ...org.unites].flatMap((e) => lireTransverses((e as { transverses?: string }).transverses));
  return [...new Set(tous.filter((t) => t.role === 'suppleant' && t.personne === pid && !!t.remplace && enCours(t, jour)).map((t) => t.remplace))];
}

/**
 * Qui peut donner un rôle transverse sur un niveau : le responsable du niveau (SM, RTE, Epic Owner, responsable de
 * direction) ou d'un niveau du dessus ; le PO (équipe) et le PM (train) peuvent inviter une Partie prenante ; chacun
 * peut nommer son propre Suppléant.
 */
export function peutDonner(moi: string, role: RoleTransverse, n: Niv, org: OrgValue, remplace = ''): boolean {
  if (role === 'suppleant' && remplace === moi) return true;
  for (const x of ascendants(n, org)) {
    if (x.kind === 'equipeagile') {
      const e = org.equipe.get(x.id);
      if (e?.sm === moi || (!e?.sm && e?.po === moi) || (role === 'partie_prenante' && e?.po === moi)) return true;
    } else if (x.kind === 'train') {
      const t = org.train.get(x.id);
      if (t?.rte === moi || (role === 'partie_prenante' && t?.pm === moi)) return true;
    } else if (x.kind === 'portfolio') {
      if (org.portfolio.get(x.id)?.epic_owner === moi) return true;
    } else if (org.unites.find((u) => u.id === x.id)?.responsable === moi) return true;
  }
  return false;
}

/** Niveaux (et ceux du dessous) où une personne a un rôle transverse qui lui fait tout voir */
export function niveauxVus(pid: string, org: OrgValue, jour: string, safe = true): Niv[] {
  const out: Niv[] = [];
  const ajouterSous = (n: Niv) => {
    out.push(n);
    if (n.kind === 'unite') for (const p of org.portfolios.filter((x) => (x.espace || 'moi') === (org.unites.find((u) => u.id === n.id)?.espace || 'moi'))) ajouterSous({ kind: 'portfolio', id: p.id });
    if (n.kind === 'unite' && !safe) for (const e of org.equipes.filter((x) => (x.espace || 'moi') === (org.unites.find((u) => u.id === n.id)?.espace || 'moi'))) out.push({ kind: 'equipeagile', id: e.id });
    if (n.kind === 'portfolio') for (const t of org.trains.filter((x) => x.portfolio === n.id)) ajouterSous({ kind: 'train', id: t.id });
    if (n.kind === 'train') for (const e of org.equipes.filter((x) => x.train === n.id)) out.push({ kind: 'equipeagile', id: e.id });
  };
  const sources: [Niv['kind'], { id: string; transverses?: string }[]][] = [
    ['unite', org.unites],
    ['portfolio', org.portfolios],
    ['train', org.trains],
    ['equipeagile', org.equipes],
  ];
  for (const [kind, l] of sources)
    for (const e of l)
      if (lireTransverses(e.transverses).some((t) => t.personne === pid && t.role !== 'suppleant' && enCours(t, jour) && (safe || t.role !== 'coach'))) ajouterSous({ kind, id: e.id });
  return [...new Map(out.map((x) => [`${x.kind}:${x.id}`, x])).values()];
}

/** Équipes d'un niveau (lui-même s'il est une équipe) : pour les réunions d'équipe d'un Coach ou d'une Partie prenante */
export const equipesSous = (n: Niv, org: OrgValue) => (n.kind === 'equipeagile' ? org.equipes.filter((e) => e.id === n.id) : n.kind === 'train' ? org.equipes.filter((e) => e.train === n.id) : []);
export { membresDe };

/**
 * Peut animer la réunion (13/10) : l'organisateur ; son Suppléant pendant sa période ; un Coach agile du niveau ou
 * du dessus (SAFe). `mail` : l'adresse de la personne qui ouvre la réunion.
 */
export function peutAnimer(mail: string, r: { organisateur: string; niveau: string; type: string }, org: OrgValue, jour: string, safe = true): boolean {
  const m = mail.toLowerCase();
  if (r.organisateur.toLowerCase() === m) return true;
  const ids = org.personnes.filter((p) => p.email?.toLowerCase() === m).map((p) => p.id);
  const orga = org.personnes.filter((p) => p.email?.toLowerCase() === r.organisateur.toLowerCase()).map((p) => p.id);
  if (ids.some((id) => remplaces(id, org, jour).some((x) => orga.includes(x)))) return true;
  const [kind, id] = [r.niveau.slice(0, r.niveau.indexOf(':')), r.niveau.slice(r.niveau.indexOf(':') + 1)];
  if (!['equipeagile', 'train', 'portfolio', 'unite'].includes(kind)) return false;
  return ids.some((pid) => aDroit(pid, 'animer', { kind: kind as Niv['kind'], id }, org, jour, safe));
}
