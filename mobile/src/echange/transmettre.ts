import { refPoint } from '../pointsSuivi';
import type { PointAEcrire } from '../suiviEscalade';
import { type Echange, type EchangeInput, natureDe, type PointReunion, type SousType, type TypePoint } from '../types';

/**
 * Transmettre (validation du 08/10, docs/cycles-de-vie.html) : un seul verbe pour l'ancienne escalade et la
 * transmission, vers le haut, sur le côté ou en parallèle. Chaque transmission est un **maillon** : un nouvel échange
 * par destinataire, au texte **reformulé** (le message reçu reste privé, ses pièces jointes ne suivent jamais).
 * - « Je reste dans la boucle » (défaut) : le maillon part de moi (`parent` = l'échange reçu, qui passe « transmis ») ;
 *   la réponse me revient, je l'accepte et la fais redescendre (reformulée) ou je la fais reprendre.
 * - « Je me retire » : le maillon part au nom de l'expéditeur (`transmis_par` = moi), la réponse va directement à lui ;
 *   l'échange reçu est retiré.
 * - « 📌 Suivre à <réunion> » (précoché, décochable) : une note reformulée dans ma réunion, liée au maillon (noms
 *   visibles, contenu non) ; elle passe à « Fait · réponse reçue » quand je fais redescendre la réponse.
 * Aucune note n'est créée sans ce choix. Le Chat lui-même n'est jamais suivi.
 */

export const MOTIFS_TRANSMISSION = ['Pas mon périmètre', 'Pas le droit de répondre', 'Absent', 'Autre'];

export interface Transmission {
  /** Destinataires (e-mails) : un maillon chacun, en parallèle */
  a: string[];
  /** Texte transmis, reformulé (obligatoire) */
  texte: string;
  motif: string;
  /** Je reste dans la boucle (la réponse revient par moi) */
  boucle: boolean;
  /** « 📌 Suivre à » : série (« daily-equipeagile:acmeqmob- ») et Sheet de la réunion, texte de la note (reformulé) */
  suivre?: { serie: string; espace: string; texte: string };
}

/** Type de la note de réunion d'après la nature du message */
export function typeNoteDe(e: Pick<Echange, 'nature' | 'type'>): { type: TypePoint; sous_type: SousType } {
  const n = natureDe(e);
  if (n === 'decision_a_prendre' || n === 'question') return { type: 'decision', sous_type: 'a_prendre' };
  if (n === 'decision_prise' || n === 'information') return { type: 'decision', sous_type: 'prise' };
  if (n === 'action') return { type: 'action', sous_type: '' };
  return { type: 'blocage', sous_type: '' };
}

/** Une transmission peut partir : au moins un destinataire, un texte reformulé, une note si on la suit */
export const transmissionPrete = (t: Transmission) => !!t.a.length && !!t.texte.trim() && !!t.motif && (!t.suivre || (!!t.suivre.serie && !!t.suivre.texte.trim()));

export interface PlanTransmission {
  /** Un maillon par destinataire */
  nouveaux: EchangeInput[];
  /** L'échange reçu : « transmis » (dans la boucle) ou retiré (je me retire) */
  recu: { patch: Partial<Echange> } | { retirer: true };
  /** Note de suivi, une par maillon (le même ordre que `nouveaux`), à relier après création */
  notes: PointAEcrire[];
}

export function planTransmettre(e: Echange, t: Transmission, o: { moi: string; nomDe: (email: string) => string; niveauDe: (email: string) => string; jour: string }): PlanTransmission {
  const moi = o.moi.toLowerCase();
  const reformule = t.texte.trim();
  const dests = [...new Set(t.a.map((x) => x.toLowerCase()))].filter((x) => x && x !== moi && x !== e.de);
  const nouveaux: EchangeInput[] = dests.map((a) => ({
    de: t.boucle ? moi : e.de,
    a,
    type: e.type,
    nature: natureDe(e),
    titre: reformule.slice(0, 200),
    texte: `↪ Transmis par ${o.nomDe(moi)} · ${t.motif.toLowerCase()}`,
    choix: e.choix,
    reponse: '',
    note: '',
    statut: 'envoye',
    element: e.element,
    niveau: o.niveauDe(a) || e.niveau,
    transmis_par: moi,
    prive: '1',
    pieces_jointes: '',
    point: '',
    parent: t.boucle ? e.id : '',
    espace: e.espace,
  }));
  const tn = typeNoteDe(e);
  const notes: PointAEcrire[] = t.suivre
    ? dests.map((a) => ({
        reunion: `${t.suivre!.serie}${o.jour}`,
        personne: moi,
        auteur: moi,
        type: tn.type,
        sous_type: tn.sous_type,
        texte: t.suivre!.texte.trim().slice(0, 1000),
        element: e.element,
        // Le maillon du bas d'une transmission suivie : le point attend la réponse (« Fait · réponse reçue »)
        concretisation: 'escalade',
        tache: '',
        echange: '',
        responsable: a,
        statut: 'en_cours',
        validateur: moi,
        echeance: '',
        note: '',
        espace: t.suivre!.espace,
      }))
    : [];
  return { nouveaux, recu: t.boucle ? { patch: { statut: 'transmis' } } : { retirer: true }, notes };
}

/** Relie chaque note de suivi à son maillon (note → échange, échange → note) une fois les deux créés */
export function liensSuivi(maillons: Echange[], notes: (PointReunion & { espace: string })[]): { echange: { e: Echange; patch: Partial<Echange> }; point: { espace: string; patch: Partial<PointReunion> & { id: string } } }[] {
  return notes.flatMap((p, k) => {
    const m = maillons[k];
    return m ? [{ echange: { e: m, patch: { point: refPoint(p.espace, p.id) } }, point: { espace: p.espace, patch: { id: p.id, echange: m.id, tache: m.id } } }] : [];
  });
}

/**
 * Faire redescendre une réponse (je suis dans la boucle) : l'échange reçu (le maillon d'en dessous) reçoit la réponse,
 * reformulée ; le maillon accepté est retiré ; sa note de suivi passe à « Fait » avec ce texte.
 */
export function planRedescendre(c: Echange, parent: Echange | undefined, texte: string): { parent?: { e: Echange; patch: Partial<Echange> }; retirer: Echange; point?: { ref: string; patch: Partial<PointReunion> } } {
  const t = texte.trim();
  return {
    parent: parent ? { e: parent, patch: { statut: 'repondu', reponse: c.reponse, note: t } } : undefined,
    retirer: c,
    point: c.point ? { ref: c.point, patch: { statut: 'fait', note: t } } : undefined,
  };
}

/** « ↩ À reprendre » : la réponse ne convient pas ; le maillon repart chez celui qui a répondu, avec le motif */
export const patchAReprendre = (motif: string): Partial<Echange> => ({ statut: 'envoye', reponse: '', note: `↩ À reprendre : ${motif.trim()}` });

/** Maillons transmis d'un échange (dans la boucle) */
export const maillonsDe = (e: Pick<Echange, 'id'>, tous: Echange[]) => tous.filter((x) => x.parent === e.id);
