import { toDateString } from './dates';
import type { Item } from './types';

/**
 * Alertes de dates : un élément (tâche, epic) qui sort des dates de son parent (epic, objectif).
 * Rien n'est modifié automatiquement : chaque alerte propose un bouton pour ajuster le parent.
 */

/** Période d'un élément enfant ; fin 'infinie' = sans fin ; null = pas de date. */
export interface Periode {
  nom: string;
  debut: string | null;
  fin: string | 'infinie' | null;
}

export interface Alerte {
  key: string;
  message: string;
  /** Texte du bouton */
  bouton: string;
  /** Dates à appliquer au parent quand on touche le bouton */
  patch: { debut?: string; fin?: string };
}

/** Dates d'une tâche : sa date ; pour une tâche répétée, « À partir du » (sinon création) et « Jusqu'au ». */
export function periodeTache(t: Item): Periode {
  if (t.periodicite) {
    return {
      nom: t.titre,
      debut: t.debut || (t.cree_le ? toDateString(new Date(t.cree_le)) : null),
      fin: t.fin || 'infinie',
    };
  }
  return { nom: t.titre, debut: t.date || null, fin: t.date || null };
}

/** Dates d'une epic (ou d'un objectif) vue comme enfant. */
export function periodeBloc(b: { titre: string; debut: string; fin: string }): Periode {
  return { nom: b.titre, debut: b.debut || null, fin: b.fin || 'infinie' };
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
      });
    }
    if (!parent.fin || !e.fin) continue;
    if (e.fin === 'infinie') {
      out.push({
        key: `i:${e.nom}`,
        message: `« ${e.nom} » n'a pas de fin, alors que ${sujet} finit le ${fmtDate(parent.fin)}.`,
        bouton: mots.sansFin,
        patch: { fin: '' },
      });
    } else if (e.fin > parent.fin) {
      out.push({
        key: `f:${e.nom}:${e.fin}`,
        message: `« ${e.nom} » finit le ${fmtDate(e.fin)}, après ${mots.fin} de ${sujet} (${fmtDate(parent.fin)}).`,
        bouton: `Repousser ${mots.fin} au ${fmtDate(e.fin)}`,
        patch: { fin: e.fin },
      });
    }
  }
  return out;
}

/** Alertes d'une epic pour ses tâches. */
export function alertesEpic(epic: { id: string; debut: string; fin: string }, items: Item[]): Alerte[] {
  return alertes(epic, "l'epic", items.filter((i) => i.epic === epic.id).map(periodeTache));
}
