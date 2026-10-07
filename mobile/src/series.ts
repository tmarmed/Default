import { addDays, toDateString } from './dates';
import { type Calendrier, calendrierCourant, iterationsOf, piEnd, piOf, piStart, shiftPi } from './pi';
import { feriesFrance } from './reunionsEquipe';

/**
 * Séries de réunions (07/10) : une ligne par série dans l'onglet « Reunions » du Sheet de l'espace, avec une règle
 * (pas de dates) et ses exceptions ; les réunions (occurrences) sont calculées. Si le calendrier agile change, les
 * réunions suivent toutes seules.
 *
 * Périodicité : d'abord l'unité — standard (jour, semaine, mois, trimestre, année) ou agile (sprint, PI) — puis le
 * moment dans la période : début, milieu, fin, début + x jours ouvrés, fin − x jours ouvrés (PI : aussi la semaine
 * IP) ; ou des jours de la semaine (« chaque mercredi », « 1er mardi du mois »).
 * Jour férié ou week-end : la réunion passe au jour ouvré le plus proche, sans sortir de sa période (début : plutôt
 * après ; fin : plutôt avant). Règle « chaque jour ouvré » : les fériés sont sautés.
 * Exceptions (même ligne, JSON) : une réunion déplacée ou annulée, repérée par sa date d'origine (gardée dans l'id de
 * la réunion : ses points restent attachés). Une exception identique à la série est retirée ; une exception dont la
 * date d'origine n'existe plus (calendrier changé) est signalée « ⚠ à revoir ».
 */
export type UniteSerie = 'jour' | 'semaine' | 'mois' | 'trimestre' | 'annee' | 'sprint' | 'pi';
export type AncreSerie = 'debut' | 'milieu' | 'fin' | 'ip';
export const UNITES_STANDARD: UniteSerie[] = ['jour', 'semaine', 'mois', 'trimestre', 'annee'];
export const UNITES_AGILES: UniteSerie[] = ['sprint', 'pi'];
export const LIBELLE_UNITE: Record<UniteSerie, string> = { jour: 'Jour', semaine: 'Semaine', mois: 'Mois', trimestre: 'Trimestre', annee: 'Année', sprint: 'Sprint', pi: 'PI' };
export const JOURS_SEMAINE = ['', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

export interface ExceptionSerie {
  /** Date d'origine (AAAA-MM-JJ) : celle que donne la règle */
  d: string;
  /** Déplacée : nouveau début (AAAA-MM-JJTHH:MM) */
  a?: string;
  /** Durée changée (minutes) */
  duree?: number;
  annulee?: boolean;
}

export interface SerieReunion {
  /** Espace (Google Sheet) d'où vient la série : posé par l'application au chargement, jamais enregistré */
  espace?: string;
  /** « daily-equipeagile:a1 » (série d'après l'Organisation), « daily-equipeagile:a1~2026-11-02 » (celle-ci et les
   * suivantes), « r-xxxx » (réunion ajoutée à la main) */
  id: string;
  /** Type de réunion (daily, revue…) ; vide = 📅 réunion libre */
  type_reunion: string;
  titre: string;
  /** Niveau de l'Organisation (« equipeagile:id »…) ; vide = personnel */
  niveau: string;
  unite: UniteSerie;
  ancre: AncreSerie | '';
  /** Jours ouvrés après le début (positif) ou avant la fin (négatif) */
  ecart: string;
  /** Jour : « ouvres » ou vide (tous les jours) ; sinon jours de la semaine (1 = lundi … 7), séparés par « ; » */
  jours: string;
  /** Toutes les N périodes (vide = 1), comptées depuis `debut` */
  tous: string;
  /** Jours exclus : debut_pi (jour du PI Planning), fin_pi, sprint1, ip (semaine IP), trimestre, annee */
  sauf: string;
  heure: string;
  duree: string;
  /** Qui anime (e-mail) ; vide = d'après le rôle dans l'Organisation */
  animateur: string;
  /** Peuvent aussi modifier ou annuler (e-mails séparés par « ; ») */
  editeurs: string;
  /** Réunion libre : participants (e-mails séparés par « ; ») ; vide = d'après l'Organisation */
  participants: string;
  /** Première et dernière date possibles (AAAA-MM-JJ) ; vide = sans limite */
  debut: string;
  fin: string;
  /** Exceptions : JSON d'une liste d'ExceptionSerie */
  exceptions: string;
  /** « non » : série arrêtée (gardée pour l'historique) */
  actif: string;
  cree_le: string;
  modifie_le: string;
}

export const COLONNES_SERIE = ['id', 'type_reunion', 'titre', 'niveau', 'unite', 'ancre', 'ecart', 'jours', 'tous', 'sauf', 'heure', 'duree', 'animateur', 'editeurs', 'participants', 'debut', 'fin', 'exceptions', 'actif', 'cree_le', 'modifie_le'] as const;

const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const feries = new Map<number, Set<string>>();
/** Jour ouvré : du lundi au vendredi, hors fériés (France) */
export function estOuvre(j: string): boolean {
  const d = parse(j);
  if (d.getDay() === 0 || d.getDay() === 6) return false;
  const y = d.getFullYear();
  if (!feries.has(y)) feries.set(y, new Set(feriesFrance(y)));
  return !feries.get(y)!.has(j);
}
const plus = (j: string, n: number) => toDateString(addDays(parse(j), n));
/** 1 = lundi … 7 = dimanche */
const jourSemaine = (j: string) => ((parse(j).getDay() + 6) % 7) + 1;

export const lireExceptions = (s: Pick<SerieReunion, 'exceptions'>): ExceptionSerie[] => {
  try {
    const l = JSON.parse(s.exceptions || '[]');
    return Array.isArray(l) ? l.filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e?.d ?? '')) : [];
  } catch {
    return [];
  }
};
const nombre = (x: string, d: number) => (x?.trim() && Number.isFinite(Number(x)) ? Math.round(Number(x)) : d);
const listeSauf = (s: Pick<SerieReunion, 'sauf'>) => new Set((s.sauf || '').split(';').filter(Boolean));
const listeJours = (s: Pick<SerieReunion, 'jours'>) => (s.jours || '').split(';').map(Number).filter((n) => n >= 1 && n <= 7);

