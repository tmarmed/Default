import { jourMois } from './format';
import { type Item, type PointReunion, type Reunion, TYPES_REUNION } from './types';

/**
 * Règles des notes (lot 1 du 16/10, docs/regles-reunions.html bloc 16 : N1-N3, V1-V4, D1). Pièce commune du Daily,
 * des réunions d'équipe (base.tsx), du Point perso et du Suivi : rien ici n'appelle Google.
 */

// ---- N3 · Une note concerne un ou plusieurs éléments de mon équipe ----
/** Éléments concernés par une note : le premier (`element`, lu partout) puis les autres (`elements`) */
export function elementsDe(p: Pick<PointReunion, 'element'> & { elements?: string }): string[] {
  const vus = new Set<string>();
  return [p.element, ...(p.elements ?? '').split(',')].map((x) => (x ?? '').trim()).filter((x) => !!x && !vus.has(x) && !!vus.add(x));
}
/** Champs d'une note pour une liste d'éléments (le premier reste `element`) */
export const avecElements = (ids: string[]) => {
  const l = elementsDe({ element: ids[0] ?? '', elements: ids.slice(1).join(',') });
  return { element: l[0] ?? '', elements: l.slice(1).join(',') };
};

// ---- V1-V4 · Perso ou à partager ----
/** Note ou suivi « 🔒 Perso » : visible par son auteur seul (rangé dans son espace 🔒 Moi) */
export const estPerso = (p: { perso?: string }) => p.perso === '1';

/** Ce qu'il faut savoir des éléments pour repérer un impact sur l'équipe */
export interface CtxImpact {
  /** Vous (e-mail) */
  moi: string;
  items: Pick<Item, 'id' | 'titre' | 'responsable' | 'iteration' | 'type'>[];
  /** Sprint de la réunion (clé d'itération) : un élément de ce sprint touche le planning */
  sprint: string;
  /** E-mail d'un responsable (id de l'Organisation) */
  emailDe: (id: string) => string;
  nomDe: (email: string) => string;
}
/** Types de note qui, sur un élément du sprint, touchent le planning de l'équipe */
const TYPES_PLANNING = new Set(['blocage', 'risque', 'dependance']);

/**
 * V2 · Impact d'une note sur l'équipe (repéré quand l'application le peut) : « touche le travail de Sara Martin »,
 * « touche le planning du sprint » ; '' = rien repéré (« 🔒 Perso » possible)
 */
export function impactNote(n: { type: string; element: string; elements?: string }, c: CtxImpact): string {
  const moi = c.moi.toLowerCase();
  for (const id of elementsDe(n)) {
    const t = c.items.find((x) => x.id === id);
    if (!t) continue;
    const resp = t.responsable ? c.emailDe(t.responsable).toLowerCase() : '';
    if (resp && resp !== moi) return `touche le travail de ${c.nomDe(resp)} (« ${t.titre} »)`;
    if (TYPES_PLANNING.has(n.type) && !!c.sprint && t.iteration === c.sprint) return `touche le planning du sprint (« ${t.titre} »)`;
  }
  return '';
}

/**
 * N2 · Impact d'une concrétisation : ce qui touche le périmètre du sprint, le planning, le travail d'un autre ou un
 * autre niveau rend le point de suivi obligatoire (confirmé par le Scrum Master) ; '' = organisation perso, suivi
 * facultatif. Une sous-tâche pour moi reste perso (sa somme face à l'estimation de la story : lot 3).
 */
export function impactConcretisation(
  ch: { que: string; type: string; resp: string; qui?: string; transmis?: boolean; ratt: string },
  note: { type: string; element: string; elements?: string },
  c: CtxImpact,
): string {
  if (ch.que === 'rien' || ch.que === 'budget') return '';
  if (ch.transmis || ch.qui === 'dessus') return 'part vers une autre équipe ou le niveau du dessus';
  const resp = ch.resp.toLowerCase();
  if (resp && resp !== c.moi.toLowerCase()) return `touche le travail de ${c.nomDe(resp)}`;
  const sousTache = ch.type === 'tache' && c.items.some((x) => x.id === ch.ratt && x.type === 'story');
  if (ch.que === 'creer' && ch.type !== 'reunion' && !sousTache) return 'touche le périmètre de l’équipe (nouvel élément)';
  return impactNote(note, c);
}
/** Phrase affichée quand le suivi est imposé */
export const texteSuiviImpose = (raison: string) => `Suivi obligatoire : ${raison}. Confirmé par le Scrum Master.`;

