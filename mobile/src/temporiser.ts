import { addDays, toDateString } from './dates';
import { jourMois } from './format';
import { type Niveau, niveauSuperieur, personneParEmail } from './echange/hierarchieEchange';
import { responsablesNiveau } from './liens';
import type { OrgValue } from './organisation';
import { estOuvre } from './series';
import { lireTransverses } from './transverses';

/**
 * ⏰ Temporiser et absences (lot 5 du 16/10, docs/regles-reunions.html bloc 16 : T1, Q4, tableau « ⏰ Temporiser ») :
 * pièce commune du Chat, des réunions et du Point perso. Un élément temporisé porte une date (`rappel_le`) : il sort
 * de mes listes et revient ce jour-là, « ⏰ prévu aujourd'hui », en haut. Rien ici n'appelle Google.
 */

export type DelaiRappel = 'demain' | 'jours' | 'reunion' | 'date';
const parse = (j: string) => new Date(Number(j.slice(0, 4)), Number(j.slice(5, 7)) - 1, Number(j.slice(8, 10)));
/** Jour ouvré suivant (ou le même s'il l'est déjà) */
function ouvreDes(j: string): string {
  let d = j;
  for (let i = 0; i < 15 && !estOuvre(d); i++) d = toDateString(addDays(parse(d), 1));
  return d;
}

/** T1 · Date du rappel : demain (jour ouvré), dans X jours, la prochaine réunion, une date */
export function dateRappel(delai: DelaiRappel, o: { jour: string; jours?: number; prochaineReunion?: string; date?: string }): string {
  if (delai === 'demain') return ouvreDes(toDateString(addDays(parse(o.jour), 1)));
  if (delai === 'jours') return ouvreDes(toDateString(addDays(parse(o.jour), Math.max(1, o.jours ?? 1))));
  if (delai === 'reunion') return o.prochaineReunion && o.prochaineReunion > o.jour ? o.prochaineReunion : ouvreDes(toDateString(addDays(parse(o.jour), 1)));
  return o.date && /^\d{4}-\d{2}-\d{2}$/.test(o.date) && o.date > o.jour ? o.date : ouvreDes(toDateString(addDays(parse(o.jour), 1)));
}

/** Temporisé (il sort de mes listes jusqu'à sa date) */
export const estTemporise = (x: { rappel_le?: string }, jour: string) => !!x.rappel_le && x.rappel_le > jour;
/** Revenu (le jour venu ou après) : affiché « ⏰ prévu aujourd'hui », en haut */
export const estRevenu = (x: { rappel_le?: string }, jour: string) => !!x.rappel_le && x.rappel_le <= jour;
/** « ⏰ prévu aujourd'hui » ou « ⏰ À traiter le 18/10 » */
export const libelleRappel = (x: { rappel_le?: string }, jour: string) => (!x.rappel_le ? '' : x.rappel_le <= jour ? '⏰ prévu aujourd’hui' : `⏰ À traiter le ${jourMois(x.rappel_le)}`);
/** Revenus d'abord, dans l'ordre d'origine ensuite */
export const revenusEnHaut = <T extends { rappel_le?: string }>(l: T[], jour: string) => [...l.filter((x) => estRevenu(x, jour)), ...l.filter((x) => !estRevenu(x, jour))];

/**
 * Q4 · À qui l'élément arrive aussi quand celui qui reçoit est absent : son suppléant (rôle transverse en cours),
 * sinon l'autre responsable du niveau ; au portfolio et à la direction (un seul responsable) : son suppléant, sinon le
 * responsable du dessus. '' s'il n'est pas absent, ou si personne d'autre. Renvoie un e-mail.
 */
export function remplacantDe(email: string, n: Niveau | null, org: OrgValue, jour: string, absent: (email: string) => boolean): string {
  if (!absent(email)) return '';
  const pid = personneParEmail(email, org)?.id ?? '';
  const mail = (id: string) => org.personne.get(id)?.email?.toLowerCase() ?? '';
  const present = (id: string) => !!id && id !== pid && !!mail(id) && !absent(mail(id));
  const entites = [...org.equipes, ...org.trains, ...org.portfolios, ...org.unites] as { transverses?: string }[];
  const suppleant = entites
    .flatMap((x) => lireTransverses(x.transverses))
    .find((t) => t.role === 'suppleant' && t.remplace === pid && (!t.du || t.du <= jour) && (!t.au || t.au >= jour) && present(t.personne));
  if (suppleant) return mail(suppleant.personne);
  const autre = responsablesNiveau(n, org).tous.find(present);
  if (autre) return mail(autre);
  const sup = niveauSuperieur(n, org);
  return sup && present(sup.responsable) ? mail(sup.responsable) : '';
}
