import { toDateString } from './dates';
import type { Epic, Item } from './types';

/**
 * Règles d'ajustement des dates d'une epic par ses tâches :
 * - l'epic ne s'agrandit que si une tâche en sort, elle ne rétrécit jamais toute seule ;
 * - début avancé si une tâche commence avant ;
 * - fin repoussée si une tâche finit après ; une epic sans fin est infinie et le reste ;
 * - une tâche répétée sans date de fin rend l'epic infinie (fin vide).
 */

/** Début d'une tâche : sa date, ou pour une tâche répétée son « À partir du » (sinon sa création). */
function taskStart(t: Item): string | null {
  if (t.periodicite) return t.debut || (t.cree_le ? toDateString(new Date(t.cree_le)) : null);
  return t.date || null;
}

/** Fin d'une tâche : sa date, ou pour une tâche répétée son « Jusqu'au » ; 'infinie' si répétée sans fin. */
function taskEnd(t: Item): string | 'infinie' | null {
  if (t.periodicite) return t.fin || 'infinie';
  return t.date || null;
}

export interface Ajustement {
  debut: string;
  fin: string;
  /** Explications à afficher, vides si rien n'a changé */
  messages: string[];
}

const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const fmt = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return `${d === 1 ? '1er' : d} ${MOIS[m - 1]} ${y}`;
};

/** Dates de l'epic après prise en compte de ses tâches. */
export function ajusterEpic(epic: Pick<Epic, 'titre' | 'debut' | 'fin'>, tasks: Item[]): Ajustement {
  let debut = epic.debut;
  let fin = epic.fin;
  let debutPar: Item | null = null;
  let finPar: Item | null = null;
  let infiniePar: Item | null = null;

  for (const t of tasks) {
    const s = taskStart(t);
    if (s && s < debut) {
      debut = s;
      debutPar = t;
    }
    const e = taskEnd(t);
    if (e === 'infinie') infiniePar ??= t;
    else if (fin && e && e > fin) {
      fin = e;
      finPar = t;
    }
  }

  const messages: string[] = [];
  if (debutPar) messages.push(`Début de l'epic « ${epic.titre} » avancé au ${fmt(debut)} (${debutPar.titre}).`);
  if (epic.fin && infiniePar) {
    fin = '';
    messages.push(`L'epic « ${epic.titre} » devient sans fin : « ${infiniePar.titre} » se répète sans date de fin.`);
  } else if (finPar) {
    messages.push(`Fin de l'epic « ${epic.titre} » repoussée au ${fmt(fin)} (${finPar.titre}).`);
  }
  return { debut, fin, messages };
}
