import { iterationOf, pointsOf } from './pi';
import type { Epic, Feature, Item, ItemInput } from './types';
import { RECURRENCE_DEFAUTS } from './types';

/**
 * Bruit, retouche, réimputation (lot 8 du 16/10, docs/regles-reunions.html bloc 17 : B1, B2, M1). Rien ici
 * n'appelle Google : l'application crée ce que ces fonctions décrivent, en une écriture.
 */

/** Nature d'un élément créé par l'application : « bruit » (travail perdu) ou « retouche » (travail refait) */
export type NatureItem = '' | 'bruit' | 'retouche';
export const CAUSES_BRUIT = ['Besoin abandonné', 'Doublon', 'Mal compris', 'Priorité changée', 'Autre'];
export const CAUSES_RETOUCHE = ['Refusée à la revue', 'Bug trouvé', 'Critère oublié', 'Régression', 'Autre'];
export const CAUSES_REIMPUTATION = ['Erreur de rattachement', 'Maintenance (TMA)', 'Changement de projet', 'Autre'];
/** « Besoin abandonné — le client a changé d'avis » */
export const texteCause = (cause: string, commentaire: string) => [cause, commentaire.trim()].filter(Boolean).join(' — ');
export const estBruit = (t: Pick<Item, 'nature'>) => t.nature === 'bruit';
/** B2 · Retouche : sous-tâche « 🔧 Retouche », ou tout Bug */
export const estRetouche = (t: Pick<Item, 'nature' | 'type'>) => t.nature === 'retouche' || t.type === 'bug';
/** B1 · Travail commencé (en attendant le CRA : en cours ou terminé) */
export const estCommence = (t: Pick<Item, 'statut'>) => t.statut === 'en_cours' || t.statut === 'termine';

type Base = Pick<Item, 'equipe' | 'espace'>;
const vide = (x: Partial<ItemInput>): ItemInput =>
  ({ ...RECURRENCE_DEFAUTS, titre: '', type: 'tache', date: '', heure: '', lieu: '', description: '', priorite: 'normale', statut: 'a_faire', epic: '', objectif: '', domaine: '', points: '', iteration: '', feature: '', telephone: '', parent: '', heure_fin: '', date_fin: '', ...x }) as ItemInput;

/**
 * B1 · Bruit d'un élément commencé puis supprimé, déplacé ou abandonné : une tâche « 🧹 Bruit » sous le parent le plus
 * proche (feature, sinon epic), sinon orpheline par équipe et par sprint ; une sous-tâche par élément, cause
 * obligatoire, points = jours ÷ jours par point. `parentExistant` : la tâche 🧹 Bruit déjà là (sinon à créer).
 */
export function planBruit(
  t: Pick<Item, 'titre' | 'feature' | 'epic' | 'parent' | 'equipe' | 'espace' | 'responsable'>,
  items: Item[],
  o: { jours: number; joursParPoint: number; cause: string; commentaire: string; aujourdhui: string; quoi: 'supprimé' | 'déplacé' | 'abandonné' },
): { parentExistant?: Item; parent: ItemInput; sous: Omit<ItemInput, 'parent'> } {
  if (!o.cause) throw new Error('Bruit : la cause est obligatoire.');
  const p = t.parent ? items.find((x) => x.id === t.parent) : undefined;
  const feature = t.feature || p?.feature || '';
  const epic = feature ? '' : t.epic || p?.epic || '';
  const sprint = iterationOf(o.aujourdhui).key;
  const equipe = t.equipe || p?.equipe || '';
  const existant = items.find((x) => estBruit(x) && !x.parent && (feature ? x.feature === feature : epic ? x.epic === epic && !x.feature : !x.feature && !x.epic && x.equipe === equipe && x.iteration === sprint));
  const parent = vide({ titre: '🧹 Bruit', nature: 'bruit', statut: 'termine', feature, epic, equipe, iteration: feature || epic ? '' : sprint, espace: t.espace, description: 'Travail commencé puis supprimé, déplacé ou abandonné (calculé par l’application).' });
  const points = o.joursParPoint > 0 ? +(o.jours / o.joursParPoint).toFixed(1) : o.jours;
  const sous = vide({ titre: `🧹 ${t.titre} (${o.quoi})`.slice(0, 200), nature: 'bruit', cause: texteCause(o.cause, o.commentaire), statut: 'termine', points: points > 0 ? String(points) : '', feature, epic, equipe, iteration: sprint, responsable: t.responsable ?? '', espace: t.espace, description: `${o.jours} j passés avant d’être ${o.quoi} le ${o.aujourdhui}.` });
  return { parentExistant: existant, parent, sous };
}

