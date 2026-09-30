import type { OrgValue } from './organisation';
import { type Epic, idsDe, type Objectif, type ResultatCle, type ValueStream } from './types';

/**
 * Lot 4 · Stratégie (SAFe) : l'objectif devient l'OKR.
 * - un OKR a ses résultats clés (éléments à part), ses value streams (lien direct) et ses epics liées
 *   directement — seulement les epics sans value stream ; une epic qui a un value stream reçoit les OKR de
 *   son value stream (pas de doublon) ;
 * - un value stream a un portfolio, des trains (ses features en découlent), des OKR et des epics ;
 * - reprise de l'existant : une epic sans value stream dont l'ancien « objectif » est l'OKR lui est liée.
 */

/** Epic sans value stream : seule à pouvoir être liée directement à un OKR */
export const sansValueStream = (e: Epic) => !idsDe(e.value_streams).length;

/** OKR liés directement à une epic (seulement si elle n'a pas de value stream) */
export function okrsDirectsDeEpic(e: Epic): string[] {
  if (!sansValueStream(e)) return [];
  return [...new Set([...idsDe(e.okrs), ...(e.objectif ? [e.objectif] : [])])];
}

/** OKR reçus par une epic à travers ses value streams */
export function okrsParValueStreams(e: Epic, vs: ValueStream[]): string[] {
  const mes = new Set(idsDe(e.value_streams));
  return [...new Set(vs.filter((v) => mes.has(v.id)).flatMap((v) => idsDe(v.okrs)))];
}

/** Value streams liés à un OKR */
export const valueStreamsDeOkr = (okr: string, vs: ValueStream[]) => vs.filter((v) => idsDe(v.okrs).includes(okr));

/** Epics liées directement à un OKR (sans value stream) */
export const epicsDirectesDeOkr = (okr: string, epics: Epic[]) => epics.filter((e) => okrsDirectsDeEpic(e).includes(okr));

/** Epics d'un value stream */
export const epicsDeValueStream = (v: string, epics: Epic[]) => epics.filter((e) => idsDe(e.value_streams).includes(v));

/** Résultats clés d'un OKR */
export const resultatsDeOkr = (okr: string, r: ResultatCle[]) => r.filter((x) => x.objectif === okr);

/** Avancement d'un résultat clé (0 à 1) : actuel ÷ cible, ou l'inverse quand la cible est plus basse (baisser un coût) */
export function avancementResultat(r: Pick<ResultatCle, 'actuel' | 'cible'>): number | null {
  const a = parseFloat(r.actuel), c = parseFloat(r.cible);
  if (isNaN(a) || isNaN(c) || c === 0) return null;
  return Math.max(0, Math.min(1, c >= a ? a / c : c / a));
}

/** Avancement d'un OKR : moyenne de ses résultats clés ; sans résultat clé, son ancien indicateur */
export function avancementOkr(o: Objectif, r: ResultatCle[]): number | null {
  const l = resultatsDeOkr(o.id, r).map(avancementResultat).filter((x): x is number => x !== null);
  if (l.length) return l.reduce((s, x) => s + x, 0) / l.length;
  return avancementResultat({ actuel: o.actuel, cible: o.cible });
}

/** « 82 → 90 % » */
export const texteResultat = (r: Pick<ResultatCle, 'actuel' | 'cible' | 'unite'>) =>
  `${r.actuel || '0'} → ${r.cible || '?'}${r.unite ? ` ${r.unite}` : ''}`;

/**
 * Droits sur la stratégie (décidés) : l'Epic Owner d'un portfolio crée les OKR et les value streams et fait
 * tous les liens ; le RTE et le Product Manager lient les OKR aux value streams de leur train ; tous les autres
 * de l'entreprise lisent. Sans personne connue (espace Moi, démo « Vous ») : tous les droits.
 */
export function droitsStrategie(moi: string | null, org: OrgValue): { tout: boolean; lierVs: (v: ValueStream) => boolean } {
  if (!moi || !org.personne.has(moi)) return { tout: true, lierVs: () => true };
  const epicOwner = org.portfolios.some((p) => (p as { epic_owner?: string }).epic_owner === moi);
  const mesTrains = new Set(org.trains.filter((t) => t.rte === moi || t.pm === moi).map((t) => t.id));
  return { tout: epicOwner, lierVs: (v) => epicOwner || idsDe(v.trains).some((t) => mesTrains.has(t)) };
}

/** Nom d'un type de value stream */
export const TYPES_VS = [
  { value: 'operationnel', label: 'Opérationnel', aide: 'Comment la valeur arrive au client' },
  { value: 'developpement', label: 'Développement', aide: 'Les systèmes qui soutiennent un flux opérationnel' },
] as const;
export const libelleTypeVs = (t: string) => TYPES_VS.find((x) => x.value === t)?.label ?? 'Opérationnel';