interface Periode {
  debut: string;
  fin: string;
  /** Rang de la période (pour « toutes les N ») */
  rang: number;
  /** Sprint : son code (IT1…) ; PI : le PI */
  code?: string;
  pi?: string;
}

/** Périodes de l'unité qui touchent [de, a] */
function periodes(unite: UniteSerie, de: string, a: string, cal: Calendrier): Periode[] {
  const out: Periode[] = [];
  if (unite === 'jour') {
    for (let j = de, k = 0; j <= a && k < 4000; j = plus(j, 1), k++) out.push({ debut: j, fin: j, rang: Math.round(parse(j).getTime() / 864e5) });
  } else if (unite === 'semaine') {
    for (let j = plus(de, 1 - jourSemaine(de)); j <= a; j = plus(j, 7)) out.push({ debut: j, fin: plus(j, 6), rang: Math.round(parse(j).getTime() / (7 * 864e5)) });
  } else if (unite === 'mois' || unite === 'trimestre' || unite === 'annee') {
    const n = unite === 'mois' ? 1 : unite === 'trimestre' ? 3 : 12;
    const d0 = parse(de);
    let d = new Date(d0.getFullYear(), unite === 'annee' ? 0 : Math.floor(d0.getMonth() / n) * n, 1);
    while (toDateString(d) <= a) {
      const f = new Date(d.getFullYear(), d.getMonth() + n, 0);
      out.push({ debut: toDateString(d), fin: toDateString(f), rang: Math.floor((d.getFullYear() * 12 + d.getMonth()) / n) });
      d = new Date(d.getFullYear(), d.getMonth() + n, 1);
    }
  } else {
    for (let pi = piOf(de, cal), k = 0; toDateString(piStart(pi, cal)) <= a && k < 40; pi = shiftPi(pi, 1), k++) {
      const [y, q] = pi.split('-T').map(Number);
      const rangPi = y * 4 + q - 1;
      if (unite === 'pi') out.push({ debut: toDateString(piStart(pi, cal)), fin: toDateString(piEnd(pi, cal)), rang: rangPi, pi });
      else
        iterationsOf(pi, cal)
          .filter((it) => it.code !== 'IP')
          .forEach((it, i) => out.push({ debut: it.start, fin: it.end, rang: rangPi * 20 + i, code: it.code, pi }));
    }
  }
  return out.filter((p) => p.fin >= de && p.debut <= a);
}

