import { fmtDate } from './alerts';
import { addMonths, toDateString } from './dates';
import { childrenOf, type Data } from './hierarchy';
import { iterationOf, piEnd, piOf, piStart, shiftPi } from './pi';
import { EPIC_COULEURS, RECURRENCE_DEFAUTS, type ItemInput } from './types';

/**
 * Assistant projet : brouillon de domaines, objectifs, epics, features et tâches, modifié librement
 * (ajout, modification, déplacement, suppression marquée) puis enregistré en une fois.
 */
export type Level = 'domaine' | 'objectif' | 'epic' | 'feature' | 'tache';
export const LEVELS: Level[] = ['domaine', 'objectif', 'epic', 'feature', 'tache'];
export const LEVEL_LABEL: Record<Level, string> = {
  domaine: 'Domaine',
  objectif: 'Objectif',
  epic: 'Epic',
  feature: 'Feature',
  tache: 'Tâche',
};
export const LEVEL_PLURAL: Record<Level, string> = {
  domaine: 'Domaines',
  objectif: 'Objectifs',
  epic: 'Epics',
  feature: 'Features',
  tache: 'Tâches',
};
export const LEVEL_ICON: Record<Level, string> = { domaine: '🏷️', objectif: '🎯', epic: '🗂️', feature: '🧩', tache: '✓' };
/** Parents possibles, du plus naturel au moins naturel. */
export const PARENT_LEVELS: Record<Level, Level[]> = {
  domaine: [],
  objectif: ['domaine'],
  epic: ['objectif', 'domaine'],
  feature: ['epic'],
  tache: ['feature', 'epic', 'objectif', 'domaine'],
};
/** Champs modifiables dans l'assistant (en plus du titre). */
const FIELDS: Record<Level, string[]> = {
  domaine: [],
  objectif: ['debut', 'fin'],
  epic: ['debut', 'fin', 'etat'],
  feature: ['pi', 'iteration', 'points'],
  tache: ['date', 'points', 'iteration'],
};

export interface WNode {
  /** « niveau:id » pour un élément existant, « new:n » pour un nouveau */
  key: string;
  level: Level;
  /** id dans le Google Sheet (éléments existants) */
  id?: string;
  titre: string;
  f: Record<string, string>;
  /** Clé du parent (dans le brouillon ou non), null = sans rattachement */
  parentKey: string | null;
  /** Valeurs d'origine d'un élément existant */
  orig?: { titre: string; f: Record<string, string>; parentKey: string | null };
  /** Marqué « à supprimer » */
  del?: { cascade: boolean };
  /** Élément existant choisi comme point d'attache (jamais modifié) */
  ctx?: boolean;
}

export const keyOf = (level: Level, id: string) => `${level}:${id}`;
export const levelOfKey = (key: string, map: Map<string, WNode>): Level | undefined =>
  map.get(key)?.level ?? (key.startsWith('new:') ? undefined : (key.split(':')[0] as Level));
const idOfKey = (key: string) => key.slice(key.indexOf(':') + 1);

type Entity = Record<string, string> & { id: string };

function parentKeyOf(level: Level, x: Entity): string | null {
  const order = PARENT_LEVELS[level];
  for (const l of order) if (x[l]) return keyOf(l, x[l]);
  return null;
}

function entityOf(level: Level, id: string, d: Data): Entity | undefined {
  const list = { domaine: d.domaines, objectif: d.objectifs, epic: d.epics, feature: d.features, tache: d.items }[level];
  return (list as unknown as Entity[]).find((x) => x.id === id);
}

export function nodeOf(level: Level, x: Entity, ctx = false): WNode {
  const f: Record<string, string> = {};
  for (const k of FIELDS[level]) f[k] = x[k] ?? '';
  const titre = level === 'domaine' ? x.nom : x.titre;
  const parentKey = parentKeyOf(level, x);
  return { key: keyOf(level, x.id), level, id: x.id, titre, f, parentKey, orig: { titre, f: { ...f }, parentKey }, ctx };
}

/** Charge un élément existant et tout ce qui lui est rattaché. */
export function loadDraft(level: Exclude<Level, 'tache'>, id: string, d: Data): WNode[] {
  const root = entityOf(level, id, d);
  if (!root) return [];
  const kids = childrenOf(level, id, d);
  const pick = (l: Level, ids: Set<string>) =>
    [...ids].map((i) => entityOf(l, i, d)).filter((x): x is Entity => !!x).map((x) => nodeOf(l, x));
  return [
    nodeOf(level, root),
    ...pick('objectif', kids.objIds),
    ...pick('epic', kids.epicIds),
    ...pick('feature', kids.featIds),
    // Les tâches répétées restent gérées dans leur fiche (échéances, périodicité)
    ...pick('tache', new Set([...kids.taskIds].filter((i) => !entityOf('tache', i, d)?.periodicite))),
  ];
}

export const mapOf = (draft: WNode[]) => new Map(draft.map((n) => [n.key, n]));

