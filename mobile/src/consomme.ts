import { cleDe, enfantsRepartition, joursOuvres, montantSurPeriode, partsDe } from './budget';
import { addDays, toDateString } from './dates';
import type { HierarchyValue } from './hierarchyContext';
import { membresDe, type OrgValue } from './organisation';
import { iterationsOf, piOf, pointsBruts } from './pi';
import { calendrierEquipe, coutJour } from './pilotage';
import type { Depense, Epic, Item } from './types';

/**
 * 💶 Lot 3 du budget (conception validée le 09/10) : trois montants par epic.
 * - Consommé réel (par période, depuis le début de l'exercice) = coût des personnes + dépenses + frais généraux.
 *   · Personnes : coût annuel ÷ jours ouvrés de l'année × jours ouvrés de la période (les congés payés ne changent
 *     pas le coût d'un salarié). Une personne rattachée à plusieurs niveaux est partagée à parts égales.
 *     Équipe → ses epics, sprint par sprint, en % des points réalisés ; RTE et PM → les epics du train, Epic Owner →
 *     celles du portfolio, en % des points réalisés ; autres personnes avec un coût (managers) → parts égales entre
 *     les portfolios, puis en % des points. Sans point réalisé : « Hors epics ».
 *   · Dépenses : montant tombé dans la période, porté par l'élément (epic, feature, tâche → son epic) ou réparti
 *     depuis l'entreprise, le portfolio, le train, l'équipe (clé de la dépense : effectif, parts égales, %).
 *   · « En % » (frais généraux) : % du coût des personnes des epics couvertes par le porteur.
 * - Coût réel d'un point = coût des personnes ÷ points réalisés.
 * - Estimation à la fin = consommé réel + reste à faire estimé (points restants × coût réel d'un point) + dépenses
 *   fixes à venir (jusqu'à la fin prévue de l'epic, sinon un an).
 * Reste à faire : estimation des features si elle dépasse les stories restantes, sinon les stories (alerte quand les
 * stories dépassent) ; stories sans estimation comptées à part (alerte).
 */

type H = Pick<HierarchyValue, 'items' | 'featureList' | 'epicList'>;
export interface CtxConsomme {
  org: OrgValue;
  h: H;
  couts: Map<string, string>;
  depenses: Depense[];
  today: string;
  /** Début de l'exercice (AAAA-MM-JJ), par défaut le 1er janvier */
  debut?: string;
}
export interface DetailEpic {
  personnes: number;
  depenses: number;
  frais: number;
  consomme: number;
  points: number;
  coutPoint: number;
  restePts: number;
  sansEstimation: number;
  /** Les stories restantes dépassent l'estimation des features */
  estimationDepassee: boolean;
  fixesAVenir: number;
  estimationFin: number;
}
const HORS = 'hors';
const nb = (v?: string) => Number(String(v ?? '').replace(/\s/g, '').replace(',', '.')) || 0;

/** Epic d'un élément (directement, par sa feature, ou par sa tâche parente) */
function epicDeItem(t: Item, items: Map<string, Item>, features: Map<string, string>): string {
  const p = t.parent ? items.get(t.parent) : undefined;
  return t.epic || features.get(t.feature) || (p ? p.epic || features.get(p.feature) || '' : '');
}