/** Jour ouvré le plus proche de `j` dans [debut, fin] ; à égalité, dans le sens `pref` ; aucun : rien */
function ouvreProche(j: string, debut: string, fin: string, pref: 1 | -1): string | undefined {
  for (let k = 0; k <= 31; k++)
    for (const s of [pref, -pref]) {
      const x = plus(j, s * k);
      if (x >= debut && x <= fin && estOuvre(x)) return x;
    }
  return undefined;
}
/** Avance (n > 0) ou recule de |n| jours ouvrés, sans sortir de [debut, fin] */
function decaler(j: string, n: number, debut: string, fin: string): string {
  let x = j;
  for (let k = Math.abs(n); k > 0; ) {
    const y = plus(x, Math.sign(n));
    if (y < debut || y > fin) break;
    x = y;
    if (estOuvre(x)) k--;
  }
  return x;
}

/** Dates (d'origine) produites par la règle dans une période */
function datesPeriode(s: SerieReunion, p: Periode, cal: Calendrier): string[] {
  const jours = listeJours(s);
  if (s.unite === 'jour') return s.jours === 'ouvres' && !estOuvre(p.debut) ? [] : [p.debut];
  if (s.unite === 'semaine') {
    const l = jours.length ? jours : [1];
    return l.map((n) => plus(p.debut, n - 1)).flatMap((j) => (estOuvre(j) ? [j] : (ouvreProche(j, p.debut, p.fin, 1) ?? [])));
  }
  let debut = p.debut;
  const fin = p.fin;
  let base: string;
  let pref: 1 | -1 = 1;
  if (s.ancre === 'ip') {
    if (!p.pi) return [];
    const ip = iterationsOf(p.pi, cal).find((it) => it.code === 'IP');
    if (!ip) return [];
    base = ip.start;
    debut = ip.start;
  } else if (s.ancre === 'fin') {
    base = fin;
    pref = -1;
  } else if (s.ancre === 'milieu') {
    base = plus(debut, Math.floor((parse(fin).getTime() - parse(debut).getTime()) / 864e5 / 2 + 0.5));
  } else base = debut;
  // Jours de la semaine (« 1er mardi du mois ») : le premier à partir du début, le dernier avant la fin
  if (jours.length) {
    for (let k = 0; k < 7 && !jours.includes(jourSemaine(base)); k++) base = plus(base, pref);
    if (base < debut || base > fin) return [];
  }
  let j = jours.length ? base : ouvreProche(base, debut, fin, pref);
  if (!j) return [];
  const e = nombre(s.ecart, 0);
  if (e) j = decaler(j, e, debut, fin);
  if (!estOuvre(j)) j = ouvreProche(j, debut, fin, e < 0 ? -1 : e > 0 ? 1 : pref) ?? j;
  return [j];
}

export interface Occurrence {
  /** Date d'origine (règle), gardée dans l'id de la réunion */
  origine: string;
  /** Début réel : AAAA-MM-JJTHH:MM */
  debut: string;
  duree: number;
  deplacee: boolean;
  annulee: boolean;
}

/**
 * Réunions d'une série sur [de, a] (dates d'origine dans la fenêtre, ou déplacées dedans), triées. Avec les
 * annulées (marquées). `cal` : le calendrier agile du niveau (équipe, train) ; par défaut le calendrier courant.
 */