/** Supprimé lui-même, ou sous un élément supprimé « avec tout ce qui est rattaché ». */
export function isGone(n: WNode, map: Map<string, WNode>): boolean {
  if (n.del) return true;
  const seen = new Set<string>();
  let pk = n.parentKey;
  while (pk && !seen.has(pk)) {
    seen.add(pk);
    const p = map.get(pk);
    if (!p) return false;
    if (p.del?.cascade) return true;
    pk = p.parentKey;
  }
  return false;
}

/** Parent effectif : un parent supprimé (sans cascade) est remplacé par le sien, comme dans le Google Sheet. */
export function resolveParent(n: WNode, map: Map<string, WNode>): string | null {
  let pk = n.parentKey;
  const seen = new Set<string>();
  while (pk && !seen.has(pk)) {
    seen.add(pk);
    const p = map.get(pk);
    if (!p) return pk;
    if (!p.del && PARENT_LEVELS[n.level].includes(p.level)) return pk;
    pk = p.parentKey;
  }
  return null;
}

/** Descendants d'un nœud dans le brouillon. */
export function descendants(key: string, draft: WNode[]): WNode[] {
  const out: WNode[] = [];
  const walk = (k: string) => {
    for (const n of draft) if (n.parentKey === k && !out.includes(n)) (out.push(n), walk(n.key));
  };
  walk(key);
  return out;
}

/** Ordre d'affichage : arbre (parents puis enfants), par niveau. */
export function treeOrder(draft: WNode[]): { node: WNode; depth: number }[] {
  const map = mapOf(draft);
  const out: { node: WNode; depth: number }[] = [];
  const visit = (n: WNode, depth: number) => {
    out.push({ node: n, depth });
    for (const c of draft.filter((x) => x.parentKey === n.key)) visit(c, depth + 1);
  };
  const roots = draft.filter((n) => !n.parentKey || !map.has(n.parentKey));
  roots.sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level));
  for (const r of roots) visit(r, 0);
  return out;
}

/** Valeurs proposées pour un nouvel élément. */
export function defaultsFor(level: Level, parent: WNode | undefined, safe: boolean, n: number): Record<string, string> {
  const today = toDateString(new Date());
  switch (level) {
    case 'domaine':
      return { couleur: EPIC_COULEURS[n % EPIC_COULEURS.length], icone: '📦' };
    case 'objectif':
      return { debut: today, fin: '', couleur: EPIC_COULEURS[n % EPIC_COULEURS.length] };
    case 'epic': {
      let fin = toDateString(addMonths(new Date(), 3));
      const pf = parent?.level === 'objectif' ? parent.f.fin : '';
      if (pf && pf < fin) fin = pf < today ? fin : pf;
      return { debut: today, fin, etat: safe ? 'idee' : '', couleur: EPIC_COULEURS[n % EPIC_COULEURS.length] };
    }
    case 'feature': {
      // PI où l'epic commence (au plus tôt maintenant) ; pendant la semaine IP, le PI suivant
      const base = parent?.level === 'epic' && parent.f.debut > today ? parent.f.debut : today;
      const pi = iterationOf(base).code === 'IP' ? shiftPi(piOf(base), 1) : piOf(base);
      return { pi, iteration: '', points: '' };
    }
    case 'tache':
      return { date: '', points: '', iteration: parent?.level === 'feature' ? parent.f.iteration ?? '' : '' };
  }
}

export function isChanged(n: WNode, map: Map<string, WNode>): { titre: boolean; champs: boolean; parent: boolean } {
  if (!n.orig) return { titre: false, champs: false, parent: false };
  return {
    titre: n.titre.trim() !== n.orig.titre,
    champs: FIELDS[n.level].some((k) => (n.f[k] ?? '') !== (n.orig!.f[k] ?? '')),
    parent: resolveParent(n, map) !== n.orig.parentKey,
  };
}

export interface Summary {
  creations: WNode[];
  updates: WNode[];
  deletions: WNode[];
}

const ORDER = (a: WNode, b: WNode) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level);

export function summarize(draft: WNode[]): Summary {
  const map = mapOf(draft);
  const live = draft.filter((n) => !n.ctx && !isGone(n, map) && n.titre.trim());
  const creations = live.filter((n) => !n.id).sort(ORDER);
  const updates = live
    .filter((n) => n.id)
    .filter((n) => {
      const c = isChanged(n, map);
      return c.titre || c.champs || c.parent;
    })
    .sort(ORDER);
  // Seuls les éléments existants sont supprimés ; sous une suppression en cascade, inutile de les compter deux fois.
  const deletions = draft
    .filter((n) => n.id && !n.ctx && n.del)
    .filter((n) => !isGone({ ...n, del: undefined }, map))
    .sort((a, b) => -ORDER(a, b));
  return { creations, updates, deletions };
}

