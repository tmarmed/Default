/**
 * Mises en forme communes (14/10, refactoring lot 1) : dates, montants, pluriels, noms de personne. Une seule version
 * de chaque ; les anciens noms (dateCourte, jourCourt, euros…) restent dans leurs fichiers et pointent ici.
 */
import type { OrgValue } from './organisation';

const JOURS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/** « 13/10 » (AAAA-MM-JJ) ; '' si vide */
export const jourMois = (j: string) => (j ? `${Number(j.slice(8, 10))}/${j.slice(5, 7)}` : '');
/** « 13/10/2026 » ; '' si vide */
export const jourMoisAn = (j: string) => (j ? `${Number(j.slice(8, 10))}/${j.slice(5, 7)}/${j.slice(0, 4)}` : '');
/** « 03/10/2026 » (jour sur deux chiffres) ; '' si vide */
export const dateFr = (j: string) => (j ? `${j.slice(8, 10)}/${j.slice(5, 7)}/${j.slice(0, 4)}` : '');
/** « jeu. 8 oct. » (« 1er » le premier du mois) */
export function jourSemaine(j: string): string {
  const [y, m, d] = j.split('-').map(Number);
  const x = new Date(y, m - 1, d);
  return `${JOURS[x.getDay()]} ${d === 1 ? '1er' : d} ${MOIS[m - 1]}`;
}
/** « jeu. 8/10 » */
export function jourSemaineChiffres(j: string): string {
  const d = new Date(`${j}T12:00`);
  return `${JOURS[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
}

/** Espaces fines insécables de toLocaleString remplacées par des espaces simples */
const espaces = (s: string) => s.replace(/ | /g, ' ');
/** « 12 500 € » (arrondi à l'euro) */
export const euros = (n: number) => `${espaces(Math.round(n).toLocaleString('fr-FR'))} €`;
/** « 13 k€ » au-delà de 10 000 €, sinon « 9 500 € » */
export const eurosCourt = (n: number) => (Math.abs(n) >= 10000 ? `${espaces(Math.round(n / 1000).toLocaleString('fr-FR'))} k€` : euros(n));
/** Montant saisi (texte) : « 12 500 € » ; `siInvalide` si le texte n'est pas un nombre */
export function eurosTexte(s: string, siInvalide = ''): string {
  const n = Number(String(s).replace(',', '.').replace(/\s/g, ''));
  return s !== '' && Number.isFinite(n) ? `${n.toLocaleString('fr-FR')} €` : siInvalide;
}

/** « 3 stories », « 1 story » (pluriel en « s ») */
export const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

/** Nom d'une personne d'après son identifiant ou son adresse ; sinon le début de l'adresse */
export function nomPersonne(org: Pick<OrgValue, 'personnes'>, idOuMail: string): string {
  const x = idOuMail.toLowerCase();
  const p = org.personnes.find((y) => y.id === idOuMail || (!!y.email && y.email.toLowerCase() === x));
  return p?.nom ?? idOuMail.split('@')[0];
}