export function occurrences(s: SerieReunion, de: string, a: string, cal: Calendrier = calendrierCourant()): Occurrence[] {
  if (s.actif === 'non') return [];
  const ex = lireExceptions(s);
  const origines = datesRegle(s, de, a, cal);
  const duree = nombre(s.duree, 30);
  const heure = /^\d{1,2}:\d{2}$/.test(s.heure) ? s.heure.padStart(5, '0') : '09:00';
  const out: Occurrence[] = [];
  const vus = new Set<string>();
  for (const o of origines) {
    vus.add(o);
    const x = ex.find((e) => e.d === o);
    out.push({ origine: o, debut: x?.a || `${o}T${heure}`, duree: x?.duree ?? duree, deplacee: !!x?.a, annulee: !!x?.annulee });
  }
  // Déplacée dans la fenêtre depuis une date d'origine hors fenêtre (ou orpheline) : montrée aussi
  for (const x of ex)
    if (!vus.has(x.d) && x.a && !x.annulee && x.a.slice(0, 10) >= de && x.a.slice(0, 10) <= a) out.push({ origine: x.d, debut: x.a, duree: x.duree ?? duree, deplacee: true, annulee: false });
  return out.filter((o) => o.annulee || (o.debut.slice(0, 10) >= de && o.debut.slice(0, 10) <= a) || (o.origine >= de && o.origine <= a)).sort((x, y) => x.debut.localeCompare(y.debut));
}

/** Dates d'origine produites par la règle dans [de, a] (limites `debut` / `fin` et exclusions comprises) */
export function datesRegle(s: SerieReunion, de: string, a: string, cal: Calendrier = calendrierCourant()): string[] {
  const d0 = s.debut && s.debut > de ? s.debut : de;
  const a0 = s.fin && s.fin < a ? s.fin : a;
  if (d0 > a0) return [];
  const sauf = listeSauf(s);
  const tous = Math.max(1, nombre(s.tous, 1));
  const ps = periodes(s.unite, d0, a0, cal);
  const rang0 = s.debut ? (periodes(s.unite, s.debut, s.debut, cal)[0]?.rang ?? 0) : 0;
  const out: string[] = [];
  for (const p of ps) {
    if (tous > 1 && (((p.rang - rang0) % tous) + tous) % tous) continue;
    if (sauf.has('sprint1') && p.code === 'IT1') continue;
    for (const j of datesPeriode(s, p, cal)) {
      if (j < d0 || j > a0) continue;
      if (exclu(j, sauf, cal)) continue;
      out.push(j);
    }
  }
  return [...new Set(out)].sort();
}

/** Jour exclu par la série : jour du PI Planning, dernier jour du PI, semaine IP, début de trimestre ou d'année */
function exclu(j: string, sauf: Set<string>, cal: Calendrier): boolean {
  if (!sauf.size) return false;
  const pi = piOf(j, cal);
  if (sauf.has('debut_pi')) {
    const s = toDateString(piStart(pi, cal));
    if (j === ouvreProche(s, s, toDateString(piEnd(pi, cal)), 1)) return true;
  }
  if (sauf.has('fin_pi')) {
    const f = toDateString(piEnd(pi, cal));
    if (j === ouvreProche(f, toDateString(piStart(pi, cal)), f, -1)) return true;
  }
  if (sauf.has('ip') && iterationsOf(pi, cal).find((it) => it.code === 'IP' && it.start <= j && j <= it.end)) return true;
  const m = parse(j).getMonth();
  if (sauf.has('trimestre') && m % 3 === 0) return true;
  if (sauf.has('annee') && m === 0) return true;
  return false;
}

/** Exceptions « ⚠ à revoir » : leur date d'origine n'est plus produite par la règle */
export function exceptionsOrphelines(s: SerieReunion, cal: Calendrier = calendrierCourant()): ExceptionSerie[] {
  return lireExceptions(s).filter((e) => !datesRegle(s, e.d, e.d, cal).includes(e.d));
}

/** Exceptions sans effet retirées (identiques à la série) ; triées */
export function nettoyerExceptions(s: SerieReunion, l: ExceptionSerie[]): ExceptionSerie[] {
  const heure = (s.heure || '09:00').padStart(5, '0');
  const duree = nombre(s.duree, 30);
  const m = new Map<string, ExceptionSerie>();
  for (const e of l) {
    const x: ExceptionSerie = { d: e.d };
    if (e.annulee) x.annulee = true;
    else {
      if (e.a && e.a !== `${e.d}T${heure}`) x.a = e.a;
      if (e.duree !== undefined && e.duree !== duree) x.duree = e.duree;
    }
    if (x.a || x.annulee || x.duree !== undefined) m.set(x.d, x);
    else m.delete(x.d);
  }
  return [...m.values()].sort((a, b) => a.d.localeCompare(b.d));
}
export const ecrireExceptions = (s: SerieReunion, l: ExceptionSerie[]) => {
  const n = nettoyerExceptions(s, l);
  return n.length ? JSON.stringify(n) : '';
};

