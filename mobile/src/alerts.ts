import { toDateString } from './dates';
import { tasksOfEpic } from './hierarchy';
import type { Feature, Item } from './types';

/**
 * Alertes de dates : un élément (tâche, epic) qui sort des dates de son parent (epic, objectif).
 * Rien n'est modifié automatiquement : chaque alerte propose deux boutons, ajuster le parent
 * ou aligner l'élément sur les dates du parent.
 */

/** Période d'un élément enfant ; fin 'infinie' = sans fin ; null = pas de date. */
export interface Periode {
  nom: string;
  debut: string | null;
  fin: string | 'infinie' | null;
  /** Élément d'origine, pour pouvoir l'aligner sur son parent */
  src?: { kind: 'tache' | 'epic'; id: string; repetee?: boolean; sous?: boolean; debut?: string; fin?: string };
}

/** Deuxième solution : modifier l'élément plutôt que le parent. */
export interface Alignement {
  kind: 'tache' | 'epic';
  id: string;
  nom: string;
  bouton: string;
  patch: Record<string, string>;
}

export interface Alerte {
  key: string;
  message: string;
  /** Texte du bouton */
  bouton: string;
  /** Dates à appliquer au parent quand on touche le bouton */
  patch: { debut?: string; fin?: string };
  /** Aligner l'élément sur le parent (absent si l'élément n'est pas connu) */
  aligner?: Alignement;
}

/** Nom court (boutons) */
const court = (t: string) => (t.length > 28 ? `${t.slice(0, 27).trimEnd()}…` : t);
const maj = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** « la tâche », « la sous-tâche », « la tâche répétée » ou « l'epic » */
function motEnfant(e: Periode): string {
  const s = e.src;
  if (s?.kind === 'epic') return "l'epic";
  if (s?.repetee) return 'la tâche répétée';
  if (s?.sous) return 'la sous-tâche';
  return 'la tâche';
}

/** Deuxième bouton : ramener l'élément au début (cas 'debut') ou à la fin (cas 'fin') du parent. */
function alignement(e: Periode, cas: 'debut' | 'fin', cible: string): Alignement | undefined {
  const s = e.src;
  if (!s) return undefined;
  const d = fmtDate(cible);
  const qui = `${motEnfant(e)} « ${court(e.nom)} »`;
  const base = { kind: s.kind, id: s.id, nom: e.nom };
  if (s.kind === 'tache') {
    if (s.repetee)
      return cas === 'debut'
        ? { ...base, bouton: `Faire commencer ${qui} le ${d}`, patch: { debut: cible } }
        : { ...base, bouton: `Arrêter ${qui} le ${d}`, patch: { fin: cible } };
    return { ...base, bouton: `${cas === 'debut' ? 'Décaler' : 'Ramener'} ${qui} au ${d}`, patch: { date: cible } };
  }
  // Epic : on garde fin ≥ début
  if (cas === 'debut')
    return { ...base, bouton: `Faire commencer ${qui} le ${d}`, patch: { debut: cible, ...(s.fin && s.fin < cible ? { fin: cible } : {}) } };
  return {
    ...base,
    bouton: s.fin ? `Faire finir ${qui} le ${d}` : `Donner une fin à ${qui} : ${d}`,
    patch: { fin: cible, ...(s.debut && s.debut > cible ? { debut: cible } : {}) },
  };
}

/** Dates d'une tâche : sa date ; pour une tâche répétée, « À partir du » (sinon création) et « Jusqu'au ». */
export function periodeTache(t: Item): Periode {
  if (t.periodicite) {
    return {
      nom: t.titre,
      debut: t.debut || (t.cree_le ? toDateString(new Date(t.cree_le)) : null),
      fin: t.fin || 'infinie',
      src: { kind: 'tache', id: t.id, repetee: true },
    };
  }
  return { nom: t.titre, debut: t.date || null, fin: t.date || null, src: { kind: 'tache', id: t.id, sous: !!t.parent } };
}

/** Dates d'une epic (ou d'un objectif) vue comme enfant. */
export function periodeBloc(b: { id?: string; titre: string; debut: string; fin: string }): Periode {
  return {
    nom: b.titre,
    debut: b.debut || null,
    fin: b.fin || 'infinie',
    src: b.id ? { kind: 'epic', id: b.id, debut: b.debut, fin: b.fin } : undefined,
  };
}

const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
export const fmtDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return `${d === 1 ? '1er' : d} ${MOIS[m - 1]} ${y}`;
};

/**
 * Alertes d'un parent (epic ou objectif) pour ses enfants. Messages et boutons nomment toujours
 * l'élément en cause (la tâche, la sous-tâche, la tâche répétée, l'epic) et le parent (l'epic, l'objectif).
 * Un parent sans fin contient tout pour la fin ; un parent sans début ne déclenche rien pour le début.
 */
export function alertes(parent: { titre?: string; debut: string; fin: string }, kind: 'epic' | 'objectif', enfants: Periode[]): Alerte[] {
  const mot = kind === 'epic' ? "l'epic" : "l'objectif";
  const P = parent.titre ? `${mot} « ${parent.titre} »` : mot;
  const Pc = parent.titre ? `${mot} « ${court(parent.titre)} »` : mot;
  const finMot = kind === 'epic' ? 'la fin' : "l'échéance";
  const out: Alerte[] = [];
  for (const e of enfants) {
    const E = maj(`${motEnfant(e)} « ${e.nom} »`);
    if (e.debut && parent.debut && e.debut < parent.debut) {
      out.push({
        key: `d:${e.nom}:${e.debut}`,
        message: `${E} commence le ${fmtDate(e.debut)}, avant le début de ${P} (${fmtDate(parent.debut)}).`,
        bouton: `Avancer le début de ${Pc} au ${fmtDate(e.debut)}`,
        patch: { debut: e.debut },
        aligner: alignement(e, 'debut', parent.debut),
      });
    }
    if (!parent.fin || !e.fin) continue;
    if (e.fin === 'infinie') {
      out.push({
        key: `i:${e.nom}`,
        message: `${E} n'a pas de fin, alors que ${P} finit le ${fmtDate(parent.fin)}.`,
        bouton: kind === 'epic' ? `Rendre ${Pc} sans fin` : `Rendre ${Pc} permanent`,
        patch: { fin: '' },
        aligner: alignement(e, 'fin', parent.fin),
      });
    } else if (e.fin > parent.fin) {
      out.push({
        key: `f:${e.nom}:${e.fin}`,
        message: `${E} finit le ${fmtDate(e.fin)}, après ${finMot} de ${P} (${fmtDate(parent.fin)}).`,
        bouton: `Repousser ${finMot} de ${Pc} au ${fmtDate(e.fin)}`,
        patch: { fin: e.fin },
        aligner: alignement(e, 'fin', parent.fin),
      });
    }
  }
  return out;
}

/** Alertes d'une epic pour ses tâches. */
export function alertesEpic(epic: { id: string; titre?: string; debut: string; fin: string }, items: Item[], features: Feature[] = []): Alerte[] {
  return alertes(epic, 'epic', tasksOfEpic(epic.id, items, features).map(periodeTache));
}

/** Alertes d'un objectif pour ses epics et ses tâches directes. */
export function alertesObjectif(
  o: { id: string; titre?: string; debut: string; fin: string },
  epics: { id?: string; titre: string; debut: string; fin: string; objectif: string }[],
  items: Item[],
): Alerte[] {
  return alertes(o, 'objectif', [
    ...epics.filter((e) => e.objectif === o.id).map(periodeBloc),
    ...items.filter((t) => t.objectif === o.id).map(periodeTache),
  ]);
}
