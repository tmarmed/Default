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
  src?: { kind: 'tache' | 'epic'; id: string; repetee?: boolean; debut?: string; fin?: string };
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

/** Deuxième bouton : ramener l'élément au début (cas 'debut') ou à la fin (cas 'fin') du parent. */
function alignement(e: Periode, cas: 'debut' | 'fin', cible: string): Alignement | undefined {
  const s = e.src;
  if (!s) return undefined;
  const d = fmtDate(cible);
  const base = { kind: s.kind, id: s.id, nom: e.nom };
  if (s.kind === 'tache') {
    if (s.repetee)
      return cas === 'debut'
        ? { ...base, bouton: `Faire commencer la répétition le ${d}`, patch: { debut: cible } }
        : { ...base, bouton: `Arrêter la répétition le ${d}`, patch: { fin: cible } };
    return { ...base, bouton: `${cas === 'debut' ? 'Décaler' : 'Ramener'} la tâche au ${d}`, patch: { date: cible } };
  }
  // Epic : on garde fin ≥ début
  if (cas === 'debut')
    return { ...base, bouton: `Faire commencer l'epic le ${d}`, patch: { debut: cible, ...(s.fin && s.fin < cible ? { fin: cible } : {}) } };
  return {
    ...base,
    bouton: s.fin ? `Faire finir l'epic le ${d}` : `Donner une fin à l'epic : ${d}`,
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
  return { nom: t.titre, debut: t.date || null, fin: t.date || null, src: { kind: 'tache', id: t.id } };
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
 * Alertes d'un parent (epic : « l'epic » ; objectif : « l'objectif ») pour ses enfants.
 * Un parent sans fin contient tout pour la fin ; un parent sans début ne déclenche rien pour le début.
 */
export function alertes(
  parent: { debut: string; fin: string },
  /** « l'epic » ou « l'objectif » */
  sujet: string,
  enfants: Periode[],
  mots: { fin: string; sansFin: string } = { fin: 'la fin', sansFin: "Rendre l'epic sans fin" },
): Alerte[] {
  const out: Alerte[] = [];
  for (const e of enfants) {
    if (e.debut && parent.debut && e.debut < parent.debut) {
      out.push({
        key: `d:${e.nom}:${e.debut}`,
        message: `« ${e.nom} » commence le ${fmtDate(e.debut)}, avant le début de ${sujet} (${fmtDate(parent.debut)}).`,
        bouton: `Avancer le début au ${fmtDate(e.debut)}`,
        patch: { debut: e.debut },
        aligner: alignement(e, 'debut', parent.debut),
      });
    }
    if (!parent.fin || !e.fin) continue;
    if (e.fin === 'infinie') {
      out.push({
        key: `i:${e.nom}`,
        message: `« ${e.nom} » n'a pas de fin, alors que ${sujet} finit le ${fmtDate(parent.fin)}.`,
        bouton: mots.sansFin,
        patch: { fin: '' },
        aligner: alignement(e, 'fin', parent.fin),
      });
    } else if (e.fin > parent.fin) {
      out.push({
        key: `f:${e.nom}:${e.fin}`,
        message: `« ${e.nom} » finit le ${fmtDate(e.fin)}, après ${mots.fin} de ${sujet} (${fmtDate(parent.fin)}).`,
        bouton: `Repousser ${mots.fin} au ${fmtDate(e.fin)}`,
        patch: { fin: e.fin },
        aligner: alignement(e, 'fin', parent.fin),
      });
    }
  }
  return out;
}

/** Alertes d'une epic pour ses tâches. */
export function alertesEpic(epic: { id: string; debut: string; fin: string }, items: Item[], features: Feature[] = []): Alerte[] {
  return alertes(epic, "l'epic", tasksOfEpic(epic.id, items, features).map(periodeTache));
}

/** Alertes d'un objectif pour ses epics et ses tâches directes. */
export function alertesObjectif(
  o: { id: string; debut: string; fin: string },
  epics: { id?: string; titre: string; debut: string; fin: string; objectif: string }[],
  items: Item[],
): Alerte[] {
  return alertes(
    o,
    "l'objectif",
    [
      ...epics.filter((e) => e.objectif === o.id).map(periodeBloc),
      ...items.filter((t) => t.objectif === o.id).map(periodeTache),
    ],
    { fin: "l'échéance", sansFin: "Rendre l'objectif permanent" },
  );
}