/** Modifier une seule réunion : son exception (déplacée, durée, annulée) ; identique à la série → retirée */
export function modifierOccurrence(s: SerieReunion, origine: string, x: Omit<ExceptionSerie, 'd'>): SerieReunion {
  const autres = lireExceptions(s).filter((e) => e.d !== origine);
  return { ...s, exceptions: ecrireExceptions(s, [...autres, { d: origine, ...x }]) };
}

/**
 * « Celle-ci et les suivantes » : la série s'arrête la veille ; une nouvelle série (mêmes réglages, puis `changes`)
 * reprend à cette date, avec les exceptions qui la suivent. Renvoie [ancienne, nouvelle].
 */
export function couperSerie(s: SerieReunion, origine: string, changes: Partial<SerieReunion>, maintenant: string): [SerieReunion, SerieReunion] {
  const ex = lireExceptions(s);
  const base = s.id.split('~')[0];
  const avant: SerieReunion = { ...s, fin: plus(origine, -1), exceptions: ecrireExceptions(s, ex.filter((e) => e.d < origine)), modifie_le: maintenant };
  const apres0: SerieReunion = { ...s, ...changes, id: `${base}~${origine}`, debut: origine, fin: changes.fin ?? s.fin, cree_le: maintenant, modifie_le: maintenant, exceptions: '' };
  const apres = { ...apres0, exceptions: ecrireExceptions(apres0, ex.filter((e) => e.d >= origine)) };
  return [avant, apres];
}

/** « Toute la série » : les réglages changent ; les exceptions restent (celles devenues identiques sont retirées) */
export function modifierSerie(s: SerieReunion, changes: Partial<SerieReunion>, maintenant: string): SerieReunion {
  const n = { ...s, ...changes, modifie_le: maintenant };
  return { ...n, exceptions: ecrireExceptions(n, lireExceptions(n)) };
}

/** « Chaque jour ouvré », « Chaque mercredi », « Sprint · fin − 1 j », « PI · semaine IP », « Mois · 1er mardi »… */
export function libelleRegle(s: Pick<SerieReunion, 'unite' | 'ancre' | 'ecart' | 'jours' | 'tous' | 'sauf'>): string {
  const tous = Math.max(1, nombre(s.tous, 1));
  const jours = listeJours(s);
  const nomJours = jours.map((n) => JOURS_SEMAINE[n]).join(', ');
  if (s.unite === 'jour') return s.jours === 'ouvres' ? 'Chaque jour ouvré' : tous > 1 ? `Tous les ${tous} jours` : 'Chaque jour';
  if (s.unite === 'semaine') return `${tous > 1 ? `Toutes les ${tous} semaines` : 'Chaque semaine'} · ${nomJours || 'lundi'}`;
  const unite = { mois: 'mois', trimestre: 'trimestre', annee: 'année', sprint: 'sprint', pi: 'PI' }[s.unite as 'mois'];
  const chaque = tous > 1 ? `Tous les ${tous} ${s.unite === 'annee' ? 'ans' : s.unite === 'mois' ? 'mois' : `${unite}s`}` : `Chaque ${unite}`;
  const e = nombre(s.ecart, 0);
  const moment =
    s.ancre === 'ip'
      ? 'semaine IP'
      : jours.length
        ? `${s.ancre === 'fin' ? 'dernier' : '1er'} ${nomJours}`
        : s.ancre === 'fin'
          ? e
            ? `fin − ${Math.abs(e)} j`
            : 'fin'
          : s.ancre === 'milieu'
            ? 'milieu'
            : e
              ? `début + ${e} j`
              : 'début';
  return `${chaque} · ${moment}`;
}