export function consommeReel(c: CtxConsomme) {
  const debut = c.debut ?? `${c.today.slice(0, 4)}-01-01`;
  const { org, h } = c;
  const items = new Map(h.items.map((t) => [t.id, t]));
  const featEpic = new Map(h.featureList.map((f) => [f.id, f.epic]));
  const featEquipe = new Map(h.featureList.map((f) => [f.id, f.equipe ?? '']));
  const featTrain = new Map(h.featureList.map((f) => [f.id, f.train ?? '']));
  const out = new Map<string, { personnes: number; depenses: number; frais: number }>();
  const ajout = (epic: string, k: 'personnes' | 'depenses' | 'frais', v: number) => {
    const x = out.get(epic || HORS) ?? { personnes: 0, depenses: 0, frais: 0 };
    x[k] += v;
    out.set(epic || HORS, x);
  };
  // Points réalisés (terminés dans une période), par epic, pour un filtre d'éléments
  const faits = h.items.filter((t) => !t.parent && t.statut === 'termine' && pointsBruts(t) > 0);
  const quand = (t: Item) => (t.termine_le || t.modifie_le || '').slice(0, 10);
  const pointsParEpic = (garde: (t: Item) => boolean, de: string, a: string) => {
    const m = new Map<string, number>();
    for (const t of faits) if (garde(t) && quand(t) >= de && quand(t) <= a) m.set(epicDeItem(t, items, featEpic), (m.get(epicDeItem(t, items, featEpic)) ?? 0) + pointsBruts(t));
    return m;
  };
  const repartirPoints = (montant: number, m: Map<string, number>, k: 'personnes' | 'frais') => {
    const tot = [...m.values()].reduce((s, x) => s + x, 0);
    if (!tot || !montant) return montant && ajout(HORS, k, montant);
    for (const [e, p] of m) ajout(e, k, (montant * p) / tot);
  };
  // ---- Personnes ----
  const rattach = new Map<string, { kind: 'equipe' | 'train' | 'portfolio' | 'entreprise'; id: string }[]>();
  const add = (pid: string, r: { kind: 'equipe' | 'train' | 'portfolio' | 'entreprise'; id: string }) => pid && rattach.set(pid, [...(rattach.get(pid) ?? []), r]);
  for (const e of org.equipes) for (const pid of new Set([...membresDe(e), e.po, e.sm].filter(Boolean))) add(pid, { kind: 'equipe', id: e.id });
  for (const t of org.trains) for (const pid of new Set([t.rte, t.pm].filter(Boolean))) add(pid, { kind: 'train', id: t.id });
  for (const p of org.portfolios) if (p.epic_owner) add(p.epic_owner, { kind: 'portfolio', id: p.id });
  for (const [pid] of c.couts) if (!rattach.has(pid) && org.personne.has(pid)) add(pid, { kind: 'entreprise', id: org.personne.get(pid)?.espace || 'moi' });
  const cout = (pid: string, de: string, a: string) => coutJour(c.couts.get(pid), Number(de.slice(0, 4))) * joursOuvres(de, a);
  const dansEquipe = (eq: string) => (t: Item) => (t.equipe || featEquipe.get(t.feature) || '') === eq;
  const equipesTrain = (tr: string) => new Set(org.equipes.filter((e) => e.train === tr).map((e) => e.id));
  const dansTrain = (tr: string) => {
    const eqs = equipesTrain(tr);
    return (t: Item) => featTrain.get(t.feature) === tr || eqs.has(t.equipe || featEquipe.get(t.feature) || '');
  };
  const epicsPortfolio = (pf: string) => new Set(h.epicList.filter((e) => e.portfolio === pf).map((e) => e.id));
  const dansPortfolio = (pf: string) => {
    const eps = epicsPortfolio(pf);
    return (t: Item) => eps.has(epicDeItem(t, items, featEpic));
  };
  for (const [pid, rs] of rattach) {
    if (!c.couts.get(pid)) continue;
    const part = 1 / rs.length;
    for (const r of rs) {
      if (r.kind === 'equipe') {
        // Sprint par sprint : en % des points réalisés par l'équipe pendant le sprint
        const cal = calendrierEquipe(r.id, org);
        const pis = new Set([piOf(debut, cal), piOf(c.today, cal)]);
        for (let d = new Date(`${debut}T12:00`); toDateString(d) <= c.today; d = addDays(d, 80)) pis.add(piOf(toDateString(d), cal));
        for (const pi of pis)
          for (const it of iterationsOf(pi, cal)) {
            const de = it.start > debut ? it.start : debut;
            const a = it.end < c.today ? it.end : c.today;
            if (a < de) continue;
            repartirPoints(cout(pid, de, a) * part, pointsParEpic(dansEquipe(r.id), de, a), 'personnes');
          }
      } else if (r.kind === 'train') repartirPoints(cout(pid, debut, c.today) * part, pointsParEpic(dansTrain(r.id), debut, c.today), 'personnes');
      else if (r.kind === 'portfolio') repartirPoints(cout(pid, debut, c.today) * part, pointsParEpic(dansPortfolio(r.id), debut, c.today), 'personnes');
      else {
        const pfs = org.portfolios.filter((p) => (p.espace || 'moi') === r.id);
        const m = cout(pid, debut, c.today) * part;
        if (!pfs.length) ajout(HORS, 'personnes', m);
        for (const p of pfs) repartirPoints(m / pfs.length, pointsParEpic(dansPortfolio(p.id), debut, c.today), 'personnes');
      }
    }
  }
  // ---- Dépenses ----
  const epicDuPorteur = (porteur: string): string | null => {
    const [k, id] = [porteur.slice(0, porteur.indexOf(':')), porteur.slice(porteur.indexOf(':') + 1)];
    if (k === 'epic') return id;
    if (k === 'feature') return featEpic.get(id) ?? '';
    if (k === 'item') {
      const t = items.get(id);
      return t ? epicDeItem(t, items, featEpic) : '';
    }
    return null;
  };
  // Une dépense répartie ne compte pour une epic que pendant sa vie (de son début à sa fin)
  const epicParId = new Map(h.epicList.map((e) => [e.id, e as { debut?: string; fin?: string }]));
  const fenetre = (epic: string, de: string, a: string): [string, string] => {
    const e = epicParId.get(epic);
    return [e?.debut && e.debut > de ? e.debut : de, e?.fin && e.fin < a ? e.fin : a];
  };
  /** Part (0..1) de chaque epic dans une dépense, en descendant depuis son porteur ; '' = hors epics */
  const partsEpics = (d: Depense, porteur: string, part = 1, prof = 0, acc = new Map<string, number>()): Map<string, number> => {
    const e = epicDuPorteur(porteur);
    if (e !== null) return acc.set(e, (acc.get(e) ?? 0) + part);
    const enfants = prof < 4 ? enfantsRepartition(porteur, org, h) : [];
    if (!enfants.length) return acc.set('', (acc.get('') ?? 0) + part);
    const parts = partsDe({ ...d, cle: prof === 0 ? cleDe(d) : 'egal', parts: prof === 0 ? d.parts : '' }, enfants);
    for (const x of enfants) partsEpics(d, x.cle, part * (parts.get(x.cle) ?? 0), prof + 1, acc);
    return acc;
  };
  const distribuer = (d: Depense, k: 'depenses' | 'frais', de: string, a: string) => {
    const direct = epicDuPorteur(d.porteur) !== null;
    for (const [e, part] of partsEpics(d, d.porteur)) {
      const [x, y] = e && !direct ? fenetre(e, de, a) : [de, a];
      if (y >= x) ajout(e, k, montantSurPeriode(d, x, y) * part);
    }
  };
  const epicsCouvertes = (porteur: string, prof = 0): string[] => {
    const e = epicDuPorteur(porteur);
    if (e !== null) return e ? [e] : [];
    return prof < 4 ? enfantsRepartition(porteur, org, h).flatMap((x) => epicsCouvertes(x.cle, prof + 1)) : [];
  };
  for (const d of c.depenses) {
    const k = d.categorie === 'frais_generaux' ? 'frais' : 'depenses';
    if (d.periode !== 'pct') distribuer(d, k, debut, c.today);
  }
  // « En % » : sur le coût des personnes des epics couvertes (après les personnes)
  for (const d of c.depenses.filter((x) => x.periode === 'pct' && x.du <= c.today)) for (const e of new Set(epicsCouvertes(d.porteur))) ajout(e, d.categorie === 'frais_generaux' ? 'frais' : 'depenses', ((out.get(e)?.personnes ?? 0) * nb(d.montant)) / 100);

  // ---- Par epic : coût d'un point, reste à faire, dépenses à venir, estimation à la fin ----
  const totPts = new Map<string, number>();
  for (const t of faits) if (quand(t) >= debut && quand(t) <= c.today) totPts.set(epicDeItem(t, items, featEpic), (totPts.get(epicDeItem(t, items, featEpic)) ?? 0) + pointsBruts(t));
  const totPers = [...out.entries()].filter(([e]) => e !== HORS).reduce((s, [, x]) => s + x.personnes, 0);
  const totP = [...totPts.entries()].filter(([e]) => e).reduce((s, [, x]) => s + x, 0);
  const coutPointMoyen = totP ? totPers / totP : 0;
  const demain = toDateString(addDays(new Date(`${c.today}T12:00`), 1));
  const detail = (e: Epic): DetailEpic => {
    const x = out.get(e.id) ?? { personnes: 0, depenses: 0, frais: 0 };
    const points = totPts.get(e.id) ?? 0;
    const coutPoint = points ? x.personnes / points : coutPointMoyen;
    const fs = h.featureList.filter((f) => f.epic === e.id);
    const restantes = h.items.filter((t) => !t.parent && t.statut !== 'termine' && epicDeItem(t, items, featEpic) === e.id && (t.type === 'story' || !!t.feature || !!t.epic));
    const resteStories = restantes.reduce((s, t) => s + pointsBruts(t), 0);
    const faitsF = (fid: string) => faits.filter((t) => t.feature === fid).reduce((s, t) => s + pointsBruts(t), 0);
    const resteFeatures = fs.reduce((s, f) => s + Math.max(0, nb(f.points) - faitsF(f.id)), 0);
    const restePts = Math.max(resteFeatures, resteStories);
    const fin = e.fin && e.fin > c.today ? e.fin : toDateString(addDays(new Date(`${c.today}T12:00`), 365));
    let fixesAVenir = 0;
    for (const d of c.depenses) {
      if (d.periode === 'pct') continue;
      const part = partsEpics(d, d.porteur).get(e.id) ?? 0;
      if (!part) continue;
      const [x, y] = epicDuPorteur(d.porteur) !== null ? [demain, fin] : fenetre(e.id, demain, fin);
      if (y >= x) fixesAVenir += montantSurPeriode(d, x, y) * part;
    }
    const consomme = (e.consomme ?? '') !== '' ? nb(e.consomme) : x.personnes + x.depenses + x.frais;
    return {
      ...x,
      consomme,
      points,
      coutPoint,
      restePts,
      sansEstimation: restantes.filter((t) => !pointsBruts(t)).length,
      estimationDepassee: resteStories > resteFeatures && resteFeatures > 0,
      fixesAVenir,
      estimationFin: consomme + restePts * coutPoint + fixesAVenir,
    };
  };
  return { debut, detail, hors: out.get(HORS) ?? { personnes: 0, depenses: 0, frais: 0 }, coutPointMoyen };
}