// ---- N1 · En préparation ----
/** Libellé d'une réunion d'après son id (« Daily du 15/10 ») */
export function libelleReunionId(id: string): string {
  const type = id.split('-')[0] as keyof typeof TYPES_REUNION;
  return `${TYPES_REUNION[type]?.libelle ?? 'Réunion'} du ${jourMois(id.slice(-10))}`;
}
/**
 * N1 · Rappel 🟡 d'une note restée « En préparation » : écrite pour une réunion de la série déjà passée (une seule
 * réunion d'attente : on le dit dès la réunion suivante) ; '' sinon
 */
export function rappelPreparation(noteReunion: string, reunionId: string): string {
  const serie = reunionId.slice(0, -10);
  if (!noteReunion.startsWith(serie) || noteReunion >= reunionId) return '';
  return `🟡 Pas encore partagée · écrite pour « ${libelleReunionId(noteReunion)} »`;
}
/** Une note perso ou en préparation est-elle une vraie note (pas une ligne technique, ni Hier / Aujourd'hui) ? */
export const estNote = (p: Pick<PointReunion, 'type'>) => !['etat', 'vote', 'donnee', 'hier', 'aujourdhui'].includes(p.type);

// ---- D1 · Déplacer ----
const SEP = ' ¶ ';
/** Historique d'un point (le plus ancien d'abord) */
export const lignesHistorique = (h?: string) => (h ? h.split(SEP).filter(Boolean) : []);
export const ajouterHistorique = (h: string | undefined, ligne: string) => [...lignesHistorique(h), ligne].join(SEP).slice(-1000);

/** Réunion où l'on peut déplacer un point : la prochaine de chaque série */
export interface CibleDeplacement {
  value: string;
  label: string;
  reunion: Reunion;
}
/**
 * D1 · Réunions où déplacer un point : parmi les miennes (à venir), une par série (la prochaine), pas celle d'ici, dans
 * le même espace, et où le responsable du point participe
 */
export function reunionsCibles(reunions: Reunion[], ici: Pick<Reunion, 'id' | 'espace'>, aujourdhui: string, participe: (r: Reunion) => boolean, niveau: (r: Reunion) => string = () => ''): CibleDeplacement[] {
  const serieIci = ici.id.slice(0, -10);
  const vues = new Set<string>([serieIci]);
  return [...reunions]
    .sort((a, b) => a.debut.localeCompare(b.debut))
    .filter((r) => {
      const serie = r.id.slice(0, -10);
      if (vues.has(serie) || r.debut.slice(0, 10) < aujourdhui || (r.espace || 'moi') !== (ici.espace || 'moi') || !participe(r)) return false;
      vues.add(serie);
      return true;
    })
    .map((r) => ({ value: r.id, label: [r.titre || TYPES_REUNION[r.type]?.libelle || 'Réunion', niveau(r), jourMois(r.debut.slice(0, 10))].filter(Boolean).join(' · '), reunion: r }));
}
/** D1 · Changement d'un point déplacé : seulement sa réunion et son historique (responsable, validation, échéance, statut inchangés) */
export function deplacement(pt: Pick<PointReunion, 'id' | 'reunion' | 'historique'>, cible: Pick<Reunion, 'id'>, par: string): Pick<PointReunion, 'id' | 'reunion' | 'historique'> {
  return { id: pt.id, reunion: cible.id, historique: ajouterHistorique(pt.historique, `Déplacé depuis « ${libelleReunionId(pt.reunion)} » par ${par}`) };
}
/** V3 · Partager une note perso : elle part dans la réunion de l'équipe avec son historique */
export const lignePartage = (par: string, jour: string) => `Note perso de ${par}, partagée le ${jourMois(jour)}`;