/**
 * B2 · Retouche d'une story terminée (réouverture, refus) : la story reste terminée dans son sprint (vélocité gardée) ;
 * une sous-tâche « 🔧 Retouche » avec son estimation et sa cause, planifiée où l'on veut (`iteration` : sprint en
 * cours, suivant, '' = plus tard)
 */
export function planRetouche(story: Pick<Item, 'id' | 'titre' | 'feature' | 'epic' | 'equipe' | 'espace' | 'responsable'>, o: { estimation: string; cause: string; commentaire: string; iteration: string }): ItemInput {
  if (!o.cause) throw new Error('Retouche : la cause est obligatoire.');
  return vide({ titre: `🔧 Retouche · ${story.titre}`.slice(0, 200), nature: 'retouche', cause: texteCause(o.cause, o.commentaire), parent: story.id, feature: story.feature, epic: story.epic, equipe: story.equipe, espace: story.espace, responsable: story.responsable ?? '', points: o.estimation, iteration: o.iteration });
}

/**
 * M1 · Qui paie un élément : la valeur choisie (« Payé par »), sinon la règle automatique : retouche ou bug sur une epic
 * en cours → l'epic ; epic terminée ou pas d'epic → l'enveloppe TMA (maintenance) du train ; sinon l'epic de l'élément
 */
export function payePar(
  t: Pick<Item, 'paye_par' | 'nature' | 'type' | 'epic' | 'feature' | 'parent' | 'equipe'>,
  o: { items: Pick<Item, 'id' | 'epic' | 'feature'>[]; features: Pick<Feature, 'id' | 'epic' | 'train'>[]; epics: Pick<Epic, 'id' | 'etat'>[]; trainDe: (equipe: string) => string },
): { valeur: string; auto: boolean } {
  if (t.paye_par) return { valeur: t.paye_par, auto: false };
  const p = t.parent ? o.items.find((x) => x.id === t.parent) : undefined;
  const feature = o.features.find((f) => f.id === (t.feature || p?.feature));
  const epic = t.epic || p?.epic || feature?.epic || '';
  const etat = o.epics.find((e) => e.id === epic)?.etat;
  if (estRetouche(t) && (!epic || etat === 'termine')) {
    const train = feature?.train || o.trainDe(t.equipe ?? '');
    return { valeur: train ? `tma:${train}` : '', auto: true };
  }
  return { valeur: epic ? `epic:${epic}` : '', auto: true };
}
/** « Epic Nouveau CRM », « TMA du train Clients » */
export const libellePayePar = (v: string, nom: (kind: 'epic' | 'train', id: string) => string) =>
  v.startsWith('epic:') ? `Epic ${nom('epic', v.slice(5))}` : v.startsWith('tma:') ? `TMA du train ${nom('train', v.slice(4))}` : 'Aucun';
/** M1 · Trace datée d'une réimputation, ajoutée à l'historique (« 16/10 · Nina Dupont : Epic A → TMA · raison ») */
export const traceReimputation = (avant: string, apres: string, par: string, jour: string, raison: string, ancienne = '') =>
  [ancienne, `${jour} · ${par} : ${avant} → ${apres} · ${raison}`].filter(Boolean).join(' ¶ ').slice(-1000);

/** Points d'un ensemble (bruit, retouche) */
export const pointsDe = (l: Item[]) => +l.reduce((n, t) => n + pointsOf(t), 0).toFixed(1);