/** Alertes de dates : un élément qui sort de la période de son parent (information seulement). */
export function draftAlerts(draft: WNode[]): string[] {
  const map = mapOf(draft);
  const period = (n: WNode): [string, string] | null => {
    if (n.level === 'epic' || n.level === 'objectif') return n.f.debut || n.f.fin ? [n.f.debut, n.f.fin] : null;
    if (n.level === 'tache') return n.f.date ? [n.f.date, n.f.date] : null;
    return null;
  };
  const out: string[] = [];
  for (const n of draft) {
    if (n.ctx || isGone(n, map)) continue;
    const pk = resolveParent(n, map);
    const p = pk ? map.get(pk) : undefined;
    if (!p || (p.level !== 'epic' && p.level !== 'objectif')) continue;
    const b = period(p);
    if (!b) continue;
    const titre = n.titre.trim() || LEVEL_LABEL[n.level];
    if (n.level === 'feature') {
      // Une feature doit seulement chevaucher son epic
      if (!n.f.pi) continue;
      const [ps, pe] = [toDateString(piStart(n.f.pi)), toDateString(piEnd(n.f.pi))];
      if (b[0] && pe < b[0]) out.push(`« ${titre} » est prévue dans un PI qui finit avant le début de « ${p.titre} » (${fmtDate(b[0])}).`);
      if (b[1] && ps > b[1]) out.push(`« ${titre} » est prévue dans un PI qui commence après la fin de « ${p.titre} » (${fmtDate(b[1])}).`);
      continue;
    }
    const a = period(n);
    if (!a) continue;
    if (b[0] && a[0] && a[0] < b[0]) out.push(`« ${titre} » commence avant « ${p.titre} » (début ${fmtDate(b[0])}).`);
    if (b[1] && (!a[1] || a[1] > b[1]))
      out.push(`« ${titre} » ${a[1] ? 'finit' : 'n’a pas de fin et continue'} après « ${p.titre} » (fin ${fmtDate(b[1])}).`);
  }
  return out;
}

export interface WizardOps {
  create: (level: Level, data: Record<string, string>) => Promise<string>;
  update: (level: Level, id: string, data: Record<string, string>) => Promise<void>;
  remove: (level: Level, id: string, cascade: boolean) => Promise<void>;
}

/** Enregistre le brouillon : créations et modifications du haut vers le bas, puis suppressions du bas vers le haut. */
export async function applyDraft(draft: WNode[], ops: WizardOps, onProgress?: (done: number, total: number) => void) {
  const map = mapOf(draft);
  const { creations, updates, deletions } = summarize(draft);
  const total = creations.length + updates.length + deletions.length;
  let done = 0;
  const created = new Map<string, string>();
  const idOf = (key: string) => map.get(key)?.id ?? created.get(key) ?? (key.startsWith('new:') ? '' : idOfKey(key));

  const links = (n: WNode): Record<string, string> => {
    const pk = resolveParent(n, map);
    const pl = pk ? levelOfKey(pk, map) : undefined;
    const pid = pk ? idOf(pk) : '';
    const out: Record<string, string> = {};
    for (const l of PARENT_LEVELS[n.level]) out[l] = l === pl ? pid : '';
    return out;
  };
  const dataOf = (n: WNode, isNew: boolean): Record<string, string> => {
    const f = { ...n.f };
    // Une tâche datée tire son itération de sa date
    if (n.level === 'tache' && f.date) f.iteration = '';
    if (n.level === 'feature' && f.iteration && !f.iteration.startsWith(f.pi)) f.iteration = '';
    const base: Record<string, string> = n.level === 'domaine' ? { nom: n.titre.trim() } : { titre: n.titre.trim() };
    if (!isNew) {
      delete f.couleur;
      delete f.icone;
      return { ...base, ...f, ...links(n) };
    }
    switch (n.level) {
      case 'domaine':
        return { ...base, icone: f.icone || '📦', couleur: f.couleur || EPIC_COULEURS[0] };
      case 'objectif':
        return { ...base, description: '', cible: '', actuel: '', unite: '', couleur: EPIC_COULEURS[0], ...f, ...links(n) };
      case 'epic':
        return { ...base, description: '', couleur: EPIC_COULEURS[0], ...f, ...links(n) };
      case 'feature':
        return { ...base, description: '', couleur: '', ...f, ...links(n) };
      case 'tache': {
        const t: ItemInput = {
          ...RECURRENCE_DEFAUTS,
          titre: n.titre.trim(),
          type: 'tache',
          date: f.date ?? '',
          heure: '',
          lieu: '',
          description: '',
          priorite: 'normale',
          statut: 'a_faire',
          points: f.points ?? '',
          iteration: f.iteration ?? '',
        };
        return { ...(t as unknown as Record<string, string>), ...links(n) };
      }
    }
  };

  for (const n of creations) {
    created.set(n.key, await ops.create(n.level, dataOf(n, true)));
    onProgress?.(++done, total);
  }
  for (const n of updates) {
    await ops.update(n.level, n.id!, dataOf(n, false));
    onProgress?.(++done, total);
  }
  for (const n of deletions) {
    try {
      await ops.remove(n.level, n.id!, !!n.del?.cascade);
    } catch (e) {
      // Déjà parti avec un parent supprimé : rien à faire
      if (!/introuvable|not found/i.test((e as Error).message)) throw e;
    }
    onProgress?.(++done, total);
  }
  return { created: creations.length, updated: updates.length, deleted: deletions.length };
}
